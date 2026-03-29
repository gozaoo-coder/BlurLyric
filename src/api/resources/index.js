/**
 * Resource Manager - 资源管理模块
 * 提供大文件资源（专辑图片、音乐文件）的获取、管理与释放
 * 
 * 新特性：
 * - 支持 Trace 来源追踪
 * - 统一的数据模型
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

    // ========== 多来源属性 ==========

    get sources() {
        return this.#data.sources ?? [];
    }

    get primarySourceIndex() {
        return this.#data.primarySourceIndex ?? this.#data.primary_source_index ?? 0;
    }

    get sourceCount() {
        return this.#data.sourceCount ?? this.sources.length ?? 1;
    }

    get primarySource() {
        const sources = this.sources;
        const index = this.primarySourceIndex;
        return sources[index] ?? sources[0] ?? null;
    }

    get alternativeSources() {
        const sources = this.sources;
        const primaryIndex = this.primarySourceIndex;
        return sources.filter((_, index) => index !== primaryIndex);
    }

    hasMultipleSources() {
        return this.sourceCount > 1;
    }

    // ========== Trace 属性 ==========

    /**
     * 获取所有 Trace
     * @returns {Trace[]}
     */
    get traces() {
        return this.#traces;
    }

    /**
     * 获取主 Trace
     * @returns {Trace|null}
     */
    get primaryTrace() {
        return this.#traces[0] || null;
    }

    /**
     * 检查是否有本地资源
     * @returns {boolean}
     */
    hasLocalResource() {
        return this.#traces.some(t => t.isLocal());
    }

    // ========== 资源获取 ==========

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

    get traces() {
        return this.#traces;
    }

    get primaryTrace() {
        return this.#traces[0] || null;
    }

    toRaw() {
        return { ...this.#data };
    }

    static fromRawArray(rawArray) {
        return rawArray.map(raw => Artist.fromRaw(raw));
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

    get traces() {
        return this.#traces;
    }

    get primaryTrace() {
        return this.#traces[0] || null;
    }

    async getCover(apiAdapter, resolution = 368) {
        const coverResource = new AlbumCoverResource(this.#data.id, resolution);
        return coverResource.load(apiAdapter);
    }

    toRaw() {
        return { ...this.#data };
    }

    static fromRawArray(rawArray) {
        return rawArray.map(raw => Album.fromRaw(raw));
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
