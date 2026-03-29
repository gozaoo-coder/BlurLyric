/**
 * Resource Fetcher - 统一资源获取器
 * 
 * ==================== 模块职责 ====================
 * 
 * 本模块实现统一的资源获取流程：
 * 1. 检查缓存是否存在
 * 2. 如果缓存存在，直接返回缓存路径
 * 3. 如果缓存不存在，从网络下载
 * 4. 将下载的资源存入缓存
 * 5. 返回资源 URL（ObjectURL 或本地文件路径）
 * 
 * ==================== 资源获取流程 ====================
 * 
 * 用户请求 → Trace.fetchMethod → 检查缓存 → 缓存命中？
 *   ↓ 是                  ↓ 否
 * 返回缓存资源        从网络下载 → 存入缓存 → 返回资源
 * 
 * ==================== 使用规范 ====================
 * 
 * // 获取资源（自动缓存）
 * const fetcher = new ResourceFetcher(sourceManager);
 * const result = await fetcher.fetch(trace);
 * // result: { objectURL: string, destroyObjectURL: Function, fromCache: boolean }
 * 
 * // 检查资源是否已缓存
 * const isCached = await fetcher.isCached(trace);
 * 
 * // 预加载资源（后台下载）
 * await fetcher.preload(trace);
 */

import { invoke } from '@tauri-apps/api/core';
import { Trace, FetchMethodType } from './source/trace.js';
import ResourceCache from './resourceCache.js';

/**
 * 资源获取结果
 * @typedef {Object} FetchResult
 * @property {string} objectURL - 资源的 ObjectURL 或文件路径
 * @property {Function} destroyObjectURL - 释放资源的回调函数
 * @property {boolean} fromCache - 是否来自缓存
 * @property {string} [cacheId] - 缓存 ID
 */

/**
 * ResourceFetcher - 统一资源获取器
 */
export class ResourceFetcher {
    #sourceManager;
    #pendingRequests = new Map();
    #resourceCache = ResourceCache;

    /**
     * @param {Object} sourceManager - 源管理器实例
     */
    constructor(sourceManager) {
        this.#sourceManager = sourceManager;
    }

    /**
     * 获取资源（统一入口）
     * 自动处理缓存检查、下载和存储
     * 
     * @param {Trace|Object} trace - 来源追踪信息
     * @param {Object} options - 选项
     * @param {boolean} [options.skipCache=false] - 是否跳过缓存
     * @param {boolean} [options.forceDownload=false] - 是否强制重新下载
     * @returns {Promise<FetchResult>}
     */
    async fetch(trace, options = {}) {
        const { skipCache = false, forceDownload = false } = options;
        const traceObj = trace instanceof Trace ? trace : Trace.fromRaw(trace);

        // 1. 检查是否为本地资源
        if (traceObj.isLocal()) {
            return await this.#fetchLocalResource(traceObj);
        }

        // 2. 如果跳过缓存或强制下载，直接获取资源
        if (skipCache || forceDownload) {
            return await this.#fetchRemoteResource(traceObj, true);
        }

        // 3. 检查缓存
        const cachedPath = await this.#resourceCache.getCachedPath(traceObj);
        if (cachedPath) {
            return await this.#getCachedResource(cachedPath, traceObj);
        }

        // 4. 检查是否有正在进行的请求（避免重复下载）
        const cacheKey = this.#getCacheKey(traceObj);
        if (this.#pendingRequests.has(cacheKey)) {
            return await this.#pendingRequests.get(cacheKey);
        }

        // 5. 获取远程资源并缓存
        const requestPromise = this.#fetchRemoteResource(traceObj, true);
        this.#pendingRequests.set(cacheKey, requestPromise);

        try {
            const result = await requestPromise;
            return result;
        } finally {
            this.#pendingRequests.delete(cacheKey);
        }
    }

    /**
     * 检查资源是否已缓存
     * @param {Trace|Object} trace - 来源追踪信息
     * @returns {Promise<boolean>}
     */
    async isCached(trace) {
        const traceObj = trace instanceof Trace ? trace : Trace.fromRaw(trace);
        
        // 本地资源始终"已缓存"
        if (traceObj.isLocal()) {
            return true;
        }
        
        return await this.#resourceCache.isCached(traceObj);
    }

    /**
     * 获取缓存路径（如果存在）
     * @param {Trace|Object} trace - 来源追踪信息
     * @returns {Promise<string|null>}
     */
    async getCachedPath(trace) {
        const traceObj = trace instanceof Trace ? trace : Trace.fromRaw(trace);
        
        if (traceObj.isLocal()) {
            const fetchMethod = traceObj.fetchMethod;
            if (fetchMethod.type === FetchMethodType.LOCAL_FILE) {
                return fetchMethod.params.path;
            }
            return null;
        }
        
        return await this.#resourceCache.getCachedPath(traceObj);
    }

    /**
     * 预加载资源（后台下载）
     * @param {Trace|Object} trace - 来源追踪信息
     * @returns {Promise<boolean>} 是否成功预加载
     */
    async preload(trace) {
        try {
            const traceObj = trace instanceof Trace ? trace : Trace.fromRaw(trace);
            
            // 本地资源无需预加载
            if (traceObj.isLocal()) {
                return true;
            }
            
            // 检查是否已缓存
            if (await this.isCached(traceObj)) {
                return true;
            }
            
            // 后台下载
            await this.fetch(traceObj);
            return true;
        } catch (error) {
            console.warn('Failed to preload resource:', error);
            return false;
        }
    }

    /**
     * 批量预加载资源
     * @param {Array<Trace|Object>} traces - Trace 数组
     * @param {number} [concurrency=3] - 并发数
     * @returns {Promise<{success: number, failed: number}>}
     */
    async preloadBatch(traces, concurrency = 3) {
        const results = { success: 0, failed: 0 };
        const queue = [...traces];
        const active = new Set();

        const processNext = async () => {
            while (queue.length > 0) {
                const trace = queue.shift();
                if (!trace) break;

                const promise = this.preload(trace).then(success => {
                    if (success) {
                        results.success++;
                    } else {
                        results.failed++;
                    }
                    active.delete(promise);
                });

                active.add(promise);

                if (active.size >= concurrency) {
                    await Promise.race(active);
                }
            }
        };

        await Promise.all([...active, processNext()]);
        return results;
    }

    /**
     * 取消预加载
     * @param {Trace|Object} trace - 来源追踪信息
     */
    cancelPreload(trace) {
        const traceObj = trace instanceof Trace ? trace : Trace.fromRaw(trace);
        const cacheKey = this.#getCacheKey(traceObj);
        this.#pendingRequests.delete(cacheKey);
    }

    // ========== 私有方法 ==========

    /**
     * 获取本地资源
     * @param {Trace} trace - Trace 对象
     * @returns {Promise<FetchResult>}
     */
    async #fetchLocalResource(trace) {
        const fetchMethod = trace.fetchMethod;
        
        if (fetchMethod.type !== FetchMethodType.LOCAL_FILE) {
            throw new Error('Invalid fetch method for local resource');
        }

        // 通过后端读取本地文件
        const result = await trace.fetchResource();
        
        return {
            objectURL: result.objectURL,
            destroyObjectURL: result.destroyObjectURL,
            fromCache: false, // 本地文件不算缓存
            cacheId: null
        };
    }

    /**
     * 获取已缓存的资源
     * @param {string} cachedPath - 缓存路径
     * @param {Trace} trace - Trace 对象
     * @returns {Promise<FetchResult>}
     */
    async #getCachedResource(cachedPath, trace) {
        // 通过 Tauri 后端读取缓存文件
        const result = await invoke('read_cached_file', { path: cachedPath });
        const blob = new Blob([result]);
        const objectURL = URL.createObjectURL(blob);
        
        return {
            objectURL,
            destroyObjectURL: () => URL.revokeObjectURL(objectURL),
            fromCache: true,
            cacheId: await this.#resourceCache.isCached(trace) ? this.#getCacheId(trace) : null
        };
    }

    /**
     * 获取远程资源
     * @param {Trace} trace - Trace 对象
     * @param {boolean} shouldCache - 是否应该缓存
     * @returns {Promise<FetchResult>}
     */
    async #fetchRemoteResource(trace, shouldCache) {
        const fetchMethod = trace.fetchMethod;
        let resourceData;
        let format = 'mp3'; // 默认格式

        switch (fetchMethod.type) {
            case FetchMethodType.DOWNLOAD:
                resourceData = await this.#downloadFromUrl(fetchMethod.params.url);
                format = fetchMethod.params.format || this.#detectFormat(fetchMethod.params.url);
                break;

            case FetchMethodType.API_CALL:
                resourceData = await this.#fetchFromApi(trace.baseUrl, fetchMethod.params);
                format = fetchMethod.params.format || 'mp3';
                break;

            case FetchMethodType.STREAM:
                // 流式资源直接返回 URL，不缓存
                return {
                    objectURL: fetchMethod.params.url,
                    destroyObjectURL: () => {},
                    fromCache: false,
                    cacheId: null
                };

            default:
                throw new Error(`Unsupported fetch method: ${fetchMethod.type}`);
        }

        // 缓存资源
        let cacheId = null;
        if (shouldCache && resourceData) {
            try {
                cacheId = await this.#resourceCache.cacheResource(trace, resourceData, format);
            } catch (error) {
                console.warn('Failed to cache resource:', error);
            }
        }

        // 创建 ObjectURL
        const blob = new Blob([resourceData]);
        const objectURL = URL.createObjectURL(blob);

        return {
            objectURL,
            destroyObjectURL: () => URL.revokeObjectURL(objectURL),
            fromCache: false,
            cacheId
        };
    }

    /**
     * 从 URL 下载资源
     * @param {string} url - 资源 URL
     * @returns {Promise<ArrayBuffer>}
     */
    async #downloadFromUrl(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download resource: ${response.status} ${response.statusText}`);
        }
        return await response.arrayBuffer();
    }

    /**
     * 从 API 获取资源
     * @param {string} baseUrl - API 基础 URL
     * @param {Object} params - API 参数
     * @returns {Promise<ArrayBuffer>}
     */
    async #fetchFromApi(baseUrl, params) {
        const url = new URL(params.endpoint, baseUrl);
        const response = await fetch(url, {
            method: params.method || 'GET',
            headers: params.headers || { 'Content-Type': 'application/json' },
            body: params.body ? JSON.stringify(params.body) : undefined
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.arrayBuffer();
    }

    /**
     * 检测资源格式
     * @param {string} url - 资源 URL
     * @returns {string}
     */
    #detectFormat(url) {
        const pathname = new URL(url).pathname;
        const ext = pathname.split('.').pop()?.toLowerCase();
        
        const formatMap = {
            'mp3': 'mp3',
            'flac': 'flac',
            'wav': 'wav',
            'm4a': 'm4a',
            'aac': 'aac',
            'ogg': 'ogg',
            'webm': 'webm'
        };

        return formatMap[ext] || 'mp3';
    }

    /**
     * 生成缓存键
     * @param {Trace} trace - Trace 对象
     * @returns {string}
     */
    #getCacheKey(trace) {
        return `${trace.sourceId}:${trace.dataType}:${trace.dataId}`;
    }

    /**
     * 获取缓存 ID
     * @param {Trace} trace - Trace 对象
     * @returns {string}
     */
    #getCacheId(trace) {
        // 与后端的 generate_cache_id 逻辑保持一致
        const input = `${trace.sourceId}:${trace.dataType}:${trace.dataId}`;
        // 简单的 hash 函数（实际应该使用与后端一致的 hash）
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(16, '0').substring(0, 16);
    }
}

/**
 * 创建全局资源获取器实例
 */
let globalFetcher = null;

/**
 * 获取全局资源获取器
 * @param {Object} [sourceManager] - 源管理器实例
 * @returns {ResourceFetcher}
 */
export function getResourceFetcher(sourceManager) {
    if (!globalFetcher && sourceManager) {
        globalFetcher = new ResourceFetcher(sourceManager);
    }
    return globalFetcher;
}

/**
 * 初始化全局资源获取器
 * @param {Object} sourceManager - 源管理器实例
 */
export function initResourceFetcher(sourceManager) {
    globalFetcher = new ResourceFetcher(sourceManager);
}

export default ResourceFetcher;
