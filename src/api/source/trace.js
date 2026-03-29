/**
 * Trace - 来源追踪信息（前端）
 * 
 * 设计原则：
 * 1. 不硬编码任何具体音乐平台名称
 * 2. 通过 sourceId 标识用户配置的数据源
 * 3. 通过 baseUrl 作为 API 源配置
 * 4. 符合接口规范即可接入
 * 
 * ==================== 资源获取流程 ====================
 * 
 * Trace.fetchResource() 实现统一的资源获取流程：
 * 1. 检查是否为本地资源（直接返回）
 * 2. 检查缓存是否存在（返回缓存）
 * 3. 根据 fetchMethod 类型获取远程资源
 * 4. 将资源存入缓存
 * 5. 返回 ObjectURL
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 数据类型枚举
 * @readonly
 * @enum {string}
 */
export const TraceDataType = {
    TRACK: 'Track',
    ARTIST: 'Artist',
    ALBUM: 'Album',
    PLAYLIST: 'Playlist'
};

/**
 * 存储类型枚举
 * @readonly
 * @enum {string}
 */
export const StorageType = {
    LOCAL: 'Local',
    WEBDAV: 'WebDAV'
};

/**
 * 来源类型枚举
 * @readonly
 * @enum {string}
 */
export const SourceType = {
    STORAGE: 'Storage',
    API: 'Api'
};

/**
 * 获取方法类型枚举
 * @readonly
 * @enum {string}
 */
export const FetchMethodType = {
    LOCAL_FILE: 'LocalFile',
    DOWNLOAD: 'Download',
    STREAM: 'Stream',
    API_CALL: 'ApiCall'
};

/**
 * Trace - 来源追踪信息
 */
export class Trace {
    #data;

    /**
     * @param {Object} traceData - Trace 数据
     * @param {Object} traceData.sourceType - 来源类型 { type: 'Storage'|'Api', storage?: 'Local'|'WebDAV' }
     * @param {string} traceData.sourceId - 来源唯一标识
     * @param {string} traceData.sourceName - 来源显示名称
     * @param {string} traceData.dataType - 数据类型
     * @param {string} traceData.dataId - 数据 ID
     * @param {string} [traceData.baseUrl] - API 基础 URL
     * @param {string} [traceData.dataUrl] - 数据 URL
     * @param {Object} traceData.fetchMethod - 获取方法
     * @param {Object} [traceData.resourceInfo] - 资源信息
     * @param {Object} [traceData.metadata] - 扩展元数据
     */
    constructor(traceData) {
        this.#data = traceData;
    }

    // ========== 基本属性 ==========

    /** @returns {Object} 来源类型 */
    get sourceType() { return this.#data.sourceType; }

    /** @returns {string} 来源 ID */
    get sourceId() { return this.#data.sourceId; }

    /** @returns {string} 来源名称 */
    get sourceName() { return this.#data.sourceName; }

    /** @returns {string} 数据类型 */
    get dataType() { return this.#data.dataType; }

    /** @returns {string} 数据 ID */
    get dataId() { return this.#data.dataId; }

    /** @returns {string|null} API 基础 URL */
    get baseUrl() { return this.#data.baseUrl; }

    /** @returns {string|null} 数据 URL */
    get dataUrl() { return this.#data.dataUrl; }

    /** @returns {Object} 获取方法 */
    get fetchMethod() { return this.#data.fetchMethod; }

    /** @returns {Object|null} 资源信息 */
    get resourceInfo() { return this.#data.resourceInfo; }

    /** @returns {Object} 扩展元数据 */
    get metadata() { return this.#data.metadata || {}; }

    // ========== 类型检查 ==========

    /**
     * 是否为存储型来源
     * @returns {boolean}
     */
    isStorage() {
        return this.#data.sourceType?.type === SourceType.STORAGE;
    }

    /**
     * 是否为 API 型来源
     * @returns {boolean}
     */
    isApi() {
        return this.#data.sourceType?.type === SourceType.API;
    }

    /**
     * 是否为本地文件
     * @returns {boolean}
     */
    isLocal() {
        return this.isStorage() && this.#data.sourceType?.storage === StorageType.LOCAL;
    }

    /**
     * 是否为 WebDAV
     * @returns {boolean}
     */
    isWebDAV() {
        return this.isStorage() && this.#data.sourceType?.storage === StorageType.WEBDAV;
    }

    // ========== 资源获取 ==========

    /**
     * 获取资源（统一入口，支持缓存）
     * 自动处理缓存检查、下载和存储
     * 
     * @param {Object} options - 选项
     * @param {boolean} [options.useCache=true] - 是否使用缓存
     * @param {boolean} [options.forceDownload=false] - 是否强制重新下载
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function, fromCache: boolean}>}
     */
    async fetchResource(options = {}) {
        const { useCache = true, forceDownload = false } = options;
        const method = this.#data.fetchMethod;

        // 1. 本地文件直接获取
        if (method.type === FetchMethodType.LOCAL_FILE) {
            return await this.fetchLocalFile(method.params.path);
        }

        // 2. 流式资源直接返回 URL
        if (method.type === FetchMethodType.STREAM) {
            return {
                objectURL: method.params.url,
                destroyObjectURL: () => { },
                fromCache: false
            };
        }

        // 3. 检查缓存（如果启用）
        if (useCache && !forceDownload) {
            const cachedResult = await this.#tryGetFromCache();
            if (cachedResult) {
                return cachedResult;
            }
        }

        // 4. 从远程获取资源
        let result;
        switch (method.type) {
            case FetchMethodType.DOWNLOAD:
                result = await this.downloadResource(method.params.url, method.params.format);
                break;
            case FetchMethodType.API_CALL:
                result = await this.fetchViaApi(method.params.endpoint, method.params.params);
                break;
            default:
                throw new Error(`Unknown fetch method: ${method.type}`);
        }

        // 5. 存入缓存（如果启用）
        if (useCache && result.data) {
            await this.#storeInCache(result.data, result.format || 'mp3');
        }

        return {
            objectURL: result.objectURL,
            destroyObjectURL: result.destroyObjectURL,
            fromCache: false
        };
    }

    /**
     * 尝试从缓存获取资源
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function, fromCache: boolean}|null>}
     */
    async #tryGetFromCache() {
        try {
            const cachedPath = await invoke('get_cached_resource_path', {
                trace: this.toRaw()
            });

            if (cachedPath) {
                const result = await invoke('read_cached_file', { path: cachedPath });
                const blob = new Blob([result]);
                const objectURL = URL.createObjectURL(blob);

                return {
                    objectURL,
                    destroyObjectURL: () => URL.revokeObjectURL(objectURL),
                    fromCache: true
                };
            }
        } catch (error) {
            console.warn('Failed to get cached resource:', error);
        }

        return null;
    }

    /**
     * 将资源存入缓存
     * @param {ArrayBuffer} data - 资源数据
     * @param {string} format - 资源格式
     */
    async #storeInCache(data, format) {
        try {
            const dataArray = Array.from(new Uint8Array(data));
            await invoke('cache_resource', {
                trace: this.toRaw(),
                data: dataArray,
                format
            });
        } catch (error) {
            console.warn('Failed to cache resource:', error);
        }
    }

    /**
     * 获取本地文件
     * @param {string} path - 文件路径
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async fetchLocalFile(path) {
        // 通过后端读取本地文件
        const result = await invoke('get_music_file', { songId: parseInt(this.dataId) });
        const blob = new Blob([result]);
        const objectURL = URL.createObjectURL(blob);
        return {
            objectURL,
            destroyObjectURL: () => URL.revokeObjectURL(objectURL)
        };
    }

    /**
     * 下载网络资源
     * @param {string} url - 资源 URL
     * @param {string} format - 格式
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function, data: ArrayBuffer, format: string}>}
     */
    async downloadResource(url, format) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer]);
        const objectURL = URL.createObjectURL(blob);
        return {
            objectURL,
            destroyObjectURL: () => URL.revokeObjectURL(objectURL),
            data: arrayBuffer,
            format: format || 'mp3'
        };
    }

    /**
     * 通过 API 获取资源
     * @param {string} endpoint - API 端点
     * @param {Object} params - 参数
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function, data: ArrayBuffer, format: string}>}
     */
    async fetchViaApi(endpoint, params) {
        const url = new URL(endpoint, this.baseUrl);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer]);
        const objectURL = URL.createObjectURL(blob);
        return {
            objectURL,
            destroyObjectURL: () => URL.revokeObjectURL(objectURL),
            data: arrayBuffer,
            format: params.format || 'mp3'
        };
    }

    /**
     * 跳转到来源数据
     * 根据 sourceId 和 dataId 精准跳转
     * @returns {Promise<Object>}
     */
    async navigateToSource() {
        const { sourceManager } = await import('./index.js');
        const source = sourceManager.getSource(this.sourceId);

        if (!source) {
            throw new Error(`Source not found: ${this.sourceId}`);
        }

        switch (this.#data.dataType) {
            case TraceDataType.TRACK:
                return await source.getTrackDetail(this.dataId);
            case TraceDataType.ARTIST:
                return await source.getArtistDetail(this.dataId);
            case TraceDataType.ALBUM:
                return await source.getAlbumDetail(this.dataId);
            case TraceDataType.PLAYLIST:
                return await source.getPlaylistDetail(this.dataId);
            default:
                throw new Error(`Unknown data type: ${this.#data.dataType}`);
        }
    }

    /**
     * 转换为原始数据
     * @returns {Object}
     */
    toRaw() {
        return { ...this.#data };
    }

    /**
     * 从原始数据创建 Trace
     * @param {Object} data - 原始数据
     * @returns {Trace}
     */
    static fromRaw(data) {
        return new Trace(data);
    }

    /**
     * 创建本地文件 Trace
     * @param {string} path - 文件路径
     * @param {string} dataType - 数据类型
     * @param {string} dataId - 数据 ID
     * @returns {Trace}
     */
    static createLocalFile(path, dataType, dataId) {
        return new Trace({
            sourceType: { type: SourceType.STORAGE, storage: StorageType.LOCAL },
            sourceId: 'local',
            sourceName: '本地音乐库',
            dataType,
            baseUrl: null,
            dataId,
            dataUrl: null,
            fetchMethod: { type: FetchMethodType.LOCAL_FILE, params: { path } },
            resourceInfo: null,
            metadata: {}
        });
    }

    /**
     * 创建 WebDAV Trace
     * @param {string} sourceId - 来源 ID
     * @param {string} sourceName - 来源名称
     * @param {string} dataType - 数据类型
     * @param {string} dataId - 数据 ID
     * @param {string} path - 文件路径
     * @returns {Trace}
     */
    static createWebDAV(sourceId, sourceName, dataType, dataId, path) {
        return new Trace({
            sourceType: { type: SourceType.STORAGE, storage: StorageType.WEBDAV },
            sourceId,
            sourceName,
            dataType,
            baseUrl: null,
            dataId,
            dataUrl: path,
            fetchMethod: { type: FetchMethodType.LOCAL_FILE, params: { path: '' } },
            resourceInfo: null,
            metadata: {}
        });
    }

    /**
     * 创建 API 来源 Trace
     * @param {string} sourceId - 来源 ID
     * @param {string} sourceName - 来源名称
     * @param {string} baseUrl - API 基础 URL
     * @param {string} dataType - 数据类型
     * @param {string} dataId - 数据 ID
     * @param {Object} fetchMethod - 获取方法
     * @returns {Trace}
     */
    static createApiSource(sourceId, sourceName, baseUrl, dataType, dataId, fetchMethod) {
        return new Trace({
            sourceType: { type: SourceType.API },
            sourceId,
            sourceName,
            dataType,
            baseUrl,
            dataId,
            dataUrl: null,
            fetchMethod,
            resourceInfo: null,
            metadata: {}
        });
    }
}

export default Trace;
