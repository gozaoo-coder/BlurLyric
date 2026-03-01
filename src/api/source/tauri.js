/**
 * Tauri Source - Tauri后端API源实现
 * 继承Source基类，实现Tauri后端的所有API接口
 * 
 * 优化特性：
 * - 多级缓存策略（内存+磁盘）
 * - 增量扫描支持
 * - 按需加载机制
 * - 性能监控集成
 */

import { Source } from './base.js';
import { invoke } from '@tauri-apps/api/core';
import lazyLoader from '../lazyLoader.js';
import { performanceMonitor } from '../performanceMonitor.js';

// 使用 Map 替代对象提高缓存管理效率
const objectURLCache = new Map();
const objectURLCounter = new Map();
const requestCache = new Map();

// 应用本地数据缓存结构
const onCacheUpdateListeners = new Map();
const appLocalDataCache = {
    musicList: {
        lastUpdateTimestamp: 0,
        data: []
    },
    folders: {
        lastUpdateTimestamp: 0,
        data: []
    },
    albums: {
        lastUpdateTimestamp: 0,
        data: []
    },
    artists: {
        lastUpdateTimestamp: 0,
        data: []
    },
};

// 统一状态更新方法
const updateAppLocalData = (path, data) => {
    if (appLocalDataCache[path] !== undefined) {
        appLocalDataCache[path].data = data;
        appLocalDataCache[path].lastUpdateTimestamp = Date.now();
        onCacheUpdateListeners.get(path)?.forEach(callback => callback(data));
    } else {
        console.error(`Invalid cache path: ${path}`);
    }
};

const setObjectURL = (id, objectURL) => {
    if (objectURLCache.has(id)) {
        objectURLCounter.set(id, objectURLCounter.get(id) + 1);
        return objectURLCache.get(id);
    }

    objectURLCache.set(id, objectURL);
    objectURLCounter.set(id, 1);
    return objectURL;
};

const getObjectURL = (id) => {
    if (!objectURLCache.has(id)) {
        throw new Error(`Object URL for ${id} is not available.`);
    }

    objectURLCounter.set(id, objectURLCounter.get(id) + 1);
    return objectURLCache.get(id);
};

const destroyObjectURL = (id) => {
    if (!objectURLCache.has(id)) return;

    const count = objectURLCounter.get(id) - 1;
    objectURLCounter.set(id, count);

    if (count <= 0) {
        URL.revokeObjectURL(objectURLCache.get(id));
        objectURLCache.delete(id);
        objectURLCounter.delete(id);
    }
};

// 增强型请求处理器
const handleAPIRequest = async (key, invokeFunction, params) => {
    if (objectURLCache.has(key)) {
        return {
            objectURL: getObjectURL(key),
            destroyObjectURL: () => destroyObjectURL(key)
        };
    }

    if (requestCache.has(key)) {
        return requestCache.get(key);
    }

    const requestPromise = invoke(invokeFunction, params)
        .then(data => {
            const objectURL = URL.createObjectURL(new Blob([data]));
            setObjectURL(key, objectURL);
            requestCache.delete(key);
            return { objectURL, destroyObjectURL: () => destroyObjectURL(key) };
        })
        .catch(error => {
            requestCache.delete(key);
            throw error;
        });

    requestCache.set(key, requestPromise);
    return requestPromise;
};

// 使用全大写命名常量
const RESOLUTIONS = {
    ORIGIN: 0,
    MIN: 46 * 2,
    NORMAL: 46 * 8,
    HIGH: 1024
};

// 参数校验方法
const validateResolution = (resolution) => {
    if (typeof resolution === 'string') {
        if (!(resolution in RESOLUTIONS)) {
            throw new Error(`Invalid resolution string: ${resolution}`);
        }
        return RESOLUTIONS[resolution];
    }
    return resolution;
};

export class TauriSource extends Source {
    constructor(name = '本地音乐库', type = 'tauri') {
        super(name, type);
        this.resolutions = RESOLUTIONS;
        this.lazyLoader = lazyLoader;
        this.performanceMonitor = performanceMonitor;
    }
    
    // 向后兼容：暴露 enum_resolutions
    get enum_resolutions() {
        return RESOLUTIONS;
    }

    // ========== 缓存更新监听 ==========
    
    onCacheUpdate(path, callback) {
        let listeners = [];
        if (onCacheUpdateListeners.has(path)) {
            listeners = onCacheUpdateListeners.get(path);
        }
        onCacheUpdateListeners.set(path, [...listeners, callback]);
    }

    // ========== 音乐列表操作 ==========
    
    async getMusicList() {
        const timerId = `music_list_${Date.now()}`;
        this.performanceMonitor.startResourceTimer(timerId);
        
        try {
            const result = await invoke("get_music_list");
            updateAppLocalData('musicList', result);
            return result;
        } finally {
            this.performanceMonitor.endResourceTimer(timerId, 'music_list', true);
        }
    }

    async getAllMusicDirs() {
        const result = await invoke("get_all_music_dirs");
        updateAppLocalData('folders', result);
        return result;
    }

    async addMusicDirs(dirs) {
        const dirArray = Array.isArray(dirs) ? dirs : [dirs];
        return await invoke("add_music_dirs", { newDirs: dirArray });
    }

    async removeMusicDirs(dirs) {
        const dirArray = Array.isArray(dirs) ? dirs : [dirs];
        return await invoke("remove_music_dirs", { dirsToRemove: dirArray });
    }

    async refreshMusicCache() {
        await invoke("refresh_music_cache");

        // 获取音乐列表
        let musicList = await invoke("get_music_list");

        if (musicList.length === 0) {
            await this.initApplication();
            musicList = await invoke("get_music_list");
        }

        // 更新本地缓存
        updateAppLocalData('musicList', musicList);
        updateAppLocalData('folders', await invoke("get_all_music_dirs"));
        updateAppLocalData('albums', await invoke("get_all_my_albums"));
        updateAppLocalData('artists', await invoke("get_all_my_artists"));
    }

    // ========== 增量扫描 ==========
    
    /**
     * 执行增量扫描
     * 只扫描新增或修改的文件，大幅提升扫描速度
     */
    async performIncrementalScan() {
        try {
            console.log('Starting incremental scan...');
            const summary = await invoke('perform_incremental_scan');
            console.log('Incremental scan completed:', summary);
            
            // 刷新本地缓存
            await this.refreshMusicCache();
            
            return summary;
        } catch (e) {
            console.error('Incremental scan failed:', e);
            throw e;
        }
    }
    
    /**
     * 执行全量扫描
     * 重新扫描所有音乐文件
     */
    async performFullScan() {
        try {
            console.log('Starting full scan...');
            const summary = await invoke('perform_full_scan');
            console.log('Full scan completed:', summary);
            
            // 刷新本地缓存
            await this.refreshMusicCache();
            
            return summary;
        } catch (e) {
            console.error('Full scan failed:', e);
            throw e;
        }
    }
    
    /**
     * 获取缓存统计信息
     */
    async getCacheStats() {
        try {
            return await invoke('get_cache_stats');
        } catch (e) {
            console.error('Failed to get cache stats:', e);
            return null;
        }
    }
    
    /**
     * 清除所有缓存
     */
    async clearCache() {
        try {
            await invoke('clear_music_cache');
            lazyLoader.clearCache();
            console.log('Cache cleared successfully');
        } catch (e) {
            console.error('Failed to clear cache:', e);
            throw e;
        }
    }

    /**
     * 获取缓存大小信息
     */
    async getCacheSizeInfo() {
        try {
            const info = await invoke('get_cache_size_info');
            return {
                totalSize: info.total_size,
                imageCacheSize: info.image_cache_size,
                dataCacheSize: info.data_cache_size,
                imageCount: info.image_count,
                fileCount: info.file_count
            };
        } catch (e) {
            console.error('Failed to get cache size info:', e);
            throw e;
        }
    }

    /**
     * 清除图片缓存
     */
    async clearImageCache() {
        try {
            const deletedCount = await invoke('clear_image_cache');
            console.log(`Cleared ${deletedCount} image cache files`);
            return deletedCount;
        } catch (e) {
            console.error('Failed to clear image cache:', e);
            throw e;
        }
    }

    /**
     * 重置所有应用数据
     */
    async resetAllData() {
        try {
            await invoke('reset_all_data');
            lazyLoader.clearCache();
            console.log('All application data has been reset');
        } catch (e) {
            console.error('Failed to reset all data:', e);
            throw e;
        }
    }

    // ========== 专辑操作 ==========

    async getAlbums() {
        const result = await invoke("get_all_my_albums");
        updateAppLocalData('albums', result);
        return result;
    }

    async getAlbumById(albumId) {
        return await invoke("get_album_by_id", { albumId: Number(albumId) });
    }

    async getAlbumsSongsById(albumId) {
        return await invoke("get_albums_songs_by_id", { albumId: Number(albumId) });
    }

    // ========== 艺术家操作 ==========

    async getArtists() {
        const result = await invoke("get_all_my_artists");
        updateAppLocalData('artists', result);
        return result;
    }

    async getArtistById(artistId) {
        return await invoke("get_artist_by_id", { artistId: Number(artistId) });
    }

    async getArtistsSongsById(artistId) {
        return await invoke("get_artists_songs_by_id", { artistId: Number(artistId) });
    }

    // ========== 资源获取（按需加载）==========

    /**
     * 获取专辑封面 - 使用按需加载
     */
    async getAlbumCover(albumId, maxResolution = RESOLUTIONS.NORMAL) {
        if (albumId < 0) {
            return { objectURL: '', destroyObjectURL: () => {} };
        }

        const resolution = validateResolution(maxResolution);
        
        // 如果是origin或0，返回原图
        if (resolution === RESOLUTIONS.ORIGIN || resolution === 0) {
            return await this.getOriginAlbumCover(albumId);
        }

        // 使用懒加载器加载封面
        try {
            const result = await lazyLoader.loadAlbumCover(albumId, resolution);
            return result;
        } catch (e) {
            console.error(`Failed to load album cover ${albumId}:`, e);
            throw e;
        }
    }

    /**
     * 获取原始专辑封面
     */
    async getOriginAlbumCover(albumId) {
        if (albumId < 0) {
            return { objectURL: '', destroyObjectURL: () => {} };
        }
        
        try {
            const result = await lazyLoader.loadOriginAlbumCover(albumId);
            return result;
        } catch (e) {
            console.error(`Failed to load origin album cover ${albumId}:`, e);
            throw e;
        }
    }

    /**
     * 获取音乐文件 - 使用按需加载
     */
    async getMusicFile(songId) {
        try {
            const result = await lazyLoader.loadMusicFile(songId);
            return result;
        } catch (e) {
            console.error(`Failed to load music file ${songId}:`, e);
            throw e;
        }
    }

    // ========== 搜索功能 ==========

    async searchTracks(keyword, options = {}) {
        // 本地搜索：从musicList中过滤
        const musicList = appLocalDataCache.musicList.data;
        const lowerKeyword = keyword.toLowerCase();
        
        return musicList.filter(track => {
            const nameMatch = track.name?.toLowerCase().includes(lowerKeyword);
            const artistMatch = track.ar?.some(ar => ar.name?.toLowerCase().includes(lowerKeyword));
            const albumMatch = track.al?.name?.toLowerCase().includes(lowerKeyword);
            return nameMatch || artistMatch || albumMatch;
        });
    }

    async searchAlbums(keyword, options = {}) {
        const albums = appLocalDataCache.albums.data;
        const lowerKeyword = keyword.toLowerCase();
        
        return albums.filter(album => 
            album.name?.toLowerCase().includes(lowerKeyword)
        );
    }

    async searchArtists(keyword, options = {}) {
        const artists = appLocalDataCache.artists.data;
        const lowerKeyword = keyword.toLowerCase();
        
        return artists.filter(artist => 
            artist.name?.toLowerCase().includes(lowerKeyword)
        );
    }

    async searchLyrics(keyword, options = {}) {
        // 本地搜索歌词：从musicList中过滤包含歌词的歌曲
        const musicList = appLocalDataCache.musicList.data;
        const lowerKeyword = keyword.toLowerCase();
        
        return musicList.filter(track => {
            const lyricMatch = track.lyric?.toLowerCase().includes(lowerKeyword);
            const nameMatch = track.name?.toLowerCase().includes(lowerKeyword);
            return lyricMatch || nameMatch;
        });
    }

    async searchAll(keyword, options = {}) {
        const [tracks, albums, artists, lyrics] = await Promise.all([
            this.searchTracks(keyword, options),
            this.searchAlbums(keyword, options),
            this.searchArtists(keyword, options),
            this.searchLyrics(keyword, options)
        ]);

        return { tracks, albums, artists, lyrics };
    }

    // ========== 初始化 ==========

    async initApplication() {
        console.log('initApplication with optimized resource management');
        await invoke('init_application');
    }

    async isAvailable() {
        try {
            // 检查Tauri API是否可用
            return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
        } catch {
            return false;
        }
    }

    // ========== 额外方法 ==========

    get appLocalCache() {
        return appLocalDataCache;
    }

    setAppLocalCache(path, data) {
        if (appLocalDataCache[path]) {
            appLocalDataCache[path] = {
                ...appLocalDataCache[path],
                ...data,
                lastUpdateTimestamp: Date.now()
            };
        }
    }

    async addUsersMusicDir(dir) {
        return await invoke("add_users_music_dir", { dir });
    }

    async getUsersMusicDir() {
        return await invoke("get_users_music_dir");
    }
    
    // ========== 性能监控 ==========
    
    /**
     * 获取性能报告
     */
    async getPerformanceReport() {
        return await this.performanceMonitor.getPerformanceReport();
    }
    
    /**
     * 重置性能统计
     */
    async resetPerformanceStats() {
        return await this.performanceMonitor.resetStats();
    }
    
    /**
     * 预加载资源
     */
    async preloadResources(items) {
        return await lazyLoader.preloadBatch(items);
    }
}

export default TauriSource;
