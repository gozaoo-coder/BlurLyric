/**
 * Web Source - Web API源实现
 * 继承Source基类，实现基于Web的音乐API接口
 */

import { Source } from './base.js';

export class WebSource extends Source {
    constructor(name, type = 'web', apiUrl = '') {
        super(name, type);
        this.apiUrl = apiUrl;
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.defaultCacheDuration = 5 * 60 * 1000; // 5分钟缓存
    }

    // ========== 缓存管理 ==========
    
    _getCacheKey(key) {
        return `${this.name}:${key}`;
    }

    _getFromCache(key) {
        const cacheKey = this._getCacheKey(key);
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && Date.now() > expiry) {
            this.cache.delete(cacheKey);
            this.cacheExpiry.delete(cacheKey);
            return null;
        }
        return this.cache.get(cacheKey);
    }

    _setCache(key, data, duration = this.defaultCacheDuration) {
        const cacheKey = this._getCacheKey(key);
        this.cache.set(cacheKey, data);
        this.cacheExpiry.set(cacheKey, Date.now() + duration);
    }

    _clearCache() {
        this.cache.clear();
        this.cacheExpiry.clear();
    }

    // ========== HTTP请求 ==========

    async _fetch(endpoint, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    }

    // ========== 音乐列表操作 ==========
    
    async getMusicList() {
        const cacheKey = 'musicList';
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        // Web API实现
        const result = await this._fetch('/playlist/track/all');
        this._setCache(cacheKey, result);
        return result;
    }

    async getAllMusicDirs() {
        // Web API通常没有目录概念，返回空数组
        return [];
    }

    async addMusicDirs(dirs) {
        // Web API不支持添加本地目录
        console.warn('WebSource does not support addMusicDirs');
        return Promise.resolve();
    }

    async removeMusicDirs(dirs) {
        // Web API不支持移除本地目录
        console.warn('WebSource does not support removeMusicDirs');
        return Promise.resolve();
    }

    async refreshMusicCache() {
        this._clearCache();
        return Promise.resolve();
    }

    // ========== 专辑操作 ==========

    async getAlbums() {
        const cacheKey = 'albums';
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this._fetch('/album/new');
        this._setCache(cacheKey, result);
        return result;
    }

    async getAlbumById(albumId) {
        const cacheKey = `album:${albumId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this._fetch(`/album?id=${albumId}`);
        this._setCache(cacheKey, result);
        return result;
    }

    async getAlbumsSongsById(albumId) {
        const album = await this.getAlbumById(albumId);
        return album?.songs || [];
    }

    // ========== 艺术家操作 ==========

    async getArtists() {
        const cacheKey = 'artists';
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        // Web API通常需要搜索或特定接口获取艺术家列表
        const result = await this._fetch('/top/artists');
        this._setCache(cacheKey, result);
        return result;
    }

    async getArtistById(artistId) {
        const cacheKey = `artist:${artistId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this._fetch(`/artist/detail?id=${artistId}`);
        this._setCache(cacheKey, result);
        return result;
    }

    async getArtistsSongsById(artistId) {
        const cacheKey = `artist:songs:${artistId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this._fetch(`/artist/songs?id=${artistId}`);
        this._setCache(cacheKey, result);
        return result;
    }

    // ========== 资源获取 ==========

    async getAlbumCover(albumId, maxResolution = 368) {
        // Web API通常直接返回图片URL
        const album = await this.getAlbumById(albumId);
        const picUrl = album?.album?.picUrl || album?.picUrl || '';
        
        if (!picUrl) {
            return { objectURL: '', destroyObjectURL: () => {} };
        }

        // 添加分辨率参数（如果支持）
        const sizedUrl = picUrl.includes('?') 
            ? `${picUrl}&param=${maxResolution}y${maxResolution}`
            : `${picUrl}?param=${maxResolution}y${maxResolution}`;

        return {
            objectURL: sizedUrl,
            destroyObjectURL: () => {} // Web URL不需要销毁
        };
    }

    async getMusicFile(songId) {
        // Web API获取音乐URL
        const result = await this._fetch(`/song/url?id=${songId}`);
        const url = result?.data?.[0]?.url;
        
        if (!url) {
            throw new Error('Music file URL not available');
        }

        return {
            objectURL: url,
            destroyObjectURL: () => {} // Web URL不需要销毁
        };
    }

    // ========== 搜索功能 ==========

    async searchTracks(keyword, options = {}) {
        const { limit = 30, offset = 0 } = options;
        const result = await this._fetch(
            `/search?keywords=${encodeURIComponent(keyword)}&type=1&limit=${limit}&offset=${offset}`
        );
        return result?.result?.songs || [];
    }

    async searchAlbums(keyword, options = {}) {
        const { limit = 30, offset = 0 } = options;
        const result = await this._fetch(
            `/search?keywords=${encodeURIComponent(keyword)}&type=10&limit=${limit}&offset=${offset}`
        );
        return result?.result?.albums || [];
    }

    async searchArtists(keyword, options = {}) {
        const { limit = 30, offset = 0 } = options;
        const result = await this._fetch(
            `/search?keywords=${encodeURIComponent(keyword)}&type=100&limit=${limit}&offset=${offset}`
        );
        return result?.result?.artists || [];
    }

    async searchLyrics(keyword, options = {}) {
        // 先搜索歌曲，然后获取歌词
        const tracks = await this.searchTracks(keyword, { limit: 10 });
        const lyrics = [];
        
        for (const track of tracks) {
            try {
                const lyricResult = await this._fetch(`/lyric?id=${track.id}`);
                if (lyricResult?.lrc?.lyric) {
                    lyrics.push({
                        id: track.id,
                        name: track.name,
                        lyric: lyricResult.lrc.lyric
                    });
                }
            } catch (e) {
                console.warn(`Failed to fetch lyric for track ${track.id}:`, e);
            }
        }
        
        return lyrics;
    }

    async searchAll(keyword, options = {}) {
        const [tracks, albums, artists, lyrics] = await Promise.allSettled([
            this.searchTracks(keyword, options),
            this.searchAlbums(keyword, options),
            this.searchArtists(keyword, options),
            this.searchLyrics(keyword, options)
        ]);

        return {
            tracks: tracks.status === 'fulfilled' ? tracks.value : [],
            albums: albums.status === 'fulfilled' ? albums.value : [],
            artists: artists.status === 'fulfilled' ? artists.value : [],
            lyrics: lyrics.status === 'fulfilled' ? lyrics.value : []
        };
    }

    // ========== 初始化 ==========

    async initApplication() {
        // Web API初始化
        console.log('WebSource initialized:', this.name);
        return Promise.resolve();
    }

    async isAvailable() {
        try {
            await this._fetch('/');
            return true;
        } catch {
            return false;
        }
    }

    // ========== WebSource特有方法 ==========

    setApiUrl(apiUrl) {
        this.apiUrl = apiUrl;
        this._clearCache();
    }

    getApiUrl() {
        return this.apiUrl;
    }
}

export default WebSource;
