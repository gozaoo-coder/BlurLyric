export class AudioEngine {
    #audioElement;
    #destroyURLFn = null;
    #isActive = true;
    #eventHandlers = new Map();

    constructor() {
        this.#audioElement = document.createElement('audio');
        this.#audioElement.preload = 'auto';
    }

    get audioDom() {
        return this.#audioElement;
    }

    get src() {
        return this.#audioElement.src;
    }

    get currentTime() {
        return this.#audioElement.currentTime;
    }

    set currentTime(v) {
        this.#audioElement.currentTime = v;
    }

    get duration() {
        return this.#audioElement.duration;
    }

    get paused() {
        return this.#audioElement.paused;
    }

    get readyState() {
        return this.#audioElement.readyState;
    }

    get volume() {
        return this.#audioElement.volume;
    }

    set volume(v) {
        this.#audioElement.volume = Math.max(0, Math.min(1, v));
    }

    async loadFromTrace(trace) {
        this.cleanupURL();
        const result = await trace.fetchResource({ useCache: true });
        this.#audioElement.src = result.objectURL;
        this.#destroyURLFn = result.destroyObjectURL;
        return result;
    }

    async loadFromTauriLocal(songId) {
        this.cleanupURL();
        const { invoke } = await import('@tauri-apps/api/core');
        const response = await invoke('get_music_file', { songId });
        const blob = new Blob([response]);
        const objectURL = URL.createObjectURL(blob);
        this.#audioElement.src = objectURL;
        this.#destroyURLFn = () => URL.revokeObjectURL(objectURL);
        return { objectURL, fromCache: false };
    }

    loadFromURL(url) {
        this.cleanupURL();
        this.#audioElement.src = url;
        this.#destroyURLFn = null;
    }

    play() {
        return this.#audioElement.play();
    }

    pause() {
        this.#audioElement.pause();
    }

    on(event, handler) {
        this.#audioElement.addEventListener(event, handler);
        this.#eventHandlers.set(handler, event);
    }

    off(event, handler) {
        if (handler) {
            this.#audioElement.removeEventListener(event, handler);
            this.#eventHandlers.delete(handler);
        } else if (event) {
            for (const [h, e] of this.#eventHandlers) {
                if (e === event) {
                    this.#audioElement.removeEventListener(event, h);
                    this.#eventHandlers.delete(h);
                }
            }
        }
    }

    removeAllListeners() {
        for (const [handler, event] of this.#eventHandlers) {
            this.#audioElement.removeEventListener(event, handler);
        }
        this.#eventHandlers.clear();
    }

    cleanupURL() {
        if (this.#destroyURLFn) {
            try { this.#destroyURLFn(); } catch {}
            this.#destroyURLFn = null;
        }
    }

    destroy() {
        if (!this.#isActive) return;
        this.#isActive = false;
        this.removeAllListeners();
        this.#audioElement.pause();
        this.cleanupURL();
        this.#audioElement.removeAttribute('src');
        this.#audioElement.load();
        this.#audioElement.remove();
    }

    get isActive() {
        return this.#isActive;
    }
}
