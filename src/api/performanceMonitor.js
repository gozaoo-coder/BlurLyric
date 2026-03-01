/**
 * Performance Monitor - 前端性能监控模块
 * 
 * 与后端性能监控系统配合，提供资源加载监控、缓存统计等功能
 */

import { invoke } from '@tauri-apps/api/core';

// 性能指标存储
const metrics = {
  resourceLoads: [],
  cacheHits: 0,
  cacheMisses: 0,
  loadTimes: []
};

// 资源加载计时器
const resourceTimers = new Map();

/**
 * 开始资源加载计时
 * @param {string} resourceId - 资源唯一标识
 */
export function startResourceTimer(resourceId) {
  resourceTimers.set(resourceId, performance.now());
}

/**
 * 结束资源加载计时并记录
 * @param {string} resourceId - 资源唯一标识
 * @param {string} resourceType - 资源类型
 * @param {boolean} fromCache - 是否来自缓存
 */
export function endResourceTimer(resourceId, resourceType, fromCache = false) {
  const startTime = resourceTimers.get(resourceId);
  if (!startTime) return null;
  
  const duration = performance.now() - startTime;
  resourceTimers.delete(resourceId);
  
  // 记录到本地指标
  const metric = {
    resourceId,
    resourceType,
    duration,
    fromCache,
    timestamp: Date.now()
  };
  
  metrics.resourceLoads.push(metric);
  
  if (fromCache) {
    metrics.cacheHits++;
  } else {
    metrics.cacheMisses++;
  }
  
  metrics.loadTimes.push(duration);
  
  // 限制历史记录数量
  if (metrics.resourceLoads.length > 1000) {
    metrics.resourceLoads.shift();
  }
  
  // 同步到后端
  try {
    invoke('record_resource_load', {
      resourceType,
      resourceId,
      durationMs: duration,
      fromCache
    }).catch(() => {});
  } catch (e) {
    // 忽略后端调用错误
  }
  
  return metric;
}

/**
 * 获取本地性能统计
 */
export function getLocalStats() {
  const totalLoads = metrics.cacheHits + metrics.cacheMisses;
  const avgLoadTime = metrics.loadTimes.length > 0
    ? metrics.loadTimes.reduce((a, b) => a + b, 0) / metrics.loadTimes.length
    : 0;
  
  return {
    totalLoads,
    cacheHits: metrics.cacheHits,
    cacheMisses: metrics.cacheMisses,
    cacheHitRate: totalLoads > 0 ? (metrics.cacheHits / totalLoads * 100).toFixed(2) : 0,
    avgLoadTime: avgLoadTime.toFixed(2),
    recentLoads: metrics.resourceLoads.slice(-20)
  };
}

/**
 * 获取后端性能统计
 */
export async function getBackendStats() {
  try {
    return await invoke('get_performance_stats');
  } catch (e) {
    console.error('Failed to get backend stats:', e);
    return null;
  }
}

/**
 * 获取完整性能报告
 */
export async function getPerformanceReport() {
  try {
    const backendReport = await invoke('get_performance_report');
    const localStats = getLocalStats();
    
    return {
      backend: backendReport,
      frontend: localStats,
      combined: {
        totalCacheHits: backendReport?.overall_stats?.cache_hits + localStats.cacheHits,
        totalCacheMisses: backendReport?.overall_stats?.cache_misses + localStats.cacheMisses,
        avgLoadTime: Math.max(backendReport?.avg_load_time_ms || 0, parseFloat(localStats.avgLoadTime))
      }
    };
  } catch (e) {
    console.error('Failed to get performance report:', e);
    return null;
  }
}

/**
 * 重置性能统计
 */
export async function resetStats() {
  // 重置本地指标
  metrics.resourceLoads = [];
  metrics.cacheHits = 0;
  metrics.cacheMisses = 0;
  metrics.loadTimes = [];
  
  // 重置后端指标
  try {
    await invoke('reset_performance_stats');
  } catch (e) {
    console.error('Failed to reset backend stats:', e);
  }
}

/**
 * 监控资源加载的高阶函数
 * @param {Function} loadFn - 资源加载函数
 * @param {string} resourceType - 资源类型
 * @param {string} resourceId - 资源ID
 */
export async function monitorResourceLoad(loadFn, resourceType, resourceId) {
  const timerId = `${resourceType}_${resourceId}_${Date.now()}`;
  startResourceTimer(timerId);
  
  try {
    const result = await loadFn();
    endResourceTimer(timerId, resourceType, false);
    return result;
  } catch (error) {
    endResourceTimer(timerId, resourceType, false);
    throw error;
  }
}

/**
 * 创建性能监控包装器
 * @param {Object} api - API对象
 * @param {string} resourceType - 资源类型
 */
export function createMonitoredApi(api, resourceType) {
  return new Proxy(api, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === 'function') {
        return async (...args) => {
          const resourceId = `${prop}_${args.join('_')}`;
          return monitorResourceLoad(
            () => value.apply(target, args),
            resourceType,
            resourceId
          );
        };
      }
      return value;
    }
  });
}

// 导出性能监控器实例
export const performanceMonitor = {
  startResourceTimer,
  endResourceTimer,
  getLocalStats,
  getBackendStats,
  getPerformanceReport,
  resetStats,
  monitorResourceLoad,
  createMonitoredApi
};

export default performanceMonitor;
