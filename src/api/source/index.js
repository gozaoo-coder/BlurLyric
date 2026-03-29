/**
 * Source Manager - API 源管理器
 * 统一管理多个 API 源（本地 Tauri、Web 等）
 * 
 * ==================== 核心功能 ====================
 * 
 * 1. 多源注册和管理
 *    - 支持本地 Tauri 源、Web API 源、自定义源
 *    - 源类型工厂模式，便于扩展
 * 
 * 2. Trace 导航
 *    - 根据 Trace 信息精准跳转到数据源
 *    - 支持多源数据关联
 * 
 * 3. 资源获取（P3-006 实现）
 *    - 统一的缓存检查流程
 *    - 自动缓存远程资源
 *    - 支持预加载和批量预加载
 * 
 * ==================== 资源调用流程 ====================
 * 
 * fetchResourceByTrace(trace) →
 *   1. 检查 trace 类型（本地/远程）
 *   2. 本地资源：直接读取文件
 *   3. 远程资源：
 *      a. 检查缓存 → 命中则返回缓存
 *      b. 未命中则从网络下载
 *      c. 存入临时缓存池
 *      d. 返回 ObjectURL
 */

import { Source, SOURCE_TYPE } from './base.js';
import { Trace, TraceDataType } from './trace.js';
import { TauriSource } from './tauri.js';
import { WebSource } from './web.js';
import { ApiSource } from './api.js';
import { NeteaseSource } from './netease.js';
import { ResourceFetcher, initResourceFetcher, getResourceFetcher } from '../resourceFetcher.js';

class SourceManager {
    #sources = new Map();
    #defaultSourceId = null;
    #sourceOrder = [];

    constructor() {
        // 注册源类型工厂
        this.registerSourceType('tauri', (sourceId, sourceName, options) => {
            return new TauriSource();
        });
        this.registerSourceType('web', (sourceId, sourceName, options) => {
            return new WebSource(sourceId, sourceName, options.apiUrl || options.baseUrl);
        });
        this.registerSourceType('api', (sourceId, sourceName, options) => {
            return new ApiSource(sourceId, sourceName, options.baseUrl);
        });
        this.registerSourceType('netease', (sourceId, sourceName, options) => {
            return new NeteaseSource(
                sourceId, 
                sourceName, 
                options.baseUrl || 'http://localhost:3000',
                options.config || {}
            );
        });

        // 注册默认本地源
        this.addSource('local', '本地音乐库', 'tauri');
    }

    /**
     * 注册源类型工厂
     * @param {string} type - 源类型
     * @param {Function} factory - 工厂函数
     */
    registerSourceType(type, factory) {
        this.#sources.set(type, factory);
    }

    /**
     * 添加数据源
     * @param {string} sourceId - 数据源唯一标识
     * @param {string} sourceName - 数据源显示名称
     * @param {string} type - 源类型
     * @param {Object} options - 额外配置
     * @returns {Source}
     */
    addSource(sourceId, sourceName, type, options = {}) {
        const factory = this.#sources.get(type);
        if (!factory) {
            throw new Error(`Unknown source type: ${type}`);
        }

        const source = factory(sourceId, sourceName, options);
        this.#sourceOrder.push({ sourceId, type, source });

        if (!this.#defaultSourceId) {
            this.#defaultSourceId = sourceId;
        }

        return source;
    }

    /**
     * 移除数据源
     * @param {string} sourceId - 数据源唯一标识
     * @returns {boolean}
     */
    removeSource(sourceId) {
        const index = this.#sourceOrder.findIndex(s => s.sourceId === sourceId);
        if (index !== -1) {
            this.#sourceOrder.splice(index, 1);
            if (this.#defaultSourceId === sourceId) {
                this.#defaultSourceId = this.#sourceOrder[0]?.sourceId || null;
            }
            return true;
        }
        return false;
    }

    /**
     * 获取数据源
     * @param {string} sourceId - 数据源唯一标识
     * @returns {Source|null}
     */
    getSource(sourceId) {
        const source = this.#sourceOrder.find(s => s.sourceId === sourceId);
        return source?.source || null;
    }

    /**
     * 获取所有数据源
     * @returns {Array<{sourceId: string, type: string, source: Source}>}
     */
    getAllSources() {
        return this.#sourceOrder.map(s => ({
            sourceId: s.sourceId,
            type: s.type,
            source: s.source
        }));
    }

    /**
     * 设置默认数据源
     * @param {string} sourceId - 数据源唯一标识
     */
    setDefaultSource(sourceId) {
        const source = this.getSource(sourceId);
        if (source) {
            this.#defaultSourceId = sourceId;
        }
    }

    /**
     * 获取默认数据源
     * @returns {Source|null}
     */
    getDefaultSource() {
        return this.getSource(this.#defaultSourceId);
    }

    // ========== Trace 导航 ==========

    /**
     * 根据 Trace 导航到数据
     * @param {Trace} trace - 来源追踪信息
     * @returns {Promise<Object>}
     */
    async navigateByTrace(trace) {
        const source = this.getSource(trace.sourceId);
        if (!source) {
            throw new Error(`Source not found: ${trace.sourceId}`);
        }
        
        return await trace.navigateToSource();
    }

    /**
     * 根据 Trace 获取资源（统一入口）
     * 实现完整的缓存策略：
     * 1. 本地资源直接返回
     * 2. 远程资源检查缓存
     * 3. 缓存未命中则下载并缓存
     * 
     * @param {Trace} trace - 来源追踪信息
     * @param {Object} options - 选项
     * @param {boolean} [options.skipCache=false] - 是否跳过缓存
     * @param {boolean} [options.forceDownload=false] - 是否强制重新下载
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function, fromCache: boolean}>}
     */
    async fetchResourceByTrace(trace, options = {}) {
        const fetcher = getResourceFetcher(this);
        if (!fetcher) {
            initResourceFetcher(this);
        }
        return await getResourceFetcher(this).fetch(trace, options);
    }

    /**
     * 预加载资源（后台下载）
     * @param {Trace} trace - 来源追踪信息
     * @returns {Promise<boolean>}
     */
    async preloadResource(trace) {
        const fetcher = getResourceFetcher(this);
        if (!fetcher) {
            initResourceFetcher(this);
        }
        return await getResourceFetcher(this).preload(trace);
    }

    /**
     * 批量预加载资源
     * @param {Array<Trace>} traces - Trace 数组
     * @param {number} [concurrency=3] - 并发数
     * @returns {Promise<{success: number, failed: number}>}
     */
    async preloadResources(traces, concurrency = 3) {
        const fetcher = getResourceFetcher(this);
        if (!fetcher) {
            initResourceFetcher(this);
        }
        return await getResourceFetcher(this).preloadBatch(traces, concurrency);
    }

    /**
     * 检查资源是否已缓存
     * @param {Trace} trace - 来源追踪信息
     * @returns {Promise<boolean>}
     */
    async isResourceCached(trace) {
        const fetcher = getResourceFetcher(this);
        if (!fetcher) {
            initResourceFetcher(this);
        }
        return await getResourceFetcher(this).isCached(trace);
    }

    // ========== 代理方法（兼容旧代码） ==========

    async getMusicList(sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getMusicList();
    }

    async getAllMusicDirs(sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getAllMusicDirs();
    }

    async addMusicDirs(dirs, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.addMusicDirs(dirs);
    }

    async removeMusicDirs(dirs, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.removeMusicDirs(dirs);
    }

    async refreshMusicCache(sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.refreshMusicCache();
    }

    async getAlbums(sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getAlbums();
    }

    async getAlbumById(albumId, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getAlbumById(albumId);
    }

    async getAlbumsSongsById(albumId, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getAlbumsSongsById(albumId);
    }

    async getArtists(sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getArtists();
    }

    async getArtistById(artistId, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getArtistById(artistId);
    }

    async getArtistsSongsById(artistId, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getArtistsSongsById(artistId);
    }

    async getAlbumCover(albumId, maxResolution, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getAlbumCover(albumId, maxResolution);
    }

    async getMusicFile(songId, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.getMusicFile(songId);
    }

    async searchTracks(keyword, options = {}, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.searchTracks(keyword, options);
    }

    async searchAlbums(keyword, options = {}, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.searchAlbums(keyword, options);
    }

    async searchArtists(keyword, options = {}, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.searchArtists(keyword, options);
    }

    async searchLyrics(keyword, options = {}, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.searchLyrics(keyword, options);
    }

    async searchAll(keyword, options = {}, sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.searchAll(keyword, options);
    }

    // ========== 多源搜索 ==========

    /**
     * 在所有 API 源中搜索
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @param {Array<string>} [options.sourceIds] - 指定搜索的源 ID 列表
     * @param {boolean} [options.includeLocal=false] - 是否包含本地源
     * @returns {Promise<{tracks: Array, albums: Array, artists: Array, sources: Object}>}
     */
    async searchAllSources(keyword, options = {}) {
        const { sourceIds, includeLocal = false } = options;
        
        // 获取要搜索的源
        let sourcesToSearch = this.#sourceOrder
            .filter(s => {
                // 如果指定了源 ID 列表，只搜索指定的源
                if (sourceIds && sourceIds.length > 0) {
                    return sourceIds.includes(s.sourceId);
                }
                // 否则搜索所有 API 源（可选包含本地源）
                if (includeLocal) {
                    return true;
                }
                return s.type !== 'tauri'; // 排除本地源
            })
            .map(s => s.source);

        // 如果没有可搜索的源，返回空结果
        if (sourcesToSearch.length === 0) {
            return { tracks: [], albums: [], artists: [], sources: {} };
        }

        // 并行搜索所有源
        const searchPromises = sourcesToSearch.map(async (source) => {
            try {
                const result = await source.searchAll(keyword, options);
                return {
                    sourceId: source.sourceId,
                    sourceName: source.sourceName,
                    result
                };
            } catch (e) {
                console.warn(`Search failed for source ${source.sourceId}:`, e);
                return {
                    sourceId: source.sourceId,
                    sourceName: source.sourceName,
                    result: { tracks: [], albums: [], artists: [] },
                    error: e.message
                };
            }
        });

        const results = await Promise.all(searchPromises);

        // 合并结果
        const mergedResult = {
            tracks: [],
            albums: [],
            artists: [],
            sources: {}
        };

        for (const { sourceId, sourceName, result, error } of results) {
            // 记录每个源的搜索结果
            mergedResult.sources[sourceId] = {
                name: sourceName,
                trackCount: result.tracks?.length || 0,
                albumCount: result.albums?.length || 0,
                artistCount: result.artists?.length || 0,
                error
            };

            // 合并结果，为每个项目添加来源标识
            if (result.tracks) {
                mergedResult.tracks.push(...result.tracks.map(t => ({
                    ...t,
                    sourceId,
                    sourceName
                })));
            }
            if (result.albums) {
                mergedResult.albums.push(...result.albums.map(a => ({
                    ...a,
                    sourceId,
                    sourceName
                })));
            }
            if (result.artists) {
                mergedResult.artists.push(...result.artists.map(a => ({
                    ...a,
                    sourceId,
                    sourceName
                })));
            }
        }

        return mergedResult;
    }

    /**
     * 获取所有可用的 API 源
     * @returns {Array<{sourceId: string, sourceName: string, type: string, available: boolean}>}
     */
    async getAvailableSources() {
        const sources = this.getAllSources();
        const availabilityChecks = sources.map(async ({ sourceId, type, source }) => {
            let available = false;
            try {
                if (source.isAvailable) {
                    available = await source.isAvailable();
                } else {
                    available = true;
                }
            } catch {
                available = false;
            }
            return {
                sourceId,
                sourceName: source.sourceName,
                type,
                available
            };
        });

        return await Promise.all(availabilityChecks);
    }

    async initApplication(sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.initApplication();
    }
}

// 创建单例
const sourceManager = new SourceManager();

// 导出
export { 
    sourceManager, 
    SourceManager, 
    Source, 
    SOURCE_TYPE, 
    Trace, 
    TraceDataType, 
    TauriSource, 
    WebSource, 
    ApiSource,
    NeteaseSource,
    ResourceFetcher
};
export default sourceManager;
