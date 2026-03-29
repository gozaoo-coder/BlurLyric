/**
 * Source Manager - API 源管理器
 * 统一管理多个 API 源（本地 Tauri、Web 等）
 * 
 * 新特性：
 * - 支持多源注册和管理
 * - 支持 Trace 导航
 * - 支持按需获取资源
 */

import { Source, SOURCE_TYPE } from './base.js';
import { Trace, TraceDataType } from './trace.js';
import { TauriSource } from './tauri.js';
import { WebSource } from './web.js';
import { ApiSource } from './api.js';

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
     * 根据 Trace 获取资源
     * @param {Trace} trace - 来源追踪信息
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async fetchResourceByTrace(trace) {
        const source = this.getSource(trace.sourceId);
        if (!source) {
            throw new Error(`Source not found: ${trace.sourceId}`);
        }

        if (source.isStorageSource() && source.getByTrace) {
            return source.getByTrace(trace);
        }

        return await trace.fetchResource();
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

    async initApplication(sourceId = null) {
        const source = sourceId ? this.getSource(sourceId) : this.getDefaultSource();
        if (!source) throw new Error('No source available');
        return source.initApplication();
    }
}

// 创建单例
const sourceManager = new SourceManager();

// 导出
export { sourceManager, SourceManager, Source, SOURCE_TYPE, Trace, TraceDataType, TauriSource, WebSource, ApiSource };
export default sourceManager;
