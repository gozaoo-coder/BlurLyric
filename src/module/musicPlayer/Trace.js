/**
 * Trace - 来源追踪信息（前端实现）
 *
 * 符合 docs/05-接口规范.md 第 5.5 节定义
 *
 * 设计原则：
 * 1. 不硬编码任何具体音乐平台名称
 * 2. 通过 sourceId 标识用户配置的数据源
 * 3. 通过 baseUrl 作为 API 源配置
 */
class Trace {
    #data;

    constructor(traceData) {
        this.#data = {
            sourceType: traceData.sourceType || { type: 'storage', storage: 'local' },
            sourceId: traceData.sourceId || 'local',
            sourceName: traceData.sourceName || '本地音乐库',
            dataType: traceData.dataType || 'track',
            dataId: traceData.dataId || '',
            dataUrl: traceData.dataUrl || null,
            baseUrl: traceData.baseUrl || null,
            fetchMethod: traceData.fetchMethod || { type: 'LocalFile', path: '' },
            resourceInfo: traceData.resourceInfo || null,
            metadata: traceData.metadata || {},
        };
    }

    // ========== 基本属性 ==========

    get sourceType() { return this.#data.sourceType; }
    get sourceId() { return this.#data.sourceId; }
    get sourceName() { return this.#data.sourceName; }
    get dataType() { return this.#data.dataType; }
    get dataId() { return this.#data.dataId; }
    get dataUrl() { return this.#data.dataUrl; }
    get baseUrl() { return this.#data.baseUrl; }
    get fetchMethod() { return this.#data.fetchMethod; }
    get resourceInfo() { return this.#data.resourceInfo; }
    get metadata() { return this.#data.metadata; }

    // ========== 类型检查 ==========

    isStorage() {
        return this.#data.sourceType?.type === 'storage';
    }

    isApi() {
        return this.#data.sourceType?.type === 'api';
    }

    isLocal() {
        return this.#data.sourceType?.storage === 'local';
    }

    isWebDAV() {
        return this.#data.sourceType?.storage === 'webdav';
    }

    // ========== 资源获取 ==========

    /**
     * 获取资源（根据 Trace 类型）
     * - track: 获取音频文件
     * - album: 获取专辑封面
     * - artist: 获取艺人头像
     *
     * @param {Object} [apiAdapter] - 外部 API 适配器（如 TauriSource）
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async fetchResource(apiAdapter) {
        const method = this.#data.fetchMethod;
        switch (method.type) {
            case 'LocalFile':
                if (apiAdapter && apiAdapter.getMusicFile) {
                    return await apiAdapter.getMusicFile(this.#data.dataId);
                }
                // fallback: use dataId as song ID
                if (apiAdapter && typeof apiAdapter.getMusicFile === 'function') {
                    return await apiAdapter.getMusicFile(this.#data.dataId);
                }
                throw new Error('LocalFile fetch requires apiAdapter with getMusicFile');
            case 'Download':
                // Download from URL - requires backend support
                if (method.url) {
                    const response = await fetch(method.url);
                    const blob = await response.blob();
                    const objectURL = URL.createObjectURL(blob);
                    return {
                        objectURL,
                        destroyObjectURL: () => URL.revokeObjectURL(objectURL)
                    };
                }
                throw new Error('Download fetch requires url in fetchMethod');
            case 'ApiCall':
                throw new Error('ApiCall fetch not yet implemented, use apiAdapter instead');
            default:
                throw new Error(`Unknown fetch method: ${method.type}`);
        }
    }

    /**
     * 获取歌词
     * @param {Object} apiAdapter
     * @returns {Promise<string>}
     */
    async fetchLyric(apiAdapter) {
        if (apiAdapter && typeof apiAdapter.getLyric === 'function') {
            return await apiAdapter.getLyric(this.#data.dataId);
        }
        return '';
    }

    /**
     * 跳转到来源数据
     * 根据 sourceId 和 dataId 精准跳转
     */
    async navigateToSource() {
        const { sourceManager } = await import('../../api/source/index.js');
        const source = sourceManager.getSource(this.sourceId);

        if (!source) {
            throw new Error(`Source not found: ${this.sourceId}`);
        }

        switch (this.#data.dataType) {
            case 'track':
                return await source.getTrackDetail(this.dataId);
            case 'artist':
                return await source.getArtistDetail(this.dataId);
            case 'album':
                return await source.getAlbumDetail(this.dataId);
            case 'playlist':
                return await source.getPlaylistDetail(this.dataId);
            default:
                throw new Error(`Unknown data type: ${this.#data.dataType}`);
        }
    }

    toRaw() {
        return { ...this.#data };
    }

    static fromRaw(data) {
        return new Trace(data);
    }

    /**
     * 创建本地文件 Trace
     */
    static createLocalFile(path, dataType = 'track', dataId = '') {
        return new Trace({
            sourceType: { type: 'storage', storage: 'local' },
            sourceId: 'local',
            sourceName: '本地音乐库',
            dataType,
            baseUrl: null,
            dataId,
            dataUrl: null,
            fetchMethod: { type: 'LocalFile', path },
            resourceInfo: null,
            metadata: {},
        });
    }

    /**
     * 创建 API 来源 Trace
     */
    static createApiSource(sourceId, sourceName, baseUrl, dataType = 'track', dataId = '', fetchMethod = { type: 'Download', url: '' }) {
        return new Trace({
            sourceType: { type: 'api' },
            sourceId,
            sourceName,
            dataType,
            baseUrl,
            dataId,
            dataUrl: null,
            fetchMethod,
            resourceInfo: null,
            metadata: {},
        });
    }
}

export { Trace };
