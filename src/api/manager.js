/**
 * API Manager - 统一的API管理入口
 * 整合Source管理和Resource管理
 */

import { sourceManager } from './source/index.js';
import { Track, Artist, Album, TrackList } from './resources/index.js';

// 导出所有API相关模块
export { 
    sourceManager,
    Track, 
    Artist, 
    Album, 
    TrackList 
};

// 导出source相关类
export { Source } from './source/base.js';
export { TauriSource } from './source/tauri.js';
export { WebSource } from './source/web.js';

// 默认导出manager实例
export default {
    // Source管理
    source: sourceManager,
    
    // 资源类
    Track,
    Artist,
    Album,
    TrackList,
    
    // 向后兼容：直接暴露tauri source的方法
    get tauri() {
        return sourceManager.getSource('本地音乐库') || sourceManager.getDefaultSource();
    },
    
    // 便捷方法
    async getMusicList(sourceName) {
        return sourceManager.getMusicList(sourceName);
    },
    
    async getAlbums(sourceName) {
        return sourceManager.getAlbums(sourceName);
    },
    
    async getArtists(sourceName) {
        return sourceManager.getArtists(sourceName);
    },
    
    async searchAll(keyword, options, sourceName) {
        return sourceManager.searchAll(keyword, options, sourceName);
    }
};
