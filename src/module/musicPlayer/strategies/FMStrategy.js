import { AbstractStrategy } from './index.js';

/**
 * FMStrategy - FM/智能推荐歌单策略
 *
 * 当播放到歌单末尾附近时，自动调用 growthMethod 补充新曲目。
 * 适用于私人FM、智能推荐等场景。
 *
 * @example
 * const strategy = new FMStrategy({
 *   growthMethod: async () => {
 *     const track = await api.fetchRecommended();
 *     return track;
 *   },
 *   triggerThreshold: 3,  // 剩余3首时触发
 * });
 */
class FMStrategy extends AbstractStrategy {
    #growthMethod;
    #triggerThreshold;
    #growing = false;

    /**
     * @param {Object} options
     * @param {Function} options.growthMethod 增长方法，返回 Track | Track[] | Promise<Track | Track[]>
     * @param {number} [options.triggerThreshold=3] 触发阈值（剩余多少首时触发）
     */
    constructor(options = {}) {
        super('fm', options);
        this.#growthMethod = options.growthMethod || (async () => []);
        this.#triggerThreshold = options.triggerThreshold ?? 3;
    }

    shouldGrow(playlist, currentIndex, playMode) {
        if (this.#growing) return false;
        if (!Array.isArray(playlist) || playlist.length === 0) return false;

        const remaining = playlist.length - currentIndex - 1;
        return remaining <= this.#triggerThreshold;
    }

    async fetchNext(playlist) {
        if (this.#growing) return [];
        this.#growing = true;

        try {
            const result = await this.#growthMethod();
            if (result == null) return [];
            const tracks = Array.isArray(result) ? result : [result];
            return tracks;
        } catch (e) {
            console.error('[FMStrategy] fetchNext error:', e);
            return [];
        } finally {
            this.#growing = false;
        }
    }

    reset() {
        this.#growing = false;
    }
}

export { FMStrategy };
