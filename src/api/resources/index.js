/**
 * Resource Manager - 资源管理模块
 * 
 * 提供大文件资源（专辑图片、音乐文件）的获取、管理与释放
 * 
 * ==================== 核心概念 ====================
 * 
 * 1. Trace 来源追踪机制
 *    - 所有数据模型（Track/Artist/Album）都支持 Trace 来源追踪
 *    - Trace 记录数据的来源信息（本地/API/WebDAV）
 *    - 通过 Trace 可以精准跳转和获取资源
 * 
 * 2. 统一的数据模型
 *    - Track: 单曲数据模型
 *    - Artist: 艺术家数据模型
 *    - Album: 专辑数据模型
 *    - TrackList: 歌曲列表模型
 * 
 * 3. 资源获取流程
 *    用户请求 → Trace.fetchMethod → IPC → 缓存检查 → 下载/读取 → ObjectURL
 * 
 * ==================== 使用规范 ====================
 * 
 * // 创建 Track
 * const track = Track.fromRaw(trackData);
 * 
 * // 获取 Trace 信息
 * const traces = track.traces;           // 所有来源
 * const primaryTrace = track.primaryTrace; // 主来源
 * 
 * // 检查来源类型
 * if (track.hasLocalResource()) { ... }
 * const apiTrace = track.getTraceBySourceType('api');
 * 
 * // 获取资源
 * const musicFile = await track.getMusicFile(apiAdapter);
 * const albumCover = await track.getAlbumCover(apiAdapter, 368);
 * 
 * // 跳转到关联数据
 * const artist = track.navigateToArtist(0);
 * const album = track.navigateToAlbum();
 * 
 * // 释放资源
 * track.releaseResources();
 * 
 * ==================== 合规说明 ====================
 * 
 * - 不硬编码任何具体音乐平台名称
 * - 通过 sourceId 和 baseUrl 标识来源
 * - 用户自行负责所接入 API 的合法性
 */

import { Trace, TraceDataType } from '../source/trace.js';

/**
 * Resource - 资源基类
 * 实现引用计数和自动释放
 */
class Resource {
    #id;
    #objectURL;
    #refCount;
    #onDestroy;

    constructor(id, objectURL, onDestroy = null) {
        this.#id = id;
        this.#objectURL = objectURL;
        this.#refCount = 1;
        this.#onDestroy = onDestroy;
    }

    get objectURL() {
        return this.#objectURL;
    }

    get id() {
        return this.#id;
    }

    retain() {
        this.#refCount++;
        return this;
    }

    release() {
        this.#refCount--;
        if (this.#refCount <= 0) {
            this.destroy();
            return true;
        }
        return false;
    }

    destroy() {
        if (this.#objectURL && this.#objectURL.startsWith('blob:')) {
            URL.revokeObjectURL(this.#objectURL);
        }
        this.#onDestroy?.();
        this.#objectURL = null;
        this.#onDestroy = null;
    }

    get refCount() {
        return this.#refCount;
    }
}

/**
 * ResourcePool - 资源池
 * 实现 LRU 淘汰策略
 */
class ResourcePool {
    #resources = new Map();
    #maxSize;

    constructor(maxSize = 100) {
        this.#maxSize = maxSize;
    }

    get(key) {
        return this.#resources.get(key);
    }

    set(key, resource) {
        if (this.#resources.size >= this.#maxSize) {
            this.#evict();
        }
        this.#resources.set(key, resource);
    }

    has(key) {
        return this.#resources.has(key);
    }

    delete(key) {
        const resource = this.#resources.get(key);
        if (resource) {
            resource.destroy();
            this.#resources.delete(key);
        }
    }

    #evict() {
        const entries = [...this.#resources.entries()];
        if (entries.length > 0) {
            const firstEntry = entries[0];
            this.delete(firstEntry[0]);
        }
    }

    clear() {
        this.#resources.forEach(resource => resource.destroy());
        this.#resources.clear();
    }

    get size() {
        return this.#resources.size;
    }
}

/**
 * AlbumCoverResource - 专辑封面资源
 */
export class AlbumCoverResource {
    #albumId;
    #resolution;
    #resource;
    #loadingPromise;

    constructor(albumId, resolution = 368) {
        this.#albumId = albumId;
        this.#resolution = resolution;
        this.#resource = null;
        this.#loadingPromise = null;
    }

    get albumId() {
        return this.#albumId;
    }

    get resolution() {
        return this.#resolution;
    }

    async load(apiAdapter) {
        if (this.#resource) {
            this.#resource.retain();
            return this.#resource;
        }

        if (this.#loadingPromise) {
            return this.#loadingPromise;
        }

        this.#loadingPromise = this.#fetchResource(apiAdapter);
        try {
            const resource = await this.#loadingPromise;
            this.#resource = resource;
            return resource;
        } finally {
            this.#loadingPromise = null;
        }
    }

    async #fetchResource(apiAdapter) {
        const key = `al_${this.#albumId}_${this.#resolution}`;
        
        return new Promise((resolve, reject) => {
            apiAdapter.getAlbumCover(this.#albumId, this.#resolution)
                .then(result => {
                    const resource = new Resource(
                        key,
                        result.objectURL,
                        result.destroyObjectURL
                    );
                    resolve(resource);
                })
                .catch(reject);
        });
    }

    release() {
        if (this.#resource) {
            const shouldDestroy = this.#resource.release();
            if (shouldDestroy) {
                this.#resource = null;
            }
        }
    }

    destroy() {
        this.release();
    }
}

/**
 * MusicFileResource - 音乐文件资源
 */
export class MusicFileResource {
    #songId;
    #resource;
    #loadingPromise;

    constructor(songId) {
        this.#songId = songId;
        this.#resource = null;
        this.#loadingPromise = null;
    }

    get songId() {
        return this.#songId;
    }

    async load(apiAdapter) {
        if (this.#resource) {
            this.#resource.retain();
            return this.#resource;
        }

        if (this.#loadingPromise) {
            return this.#loadingPromise;
        }

        this.#loadingPromise = this.#fetchResource(apiAdapter);
        try {
            const resource = await this.#loadingPromise;
            this.#resource = resource;
            return resource;
        } finally {
            this.#loadingPromise = null;
        }
    }

    async #fetchResource(apiAdapter) {
        const key = `mf_${this.#songId}`;
        
        return new Promise((resolve, reject) => {
            apiAdapter.getMusicFile(this.#songId)
                .then(result => {
                    const resource = new Resource(
                        key,
                        result.objectURL,
                        result.destroyObjectURL
                    );
                    resolve(resource);
                })
                .catch(reject);
        });
    }

    release() {
        if (this.#resource) {
            const shouldDestroy = this.#resource.release();
            if (shouldDestroy) {
                this.#resource = null;
            }
        }
    }

    destroy() {
        this.release();
    }
}

/**
 * Track - 单曲数据模型
 * 支持 Trace 来源追踪
 */
export class Track {
    #data;
    #albumCover;
    #musicFile;
    #traces;

    constructor(trackData) {
        this.#data = trackData;
        this.#albumCover = null;
        this.#musicFile = null;
        // 解析 Trace 数据
        this.#traces = (trackData.traces || []).map(t => 
            t instanceof Trace ? t : Trace.fromRaw(t)
        );
    }

    /**
     * 从原始数据创建 Track
     */
    static fromRaw(rawData) {
        return new Track(rawData);
    }

    /**
     * 从原始数据数组创建 Track 数组
     */
    static fromRawArray(rawArray) {
        return rawArray.map(raw => Track.fromRaw(raw));
    }

    // ========== 基本属性 ==========

    get id() {
        return this.#data.id;
    }

    get name() {
        return this.#data.name;
    }

    get src() {
        return this.#data.src;
    }

    get lyric() {
        return this.#data.lyric;
    }

    get trackNumber() {
        return this.#data.track_number ?? this.#data.trackNumber ?? 0;
    }

    get artists() {
        return (this.#data.ar ?? []).map(ar => Artist.fromRaw(ar));
    }

    get album() {
        return this.#data.al ? Album.fromRaw(this.#data.al) : null;
    }

    // ========== 扩展属性 ==========

    get duration() {
        return this.#data.duration ?? null;
    }

    get durationFormatted() {
        const duration = this.#data.duration;
        if (!duration || duration <= 0) return '--:--';
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    get genre() {
        return this.#data.genre ?? null;
    }

    get year() {
        return this.#data.year ?? null;
    }

    get comment() {
        return this.#data.comment ?? null;
    }

    get composer() {
        return this.#data.composer ?? null;
    }

    get lyricist() {
        return this.#data.lyricist ?? null;
    }

    get bitrate() {
        return this.#data.bitrate ?? null;
    }

    get sampleRate() {
        return this.#data.sampleRate ?? this.#data.sample_rate ?? null;
    }

    get channels() {
        return this.#data.channels ?? null;
    }

    get otherTags() {
        return this.#data.otherTags ?? this.#data.other_tags ?? {};
    }

    // ========== Trace 来源追踪属性（统一接口）==========

    /**
     * 获取所有 Trace
     * @returns {Trace[]}
     */
    get traces() {
        return this.#traces;
    }

    /**
     * 获取主 Trace 索引
     * @returns {number}
     */
    get primaryTraceIndex() {
        return this.#data.primary_trace_index ?? this.#data.primaryTraceIndex ?? 0;
    }

    /**
     * 获取主 Trace
     * @returns {Trace|null}
     */
    get primaryTrace() {
        return this.#traces[this.primaryTraceIndex] || null;
    }

    /**
     * 检查是否有本地资源
     * @returns {boolean}
     */
    hasLocalResource() {
        return this.#traces.some(t => t.isLocal());
    }

    /**
     * 检查是否有多个来源
     * @returns {boolean}
     */
    hasMultipleTraces() {
        return this.#traces.length > 1;
    }

    /**
     * 根据来源类型获取 Trace
     * @param {string} sourceType - 来源类型 ('local' | 'webdav' | 'api')
     * @returns {Trace|null}
     */
    getTraceBySourceType(sourceType) {
        return this.#traces.find(t => {
            if (sourceType === 'local') return t.isLocal();
            if (sourceType === 'webdav') return t.isWebDAV();
            if (sourceType === 'api') return t.isApi();
            return false;
        }) || null;
    }

    /**
     * 跳转到艺人页面
     * @param {number} artistIndex - 艺人索引
     * @returns {Artist|null}
     */
    navigateToArtist(artistIndex) {
        const artist = this.artists[artistIndex];
        if (artist && artist.primaryTrace) {
            return artist;
        }
        return artist || null;
    }

    /**
     * 跳转到专辑页面
     * @returns {Album|null}
     */
    navigateToAlbum() {
        const album = this.album;
        if (album && album.primaryTrace) {
            return album;
        }
        return album || null;
    }

    // ========== 资源获取（统一调用方法）==========

    async getAlbumCover(apiAdapter, resolution = 368) {
        if (!this.#albumCover) {
            const albumId = this.#data.al?.id ?? -1;
            if (albumId < 0) {
                return null;
            }
            this.#albumCover = new AlbumCoverResource(albumId, resolution);
        }
        return this.#albumCover.load(apiAdapter);
    }

    async getMusicFile(apiAdapter) {
        if (!this.#musicFile) {
            this.#musicFile = new MusicFileResource(this.#data.id);
        }
        return this.#musicFile.load(apiAdapter);
    }

    /**
     * 根据 Trace 获取资源
     * @param {Object} sourceManager - 源管理器
     * @returns {Promise<{objectURL: string, destroyObjectURL: Function}>}
     */
    async fetchResourceByTrace(sourceManager) {
        const trace = this.primaryTrace;
        if (!trace) {
            throw new Error('No trace available');
        }
        return sourceManager.fetchResourceByTrace(trace);
    }

    releaseResources() {
        if (this.#albumCover) {
            this.#albumCover.destroy();
            this.#albumCover = null;
        }
        if (this.#musicFile) {
            this.#musicFile.destroy();
            this.#musicFile = null;
        }
    }

    toRaw() {
        return { ...this.#data };
    }
}

/**
 * Artist - 艺术家数据模型
 * 支持 Trace 来源追踪
 */
export class Artist {
    #data;
    #traces;

    constructor(artistData) {
        this.#data = artistData;
        this.#traces = (artistData.traces || []).map(t => 
            t instanceof Trace ? t : Trace.fromRaw(t)
        );
    }

    static fromRaw(rawData) {
        return new Artist(rawData);
    }

    static fromRawArray(rawArray) {
        return rawArray.map(raw => Artist.fromRaw(raw));
    }

    // ========== 基本属性 ==========

    get id() {
        return this.#data.id;
    }

    get name() {
        return this.#data.name;
    }

    get alias() {
        return this.#data.alias ?? [];
    }

    get avatarUrl() {
        return this.#data.avatarUrl ?? this.#data.picUrl ?? null;
    }

    get bio() {
        return this.#data.bio ?? null;
    }

    // ========== Trace 来源追踪属性（统一接口）==========

    /**
     * 获取所有 Trace
     * @returns {Trace[]}
     */
    get traces() {
        return this.#traces;
    }

    /**
     * 获取主 Trace 索引
     * @returns {number}
     */
    get primaryTraceIndex() {
        return this.#data.primary_trace_index ?? this.#data.primaryTraceIndex ?? 0;
    }

    /**
     * 获取主 Trace
     * @returns {Trace|null}
     */
    get primaryTrace() {
        return this.#traces[this.primaryTraceIndex] || null;
    }

    /**
     * 检查是否有本地资源
     * @returns {boolean}
     */
    hasLocalResource() {
        return this.#traces.some(t => t.isLocal());
    }

    /**
     * 根据来源类型获取 Trace
     * @param {string} sourceType - 来源类型 ('local' | 'webdav' | 'api')
     * @returns {Trace|null}
     */
    getTraceBySourceType(sourceType) {
        return this.#traces.find(t => {
            if (sourceType === 'local') return t.isLocal();
            if (sourceType === 'webdav') return t.isWebDAV();
            if (sourceType === 'api') return t.isApi();
            return false;
        }) || null;
    }

    /**
     * 跳转到来源数据
     * @param {Object} sourceManager - 源管理器
     * @returns {Promise<Artist>}
     */
    async navigateToSource(sourceManager) {
        const trace = this.primaryTrace;
        if (!trace) {
            throw new Error('No trace available');
        }
        return sourceManager.navigateByTrace(trace);
    }

    // ========== 资源获取 ==========

    /**
     * 获取头像图片
     * @param {Object} apiAdapter - API适配器
     * @param {number} resolution - 分辨率
     * @returns {Promise<Resource>}
     */
    async getAvatar(apiAdapter, resolution = 368) {
        // 如果有本地资源，优先使用
        const localTrace = this.getTraceBySourceType('local');
        if (localTrace) {
            return localTrace.fetchResource();
        }
        // 否则返回 URL
        if (this.avatarUrl) {
            return { url: this.avatarUrl };
        }
        return null;
    }

    toRaw() {
        return { ...this.#data };
    }
}

/**
 * Album - 专辑数据模型
 * 支持 Trace 来源追踪
 */
export class Album {
    #data;
    #traces;

    constructor(albumData) {
        this.#data = albumData;
        this.#traces = (albumData.traces || []).map(t => 
            t instanceof Trace ? t : Trace.fromRaw(t)
        );
    }

    static fromRaw(rawData) {
        return new Album(rawData);
    }

    static fromRawArray(rawArray) {
        return rawArray.map(raw => Album.fromRaw(raw));
    }

    // ========== 基本属性 ==========

    get id() {
        return this.#data.id;
    }

    get name() {
        return this.#data.name;
    }

    get picUrl() {
        return this.#data.picUrl ?? this.#data.pic_url ?? this.#data.coverUrl ?? '';
    }

    get coverUrl() {
        return this.picUrl;
    }

    get year() {
        return this.#data.year ?? null;
    }

    get artists() {
        return (this.#data.artists ?? this.#data.ar ?? []).map(a => 
            a instanceof Artist ? a : Artist.fromRaw(a)
        );
    }

    // ========== Trace 来源追踪属性（统一接口）==========

    /**
     * 获取所有 Trace
     * @returns {Trace[]}
     */
    get traces() {
        return this.#traces;
    }

    /**
     * 获取主 Trace 索引
     * @returns {number}
     */
    get primaryTraceIndex() {
        return this.#data.primary_trace_index ?? this.#data.primaryTraceIndex ?? 0;
    }

    /**
     * 获取主 Trace
     * @returns {Trace|null}
     */
    get primaryTrace() {
        return this.#traces[this.primaryTraceIndex] || null;
    }

    /**
     * 检查是否有本地资源
     * @returns {boolean}
     */
    hasLocalResource() {
        return this.#traces.some(t => t.isLocal());
    }

    /**
     * 根据来源类型获取 Trace
     * @param {string} sourceType - 来源类型 ('local' | 'webdav' | 'api')
     * @returns {Trace|null}
     */
    getTraceBySourceType(sourceType) {
        return this.#traces.find(t => {
            if (sourceType === 'local') return t.isLocal();
            if (sourceType === 'webdav') return t.isWebDAV();
            if (sourceType === 'api') return t.isApi();
            return false;
        }) || null;
    }

    /**
     * 跳转到来源数据
     * @param {Object} sourceManager - 源管理器
     * @returns {Promise<Album>}
     */
    async navigateToSource(sourceManager) {
        const trace = this.primaryTrace;
        if (!trace) {
            throw new Error('No trace available');
        }
        return sourceManager.navigateByTrace(trace);
    }

    /**
     * 跳转到艺人页面
     * @param {number} artistIndex - 艺人索引
     * @returns {Artist|null}
     */
    navigateToArtist(artistIndex) {
        const artist = this.artists[artistIndex];
        if (artist && artist.primaryTrace) {
            return artist;
        }
        return artist || null;
    }

    // ========== 资源获取 ==========

    /**
     * 获取封面图片
     * @param {Object} apiAdapter - API适配器
     * @param {number} resolution - 分辨率
     * @returns {Promise<Resource>}
     */
    async getCover(apiAdapter, resolution = 368) {
        // 如果有本地资源，优先使用
        const localTrace = this.getTraceBySourceType('local');
        if (localTrace) {
            return localTrace.fetchResource();
        }
        // 否则通过 API 获取
        const coverResource = new AlbumCoverResource(this.#data.id, resolution);
        return coverResource.load(apiAdapter);
    }

    toRaw() {
        return { ...this.#data };
    }
}

/**
 * TrackList - 歌曲列表
 */
export class TrackList {
    #tracks = [];
    #currentIndex = 0;

    constructor(tracks = []) {
        this.#tracks = tracks.map(t => t instanceof Track ? t : Track.fromRaw(t));
        this.#currentIndex = 0;
    }

    get tracks() {
        return this.#tracks;
    }

    get length() {
        return this.#tracks.length;
    }

    get currentIndex() {
        return this.#currentIndex;
    }

    get currentTrack() {
        return this.#tracks[this.#currentIndex] ?? null;
    }

    setCurrentIndex(index) {
        if (index >= 0 && index < this.#tracks.length) {
            this.#currentIndex = index;
        }
    }

    next() {
        if (this.#tracks.length === 0) return null;
        this.#currentIndex = (this.#currentIndex + 1) % this.#tracks.length;
        return this.currentTrack;
    }

    prev() {
        if (this.#tracks.length === 0) return null;
        this.#currentIndex = (this.#currentIndex - 1 + this.#tracks.length) % this.#tracks.length;
        return this.currentTrack;
    }

    addTrack(track) {
        const t = track instanceof Track ? track : Track.fromRaw(track);
        this.#tracks.push(t);
    }

    removeTrack(index) {
        if (index >= 0 && index < this.#tracks.length) {
            const track = this.#tracks[index];
            track.releaseResources();
            this.#tracks.splice(index, 1);
            if (this.#currentIndex >= this.#tracks.length) {
                this.#currentIndex = Math.max(0, this.#tracks.length - 1);
            }
        }
    }

    clear() {
        this.#tracks.forEach(track => track.releaseResources());
        this.#tracks = [];
        this.#currentIndex = 0;
    }

    shuffle() {
        for (let i = this.#tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.#tracks[i], this.#tracks[j]] = [this.#tracks[j], this.#tracks[i]];
        }
    }

    toRawArray() {
        return this.#tracks.map(t => t.toRaw());
    }

    static fromRawArray(rawArray) {
        return new TrackList(rawArray);
    }
}

export { Resource, ResourcePool };
