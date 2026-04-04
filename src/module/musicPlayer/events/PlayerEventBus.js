export class PlayerEventBus {
    #listeners = new Map();

    on(event, callback, context = null) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, []);
        }
        this.#listeners.get(event).push({ callback, context });
        return this;
    }

    off(event, callback) {
        if (!this.#listeners.has(event)) return this;
        const list = this.#listeners.get(event);
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].callback === callback) {
                list.splice(i, 1);
            }
        }
        return this;
    }

    once(event, callback, context = null) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            callback.apply(context, args);
        };
        wrapper._original = callback;
        return this.on(event, wrapper, context);
    }

    emit(event, data) {
        if (!this.#listeners.has(event)) return;
        const list = [...this.#listeners.get(event)];
        for (const { callback, context } of list) {
            try {
                callback.call(context, data);
            } catch (error) {
                console.error(`[PlayerEventBus] Error in "${event}" handler:`, error);
            }
        }
    }

    clear(event) {
        if (event) {
            this.#listeners.delete(event);
        } else {
            this.#listeners.clear();
        }
    }

    listenerCount(event) {
        return this.#listeners.has(event) ? this.#listeners.get(event).length : 0;
    }
}
