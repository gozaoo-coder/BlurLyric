import { NotificationCenter } from '../core/NotificationCenter.js';

class LegacyAdapter {
    #center;

    constructor(center) {
        this.#center = center;
    }

    register(message) {
        return this.#center.registerMessage(message);
    }

    destroy(timestamp) {
        return this.#center.destroyMessage(timestamp);
    }

    getAll() {
        return this.#center.getAllMessages();
    }
}

export function createLegacyAdapter(notificationCenter) {
    return new LegacyAdapter(notificationCenter);
}
