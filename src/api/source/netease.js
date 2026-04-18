/**
 * NeteaseSource - 网易云音乐 API 适配器
 * 
 * 基于 NeteaseCloudMusicApiEnhanced 项目实现
 * 项目地址: https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced
 * 
 * ==================== API 端点映射 ====================
 * 
 * 搜索:
 *   - 歌曲: /search?keywords=xxx&type=1&limit=30&offset=0
 *   - 专辑: /search?keywords=xxx&type=10&limit=30&offset=0
 *   - 歌手: /search?keywords=xxx&type=100&limit=30&offset=0
 * 
 * 详情:
 *   - 歌曲详情: /song/detail?ids=xxx
 *   - 专辑详情: /album?id=xxx
 *   - 歌手详情: /artist/detail?id=xxx
 *   - 歌手歌曲: /artist/songs?id=xxx
 * 
 * 资源:
 *   - 歌曲URL: /song/url?id=xxx&br=320000
 *   - 歌词: /lyric?id=xxx
 * 
 * 歌单:
 *   - 用户歌单: /user/playlist?uid=xxx
 *   - 歌单详情: /playlist/detail?id=xxx
 * 
 * ==================== 使用规范 ====================
 * 
 * // 创建实例
 * const netease = new NeteaseSource('netease', '网易云音乐', 'http://localhost:3000');
 * 
 * // 搜索歌曲
 * const result = await netease.searchTracks('周杰伦');
 * 
 * // 获取歌曲详情
 * const track = await netease.getTrackDetail('123456');
 * 
 * // 获取播放URL
 * const url = await netease.getTrackResourceUrl('123456');
 */

import { WebSource } from './web.js';
import { Trace, TraceDataType, FetchMethodType } from './trace.js';

/**
 * NeteaseCloudMusicApiEnhanced 适配器
 * 继承 WebSource，实现网易云音乐 API 的具体接口
 */
export class NeteaseSource extends WebSource {
    /**
     * @param {string} sourceId - 数据源唯一标识（用户自定义）
     * @param {string} sourceName - 数据源显示名称
     * @param {string} baseUrl - API 基础地址（如 http://localhost:3000）
     * @param {Object} [config] - 额外配置
     * @param {number} [config.defaultBitrate=320000] - 默认音质（320kbps）
     * @param {boolean} [config.enableFlac=true] - 是否启用无损音质
     */
    constructor(sourceId, sourceName, baseUrl, config = {}) {
        super(sourceId, sourceName, baseUrl, config);
        this.defaultBitrate = config.defaultBitrate || 320000;
        this.enableFlac = config.enableFlac !== false;
    }

    // ========== 搜索功能实现 ==========

    /**
     * 搜索歌曲
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @param {number} [options.limit=30] - 返回数量
     * @param {number} [options.offset=0] - 偏移量
     * @returns {Promise<{tracks: Array, total: number, hasMore: boolean}>}
     */
    async searchTracks(keyword, options = {}) {
        const { limit = 30, offset = 0 } = options;
        const cacheKey = `search_tracks:${keyword}:${offset}:${limit}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(
                `/search?keywords=${encodeURIComponent(keyword)}&type=1&limit=${limit}&offset=${offset}`
            );

            const tracks = (result?.result?.songs || []).map(song => this.parseTrack(song));
            const response = {
                tracks,
                total: result?.result?.songCount || tracks.length,
                hasMore: (offset + limit) < (result?.result?.songCount || 0)
            };

            this._setCache(cacheKey, response);
            return response;
        } catch (e) {
            console.error('Failed to search tracks:', e);
            return { tracks: [], total: 0, hasMore: false };
        }
    }

    /**
     * 搜索专辑
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @returns {Promise<{albums: Array, total: number, hasMore: boolean}>}
     */
    async searchAlbums(keyword, options = {}) {
        const { limit = 30, offset = 0 } = options;
        const cacheKey = `search_albums:${keyword}:${offset}:${limit}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(
                `/search?keywords=${encodeURIComponent(keyword)}&type=10&limit=${limit}&offset=${offset}`
            );

            const albums = (result?.result?.albums || []).map(album => this.parseAlbum(album));
            const response = {
                albums,
                total: result?.result?.albumCount || albums.length,
                hasMore: (offset + limit) < (result?.result?.albumCount || 0)
            };

            this._setCache(cacheKey, response);
            return response;
        } catch (e) {
            console.error('Failed to search albums:', e);
            return { albums: [], total: 0, hasMore: false };
        }
    }

    /**
     * 搜索艺术家
     * @param {string} keyword - 搜索关键词
     * @param {Object} options - 搜索选项
     * @returns {Promise<{artists: Array, total: number, hasMore: boolean}>}
     */
    async searchArtists(keyword, options = {}) {
        const { limit = 30, offset = 0 } = options;
        const cacheKey = `search_artists:${keyword}:${offset}:${limit}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(
                `/search?keywords=${encodeURIComponent(keyword)}&type=100&limit=${limit}&offset=${offset}`
            );

            const artists = (result?.result?.artists || []).map(artist => this.parseArtist(artist));
            const response = {
                artists,
                total: result?.result?.artistCount || artists.length,
                hasMore: (offset + limit) < (result?.result?.artistCount || 0)
            };

            this._setCache(cacheKey, response);
            return response;
        } catch (e) {
            console.error('Failed to search artists:', e);
            return { artists: [], total: 0, hasMore: false };
        }
    }

    // ========== 详情获取实现 ==========

    /**
     * 获取歌曲详情
     * @param {string} trackId - 歌曲 ID
     * @returns {Promise<Object>}
     */
    async getTrackDetail(trackId) {
        const actualId = this.extractOriginalId(trackId);
        const cacheKey = `track:${actualId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(`/song/detail?ids=${actualId}`);
            const track = result?.songs?.[0];

            if (!track) {
                throw new Error(`Track not found: ${trackId}`);
            }

            const parsedTrack = this.parseTrack(track);
            this._setCache(cacheKey, parsedTrack);
            return parsedTrack;
        } catch (e) {
            console.error('Failed to get track detail:', e);
            throw e;
        }
    }

    /**
     * 获取专辑详情
     * @param {string} albumId - 专辑 ID
     * @returns {Promise<Object>}
     */
    async getAlbumDetail(albumId) {
        const actualId = this.extractOriginalId(albumId);
        const cacheKey = `album:${actualId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(`/album?id=${actualId}`);
            const album = this.parseAlbum(result?.album || result);
            album.tracks = (result?.songs || []).map(song => this.parseTrack(song));

            this._setCache(cacheKey, album);
            return album;
        } catch (e) {
            console.error('Failed to get album detail:', e);
            throw e;
        }
    }

    /**
     * 获取艺术家详情
     * @param {string} artistId - 艺术家 ID
     * @returns {Promise<Object>}
     */
    async getArtistDetail(artistId) {
        const actualId = this.extractOriginalId(artistId);
        const cacheKey = `artist:${actualId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(`/artist/detail?id=${actualId}`);
            const artist = this.parseArtist(result?.data?.artist || result?.artist);

            // 获取热门歌曲
            const songsResult = await this._fetch(`/artist/songs?id=${actualId}`);
            artist.topTracks = (songsResult?.songs || []).map(song => this.parseTrack(song));

            this._setCache(cacheKey, artist);
            return artist;
        } catch (e) {
            console.error('Failed to get artist detail:', e);
            throw e;
        }
    }

    // ========== 歌单功能实现 ==========

    /**
     * 获取用户歌单列表
     * @param {string} userId - 用户 ID
     * @returns {Promise<Array>}
     */
    async getUserPlaylists(userId) {
        const actualId = this.extractOriginalId(userId);
        try {
            const result = await this._fetch(`/user/playlist?uid=${actualId}`);
            return (result?.playlist || []).map(playlist => this.parsePlaylist(playlist));
        } catch (e) {
            console.error('Failed to get user playlists:', e);
            return [];
        }
    }

    /**
     * 获取歌单详情
     * @param {string} playlistId - 歌单 ID
     * @returns {Promise<Object>}
     */
    async getPlaylistDetail(playlistId) {
        const actualId = this.extractOriginalId(playlistId);
        const cacheKey = `playlist:${actualId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(`/playlist/detail?id=${actualId}`);
            const playlist = this.parsePlaylist(result?.playlist);

            // 获取歌单歌曲（分批获取，最多 100 首）
            const trackIds = (playlist.trackIds || []).slice(0, 100);
            if (trackIds.length > 0) {
                const idsParam = trackIds.join(',');
                const tracksResult = await this._fetch(`/song/detail?ids=${idsParam}`);
                playlist.tracks = (tracksResult?.songs || []).map(song => this.parseTrack(song));
            }

            this._setCache(cacheKey, playlist);
            return playlist;
        } catch (e) {
            console.error('Failed to get playlist detail:', e);
            throw e;
        }
    }

    // ========== 资源获取实现 ==========

    /**
     * 获取音频资源 URL
     * @param {string} trackId - 歌曲 ID
     * @param {Object} options - 音质选项
     * @param {number} [options.bitrate] - 音质（默认使用配置的音质）
     * @returns {Promise<{url: string, format: string, bitrate: number, size: number, expiresAt: number}>}
     */
    async getTrackResourceUrl(trackId, options = {}) {
        const actualId = this.extractOriginalId(trackId);
        const bitrate = options.bitrate || this.defaultBitrate;

        try {
            const result = await this._fetch(`/song/url?id=${actualId}&br=${bitrate}`);
            const data = result?.data?.[0];

            if (!data?.url) {
                // 尝试获取无损音质
                if (this.enableFlac && bitrate !== 999000) {
                    const flacResult = await this._fetch(`/song/url?id=${actualId}&br=999000`);
                    const flacData = flacResult?.data?.[0];
                    if (flacData?.url) {
                        return {
                            url: flacData.url,
                            format: flacData.type || 'flac',
                            bitrate: flacData.br || 999000,
                            size: flacData.size || 0,
                            expiresAt: Date.now() + 3600000
                        };
                    }
                }
                throw new Error('Music file URL not available');
            }

            return {
                url: data.url,
                format: data.type || 'mp3',
                bitrate: data.br || bitrate,
                size: data.size || 0,
                expiresAt: Date.now() + 3600000
            };
        } catch (e) {
            console.error('Failed to get track resource URL:', e);
            throw e;
        }
    }

    /**
     * 获取封面图片 URL
     * @param {string} coverId - 封面 ID 或 URL
     * @param {number} [size=368] - 图片尺寸
     * @returns {Promise<string>}
     */
    async getCoverUrl(coverId, size = 368) {
        if (coverId?.startsWith('http')) {
            // 网易云图片 URL 添加尺寸参数
            if (coverId.includes('127.0.0.1') || coverId.includes('localhost')) {
                return coverId;
            }
            return `${coverId}?param=${size}y${size}`;
        }

        return `${this.baseUrl}/cover?id=${coverId}&size=${size}`;
    }

    /**
     * 获取歌词
     * @param {string} trackId - 歌曲 ID
     * @returns {Promise<{lyric: string, tlyric: string}>}
     */
    async getLyric(trackId) {
        const actualId = this.extractOriginalId(trackId);
        try {
            const result = await this._fetch(`/lyric?id=${actualId}`);
            return {
                lyric: result?.lrc?.lyric || '',
                tlyric: result?.tlyric?.lyric || ''
            };
        } catch (e) {
            console.error('Failed to get lyric:', e);
            return { lyric: '', tlyric: '' };
        }
    }

    /**
     * 获取专辑封面
     * @param {number|string} albumId - 专辑 ID
     * @param {number} [maxResolution=368] - 最大分辨率
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async getAlbumCover(albumId, maxResolution = 368) {
        const album = await this.getAlbumDetail(albumId);
        const picUrl = album?.coverUrl || album?.picUrl || '';

        if (!picUrl) {
            return { objectURL: '', destroyObjectURL: () => { } };
        }

        const sizedUrl = await this.getCoverUrl(picUrl, maxResolution);

        return {
            objectURL: sizedUrl,
            destroyObjectURL: () => { }
        };
    }

    /**
     * 获取音乐文件
     * @param {number|string} songId - 歌曲 ID
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async getMusicFile(songId) {
        const resourceUrl = await this.getTrackResourceUrl(songId);

        return {
            objectURL: resourceUrl.url,
            destroyObjectURL: () => { }
        };
    }

    // ========== 数据解析方法 ==========

    /**
     * 解析歌曲数据
     * @param {Object} song - 原始歌曲数据
     * @returns {Object}
     */
    parseTrack(song) {
        const originalId = String(song.id);
        
        return {
            id: originalId,
            name: song.name || '未知歌曲',
            artists: (song.ar || song.artists || []).map(a => ({
                id: String(a.id),
                name: a.name || '未知艺术家'
            })),
            album: {
                id: String(song.al?.id || song.album?.id || -1),
                name: song.al?.name || song.album?.name || '未知专辑',
                picUrl: song.al?.picUrl || song.album?.picUrl || ''
            },
            duration: Math.floor((song.dt || song.duration || 0) / 1000),
            trackNumber: song.no || 0,
            traces: [this.createTrackTrace(originalId, {
                format: 'mp3',
                bitrate: song.h?.br || this.defaultBitrate,
                url: null
            })]
        };
    }

    /**
     * 解析专辑数据
     * @param {Object} album - 原始专辑数据
     * @returns {Object}
     */
    parseAlbum(album) {
        const originalId = String(album.id);

        return {
            id: originalId,
            name: album.name || '未知专辑',
            artists: (album.ar || album.artists || []).map(a => ({
                id: String(a.id),
                name: a.name || '未知艺术家'
            })),
            coverUrl: album.picUrl || album.coverImgUrl || album.blurPicUrl || '',
            picUrl: album.picUrl || album.coverImgUrl || album.blurPicUrl || '',
            year: album.publishTime ? new Date(album.publishTime).getFullYear() : null,
            description: album.description || '',
            trackCount: album.size || album.trackCount || 0,
            traces: [this.createAlbumTrace(originalId)]
        };
    }

    /**
     * 解析艺术家数据
     * @param {Object} artist - 原始艺术家数据
     * @returns {Object}
     */
    parseArtist(artist) {
        const originalId = String(artist.id);

        return {
            id: originalId,
            name: artist.name || '未知艺术家',
            alias: artist.alias || [],
            avatarUrl: artist.picUrl || artist.avatarUrl || artist.img1v1Url || '',
            albumCount: artist.albumSize || artist.albumCount || 0,
            briefDesc: artist.briefDesc || '',
            traces: [this.createArtistTrace(originalId)]
        };
    }

    /**
     * 解析歌单数据
     * @param {Object} playlist - 原始歌单数据
     * @returns {Object}
     */
    parsePlaylist(playlist) {
        const originalId = String(playlist.id);

        return {
            id: originalId,
            name: playlist.name || '未知歌单',
            description: playlist.description || '',
            coverUrl: playlist.coverImgUrl || '',
            trackCount: playlist.trackCount || 0,
            playCount: playlist.playCount || 0,
            creator: {
                id: String(playlist.creator?.userId || playlist.creator?.id || ''),
                name: playlist.creator?.nickname || ''
            },
            trackIds: (playlist.trackIds || []).map(t => t.id || t),
            traces: [this.createApiTrace(
                TraceDataType.PLAYLIST,
                originalId,
                {
                    type: FetchMethodType.API_CALL,
                    params: {
                        endpoint: `/playlist/detail?id=${originalId}`,
                        params: {}
                    }
                }
            )]
        };
    }

    // ========== 工具方法 ==========

    /**
     * 从复合 ID 中提取原始 ID
     * @param {string} compositeId - 复合 ID（可能包含 sourceId 前缀）
     * @returns {string}
     */
    extractOriginalId(compositeId) {
        if (typeof compositeId !== 'string') {
            return String(compositeId);
        }

        // 如果 ID 包含下划线，可能是 sourceId_id 格式
        if (compositeId.includes('_')) {
            const parts = compositeId.split('_');
            // 如果第一部分是 sourceId，返回后面的部分
            if (parts[0] === this.sourceId) {
                return parts.slice(1).join('_');
            }
        }

        return compositeId;
    }

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
     * @returns {Trace}
     */
    createAlbumTrace(albumId) {
        return this.createApiTrace(
            TraceDataType.ALBUM,
            albumId,
            {
                type: FetchMethodType.API_CALL,
                params: {
                    endpoint: `/album?id=${albumId}`,
                    params: {}
                }
            }
        );
    }

    /**
     * 创建艺术家 Trace
     * @param {string} artistId - 艺术家 ID
     * @returns {Trace}
     */
    createArtistTrace(artistId) {
        return this.createApiTrace(
            TraceDataType.ARTIST,
            artistId,
            {
                type: FetchMethodType.API_CALL,
                params: {
                    endpoint: `/artist/detail?id=${artistId}`,
                    params: {}
                }
            }
        );
    }

    /**
     * 检查源是否可用
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const result = await this._fetch('/');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取源信息
     * @returns {Object}
     */
    getSourceInfo() {
        return {
            ...this.getInfo(),
            type: 'netease',
            features: {
                search: true,
                trackDetail: true,
                albumDetail: true,
                artistDetail: true,
                playlist: true,
                lyric: true,
                flac: this.enableFlac
            }
        };
    }
}

export default NeteaseSource;
