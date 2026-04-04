import { PlaylistOperations } from './PlaylistOperations';
import { PlayerEvents } from '../events/PlayerEvents';

class SmartPlaylist extends PlaylistOperations {
    #growFunction;
    #minBufferCount;
    #isLoading = false;
    #hasMore = true;

    constructor(options = {}) {
        super(options.eventBus ?? null);

        if (typeof options.growFunction !== 'function') {
            throw new Error('SmartPlaylist requires a growFunction option');
        }
        this.#growFunction = options.growFunction;
        this.#minBufferCount = options.minBufferCount ?? 5;
        this.#hasMore = options.hasMore ?? true;
    }

    async checkAndGrow() {
        if (!this.#hasMore || this.#isLoading) return;

        if (this.length < this.#minBufferCount) {
            await this.#doGrow();
        } else if (this.currentIndex >= this.length - Math.ceil(this.#minBufferCount / 2)) {
            await this.#doGrow();
        }
    }

    async #doGrow() {
        this.#isLoading = true;
        try {
            const result = await this.#growFunction();
            if (result === null || result === undefined) {
                this.#hasMore = false;
                return;
            }
            if (Array.isArray(result)) {
                if (result.length === 0) {
                    this.#hasMore = false;
                    return;
                }
                this.pushBatch(result);
            } else {
                this.push(result);
            }
        } catch (error) {
            console.error('[SmartPlaylist] growFunction error:', error);
            this.emit(PlayerEvents.ERROR, { error, context: 'smartPlaylistGrow' });
        } finally {
            this.#isLoading = false;
        }
    }

    getCurrentOrGrow(currentIndex) {
        const track = this.get(currentIndex);
        if (!track || currentIndex >= this.length - 2) {
            this.checkAndGrow();
        }
        return track;
    }

    get isLoading() {
        return this.#isLoading;
    }

    get hasMore() {
        return this.#hasMore;
    }

    reset(growFunction) {
        if (typeof growFunction === 'function') {
            this.#growFunction = growFunction;
        }
        this.#hasMore = true;
        this.#isLoading = false;
    }
}

export { SmartPlaylist };
