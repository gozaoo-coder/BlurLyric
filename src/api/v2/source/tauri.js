import { BaseSource } from './base.js';
import { invoke } from '@tauri-apps/api/core';

export class TauriSource extends BaseSource {
    constructor(sourceId, sourceName) {
        super(sourceId, sourceName);
    }

    getType() {
        return 'tauri';
    }

    async getSongFile(trace) {
        return invoke('get_music_file', { trace });
    }

    async getSongLyric(trace) {
        return invoke('get_song_lyric', { trace });
    }

    async getAlbumPicture(trace) {
        return invoke('get_album_cover', { trace });
    }

    async getMusicList() {
        return invoke('get_music_list');
    }

    async getAllAlbums() {
        return invoke('get_all_my_albums');
    }

    async getAllArtists() {
        return invoke('get_all_my_artists');
    }
}
