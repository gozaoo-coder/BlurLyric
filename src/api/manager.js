/**
 * API Manager - 统一的 API 管理入口
 * 整合 Source 管理和 Resource 管理
 * 
 * ==================== 核心功能 ====================
 * 
 * 1. 多源管理
 *    - 支持本地 Tauri 源、Web API 源、自定义源
 *    - 源类型工厂模式，便于扩展
 * 
 * 2. Trace 来源追踪
 *    - 所有数据支持来源追踪
 *    - 支持多源数据关联
 * 
 * 3. 统一的数据模型
 *    - Track, Artist, Album, TrackList
 *    - 资源管理和引用计数
 * 
 * 4. 资源获取（P3-006 实现）
 *    - 统一的缓存策略
 *    - 自动缓存远程资源
 *    - 支持预加载
 */

import { 
    sourceManager, 
    SourceManager, 
    Source, 
    SOURCE_TYPE,
    Trace,
    TraceDataType,
    TauriSource,
    WebSource,
    ApiSource,
    ResourceFetcher
} from './source/index.js';

import { 
    Track, 
    Artist, 
    Album, 
    TrackList,
    Resource,
    ResourcePool,
    AlbumCoverResource,
    MusicFileResource
} from './resources/index.js';

// 导入缓存模块
import LibraryCache from './libraryCache.js';
import ResourceCache from './resourceCache.js';

// 导入资源获取器
import { getResourceFetcher, initResourceFetcher } from './resourceFetcher.js';

// 导出所有 API 相关模块
export { 
    // Source 管理
    sourceManager,
    SourceManager,
    Source,
    SOURCE_TYPE,
    
    // Trace 来源追踪
    Trace,
    TraceDataType,
    
    // 数据源实现
    TauriSource,
    WebSource,
    ApiSource,
    
    // 资源类
    Track, 
    Artist, 
    Album, 
    TrackList,
    Resource,
    ResourcePool,
    AlbumCoverResource,
    MusicFileResource,
    
    // 缓存模块
    LibraryCache,
    ResourceCache,
    
    // 资源获取器
    ResourceFetcher,
    getResourceFetcher,
    initResourceFetcher
};

// 默认导出 manager 实例
export default {
    // Source 管理
    source: sourceManager,
    
    // 资源类
    Track,
    Artist,
    Album,
    TrackList,
    
    // 向后兼容：直接暴露 tauri source 的方法
    get tauri() {
        return sourceManager.getSource('local') || sourceManager.getDefaultSource();
    },
    
    // ========== 向后兼容的便捷方法 ==========
    
    /**
     * 初始化应用
     */
    async initApplication() {
        return sourceManager.initApplication();
    },
    
    /**
     * 获取音乐列表
     * @param {string} [sourceId] - 数据源 ID（向后兼容参数名）
     */
    async getMusicList(sourceId) {
        return sourceManager.getMusicList(sourceId);
    },
    
    /**
     * 获取所有专辑
     * @param {string} [sourceId] - 数据源 ID
     */
    async getAlbums(sourceId) {
        return sourceManager.getAlbums(sourceId);
    },
    
    /**
     * 获取所有艺术家
     * @param {string} [sourceId] - 数据源 ID
     */
    async getArtists(sourceId) {
        return sourceManager.getArtists(sourceId);
    },
    
    /**
     * 综合搜索
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @param {string} [sourceId] - 数据源 ID
     */
    async searchAll(keyword, options, sourceId) {
        return sourceManager.searchAll(keyword, options, sourceId);
    },
    
    /**
     * 搜索歌曲
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @param {string} [sourceId] - 数据源 ID
     */
    async searchTracks(keyword, options, sourceId) {
        return sourceManager.searchTracks(keyword, options, sourceId);
    },
    
    /**
     * 搜索专辑
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @param {string} [sourceId] - 数据源 ID
     */
    async searchAlbums(keyword, options, sourceId) {
        return sourceManager.searchAlbums(keyword, options, sourceId);
    },
    
    /**
     * 搜索艺术家
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @param {string} [sourceId] - 数据源 ID
     */
    async searchArtists(keyword, options, sourceId) {
        return sourceManager.searchArtists(keyword, options, sourceId);
    },
    
    /**
     * 获取专辑封面
     * @param {number} albumId - 专辑 ID
     * @param {number} maxResolution - 最大分辨率
     * @param {string} [sourceId] - 数据源 ID
     */
    async getAlbumCover(albumId, maxResolution, sourceId) {
        return sourceManager.getAlbumCover(albumId, maxResolution, sourceId);
    },
    
    /**
     * 获取音乐文件
     * @param {number} songId - 歌曲 ID
     * @param {string} [sourceId] - 数据源 ID
     */
    async getMusicFile(songId, sourceId) {
        return sourceManager.getMusicFile(songId, sourceId);
    },
    
    /**
     * 获取所有音乐目录
     * @param {string} [sourceId] - 数据源 ID
     */
    async getAllMusicDirs(sourceId) {
        return sourceManager.getAllMusicDirs(sourceId);
    },
    
    /**
     * 添加音乐目录
     * @param {string|string[]} dirs - 目录
     * @param {string} [sourceId] - 数据源 ID
     */
    async addMusicDirs(dirs, sourceId) {
        return sourceManager.addMusicDirs(dirs, sourceId);
    },
    
    /**
     * 移除音乐目录
     * @param {string|string[]} dirs - 目录
     * @param {string} [sourceId] - 数据源 ID
     */
    async removeMusicDirs(dirs, sourceId) {
        return sourceManager.removeMusicDirs(dirs, sourceId);
    },
    
    /**
     * 刷新音乐缓存
     * @param {string} [sourceId] - 数据源 ID
     */
    async refreshMusicCache(sourceId) {
        return sourceManager.refreshMusicCache(sourceId);
    },
    
    /**
     * 通过 ID 获取专辑
     * @param {number} albumId - 专辑 ID
     * @param {string} [sourceId] - 数据源 ID
     */
    async getAlbumById(albumId, sourceId) {
        return sourceManager.getAlbumById(albumId, sourceId);
    },
    
    /**
     * 通过专辑 ID 获取歌曲
     * @param {number} albumId - 专辑 ID
     * @param {string} [sourceId] - 数据源 ID
     */
    async getAlbumsSongsById(albumId, sourceId) {
        return sourceManager.getAlbumsSongsById(albumId, sourceId);
    },
    
    /**
     * 通过 ID 获取艺术家
     * @param {number} artistId - 艺术家 ID
     * @param {string} [sourceId] - 数据源 ID
     */
    async getArtistById(artistId, sourceId) {
        return sourceManager.getArtistById(artistId, sourceId);
    },
    
    /**
     * 通过艺术家 ID 获取歌曲
     * @param {number} artistId - 艺术家 ID
     * @param {string} [sourceId] - 数据源 ID
     */
    async getArtistsSongsById(artistId, sourceId) {
        return sourceManager.getArtistsSongsById(artistId, sourceId);
    },
    
    // ========== 暴露本地数据缓存（向后兼容） ==========
    
    /**
     * 获取本地数据缓存
     * @deprecated 使用 sourceManager.getDefaultSource().appLocalCache 代替
     */
    get appLocalCache() {
        const source = this.tauri;
        return source?.appLocalCache || {
            musicList: { lastUpdateTimestamp: 0, data: [] },
            folders: { lastUpdateTimestamp: 0, data: [] },
            albums: { lastUpdateTimestamp: 0, data: [] },
            artists: { lastUpdateTimestamp: 0, data: [] }
        };
    },
    
    /**
     * 设置本地数据缓存
     * @deprecated 使用 sourceManager.getDefaultSource().setAppLocalCache 代替
     */
    setAppLocalCache(path, data) {
        const source = this.tauri;
        if (source?.setAppLocalCache) {
            source.setAppLocalCache(path, data);
        }
    },
    
    /**
     * 注册缓存更新回调
     * @deprecated 使用 sourceManager.getDefaultSource().onCacheUpdate 代替
     */
    onCacheUpdate(path, callback) {
        const source = this.tauri;
        if (source?.onCacheUpdate) {
            source.onCacheUpdate(path, callback);
        }
    },
    
    // ========== 分辨率常量（向后兼容） ==========
    
    get RESOLUTIONS() {
        const source = this.tauri;
        return source?.resolutions || {
            ORIGIN: 0,
            MIN: 92,
            NORMAL: 368,
            HIGH: 1024
        };
    },
    
    get enum_resolutions() {
        return this.RESOLUTIONS;
    }
};
