import { Trace } from './Trace.js';

/**
 * TraceResolver - Trace 资源解析器
 *
 * 职责：
 * 1. 根据 Track 的 traces 信息获取音频资源 URL
 * 2. 对接现有 lazyLoader / api adapter
 * 3. 统一资源获取接口
 */
class TraceResolver {
    #apiAdapter;

    /**
     * @param {Object} apiAdapter 外部 API 适配器（如 sourceManager.getSource('本地音乐库')）
     */
    constructor(apiAdapter = null) {
        this.#apiAdapter = apiAdapter;
    }

    /**
     * 设置 API 适配器
     */
    setApiAdapter(adapter) {
        this.#apiAdapter = adapter;
    }

    /**
     * 获取 API 适配器
     */
    get apiAdapter() { return this.#apiAdapter; }

    /**
     * 解析 Track 的主 Trace -> 音频文件 ObjectURL
     * @param {Object} track Track 实例或原始 track 对象
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async resolveMusicFile(track) {
        const trace = this.#getPrimaryTrace(track);
        if (trace) {
            try {
                return await trace.fetchResource(this.#apiAdapter);
            } catch (e) {
                console.warn('[TraceResolver] Trace fetchResource failed, fallback:', e);
            }
        }

        // 回退：通过 apiAdapter.getMusicFile()
        const trackId = track?.id || track?.data?.id;
        if (trackId && this.#apiAdapter?.getMusicFile) {
            try {
                return await this.#apiAdapter.getMusicFile(trackId);
            } catch (e2) {
                throw new Error(`Failed to resolve music file for ${trackId}: ${e2.message}`);
            }
        }

        throw new Error('No available trace or apiAdapter to resolve music file');
    }

    /**
     * 解析专辑封面
     * @param {string|number} albumId 专辑 ID
     * @param {number} [resolution=368]
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async resolveAlbumCover(albumId, resolution = 368) {
        if (albumId == null || albumId === -2) {
            return { objectURL: '', destroyObjectURL: () => {} };
        }

        if (this.#apiAdapter?.getAlbumCover) {
            try {
                return await this.#apiAdapter.getAlbumCover(albumId, resolution);
            } catch (e) {
                console.warn('[TraceResolver] getAlbumCover failed:', e);
            }
        }

        return { objectURL: '', destroyObjectURL: () => {} };
    }

    /**
     * 获取 Track 的主 Trace
     * @param {Object} track
     * @returns {Trace|null}
     */
    #getPrimaryTrace(track) {
        if (!track) return null;

        // Track 实例有 traces 数组（需包装为 Trace 实例）
        if (Array.isArray(track.traces) && track.traces.length > 0) {
            const raw = track.traces[track.primaryTraceIndex ?? 0] ?? track.traces[0];
            return raw instanceof Trace ? raw : Trace.fromRaw(raw);
        }

        // Track 私有 #data 模式（需包装为 Trace 实例）
        if (Array.isArray(track._traces) && track._traces.length > 0) {
            const raw = track._traces[0];
            return raw instanceof Trace ? raw : Trace.fromRaw(raw);
        }

        // 从 tra Items 的 raw data 构建
        if (track.traceItems || track.sources) {
            const items = track.traceItems || track.sources;
            if (items.length > 0) {
                const item = items[track.primarySourceIndex ?? 0] ?? items[0];
                if (item.trace instanceof Trace) return item.trace;
                if (item.trace) return Trace.fromRaw(item.trace);
            }
        }

        return null;
    }
}

export { TraceResolver };
