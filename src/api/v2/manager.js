import { isTauriEnvironment } from './env.js';
import { SourceManager } from './source/manager.js';

class MusicSystem {
    constructor() {
        this.env = isTauriEnvironment() ? 'tauri' : 'web';
        this.sourceManager = new SourceManager();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        this.sourceManager.init();
        this.initialized = true;
    }

    getSourceManager() {
        return this.sourceManager;
    }

    getEnvironment() {
        return this.env;
    }

    isTauri() {
        return this.env === 'tauri';
    }

    isWeb() {
        return this.env === 'web';
    }
}

export const musicSystem = new MusicSystem();
export default musicSystem;
