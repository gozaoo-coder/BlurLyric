/**
 * PlayerEventEmitter - 播放器事件系统
 * 实现模块与视图层的完全解耦
 */
class PlayerEventEmitter {
    #listeners = new Map();

    /**
     * 注册事件监听
     * @param {string} event 事件名
     * @param {Function} callback 回调
     * @returns {Function} 取消监听的函数
     */
    on(event, callback) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    /**
     * 移除事件监听
     */
    off(event, callback) {
        const callbacks = this.#listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.#listeners.delete(event);
            }
        }
    }

    /**
     * 触发事件
     */
    emit(event, ...args) {
        const callbacks = this.#listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(...args);
                } catch (e) {
                    console.error(`[PlayerEventEmitter] Error in ${event} handler:`, e);
                }
            });
        }
    }

    /**
     * 一次性监听
     */
    once(event, callback) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            callback(...args);
        };
        this.on(event, wrapper);
    }

    /**
     * 移除所有监听
     * @param {string} [event] 不传则移除全部
     */
    removeAllListeners(event) {
        if (event) {
            this.#listeners.delete(event);
        } else {
            this.#listeners.clear();
        }
    }

    /**
     * 指定事件的监听器数量
     */
    listenerCount(event) {
        return this.#listeners.get(event)?.size ?? 0;
    }
}

export { PlayerEventEmitter };
