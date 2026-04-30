/**
 * AudioEngine - 音频引擎抽象
 *
 * 默认实现 HtmlAudioEngine：（基于 HTMLAudioElement）
 * 可传入自定义引擎工厂替换
 *
 * 引擎合约：
 * {
 *   play(): Promise<void>
 *   pause(): void
 *   setSrc(url: string): void
 *   setVolume(v: number): void
 *   setCurrentTime(time: number): void
 *   destroy(): void
 *   get currentTime(): number
 *   get duration(): number
 *   get volume(): number
 *   get readyState(): number
 *   on(event, callback): void
 *   off(event, callback): void
 * }
 */

/**
 * 默认 HTMLAudioElement 引擎
 */
class HtmlAudioEngine {
    #audio;
    #destroyed = false;
    #listeners = new Map();

    constructor() {
        this.#audio = document.createElement('audio');
        this.#audio.preload = 'auto';
    }

    get #audioDom() { return this.#audio; }

    get currentTime() { return this.#audio.currentTime; }
    get duration() { return this.#audio.duration || 0; }
    get volume() { return this.#audio.volume; }
    get readyState() { return this.#audio.readyState; }
    get paused() { return this.#audio.paused; }
    get ended() { return this.#audio.ended; }
    get audioDom() { return this.#audio; }

    async play() {
        if (this.#destroyed) return;
        if (this.#audio.readyState >= 4) {
            await this.#audio.play();
        } else {
            return new Promise((resolve, reject) => {
                const canplay = () => {
                    this.#audio.removeEventListener('canplay', canplay);
                    this.#audio.play().then(resolve).catch(reject);
                };
                this.#audio.addEventListener('canplay', canplay);
            });
        }
    }

    pause() {
        if (!this.#destroyed) {
            this.#audio.pause();
        }
    }

    setSrc(url) {
        if (this.#destroyed) return;
        this.#audio.src = url;
    }

    setVolume(v) {
        if (this.#destroyed) return;
        this.#audio.volume = Math.max(0, Math.min(1, v));
    }

    setCurrentTime(time) {
        if (this.#destroyed) return;
        this.#audio.currentTime = time;
    }

    /**
     * 内部事件绑定（将 audio 原生事件映射到引擎事件）
     */
    on(event, callback) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event).add(callback);

        // 将 audio 原生事件映射到引擎事件
        const audioEvent = this.#mapToAudioEvent(event);
        if (audioEvent) {
            const wrapper = (e) => {
                if (!this.#destroyed) callback(e);
            };
            if (!this.#audio._eventWrappers) this.#audio._eventWrappers = new Map();
            this.#audio._eventWrappers.set(`${event}_${callback}`, wrapper);
            this.#audio.addEventListener(audioEvent, wrapper);
        }
    }

    off(event, callback) {
        const callbacks = this.#listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
        // 移除 audio 原生事件映射
        if (this.#audio._eventWrappers) {
            const wrapper = this.#audio._eventWrappers.get(`${event}_${callback}`);
            if (wrapper) {
                const audioEvent = this.#mapToAudioEvent(event);
                if (audioEvent) {
                    this.#audio.removeEventListener(audioEvent, wrapper);
                }
                this.#audio._eventWrappers.delete(`${event}_${callback}`);
            }
        }
    }

    /**
     * 触发内部事件
     */
    #emit(event, ...args) {
        const callbacks = this.#listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => {
                try { cb(...args); } catch (e) { console.error(`[HtmlAudioEngine] ${event} handler error:`, e); }
            });
        }
    }

    /**
     * 映射引擎事件 → audio 原生事件
     */
    #mapToAudioEvent(event) {
        const map = {
            loadeddata: 'loadeddata',
            canplay: 'canplay',
            playing: 'playing',
            pause: 'pause',
            timeupdate: 'timeupdate',
            ended: 'ended',
            error: 'error',
            waiting: 'waiting',
            seeked: 'seeked',
            volumechange: 'volumechange',
            durationchange: 'durationchange',
        };
        return map[event] || null;
    }

    /**
     * 销毁引擎
     */
    destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.#audio.pause();
        this.#audio.src = '';
        this.#audio.load();
        this.#audio.remove();
        this.#listeners.clear();
        this.#audio._eventWrappers = null;
    }

    get destroyed() { return this.#destroyed; }
}

export { HtmlAudioEngine };
