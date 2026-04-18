export class BaseSource {
    constructor(sourceId, sourceName) {
        this.sourceId = sourceId;
        this.sourceName = sourceName;
    }

    getSourceId() {
        return this.sourceId;
    }

    getName() {
        return this.sourceName;
    }

    getType() {
        throw new Error('getType must be implemented');
    }

    async getSongFile(trace) {
        throw new Error('getSongFile must be implemented');
    }

    async getSongLyric(trace) {
        throw new Error('getSongLyric must be implemented');
    }

    async getAlbumPicture(trace) {
        throw new Error('getAlbumPicture must be implemented');
    }
}
