/**
 * ApiSource - API 型数据源抽象类
 * 
 * 特点：
 * 1. 全曲库数据量巨大，不支持全量同步
 * 2. 通过搜索/歌单等方式按需获取 Track 信息
 * 3. 返回的 Track 只包含元数据和来源信息，不含实际音频资源
 * 4. 资源需通过 ResourceManager 下载到本地后才可播放
 * 
 * 设计原则：
 * - 不硬编码任何具体音乐平台名称
 * - 通过 sourceId 标识用户配置的数据源
 * - 通过 baseUrl 作为 API 源配置
 * - 符合接口规范即可接入
 */

import { Source, SOURCE_TYPE } from './base.js';
import { Trace, TraceDataType, FetchMethodType } from './trace.js';

export class ApiSource extends Source {
    /**
     * @param {string} sourceId - 数据源唯一标识（用户自定义）
     * @param {string} sourceName - 数据源显示名称
     * @param {string} baseUrl - API 基础地址
     * @param {Object} [config] - 额外配置
     */
    constructor(sourceId, sourceName, baseUrl, config = {}) {
        super(sourceId, sourceName, 'api', SOURCE_TYPE.API);
        this.baseUrl = baseUrl;
        this.config = config;
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.defaultCacheDuration = 5 * 60 * 1000; // 5 分钟缓存
    }

    // ========== 缓存管理 ==========
    
    _getCacheKey(key) {
        return `${this.sourceId}:${key}`;
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

    // ========== HTTP 请求 ==========

    /**
     * 发送 HTTP 请求
     * @param {string} endpoint - API 端点
     * @param {Object} options - 请求选项
     * @returns {Promise<any>}
     */
    async _fetch(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
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

    // ========== Trace 创建 ==========

    /**
     * 创建歌曲 Trace
     * @param {string} trackId - 歌曲 ID
     * @param {Object} metadata - 歌曲元数据
     * @returns {Trace}
     */
    createTrackTrace(trackId, metadata = {}) {
        return this.createApiTrace(
            TraceDataType.TRACK,
            trackId,
            {
                type: FetchMethodType.DOWNLOAD,
                params: {
                    url: metadata.url || '',
                    format: metadata.format || 'mp3'
                }
            }
        );
    }

    /**
     * 创建专辑 Trace
     * @param {string} albumId - 专辑 ID
     * @param {Object} metadata - 专辑元数据
     * @returns {Trace}
     */
    createAlbumTrace(albumId, metadata = {}) {
        return this.createApiTrace(
            TraceDataType.ALBUM,
            albumId,
            {
                type: FetchMethodType.API_CALL,
                params: {
                    endpoint: `/album/${albumId}`,
                    params: {}
                }
            }
        );
    }

    /**
     * 创建艺术家 Trace
     * @param {string} artistId - 艺术家 ID
     * @param {Object} metadata - 艺术家元数据
     * @returns {Trace}
     */
    createArtistTrace(artistId, metadata = {}) {
        return this.createApiTrace(
            TraceDataType.ARTIST,
            artistId,
            {
                type: FetchMethodType.API_CALL,
                params: {
                    endpoint: `/artist/${artistId}`,
                    params: {}
                }
            }
        );
    }

    // ========== 搜索功能 ==========

    /**
     * 搜索歌曲
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<{tracks: Array, total: number, hasMore: boolean}>}
     * 
     * 返回的 TrackInfo 包含：
     * - 基本信息：name, artists, album, duration
     * - 来源信息：sources[] (平台 ID、获取 URL 的方法等)
     * - 不包含实际音频资源
     */
    async searchTracks(keyword, options = {}) {
        throw new Error('searchTracks must be implemented');
    }

    /**
     * 搜索专辑
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<{albums: Array, total: number, hasMore: boolean}>}
     */
    async searchAlbums(keyword, options = {}) {
        throw new Error('searchAlbums must be implemented');
    }

    /**
     * 搜索艺术家
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<{artists: Array, total: number, hasMore: boolean}>}
     */
    async searchArtists(keyword, options = {}) {
        throw new Error('searchArtists must be implemented');
    }

    // ========== 详情获取 ==========

    /**
     * 获取歌曲详情（包含来源信息）
     * @param {string} trackId 歌曲 ID
     * @returns {Promise<Object>}
     */
    async getTrackDetail(trackId) {
        throw new Error('getTrackDetail must be implemented');
    }

    /**
     * 获取专辑详情（包含曲目列表）
     * @param {string} albumId 专辑 ID
     * @returns {Promise<Object>}
     */
    async getAlbumDetail(albumId) {
        throw new Error('getAlbumDetail must be implemented');
    }

    /**
     * 获取艺术家详情
     * @param {string} artistId 艺术家 ID
     * @returns {Promise<Object>}
     */
    async getArtistDetail(artistId) {
        throw new Error('getArtistDetail must be implemented');
    }

    // ========== 歌单功能 ==========

    /**
     * 获取用户歌单列表
     * @param {string} [userId] 用户 ID
     * @returns {Promise<Array>}
     */
    async getUserPlaylists(userId) {
        throw new Error('getUserPlaylists must be implemented');
    }

    /**
     * 获取歌单详情
     * @param {string} playlistId 歌单 ID
     * @returns {Promise<Object>}
     */
    async getPlaylistDetail(playlistId) {
        throw new Error('getPlaylistDetail must be implemented');
    }

    // ========== 资源获取（返回 URL，不直接播放）==========

    /**
     * 获取音频资源 URL
     * @param {string} trackId 歌曲 ID
     * @param {Object} options 音质选项等
     * @returns {Promise<{url: string, format: string, bitrate: number, size: number, expiresAt: number}>}
     */
    async getTrackResourceUrl(trackId, options = {}) {
        throw new Error('getTrackResourceUrl must be implemented');
    }

    /**
     * 获取封面图片 URL
     * @param {string} coverId 封面 ID 或 URL
     * @returns {Promise<string>} 图片 URL
     */
    async getCoverUrl(coverId) {
        throw new Error('getCoverUrl must be implemented');
    }

    /**
     * 获取歌词
     * @param {string} trackId 歌曲 ID
     * @returns {Promise<Object>}
     */
    async getLyric(trackId) {
        throw new Error('getLyric must be implemented');
    }

    // ========== 来源信息生成 ==========

    /**
     * 为 Track 生成来源信息
     * @param {string} trackId 歌曲 ID
     * @param {Object} metadata 歌曲元数据
     * @returns {Object}
     */
    createSourceInfo(trackId, metadata) {
        return {
            sourceType: this.type,
            sourceId: trackId,
            sourceName: this.sourceName,
            resourceUrl: null,
            resourceInfo: {
                format: metadata.format,
                bitrate: metadata.bitrate,
                size: metadata.size
            },
            metadata: {
                platform: this.type,
                ...metadata
            }
        };
    }

    // ========== 本地源不支持的接口 ==========

    async getMusicList() {
        // API 型数据源不支持全量获取
        console.warn('ApiSource does not support getMusicList');
        return [];
    }

    async getAllMusicDirs() {
        // API 型数据源没有目录概念
        return [];
    }

    async addMusicDirs(dirs) {
        console.warn('ApiSource does not support addMusicDirs');
        return Promise.resolve();
    }

    async removeMusicDirs(dirs) {
        console.warn('ApiSource does not support removeMusicDirs');
        return Promise.resolve();
    }

    async refreshMusicCache() {
        this._clearCache();
        return Promise.resolve();
    }

    async getAlbums() {
        // API 型数据源不支持全量获取
        console.warn('ApiSource does not support getAlbums');
        return [];
    }

    async getArtists() {
        // API 型数据源不支持全量获取
        console.warn('ApiSource does not support getArtists');
        return [];
    }

    async getAlbumById(albumId) {
        return this.getAlbumDetail(albumId);
    }

    async getAlbumsSongsById(albumId) {
        const album = await this.getAlbumDetail(albumId);
        return album?.tracks || [];
    }

    async getArtistById(artistId) {
        return this.getArtistDetail(artistId);
    }

    async getArtistsSongsById(artistId) {
        const artist = await this.getArtistDetail(artistId);
        return artist?.topTracks || [];
    }

    // ========== 初始化 ==========

    async initApplication() {
        console.log('ApiSource initialized:', this.sourceName);
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

    // ========== ApiSource 特有方法 ==========

    /**
     * 设置 API URL
     * @param {string} baseUrl - API 基础地址
     */
    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
        this._clearCache();
    }

    /**
     * 获取 API URL
     * @returns {string}
     */
    getBaseUrl() {
        return this.baseUrl;
    }
}

export default ApiSource;
