/**
 * NotificationEventBus - 通知模块事件总线
 */

export const NotificationEvents = {
    NOTIFICATION_SHOW: 'notification:show',
    NOTIFICATION_HIDE: 'notification:hide',
    NOTIFICATION_UPDATE: 'notification:update',
    DIALOG_CONFIRM: 'dialog:confirm',
    DIALOG_CANCEL: 'dialog:cancel',
    TOAST_DISMISS: 'toast:dismiss',
    SNACKBAR_ACTION: 'snackbar:action',
    POPUP_TOGGLE: 'popup:toggle'
};

export class NotificationCenterEventBus {
    #listeners = new Map();

    on(event, callback, context = null) {
        if (typeof callback !== 'function') {
            console.warn(`[NotificationCenterEventBus] on() requires a function callback`);
            return this;
        }
        if (!this.#listeners.has(event)) this.#listeners.set(event, []);
        this.#listeners.get(event).push({ callback, context });
        return this;
    }

    off(event, callback) {
        if (!this.#listeners.has(event)) return this;
        const list = this.#listeners.get(event);
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].callback === callback || list[i].callback._original === callback) {
                list.splice(i, 1);
            }
        }
        if (list.length === 0) this.#listeners.delete(event);
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
                console.error(`[NotificationCenterEventBus] Error in "${event}" handler:`, error);
            }
        }
    }

    clear(event) {
        if (event) this.#listeners.delete(event);
        else this.#listeners.clear();
    }

    clearEvent(event) {
        this.clear(event);
    }

    listenerCount(event) {
        return this.#listeners.has(event) ? this.#listeners.get(event).length : 0;
    }

    hasListeners(event) {
        return this.#listeners.has(event) && this.#listeners.get(event).length > 0;
    }

    eventNames() {
        return Array.from(this.#listeners.keys());
    }
}

export const notificationEventBus = new NotificationCenterEventBus();
