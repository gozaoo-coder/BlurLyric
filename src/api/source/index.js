/**
 * Source Manager - API源管理器
 * 统一管理多个API源（本地Tauri、Web等）
 */

import { Source } from './base.js';
import TauriSource from './tauri.js';
import WebSource from './web.js';

class SourceManager {
    #sources = new Map();
    #defaultSource = null;
    #sourceOrder = [];

    constructor() {
        this.registerSourceType('tauri', TauriSource);
        this.registerSourceType('web', WebSource);
    }

    registerSourceType(type, SourceClass) {
        this.#sources.set(type, SourceClass);
    }

    addSource(name, type, options = {}) {
        const SourceClass = this.#sources.get(type);
        if (!SourceClass) {
            throw new Error(`Unknown source type: ${type}`);
        }

        const source = new SourceClass(name, type, options.apiUrl);
        this.#sourceOrder.push({ name, type, source });
        
        if (!this.#defaultSource) {
            this.#defaultSource = source;
        }

        return source;
    }

    removeSource(name) {
        const index = this.#sourceOrder.findIndex(s => s.name === name);
        if (index !== -1) {
            const removed = this.#sourceOrder.splice(index, 1)[0];
            if (this.#defaultSource === removed.source) {
                this.#defaultSource = this.#sourceOrder[0]?.source || null;
            }
            return true;
        }
        return false;
    }

    getSource(name) {
        const source = this.#sourceOrder.find(s => s.name === name);
        return source?.source || null;
    }

    getAllSources() {
        return this.#sourceOrder.map(s => ({
            name: s.name,
            type: s.type,
            source: s.source
        }));
    }

    setDefaultSource(name) {
        const source = this.getSource(name);
        if (source) {
            this.#defaultSource = source;
        }
    }

    getDefaultSource() {
        return this.#defaultSource;
    }

    async getMusicList(sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getMusicList();
    }

    async getAllMusicDirs(sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getAllMusicDirs();
    }

    async addMusicDirs(dirs, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.addMusicDirs(dirs);
    }

    async removeMusicDirs(dirs, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.removeMusicDirs(dirs);
    }

    async refreshMusicCache(sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.refreshMusicCache();
    }

    async getAlbums(sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getAlbums();
    }

    async getAlbumById(albumId, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getAlbumById(albumId);
    }

    async getAlbumsSongsById(albumId, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getAlbumsSongsById(albumId);
    }

    async getArtists(sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getArtists();
    }

    async getArtistById(artistId, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getArtistById(artistId);
    }

    async getArtistsSongsById(artistId, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getArtistsSongsById(artistId);
    }

    async getAlbumCover(albumId, maxResolution, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getAlbumCover(albumId, maxResolution);
    }

    async getMusicFile(songId, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.getMusicFile(songId);
    }

    async searchTracks(keyword, options = {}, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.searchTracks(keyword, options);
    }

    async searchAlbums(keyword, options = {}, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.searchAlbums(keyword, options);
    }

    async searchArtists(keyword, options = {}, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.searchArtists(keyword, options);
    }

    async searchLyrics(keyword, options = {}, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.searchLyrics(keyword, options);
    }

    async searchAll(keyword, options = {}, sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.searchAll(keyword, options);
    }

    async initApplication(sourceName = null) {
        const source = sourceName ? this.getSource(sourceName) : this.#defaultSource;
        if (!source) throw new Error('No source available');
        return source.initApplication();
    }
}

const sourceManager = new SourceManager();

sourceManager.addSource('本地音乐库', 'tauri');

export { sourceManager, SourceManager };
export default sourceManager;
