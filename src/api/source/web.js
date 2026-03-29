/**
 * WebSource - Web API 源实现
 * 
 * 继承 ApiSource，实现基于 Web 的音乐 API 接口
 * 这是一个通用实现，具体平台可通过继承此类实现特定接口
 */

import { ApiSource } from './api.js';
import { TraceDataType, FetchMethodType } from './trace.js';

export class WebSource extends ApiSource {
    /**
     * @param {string} sourceId - 数据源唯一标识
     * @param {string} sourceName - 数据源显示名称
     * @param {string} apiUrl - API 基础地址
     * @param {Object} [config] - 额外配置
     */
    constructor(sourceId, sourceName, apiUrl, config = {}) {
        super(sourceId, sourceName, apiUrl, config);
    }

    // ========== 搜索功能实现 ==========

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
                hasMore: result?.result?.hasMore || false
            };
            
            this._setCache(cacheKey, response);
            return response;
        } catch (e) {
            console.error('Failed to search tracks:', e);
            return { tracks: [], total: 0, hasMore: false };
        }
    }

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
                hasMore: result?.result?.hasMore || false
            };
            
            this._setCache(cacheKey, response);
            return response;
        } catch (e) {
            console.error('Failed to search albums:', e);
            return { albums: [], total: 0, hasMore: false };
        }
    }

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
                hasMore: result?.result?.hasMore || false
            };
            
            this._setCache(cacheKey, response);
            return response;
        } catch (e) {
            console.error('Failed to search artists:', e);
            return { artists: [], total: 0, hasMore: false };
        }
    }

    async searchAll(keyword, options = {}) {
        const [tracksResult, albumsResult, artistsResult] = await Promise.allSettled([
            this.searchTracks(keyword, options),
            this.searchAlbums(keyword, options),
            this.searchArtists(keyword, options)
        ]);

        return {
            tracks: tracksResult.status === 'fulfilled' ? tracksResult.value.tracks : [],
            albums: albumsResult.status === 'fulfilled' ? albumsResult.value.albums : [],
            artists: artistsResult.status === 'fulfilled' ? artistsResult.value.artists : []
        };
    }

    // ========== 详情获取实现 ==========

    async getTrackDetail(trackId) {
        const cacheKey = `track:${trackId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(`/song/detail?ids=${trackId}`);
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

    async getAlbumDetail(albumId) {
        const cacheKey = `album:${albumId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(`/album?id=${albumId}`);
            const album = this.parseAlbum(result?.album || result);
            album.tracks = (result?.songs || []).map(song => this.parseTrack(song));
            
            this._setCache(cacheKey, album);
            return album;
        } catch (e) {
            console.error('Failed to get album detail:', e);
            throw e;
        }
    }

    async getArtistDetail(artistId) {
        const cacheKey = `artist:${artistId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(`/artist/detail?id=${artistId}`);
            const artist = this.parseArtist(result?.data?.artist || result?.artist);
            
            // 获取热门歌曲
            const songsResult = await this._fetch(`/artist/songs?id=${artistId}`);
            artist.topTracks = (songsResult?.songs || []).map(song => this.parseTrack(song));
            
            this._setCache(cacheKey, artist);
            return artist;
        } catch (e) {
            console.error('Failed to get artist detail:', e);
            throw e;
        }
    }

    // ========== 歌单功能实现 ==========

    async getUserPlaylists(userId) {
        try {
            const result = await this._fetch(`/user/playlist?uid=${userId}`);
            return (result?.playlist || []).map(playlist => this.parsePlaylist(playlist));
        } catch (e) {
            console.error('Failed to get user playlists:', e);
            return [];
        }
    }

    async getPlaylistDetail(playlistId) {
        const cacheKey = `playlist:${playlistId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const result = await this._fetch(`/playlist/detail?id=${playlistId}`);
            const playlist = this.parsePlaylist(result?.playlist);
            
            // 获取歌单歌曲
            const trackIds = (playlist.trackIds || []).slice(0, 100).join(',');
            if (trackIds) {
                const tracksResult = await this._fetch(`/song/detail?ids=${trackIds}`);
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

    async getTrackResourceUrl(trackId, options = {}) {
        const { bitrate = 320000 } = options;
        try {
            const result = await this._fetch(`/song/url?id=${trackId}&br=${bitrate}`);
            const data = result?.data?.[0];
            
            if (!data?.url) {
                throw new Error('Music file URL not available');
            }
            
            return {
                url: data.url,
                format: data.type || 'mp3',
                bitrate: data.br || bitrate,
                size: data.size || 0,
                expiresAt: Date.now() + 3600000 // 1 小时后过期
            };
        } catch (e) {
            console.error('Failed to get track resource URL:', e);
            throw e;
        }
    }

    async getCoverUrl(coverId) {
        // 如果 coverId 是完整 URL，直接返回
        if (coverId?.startsWith('http')) {
            return coverId;
        }
        
        // 否则构造 URL
        return `${this.baseUrl}/cover?id=${coverId}`;
    }

    async getLyric(trackId) {
        try {
            const result = await this._fetch(`/lyric?id=${trackId}`);
            return {
                lyric: result?.lrc?.lyric || '',
                tlyric: result?.tlyric?.lyric || ''
            };
        } catch (e) {
            console.error('Failed to get lyric:', e);
            return { lyric: '', tlyric: '' };
        }
    }

    async getAlbumCover(albumId, maxResolution = 368) {
        const album = await this.getAlbumDetail(albumId);
        const picUrl = album?.coverUrl || album?.picUrl || '';
        
        if (!picUrl) {
            return { objectURL: '', destroyObjectURL: () => {} };
        }

        // 添加分辨率参数
        const sizedUrl = picUrl.includes('?') 
            ? `${picUrl}&param=${maxResolution}y${maxResolution}`
            : `${picUrl}?param=${maxResolution}y${maxResolution}`;

        return {
            objectURL: sizedUrl,
            destroyObjectURL: () => {} // Web URL 不需要销毁
        };
    }

    async getMusicFile(songId) {
        const resourceUrl = await this.getTrackResourceUrl(songId);
        
        return {
            objectURL: resourceUrl.url,
            destroyObjectURL: () => {} // Web URL 不需要销毁
        };
    }

    // ========== 数据解析方法（可被子类覆盖） ==========

    /**
     * 解析歌曲数据
     * @param {Object} song - 原始歌曲数据
     * @returns {Object}
     */
    parseTrack(song) {
        return {
            id: `${this.sourceId}_${song.id}`,
            name: song.name,
            artists: (song.ar || song.artists || []).map(a => ({ id: a.id, name: a.name })),
            album: {
                id: song.al?.id || song.album?.id,
                name: song.al?.name || song.album?.name,
                picUrl: song.al?.picUrl || song.album?.picUrl
            },
            duration: (song.dt || song.duration) / 1000,
            traces: [this.createTrackTrace(String(song.id), {
                format: 'mp3',
                bitrate: song.h?.br || 320
            })]
        };
    }

    /**
     * 解析专辑数据
     * @param {Object} album - 原始专辑数据
     * @returns {Object}
     */
    parseAlbum(album) {
        return {
            id: `${this.sourceId}_${album.id}`,
            name: album.name,
            artists: (album.ar || album.artists || []).map(a => ({ id: a.id, name: a.name })),
            coverUrl: album.picUrl || album.coverImgUrl,
            year: album.publishTime ? new Date(album.publishTime).getFullYear() : null,
            traces: [this.createAlbumTrace(String(album.id))]
        };
    }

    /**
     * 解析艺术家数据
     * @param {Object} artist - 原始艺术家数据
     * @returns {Object}
     */
    parseArtist(artist) {
        return {
            id: `${this.sourceId}_${artist.id}`,
            name: artist.name,
            avatarUrl: artist.picUrl || artist.avatarUrl || artist.img1v1Url,
            albumCount: artist.albumSize || artist.albumCount || 0,
            traces: [this.createArtistTrace(String(artist.id))]
        };
    }

    /**
     * 解析歌单数据
     * @param {Object} playlist - 原始歌单数据
     * @returns {Object}
     */
    parsePlaylist(playlist) {
        return {
            id: `${this.sourceId}_${playlist.id}`,
            name: playlist.name,
            description: playlist.description,
            coverUrl: playlist.coverImgUrl,
            trackCount: playlist.trackCount,
            trackIds: playlist.trackIds?.map(t => t.id) || [],
            playCount: playlist.playCount,
            creator: playlist.creator?.nickname || ''
        };
    }
}

export default WebSource;
