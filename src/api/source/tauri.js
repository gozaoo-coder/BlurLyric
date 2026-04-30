/**
 * Tauri Source - Tauri后端API源实现
 * 继承Source基类，实现Tauri后端的所有API接口
 *
 * 新架构：调用 modules/music_library 命令，转换 SongFull/AlbumFull/ArtistFull
 */

import { Source } from './base.js';
import { invoke } from '@tauri-apps/api/core';
import lazyLoader from '../lazyLoader.js';
import { performanceMonitor } from '../performanceMonitor.js';
import {
    songFullToTrack, albumFullToAlbum, artistFullToArtist,
    songFullArrayToTracks, albumFullArrayToAlbums, artistFullArrayToArtists
} from '../resources/index.js';

const onCacheUpdateListeners = new Map();
const appLocalDataCache = {
    musicList: { lastUpdateTimestamp: 0, data: [] },
    folders: { lastUpdateTimestamp: 0, data: [] },
    albums: { lastUpdateTimestamp: 0, data: [] },
    artists: { lastUpdateTimestamp: 0, data: [] },
};

const updateAppLocalData = (path, data) => {
    if (appLocalDataCache[path] !== undefined) {
        appLocalDataCache[path].data = data;
        appLocalDataCache[path].lastUpdateTimestamp = Date.now();
        onCacheUpdateListeners.get(path)?.forEach(callback => callback(data));
    } else {
        console.error(`Invalid cache path: ${path}`);
    }
};

const RESOLUTIONS = { ORIGIN: 0, MIN: 92, NORMAL: 368, HIGH: 1024 };

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
            const tracks = songFullArrayToTracks(result);
            updateAppLocalData('musicList', tracks);
            return tracks;
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

        // 重新获取所有数据
        let musicList = await invoke("get_music_list");
        if (musicList.length === 0) {
            await this.initApplication();
            musicList = await invoke("get_music_list");
        }

        updateAppLocalData('musicList', songFullArrayToTracks(musicList));
        const albums = await invoke("get_all_my_albums");
        updateAppLocalData('albums', albumFullArrayToAlbums(albums));
        const artists = await invoke("get_all_my_artists");
        updateAppLocalData('artists', artistFullArrayToArtists(artists));
        updateAppLocalData('folders', await invoke("get_all_music_dirs"));
    }

    // ========== 增量扫描 ==========

    async performIncrementalScan() {
        try {
            const summary = await invoke('perform_incremental_scan');
            await this.refreshMusicCache();
            return summary;
        } catch (e) {
            console.error('Incremental scan failed:', e);
            throw e;
        }
    }

    async performFullScan() {
        try {
            const summary = await invoke('perform_full_scan');
            await this.refreshMusicCache();
            return summary;
        } catch (e) {
            console.error('Full scan failed:', e);
            throw e;
        }
    }

    async getCacheStats() {
        try {
            return await invoke('get_cache_stats');
        } catch (e) {
            console.error('Failed to get cache stats:', e);
            return null;
        }
    }

    async clearCache() {
        try {
            await invoke('clear_music_cache');
            lazyLoader.clearCache();
        } catch (e) {
            console.error('Failed to clear cache:', e);
            throw e;
        }
    }

    async getCacheSizeInfo() {
        try {
            const info = await invoke('get_cache_size_info');
            return {
                totalSize: info.total_size,
                imageCacheSize: info.image_cache_size,
                dataCacheSize: info.data_cache_size,
                imageCount: info.image_count,
                fileCount: info.file_count,
            };
        } catch (e) {
            console.error('Failed to get cache size info:', e);
            throw e;
        }
    }

    async clearImageCache() {
        try {
            return await invoke('clear_image_cache');
        } catch (e) {
            console.error('Failed to clear image cache:', e);
            throw e;
        }
    }

    async resetAllData() {
        try {
            await invoke('reset_all_data');
            lazyLoader.clearCache();
        } catch (e) {
            console.error('Failed to reset all data:', e);
            throw e;
        }
    }

    // ========== 专辑操作 ==========

    async getAlbums() {
        const result = await invoke("get_all_my_albums");
        const albums = albumFullArrayToAlbums(result);
        updateAppLocalData('albums', albums);
        return albums;
    }

    async getAlbumById(albumId) {
        const result = await invoke("get_album_by_id", { albumId });
        return albumFullToAlbum(result);
    }

    async getAlbumsSongsById(albumId) {
        const result = await invoke("get_albums_songs_by_id", { albumId });
        return songFullArrayToTracks(result);
    }

    // ========== 艺术家操作 ==========

    async getArtists() {
        const result = await invoke("get_all_my_artists");
        const artists = artistFullArrayToArtists(result);
        updateAppLocalData('artists', artists);
        return artists;
    }

    async getArtistById(artistId) {
        const result = await invoke("get_artist_by_id", { artistId });
        return artistFullToArtist(result);
    }

    async getArtistsSongsById(artistId) {
        const result = await invoke("get_artists_songs_by_id", { artistId });
        return songFullArrayToTracks(result);
    }

    // ========== 资源获取（按需加载）==========

    async getAlbumCover(albumId, maxResolution = RESOLUTIONS.NORMAL) {
        if (albumId == null) {
            return { objectURL: '', destroyObjectURL: () => {} };
        }
        const resolution = validateResolution(maxResolution);
        if (resolution === RESOLUTIONS.ORIGIN || resolution === 0) {
            return await lazyLoader.loadOriginAlbumCover(albumId);
        }
        try {
            return await lazyLoader.loadAlbumCover(albumId, resolution);
        } catch (e) {
            console.error(`Failed to load album cover ${albumId}:`, e);
            throw e;
        }
    }

    async getOriginAlbumCover(albumId) {
        if (albumId == null) {
            return { objectURL: '', destroyObjectURL: () => {} };
        }
        try {
            return await lazyLoader.loadOriginAlbumCover(albumId);
        } catch (e) {
            console.error(`Failed to load origin album cover ${albumId}:`, e);
            throw e;
        }
    }

    async getMusicFile(songId) {
        try {
            return await lazyLoader.loadMusicFile(songId);
        } catch (e) {
            console.error(`Failed to load music file ${songId}:`, e);
            throw e;
        }
    }

    // ========== 搜索功能 ==========

    async searchTracks(keyword, options = {}) {
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
            this.searchLyrics(keyword, options),
        ]);
        return { tracks, albums, artists, lyrics };
    }

    // ========== 初始化 ==========

    async initApplication() {
        await invoke('init_application');
    }

    async isAvailable() {
        try {
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
                lastUpdateTimestamp: Date.now(),
            };
        }
    }

    async addUsersMusicDir(dir) {
        return await invoke("add_users_music_dir", { dir });
    }

    async getUsersMusicDir() {
        return await invoke("get_users_music_dir");
    }

    async getPerformanceReport() {
        return await this.performanceMonitor.getPerformanceReport();
    }

    async resetPerformanceStats() {
        return await this.performanceMonitor.resetStats();
    }

    async preloadResources(items) {
        return await lazyLoader.preloadBatch(items);
    }
}

export default TauriSource;
