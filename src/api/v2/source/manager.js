import { isTauriEnvironment } from '../env.js';
import { TauriSource } from './tauri.js';
import { WebSource } from './web.js';

export class SourceManager {
    constructor() {
        this.sources = new Map();
        this.defaultSourceId = null;
    }

    init() {
        if (isTauriEnvironment()) {
            const tauriSource = new TauriSource('local', '本地音乐库');
            this.addSource(tauriSource);
            this.setDefaultSource('local');
        }
    }

    addSource(source) {
        this.sources.set(source.getSourceId(), source);
        if (!this.defaultSourceId) {
            this.defaultSourceId = source.getSourceId();
        }
    }

    removeSource(sourceId) {
        this.sources.delete(sourceId);
        if (this.defaultSourceId === sourceId) {
            const firstSource = this.sources.values().next().value;
            this.defaultSourceId = firstSource ? firstSource.getSourceId() : null;
        }
    }

    getSource(sourceId) {
        return this.sources.get(sourceId);
    }

    getDefaultSource() {
        return this.defaultSourceId ? this.getSource(this.defaultSourceId) : null;
    }

    setDefaultSource(sourceId) {
        if (this.sources.has(sourceId)) {
            this.defaultSourceId = sourceId;
        }
    }

    getAllSources() {
        return Array.from(this.sources.values());
    }
}
