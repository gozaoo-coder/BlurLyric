/**
 * Source Base Class - API 源抽象基类
 * 
 * 设计原则：
 * 1. 不硬编码任何具体平台名称
 * 2. 通过 sourceId 标识用户配置的数据源
 * 3. 通过 baseUrl 作为 API 源配置
 * 4. 符合接口规范即可接入
 */

import { Trace, TraceDataType, SourceType as TraceSourceType, FetchMethodType } from './trace.js';

/**
 * SourceType 常量（兼容旧代码）
 * @readonly
 * @enum {string}
 */
export const SOURCE_TYPE = {
    STORAGE: 'storage',    // 存储型：本地文件、WebDAV 等
    API: 'api'             // API 型：网络音乐 API
};

/**
 * Source - 数据源抽象基类
 * 所有数据源必须实现此接口
 */
export class Source {
    /**
     * @param {string} sourceId - 数据源唯一标识（用户自定义）
     * @param {string} sourceName - 数据源显示名称
     * @param {string} type - 具体类型 (tauri/webdav/api)
     * @param {string} sourceType - STORAGE 或 API
     * @param {string} [baseUrl] - API 基础地址（API 型数据源需要）
     */
    constructor(sourceId, sourceName, type, sourceType, baseUrl = '') {
        this.sourceId = sourceId;       // 数据源唯一标识（用户自定义）
        this.sourceName = sourceName;   // 数据源显示名称
        this.type = type;               // 具体类型 (tauri/webdav/api)
        this.sourceType = sourceType;   // STORAGE 或 API
        this.baseUrl = baseUrl;         // API 基础地址
        this.enabled = true;
    }

    // ========== 来源类型检查 ==========

    /**
     * 获取数据源类型
     * @returns {string} STORAGE 或 API
     */
    getSourceType() {
        return this.sourceType;
    }

    /**
     * 是否为存储型数据源
     * @returns {boolean}
     */
    isStorageSource() {
        return this.sourceType === SOURCE_TYPE.STORAGE;
    }

    /**
     * 是否为 API 型数据源
     * @returns {boolean}
     */
    isApiSource() {
        return this.sourceType === SOURCE_TYPE.API;
    }

    // ========== Trace 创建方法 ==========

    /**
     * 创建本地文件 Trace
     * @param {string} dataType - 数据类型
     * @param {string} dataId - 数据 ID
     * @param {string} path - 文件路径
     * @returns {Trace}
     */
    createLocalTrace(dataType, dataId, path) {
        return Trace.createLocalFile(path, dataType, dataId);
    }

    /**
     * 创建 API 来源 Trace
     * @param {string} dataType - 数据类型
     * @param {string} dataId - 数据 ID
     * @param {Object} fetchMethod - 获取方法
     * @returns {Trace}
     */
    createApiTrace(dataType, dataId, fetchMethod) {
        return Trace.createApiSource(
            this.sourceId,
            this.sourceName,
            this.baseUrl,
            dataType,
            dataId,
            fetchMethod
        );
    }

    // ========== 音乐列表操作 ==========

    /**
     * 获取音乐列表
     * @returns {Promise<Array>} 音乐列表
     */
    async getMusicList() {
        throw new Error('getMusicList must be implemented');
    }

    /**
     * 获取所有音乐目录
     * @returns {Promise<Array>} 目录列表
     */
    async getAllMusicDirs() {
        throw new Error('getAllMusicDirs must be implemented');
    }

    /**
     * 添加音乐目录
     * @param {string|Array} dirs 目录或目录数组
     * @returns {Promise<void>}
     */
    async addMusicDirs(dirs) {
        throw new Error('addMusicDirs must be implemented');
    }

    /**
     * 移除音乐目录
     * @param {string|Array} dirs 目录或目录数组
     * @returns {Promise<void>}
     */
    async removeMusicDirs(dirs) {
        throw new Error('removeMusicDirs must be implemented');
    }

    /**
     * 刷新音乐缓存
     * @returns {Promise<void>}
     */
    async refreshMusicCache() {
        throw new Error('refreshMusicCache must be implemented');
    }

    // ========== 专辑操作 ==========

    /**
     * 获取所有专辑
     * @returns {Promise<Array>} 专辑列表
     */
    async getAlbums() {
        throw new Error('getAlbums must be implemented');
    }

    /**
     * 通过 ID 获取专辑
     * @param {number|string} albumId 专辑 ID
     * @returns {Promise<Object>} 专辑信息
     */
    async getAlbumById(albumId) {
        throw new Error('getAlbumById must be implemented');
    }

    /**
     * 通过专辑 ID 获取歌曲
     * @param {number|string} albumId 专辑 ID
     * @returns {Promise<Array>} 歌曲列表
     */
    async getAlbumsSongsById(albumId) {
        throw new Error('getAlbumsSongsById must be implemented');
    }

    /**
     * 获取专辑详情（含 Trace）
     * @param {string} albumId 专辑 ID
     * @returns {Promise<Object>} 专辑详情
     */
    async getAlbumDetail(albumId) {
        throw new Error('getAlbumDetail must be implemented');
    }

    // ========== 艺术家操作 ==========

    /**
     * 获取所有艺术家
     * @returns {Promise<Array>} 艺术家列表
     */
    async getArtists() {
        throw new Error('getArtists must be implemented');
    }

    /**
     * 通过 ID 获取艺术家
     * @param {number|string} artistId 艺术家 ID
     * @returns {Promise<Object>} 艺术家信息
     */
    async getArtistById(artistId) {
        throw new Error('getArtistById must be implemented');
    }

    /**
     * 通过艺术家 ID 获取歌曲
     * @param {number|string} artistId 艺术家 ID
     * @returns {Promise<Array>} 歌曲列表
     */
    async getArtistsSongsById(artistId) {
        throw new Error('getArtistsSongsById must be implemented');
    }

    /**
     * 获取艺术家详情（含 Trace）
     * @param {string} artistId 艺术家 ID
     * @returns {Promise<Object>} 艺术家详情
     */
    async getArtistDetail(artistId) {
        throw new Error('getArtistDetail must be implemented');
    }

    // ========== 资源获取 ==========

    /**
     * 获取专辑封面
     * @param {number|string} albumId 专辑 ID
     * @param {number} maxResolution 最大分辨率
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async getAlbumCover(albumId, maxResolution = 368) {
        throw new Error('getAlbumCover must be implemented');
    }

    /**
     * 获取音乐文件
     * @param {number|string} songId 歌曲 ID
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async getMusicFile(songId) {
        throw new Error('getMusicFile must be implemented');
    }

    // ========== 搜索功能 ==========

    /**
     * 搜索歌曲
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<Array>} 搜索结果
     */
    async searchTracks(keyword, options = {}) {
        throw new Error('searchTracks must be implemented');
    }

    /**
     * 搜索专辑
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<Array>} 搜索结果
     */
    async searchAlbums(keyword, options = {}) {
        throw new Error('searchAlbums must be implemented');
    }

    /**
     * 搜索艺术家
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<Array>} 搜索结果
     */
    async searchArtists(keyword, options = {}) {
        throw new Error('searchArtists must be implemented');
    }

    /**
     * 搜索歌词
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<Array>} 搜索结果
     */
    async searchLyrics(keyword, options = {}) {
        throw new Error('searchLyrics must be implemented');
    }

    /**
     * 综合搜索
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<Object>} 搜索结果 {tracks, albums, artists, lyrics}
     */
    async searchAll(keyword, options = {}) {
        throw new Error('searchAll must be implemented');
    }

    // ========== 歌单功能（API 型数据源） ==========

    /**
     * 获取用户歌单列表
     * @param {string} [userId] 用户 ID
     * @returns {Promise<Array>} 歌单列表
     */
    async getUserPlaylists(userId) {
        throw new Error('getUserPlaylists must be implemented');
    }

    /**
     * 获取歌单详情
     * @param {string} playlistId 歌单 ID
     * @returns {Promise<Object>} 歌单详情
     */
    async getPlaylistDetail(playlistId) {
        throw new Error('getPlaylistDetail must be implemented');
    }

    /**
     * 获取歌曲详情（含 Trace）
     * @param {string} trackId 歌曲 ID
     * @returns {Promise<Object>} 歌曲详情
     */
    async getTrackDetail(trackId) {
        throw new Error('getTrackDetail must be implemented');
    }

    // ========== 初始化 ==========

    /**
     * 初始化应用
     * @returns {Promise<void>}
     */
    async initApplication() {
        throw new Error('initApplication must be implemented');
    }

    /**
     * 检查源是否可用
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        return this.enabled;
    }

    /**
     * 获取源信息
     * @returns {Object}
     */
    getInfo() {
        return {
            sourceId: this.sourceId,
            sourceName: this.sourceName,
            type: this.type,
            sourceType: this.sourceType,
            enabled: this.enabled
        };
    }

    // ========== 向后兼容属性 ==========

    /**
     * @deprecated 使用 sourceName 代替
     */
    get name() {
        return this.sourceName;
    }
}

export default Source;
