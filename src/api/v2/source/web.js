import { BaseSource } from './base.js';

export class WebSource extends BaseSource {
    constructor(sourceId, sourceName, baseUrl) {
        super(sourceId, sourceName);
        this.baseUrl = baseUrl;
    }

    getType() {
        return 'web';
    }

    async getSongFile(trace) {
        const response = await fetch(`${this.baseUrl}/webApi/song/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trace })
        });
        if (!response.ok) throw new Error('Failed to get song file');
        return response.arrayBuffer();
    }

    async getSongLyric(trace) {
        const response = await fetch(`${this.baseUrl}/webApi/song/lyric`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trace })
        });
        if (!response.ok) throw new Error('Failed to get song lyric');
        return response.text();
    }

    async getAlbumPicture(trace) {
        const response = await fetch(`${this.baseUrl}/webApi/album/picture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trace })
        });
        if (!response.ok) throw new Error('Failed to get album picture');
        return response.arrayBuffer();
    }
}
