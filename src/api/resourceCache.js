/**
 * Resource Cache - 网络资源缓存前端接口
 * 
 * ==================== 模块职责 ====================
 * 
 * 本模块专门负责网络资源的缓存管理：
 * - 缓存从网络下载的音频、图片等资源文件
 * - 支持临时缓存池（用于试听）和偏好缓存池（用于收藏）
 * - 实现 LRU 自动清理策略
 * - 提供缓存资源的获取、存储和管理接口
 * 
 * ==================== 与 LibraryCache 的区别 ====================
 * 
 * 本模块（ResourceCache）：
 *   - 缓存内容：网络下载的音频、图片等资源文件
 *   - 数据来源：网络下载
 *   - 清理策略：LRU 自动清理
 *   - 用户交互：用户可手动管理
 * 
 * LibraryCache 模块：
 *   - 缓存内容：本地音乐文件的元数据
 *   - 数据来源：本地文件扫描
 *   - 清理策略：增量扫描时更新
 *   - 用户交互：无感知，自动管理
 * 
 * ==================== 缓存池分层策略 ====================
 * 
 * 临时缓存池（Temp Pool）：
 *   - 用途：临时搜索试听的音乐资源
 *   - 大小限制：默认 500MB
 *   - 清理策略：LRU 自动清理
 *   - 用户操作：自动管理，用户可手动清空
 * 
 * 偏好缓存池（Preference Pool）：
 *   - 用途：用户收藏/歌单中的音乐资源
 *   - 大小限制：默认 5GB
 *   - 清理策略：用户手动管理
 *   - 用户操作：收藏时自动从临时池移动到此
 */

import { invoke } from '@tauri-apps/api/core';
import { Trace } from './source/trace.js';

/**
 * 缓存池类型
 */
export const ResourcePoolType = {
    TEMP: 'Temp',
    PREFERENCE: 'Preference'
};

/**
 * 缓存池统计信息
 * @typedef {Object} ResourcePoolStats
 * @property {number} count - 缓存项数量
 * @property {number} totalSize - 总大小（字节）
 * @property {number} maxSize - 最大大小（字节）
 * @property {number} usagePercent - 使用百分比
 */

/**
 * 资源缓存信息
 * @typedef {Object} ResourceCacheInfo
 * @property {ResourcePoolStats} tempPool - 临时池统计
 * @property {ResourcePoolStats} preferencePool - 偏好池统计
 */

/**
 * 缓存资源项
 * @typedef {Object} CachedResource
 * @property {string} id - 缓存唯一标识
 * @property {Object} trace - 来源追踪信息
 * @property {string} pool - 缓存池类型
 * @property {string} path - 本地缓存路径
 * @property {number} size - 文件大小（字节）
 * @property {number} cachedAt - 缓存时间戳
 * @property {number} lastAccessed - 最后访问时间戳
 * @property {number} accessCount - 访问次数
 * @property {string} format - 资源格式
 * @property {string|null} trackId - 关联的歌曲 ID
 */

/**
 * 资源缓存管理类
 */
export class ResourceCache {
    /**
     * 缓存资源到临时池
     * @param {Trace|Object} trace - 来源追踪信息
     * @param {ArrayBuffer|Uint8Array} data - 资源数据
     * @param {string} format - 资源格式（如 'mp3', 'flac'）
     * @returns {Promise<string>} 缓存 ID
     */
    static async cacheResource(trace, data, format = 'mp3') {
        const traceData = trace instanceof Trace ? trace.toRaw() : trace;
        const dataArray = data instanceof ArrayBuffer 
            ? Array.from(new Uint8Array(data)) 
            : Array.from(data);
        
        return await invoke('cache_resource', {
            trace: traceData,
            data: dataArray,
            format
        });
    }

    /**
     * 移动缓存到偏好池
     * @param {string} cacheId - 缓存 ID
     * @param {string|null} trackId - 关联的歌曲 ID
     * @returns {Promise<void>}
     */
    static async moveToPreferencePool(cacheId, trackId = null) {
        return await invoke('move_resource_to_preference_pool', {
            cacheId,
            trackId
        });
    }

    /**
     * 从偏好池移除缓存
     * @param {string} cacheId - 缓存 ID
     * @returns {Promise<void>}
     */
    static async removeFromPreferencePool(cacheId) {
        return await invoke('remove_resource_from_preference_pool', {
            cacheId
        });
    }

    /**
     * 获取资源缓存信息
     * @returns {Promise<ResourceCacheInfo>}
     */
    static async getInfo() {
        return await invoke('get_resource_cache_info');
    }

    /**
     * 清空临时资源缓存池
     * @returns {Promise<number>} 释放的空间大小（字节）
     */
    static async clearTempPool() {
        return await invoke('clear_temp_resource_cache');
    }

    /**
     * 清空偏好资源缓存池
     * @returns {Promise<number>} 释放的空间大小（字节）
     */
    static async clearPreferencePool() {
        return await invoke('clear_preference_resource_cache');
    }

    /**
     * 检查资源是否已缓存
     * @param {Trace|Object} trace - 来源追踪信息
     * @returns {Promise<boolean>}
     */
    static async isCached(trace) {
        const traceData = trace instanceof Trace ? trace.toRaw() : trace;
        return await invoke('is_resource_cached', {
            trace: traceData
        });
    }

    /**
     * 获取缓存资源路径
     * @param {Trace|Object} trace - 来源追踪信息
     * @returns {Promise<string|null>} 缓存文件路径
     */
    static async getCachedPath(trace) {
        const traceData = trace instanceof Trace ? trace.toRaw() : trace;
        return await invoke('get_cached_resource_path', {
            trace: traceData
        });
    }

    /**
     * 清理临时资源缓存（LRU 策略）
     * @returns {Promise<number>} 释放的空间大小（字节）
     */
    static async cleanupTempPool() {
        return await invoke('cleanup_temp_resource_cache');
    }

    /**
     * 设置资源缓存池大小
     * @param {number} tempSize - 临时池最大大小（字节）
     * @param {number} preferenceSize - 偏好池最大大小（字节）
     * @returns {Promise<void>}
     */
    static async setPoolSizes(tempSize, preferenceSize) {
        return await invoke('set_resource_cache_pool_sizes', {
            tempSize,
            preferenceSize
        });
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
     * 获取缓存使用情况摘要
     * @returns {Promise<string>}
     */
    static async getSummary() {
        const info = await this.getInfo();
        
        const tempUsage = this.formatSize(info.tempPool.totalSize);
        const tempMax = this.formatSize(info.tempPool.maxSize);
        const prefUsage = this.formatSize(info.preferencePool.totalSize);
        const prefMax = this.formatSize(info.preferencePool.maxSize);
        
        return `资源缓存统计:\n` +
               `- 临时缓存: ${tempUsage} / ${tempMax} (${info.tempPool.count} 项, ${info.tempPool.usagePercent.toFixed(1)}%)\n` +
               `- 偏好缓存: ${prefUsage} / ${prefMax} (${info.preferencePool.count} 项, ${info.preferencePool.usagePercent.toFixed(1)}%)`;
    }
}

// 向后兼容的别名
export const CachePoolType = ResourcePoolType;

export default ResourceCache;
