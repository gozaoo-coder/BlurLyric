import { PlayerEventEmitter } from './PlayerEventEmitter.js';
import { AbstractStrategy } from './strategies/index.js';
import { FixedStrategy } from './strategies/FixedStrategy.js';

/**
 * PLAY_MODE - 播放模式枚举
 */
const PLAY_MODE = {
    LOOP_PLAYLIST: 'loopPlaylist',
    LOOP_SINGLE: 'loopSingle',
    STOP_AFTER_SINGLE: 'stopAfterSingle',
    RANDOM_PLAY: 'randomPlay',
    SMART_RECOMMEND: 'smartRecommend',
    REVERSE_LOOP: 'reverseLoop',
};

const ALL_PLAY_MODES = [
    PLAY_MODE.LOOP_PLAYLIST,
    PLAY_MODE.LOOP_SINGLE,
    PLAY_MODE.STOP_AFTER_SINGLE,
    PLAY_MODE.RANDOM_PLAY,
    PLAY_MODE.SMART_RECOMMEND,
    PLAY_MODE.REVERSE_LOOP,
];

/**
 * TrackListManager - 播放列表管理器
 *
 * 职责：
 * 1. 用户操作类：replace, push, remove, insertAt, clear, move
 * 2. 索引计算：getNextIndex / getPrevIndex（按播放模式）
 * 3. 智能策略集成：歌单末尾自动增长
 */
class TrackListManager {
    #tracks = [];
    #currentIndex = 0;
    #strategy;
    #events;

    /**
     * @param {Array} [initialTracks] 初始歌单
     * @param {AbstractStrategy} [strategy] 增长策略，默认 FixedStrategy
     * @param {PlayerEventEmitter} [events] 事件发射器
     */
    constructor(initialTracks = [], strategy = null, events = null) {
        this.#tracks = Array.isArray(initialTracks) ? [...initialTracks] : [];
        this.#currentIndex = 0;
        this.#strategy = strategy instanceof AbstractStrategy ? strategy : new FixedStrategy();
        this.#events = events;
    }

    // ========== 事件触发 ==========

    #emit(event, ...args) {
        this.#events?.emit(event, ...args);
    }

    // ========== 策略管理 ==========

    get strategy() { return this.#strategy; }

    setStrategy(strategy) {
        this.#strategy = strategy instanceof AbstractStrategy ? strategy : new FixedStrategy();
        this.#emit('strategyChange', { strategy: this.#strategy });
    }

    // ========== 用户操作 ==========

    /**
     * 替换整个歌单
     */
    replace(tracks, startIndex = 0) {
        this.#tracks = Array.isArray(tracks) ? [...tracks] : [];
        this.#currentIndex = Math.max(0, Math.min(startIndex, this.#tracks.length - 1));
        this.#emit('listReplace', { tracks: this.getAll(), index: this.#currentIndex });
        return this;
    }

    /**
     * 添加一首到末尾
     */
    push(song) {
        this.#tracks.push(song);
        this.#emit('listAdd', { track: song, index: this.#tracks.length - 1 });
        return this;
    }

    /**
     * 添加多首到末尾
     */
    pushTracks(tracks) {
        if (!Array.isArray(tracks)) return this;
        const added = [];
        for (const t of tracks) {
            this.#tracks.push(t);
            added.push(t);
        }
        if (added.length > 0) {
            this.#emit('listAddBatch', { tracks: added });
        }
        return this;
    }

    /**
     * 移除指定位置的曲目
     */
    remove(index) {
        if (index < 0 || index >= this.#tracks.length) return null;
        const removed = this.#tracks.splice(index, 1)[0];
        if (this.#currentIndex >= this.#tracks.length) {
            this.#currentIndex = Math.max(0, this.#tracks.length - 1);
        }
        this.#emit('listRemove', { track: removed, index });
        return removed;
    }

    /**
     * 在指定位置插入
     */
    insertAt(index, song) {
        const clampedIndex = Math.max(0, Math.min(index, this.#tracks.length));
        this.#tracks.splice(clampedIndex, 0, song);
        if (clampedIndex <= this.#currentIndex) {
            this.#currentIndex++;
        }
        this.#emit('listInsert', { track: song, index: clampedIndex });
        return this;
    }

    /**
     * 清空歌单
     */
    clear() {
        this.#tracks = [];
        this.#currentIndex = 0;
        this.#emit('listClear');
        this.#emit('listChange', { tracks: [], index: 0 });
        return this;
    }

    /**
     * 移动曲目位置
     */
    move(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.#tracks.length) return false;
        if (toIndex < 0 || toIndex >= this.#tracks.length) return false;
        if (fromIndex === toIndex) return false;

        const [moved] = this.#tracks.splice(fromIndex, 1);
        this.#tracks.splice(toIndex, 0, moved);

        if (this.#currentIndex === fromIndex) {
            this.#currentIndex = toIndex;
        } else if (fromIndex < this.#currentIndex && toIndex >= this.#currentIndex) {
            this.#currentIndex--;
        } else if (fromIndex > this.#currentIndex && toIndex <= this.#currentIndex) {
            this.#currentIndex++;
        }

        this.#emit('listMove', { track: moved, fromIndex, toIndex });
        return true;
    }

    /**
     * 在播放列表中"下一首播放"插入（在当前播放位置后插入）
     */
    insertNext(song) {
        return this.insertAt(this.#currentIndex + 1, song);
    }

    // ========== 索引操作 ==========

    setCurrentIndex(index) {
        if (index >= 0 && index < this.#tracks.length) {
            this.#currentIndex = index;
            this.#emit('indexChange', { index: this.#currentIndex });
        }
    }

    /**
     * 根据播放模式计算下一首索引
     * @param {string} playMode
     * @returns {number} 下一首索引
     */
    getNextIndex(playMode) {
        const len = this.#tracks.length;
        if (len === 0) return 0;

        switch (playMode) {
            case PLAY_MODE.LOOP_PLAYLIST:
                return (this.#currentIndex + 1) % len;

            case PLAY_MODE.LOOP_SINGLE:
                return this.#currentIndex;

            case PLAY_MODE.STOP_AFTER_SINGLE:
                return (this.#currentIndex + 1) % len;

            case PLAY_MODE.RANDOM_PLAY: {
                if (len <= 1) return 0;
                let randomIndex;
                do {
                    randomIndex = Math.floor(Math.random() * len);
                } while (randomIndex === this.#currentIndex);
                return randomIndex;
            }

            case PLAY_MODE.SMART_RECOMMEND:
                return (this.#currentIndex + 1) % len;

            case PLAY_MODE.REVERSE_LOOP:
                return (this.#currentIndex - 1 + len) % len;

            default:
                return 0;
        }
    }

    /**
     * 根据播放模式计算上一首索引
     */
    getPrevIndex(playMode) {
        const len = this.#tracks.length;
        if (len === 0) return 0;

        switch (playMode) {
            case PLAY_MODE.LOOP_PLAYLIST:
            case PLAY_MODE.REVERSE_LOOP:
                return (this.#currentIndex - 1 + len) % len;

            case PLAY_MODE.LOOP_SINGLE:
                return this.#currentIndex;

            case PLAY_MODE.RANDOM_PLAY: {
                if (len <= 1) return 0;
                let randomIndex;
                do {
                    randomIndex = Math.floor(Math.random() * len);
                } while (randomIndex === this.#currentIndex);
                return randomIndex;
            }

            default:
                return (this.#currentIndex - 1 + len) % len;
        }
    }

    // ========== 查询 ==========

    getCurrent() {
        return this.#tracks[this.#currentIndex] ?? null;
    }

    get(index) {
        return this.#tracks[index] ?? null;
    }

    getAll() {
        return [...this.#tracks];
    }

    get length() {
        return this.#tracks.length;
    }

    get currentIndex() {
        return this.#currentIndex;
    }

    isEmpty() {
        return this.#tracks.length === 0;
    }

    // ========== 策略触发 ==========

    /**
     * 检查并触发策略增长
     * 由 MusicPlayer 在切换曲目时调用
     * @param {string} playMode
     * @returns {Promise<boolean>} 是否有新曲目加入
     */
    async checkAndGrow(playMode) {
        if (!this.#strategy.shouldGrow(this.#tracks, this.#currentIndex, playMode)) {
            return false;
        }

        const newTracks = await this.#strategy.fetchNext(this.#tracks);
        if (!Array.isArray(newTracks) || newTracks.length === 0) return false;

        this.pushTracks(newTracks);
        return true;
    }
}

export { TrackListManager, PLAY_MODE, ALL_PLAY_MODES };
