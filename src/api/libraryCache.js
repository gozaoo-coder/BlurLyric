/**
 * Library Cache - 音乐库缓存前端接口
 * 
 * ==================== 模块职责 ====================
 * 
 * 本模块专门负责本地音乐库的元数据缓存管理：
 * - 缓存本地音乐文件的元数据（歌曲名、艺人、专辑、时长等）
 * - 维护文件指纹用于增量扫描
 * - 管理艺术家和专辑的索引信息
 * 
 * ==================== 与 ResourceCache 的区别 ====================
 * 
 * 本模块（LibraryCache）：
 *   - 缓存内容：本地音乐文件的元数据
 *   - 数据来源：本地文件扫描
 *   - 清理策略：增量扫描时更新
 *   - 用户交互：无感知，自动管理
 * 
 * ResourceCache 模块：
 *   - 缓存内容：网络下载的音频、图片等资源文件
 *   - 数据来源：网络下载
 *   - 清理策略：LRU 自动清理
 *   - 用户交互：用户可手动管理
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 音乐库缓存统计信息
 * @typedef {Object} LibraryCacheStats
 * @property {number} totalSongs - 歌曲总数
 * @property {number} totalArtists - 艺术家总数
 * @property {number} totalAlbums - 专辑总数
 * @property {number} cachedFiles - 缓存文件数
 * @property {number} cacheVersion - 缓存版本
 * @property {number} lastUpdated - 最后更新时间戳
 */

/**
 * 音乐库缓存管理类
 */
export class LibraryCache {
    /**
     * 获取音乐库缓存统计信息
     * @returns {Promise<LibraryCacheStats>}
     */
    static async getStats() {
        return await invoke('get_library_cache_stats');
    }

    /**
     * 清除音乐库缓存
     * @returns {Promise<void>}
     */
    static async clear() {
        return await invoke('clear_library_cache');
    }

    /**
     * 检查音乐库缓存是否有效
     * @returns {Promise<boolean>}
     */
    static async isValid() {
        return await invoke('is_library_cache_valid');
    }

    /**
     * 格式化字节大小为可读字符串
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的字符串
     */
    static formatSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
    }

    /**
     * 格式化时间戳为可读字符串
     * @param {number} timestamp - Unix 时间戳（秒）
     * @returns {string} 格式化后的字符串
     */
    static formatTimestamp(timestamp) {
        if (!timestamp) return '未知';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('zh-CN');
    }

    /**
     * 获取缓存使用情况摘要
     * @returns {Promise<string>}
     */
    static async getSummary() {
        const stats = await this.getStats();
        
        return `音乐库缓存统计:\n` +
               `- 歌曲数量: ${stats.totalSongs}\n` +
               `- 艺术家数量: ${stats.totalArtists}\n` +
               `- 专辑数量: ${stats.totalAlbums}\n` +
               `- 缓存文件: ${stats.cachedFiles}\n` +
               `- 最后更新: ${this.formatTimestamp(stats.lastUpdated)}`;
    }
}

export default LibraryCache;
