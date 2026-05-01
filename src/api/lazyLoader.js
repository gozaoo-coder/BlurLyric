/**
 * Lazy Loader - 按需加载和缓存管理模块
 * 
 * 实现资源的按需加载、自动缓存和智能预加载
 */

import { invoke } from '@tauri-apps/api/core';

class LazyLoader {
  #cache = new Map();
  #loadingPromises = new Map();
  #maxCacheSize = 100;
  #cacheExpiry = 30 * 60 * 1000; // 30分钟
  
  constructor() {
    this.init();
  }
  
  async init() {
    try {
      const isValid = await invoke('is_cache_valid');
      console.log('Cache valid:', isValid);
    } catch (e) {
      console.warn('Cache status check failed:', e);
    }
  }
  
  /**
   * 生成缓存键
   */
  #getCacheKey(type, id) {
    return `${type}_${id}`;
  }
  
  /**
   * 检查缓存是否有效
   */
  isCached(key) {
    const cached = this.#cache.get(key);
    if (!cached) return false;
    
    if (Date.now() - cached.timestamp > this.#cacheExpiry) {
      this.#cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取缓存数据
   */
  get(key) {
    const cached = this.#cache.get(key);
    return cached?.data ?? null;
  }
  
  /**
   * 设置缓存数据
   */
  set(key, data) {
    if (this.#cache.size >= this.#maxCacheSize) {
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
    }
    
    this.#cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * 清除所有缓存（ObjectURL 由各组件自己管理生命周期）
   */
  clearCache() {
    this.#cache.clear();
    this.#loadingPromises.clear();
  }
  
  /**
   * 加载专辑封面
   * 缓存原始 ArrayBuffer，每次调用创建新的 ObjectURL，
   * 避免虚拟滚动等场景下已销毁的 ObjectURL 被复用
   */
  async loadAlbumCover(albumId, maxResolution = 368) {
    const key = this.#getCacheKey(`cover_${maxResolution}`, albumId);

    // 检查缓存中的原始数据
    const cachedRaw = this.isCached(key) ? this.get(key) : null;
    if (cachedRaw) {
      const objectURL = URL.createObjectURL(new Blob([cachedRaw]));
      return {
        objectURL,
        destroyObjectURL: () => URL.revokeObjectURL(objectURL)
      };
    }

    // 防止重复请求
    if (this.#loadingPromises.has(key)) {
      const raw = await this.#loadingPromises.get(key);
      const objectURL = URL.createObjectURL(new Blob([raw]));
      return {
        objectURL,
        destroyObjectURL: () => URL.revokeObjectURL(objectURL)
      };
    }

    const promise = (async () => {
      const result = await invoke('get_low_quality_album_cover', {
        albumId,
        maxResolution
      });
      // 缓存原始数据
      this.set(key, result);
      return result;
    })();

    this.#loadingPromises.set(key, promise);
    const raw = await promise;
    this.#loadingPromises.delete(key);
    const objectURL = URL.createObjectURL(new Blob([raw]));
    return {
      objectURL,
      destroyObjectURL: () => URL.revokeObjectURL(objectURL)
    };
  }
  
  /**
   * 加载原始专辑封面
   * 缓存原始 ArrayBuffer，每次调用创建新的 ObjectURL
   */
  async loadOriginAlbumCover(albumId) {
    const key = this.#getCacheKey('cover_origin', albumId);

    const cachedRaw = this.isCached(key) ? this.get(key) : null;
    if (cachedRaw) {
      const objectURL = URL.createObjectURL(new Blob([cachedRaw]));
      return {
        objectURL,
        destroyObjectURL: () => URL.revokeObjectURL(objectURL)
      };
    }

    if (this.#loadingPromises.has(key)) {
      const raw = await this.#loadingPromises.get(key);
      const objectURL = URL.createObjectURL(new Blob([raw]));
      return {
        objectURL,
        destroyObjectURL: () => URL.revokeObjectURL(objectURL)
      };
    }

    const promise = (async () => {
      const result = await invoke('get_album_cover', { albumId });
      this.set(key, result);
      return result;
    })();

    this.#loadingPromises.set(key, promise);
    const raw = await promise;
    this.#loadingPromises.delete(key);
    const objectURL = URL.createObjectURL(new Blob([raw]));
    return {
      objectURL,
      destroyObjectURL: () => URL.revokeObjectURL(objectURL)
    };
  }
  
  /**
   * 加载音乐文件
   * 缓存原始 ArrayBuffer，每次调用创建新的 ObjectURL
   */
  async loadMusicFile(songId) {
    const key = this.#getCacheKey('music', songId);

    const cachedRaw = this.isCached(key) ? this.get(key) : null;
    if (cachedRaw) {
      const objectURL = URL.createObjectURL(new Blob([cachedRaw]));
      return {
        objectURL,
        destroyObjectURL: () => URL.revokeObjectURL(objectURL)
      };
    }

    if (this.#loadingPromises.has(key)) {
      const raw = await this.#loadingPromises.get(key);
      const objectURL = URL.createObjectURL(new Blob([raw]));
      return {
        objectURL,
        destroyObjectURL: () => URL.revokeObjectURL(objectURL)
      };
    }

    const promise = (async () => {
      const result = await invoke('get_music_file', { songId });
      this.set(key, result);
      return result;
    })();

    this.#loadingPromises.set(key, promise);
    const raw = await promise;
    this.#loadingPromises.delete(key);
    const objectURL = URL.createObjectURL(new Blob([raw]));
    return {
      objectURL,
      destroyObjectURL: () => URL.revokeObjectURL(objectURL)
    };
  }
  
  /**
   * 预加载资源
   */
  async preload(resourceType, id) {
    switch (resourceType) {
      case 'cover':
        return this.loadAlbumCover(id);
      case 'music':
        return this.loadMusicFile(id);
      default:
        console.warn(`Unknown resource type: ${resourceType}`);
    }
  }
  
  /**
   * 批量预加载
   */
  async preloadBatch(items) {
    const promises = items.map(item => 
      this.preload(item.type, item.id).catch(e => {
        console.warn(`Failed to preload ${item.type}_${item.id}:`, e);
        return null;
      })
    );
    
    return Promise.all(promises);
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.#cache.size,
      maxSize: this.#maxCacheSize,
      keys: [...this.#cache.keys()]
    };
  }
}

const lazyLoader = new LazyLoader();

export default lazyLoader;
export { LazyLoader };
