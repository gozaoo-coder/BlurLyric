/**
 * Trace - 来源追踪信息（前端）
 * 
 * 设计原则：
 * 1. 不硬编码任何具体音乐平台名称
 * 2. 通过 sourceId 标识用户配置的数据源
 * 3. 通过 baseUrl 作为 API 源配置
 * 4. 符合接口规范即可接入
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
     * 获取资源（根据 Trace 类型）
     * - Track: 获取音频文件
     * - Album: 获取专辑封面
     * - Artist: 获取艺人头像
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async fetchResource() {
        const method = this.#data.fetchMethod;

        switch (method.type) {
            case FetchMethodType.LOCAL_FILE:
                return await this.fetchLocalFile(method.params.path);
            case FetchMethodType.DOWNLOAD:
                return await this.downloadResource(method.params.url, method.params.format);
            case FetchMethodType.API_CALL:
                return await this.fetchViaApi(method.params.endpoint, method.params.params);
            case FetchMethodType.STREAM:
                // 流式播放直接返回 URL
                return {
                    objectURL: method.params.url,
                    destroyObjectURL: () => { }
                };
            default:
                throw new Error(`Unknown fetch method: ${method.type}`);
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
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async downloadResource(url, format) {
        const response = await fetch(url);
        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);
        return {
            objectURL,
            destroyObjectURL: () => URL.revokeObjectURL(objectURL)
        };
    }

    /**
     * 通过 API 获取资源
     * @param {string} endpoint - API 端点
     * @param {Object} params - 参数
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async fetchViaApi(endpoint, params) {
        const url = new URL(endpoint, this.baseUrl);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);
        return {
            objectURL,
            destroyObjectURL: () => URL.revokeObjectURL(objectURL)
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
