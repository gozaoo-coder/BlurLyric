/**
 * TransitionManager - 切歌过渡管理器
 *
 * 内置过渡类型：
 * - immediate: 立即切换，无过渡效果
 * - crossfade: 淡入淡出（默认）
 *
 * 可通过 setTransition() 注册自定义过渡函数
 */
class TransitionManager {
    #transitions = new Map();
    #active = 'crossfade';

    constructor() {
        this.#registerDefaultTransitions();
    }

    #registerDefaultTransitions() {
        this.#transitions.set('immediate', async (oldEngine, newEngine) => {
            // 立即切换：旧引擎停止，新引擎直接播放
            if (oldEngine) oldEngine.pause();
            newEngine.setVolume(1);
            await newEngine.play();
        });

        this.#transitions.set('crossfade', async (oldEngine, newEngine, duration = 1000) => {
            if (!oldEngine || oldEngine.destroyed || oldEngine.paused) {
                // 没有旧引擎，直接播放
                newEngine.setVolume(1);
                await newEngine.play();
                return;
            }

            // 设置新引擎初始音量为低
            newEngine.setVolume(0.3);
            newEngine.play();

            const startTime = performance.now();
            const oldVolume = oldEngine.volume;

            return new Promise((resolve) => {
                const animate = () => {
                    const elapsed = performance.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    // 旧引擎渐弱
                    if (!oldEngine.destroyed) {
                        oldEngine.setVolume(oldVolume * (1 - progress));
                    }
                    // 新引擎渐强
                    if (!newEngine.destroyed) {
                        newEngine.setVolume(0.3 + 0.7 * progress);
                    }

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        // 过渡完成，清理旧引擎
                        if (!oldEngine.destroyed) {
                            oldEngine.setVolume(0);
                            oldEngine.pause();
                        }
                        if (!newEngine.destroyed) {
                            newEngine.setVolume(1);
                        }
                        resolve();
                    }
                };
                animate();
            });
        });
    }

    /**
     * 注册自定义过渡
     * @param {string} name 过渡名称
     * @param {Function} fn async (oldEngine, newEngine, ...args) => void
     */
    setTransition(name, fn) {
        if (typeof fn !== 'function') {
            throw new Error('Transition must be a function');
        }
        this.#transitions.set(name, fn);
    }

    /**
     * 设置当前使用的过渡
     */
    setActive(name) {
        if (!this.#transitions.has(name)) {
            throw new Error(`Transition "${name}" not found`);
        }
        this.#active = name;
    }

    /**
     * 获取当前过渡名称
     */
    get active() { return this.#active; }

    /**
     * 获取可用过渡名称列表
     */
    get available() { return [...this.#transitions.keys()]; }

    /**
     * 执行当前过渡
     * @param {Object} oldEngine 旧引擎实例
     * @param {Object} newEngine 新引擎实例
     * @param {...any} args 额外参数（如 duration）
     */
    async execute(oldEngine, newEngine, ...args) {
        const fn = this.#transitions.get(this.#active);
        if (!fn) {
            throw new Error(`Active transition "${this.#active}" not found`);
        }
        await fn(oldEngine, newEngine, ...args);
    }
}

export { TransitionManager };
