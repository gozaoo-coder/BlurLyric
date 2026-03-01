/**
 * Source Base Class - API源抽象基类
 * 定义所有API源必须实现的标准接口
 */

export class Source {
    constructor(name, type) {
        this.name = name;
        this.type = type;
        this.enabled = true;
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
     * 通过ID获取专辑
     * @param {number} albumId 专辑ID
     * @returns {Promise<Object>} 专辑信息
     */
    async getAlbumById(albumId) {
        throw new Error('getAlbumById must be implemented');
    }

    /**
     * 通过专辑ID获取歌曲
     * @param {number} albumId 专辑ID
     * @returns {Promise<Array>} 歌曲列表
     */
    async getAlbumsSongsById(albumId) {
        throw new Error('getAlbumsSongsById must be implemented');
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
     * 通过ID获取艺术家
     * @param {number} artistId 艺术家ID
     * @returns {Promise<Object>} 艺术家信息
     */
    async getArtistById(artistId) {
        throw new Error('getArtistById must be implemented');
    }

    /**
     * 通过艺术家ID获取歌曲
     * @param {number} artistId 艺术家ID
     * @returns {Promise<Array>} 歌曲列表
     */
    async getArtistsSongsById(artistId) {
        throw new Error('getArtistsSongsById must be implemented');
    }

    // ========== 资源获取 ==========

    /**
     * 获取专辑封面
     * @param {number} albumId 专辑ID
     * @param {number} maxResolution 最大分辨率
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async getAlbumCover(albumId, maxResolution = 368) {
        throw new Error('getAlbumCover must be implemented');
    }

    /**
     * 获取音乐文件
     * @param {number} songId 歌曲ID
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
            name: this.name,
            type: this.type,
            enabled: this.enabled
        };
    }
}

export default Source;
