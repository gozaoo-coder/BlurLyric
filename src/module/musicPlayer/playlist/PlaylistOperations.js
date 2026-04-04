import { PlayerEvents } from '../events/PlayerEvents';

class PlaylistOperations {
    #tracks = [];
    #eventBus = null;
    #currentIndex = 0;

    constructor(eventBus = null) {
        this.#eventBus = eventBus;
    }

    setEventBus(bus) {
        this.#eventBus = bus;
    }

    replace(tracks, startIndex = 0) {
        this.#tracks = Array.isArray(tracks) ? [...tracks] : [];
        this.#currentIndex = Math.max(0, Math.min(startIndex, this.#tracks.length - 1));
        this.#emit(PlayerEvents.PLAYLIST_REPLACE, { tracks: this.getAll(), index: this.#currentIndex });
    }

    push(track) {
        if (!track) return;
        this.#tracks.push(track);
        this.#emit(PlayerEvents.PLAYLIST_PUSH, { track, index: this.#tracks.length - 1 });
    }

    pushBatch(tracks) {
        if (!Array.isArray(tracks) || tracks.length === 0) return;
        const startIdx = this.#tracks.length;
        this.#tracks.push(...tracks);
        this.#emit(PlayerEvents.PLAYLIST_PUSH, { tracks, startIndex: startIdx });
    }

    remove(index) {
        if (index < 0 || index >= this.#tracks.length) return null;
        const removed = this.#tracks.splice(index, 1)[0];
        if (this.#currentIndex >= this.#tracks.length && this.#tracks.length > 0) {
            this.#currentIndex = this.#tracks.length - 1;
        }
        this.#emit(PlayerEvents.PLAYLIST_REMOVE, { track: removed, index });
        return removed;
    }

    clear() {
        this.#tracks = [];
        this.#currentIndex = 0;
        this.#emit(PlayerEvents.PLAYLIST_CLEAR);
    }

    insert(track, index) {
        if (!track) return;
        const safeIndex = Math.max(0, Math.min(index, this.#tracks.length));
        this.#tracks.splice(safeIndex, 0, track);
        if (safeIndex <= this.#currentIndex) {
            this.#currentIndex++;
        }
    }

    move(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.#tracks.length) return;
        if (toIndex < 0 || toIndex >= this.#tracks.length) return;
        if (fromIndex === toIndex) return;
        const [item] = this.#tracks.splice(fromIndex, 1);
        this.#tracks.splice(toIndex, 0, item);
        if (fromIndex === this.#currentIndex) {
            this.#currentIndex = toIndex;
        } else if (fromIndex < this.#currentIndex && toIndex >= this.#currentIndex) {
            this.#currentIndex--;
        } else if (fromIndex > this.#currentIndex && toIndex <= this.#currentIndex) {
            this.#currentIndex++;
        }
    }

    get currentIndex() {
        return this.#currentIndex;
    }

    set currentIndex(idx) {
        this.#currentIndex = Math.max(0, Math.min(idx, this.#tracks.length - 1));
    }

    get current() {
        return this.#tracks[this.#currentIndex] ?? null;
    }

    getAll() {
        return [...this.#tracks];
    }

    get length() {
        return this.#tracks.length;
    }

    get isEmpty() {
        return this.#tracks.length === 0;
    }

    get(index) {
        if (index < 0 || index >= this.#tracks.length) return null;
        return this.#tracks[index];
    }

    indexOf(predicate) {
        if (typeof predicate === 'function') {
            return this.#tracks.findIndex(predicate);
        }
        return this.#tracks.indexOf(predicate);
    }

    #emit(event, data) {
        if (this.#eventBus) {
            this.#eventBus.emit(event, data);
        }
    }
}

class PlaylistManager extends PlaylistOperations {
    constructor(eventBus = null) {
        super(eventBus);
    }
}

export { PlaylistOperations, PlaylistManager };
