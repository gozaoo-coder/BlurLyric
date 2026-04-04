/**
 * Lazy Loader - 按需加载和引用计数缓存管理模块
 * 
 * 核心机制：
 * - 引用计数：每个资源记录被多少个DOM节点引用
 * - DOM追踪：记录调用者的CSS选择器路径（树状结构）
 * - 延迟回收：引用计数归零后等待10秒，期间有新引用则取消回收
 * - 废弃标记：reclaimed的资源标记为revoked，防止TOCTOU竞态返回死URL
 */

import { invoke } from '@tauri-apps/api/core';

const RECLAIM_DELAY_MS = 10 * 1000;

class RefCountedEntry {
  constructor(data) {
    this.data = data;
    this.refCount = 0;
    this.consumers = new Map();
    this.releaseTimer = null;
    this.timestamp = Date.now();
    this.revoked = false;
  }
}

class LazyLoader {
  #cache = new Map();
  #loadingPromises = new Map();

  constructor() {
    this.init();
  }

  async init() {
    try {
      const isValid = await invoke('is_library_cache_valid');
      console.log('Library cache valid:', isValid);
    } catch (e) {
      console.warn('Library cache status check failed:', e);
    }
  }

  #getCacheKey(type, id) {
    return `${type}_${id}`;
  }

  #getDomSelector(element) {
    if (!element || !element.tagName) return 'unknown';
    const parts = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += `#${current.id}`;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(/\s+/).filter(Boolean).slice(0, 2);
        if (classes.length > 0) selector += `.${classes.join('.')}`;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          selector += `:nth-child(${idx})`;
        }
      }
      parts.unshift(selector);
      current = parent;
      if (parts.length >= 4) break;
    }
    return parts.join(' > ');
  }

  #startReleaseTimer(key) {
    const entry = this.#cache.get(key);
    if (!entry || entry.revoked) return;

    this.#cancelReleaseTimer(key);

    entry.releaseTimer = setTimeout(() => {
      const current = this.#cache.get(key);
      if (!current || current.revoked) return;
      if (current.refCount <= 0) {
        this.#reclaim(key);
      }
    }, RECLAIM_DELAY_MS);
  }

  #cancelReleaseTimer(key) {
    const entry = this.#cache.get(key);
    if (entry?.releaseTimer) {
      clearTimeout(entry.releaseTimer);
      entry.releaseTimer = null;
    }
  }

  #reclaim(key) {
    const entry = this.#cache.get(key);
    if (!entry || entry.revoked) return;

    entry.revoked = true;

    try {
      entry.data.destroyObjectURL?.();
    } catch (e) {
      console.warn(`Failed to revoke ObjectURL for ${key}:`, e);
    }

    this.#cache.delete(key);

    console.log(`Resource reclaimed: ${key}`);
  }

  #getValidEntry(key) {
    const entry = this.#cache.get(key);
    if (!entry || entry.revoked) return null;
    return entry;
  }

  acquire(key, domElement) {
    const entry = this.#getValidEntry(key);
    if (!entry) return null;

    this.#cancelReleaseTimer(key);

    if (entry.revoked) return null;

    const selector = this.#getDomSelector(domElement);
    const prevCount = entry.consumers.get(selector) || 0;
    entry.consumers.set(selector, prevCount + 1);
    entry.refCount += 1;

    console.log(`[LazyLoader] acquire ${key} → refCount=${entry.refCount}, consumer=${selector}`);

    return entry.data;
  }

  release(key, domElement) {
    const entry = this.#getValidEntry(key);
    if (!entry) return;

    const selector = this.#getDomSelector(domElement);
    const prevCount = entry.consumers.get(selector) || 0;

    if (prevCount <= 1) {
      entry.consumers.delete(selector);
    } else {
      entry.consumers.set(selector, prevCount - 1);
    }

    entry.refCount = Math.max(0, entry.refCount - 1);

    console.log(`[LazyLoader] release ${key} → refCount=${entry.refCount}, removed=${selector}`);

    if (entry.refCount <= 0) {
      this.#startReleaseTimer(key);
    }
  }

  isCached(key) {
    const entry = this.#cache.get(key);
    return !!entry && !entry.revoked;
  }

  getCacheStats() {
    const entries = [];
    for (const [key, entry] of this.#cache) {
      entries.push({
        key,
        refCount: entry.refCount,
        revoked: entry.revoked,
        consumers: [...entry.consumers.keys()],
        hasPendingRelease: entry.releaseTimer !== null,
        age: Date.now() - entry.timestamp,
      });
    }
    return {
      size: entries.filter(e => !e.revoked).length,
      entries,
    };
  }

  clearCache() {
    for (const [key] of this.#cache) {
      this.#cancelReleaseTimer(key);
      this.#reclaim(key);
    }
  }

  async loadAlbumCover(albumId, maxResolution = 368) {
    const key = this.#getCacheKey(`cover_${maxResolution}`, albumId);

    const cachedEntry = this.#getValidEntry(key);
    if (cachedEntry) {
      console.log(`Cover ${albumId}@${maxResolution} served from cache`);
      return cachedEntry.data;
    }

    if (this.#loadingPromises.has(key)) {
      return this.#loadingPromises.get(key);
    }

    const promise = (async () => {
      try {
        const result = await invoke('get_low_quality_album_cover', {
          albumId,
          maxResolution,
        });

        const objectURL = URL.createObjectURL(new Blob([result]));
        const data = {
          objectURL,
          destroyObjectURL: () => URL.revokeObjectURL(objectURL),
        };

        const existing = this.#cache.get(key);
        if (existing && !existing.revoked) {
          console.log(`Cover ${albumId}@${maxResolution} loaded but already cached, revoking duplicate`);
          URL.revokeObjectURL(objectURL);
          return existing.data;
        }

        const entry = new RefCountedEntry(data);
        this.#cache.set(key, entry);

        return data;
      } finally {
        this.#loadingPromises.delete(key);
      }
    })();

    this.#loadingPromises.set(key, promise);
    return promise;
  }

  async loadOriginAlbumCover(albumId) {
    const key = this.#getCacheKey('cover_origin', albumId);

    const cachedEntry = this.#getValidEntry(key);
    if (cachedEntry) {
      return cachedEntry.data;
    }

    if (this.#loadingPromises.has(key)) {
      return this.#loadingPromises.get(key);
    }

    const promise = (async () => {
      try {
        const result = await invoke('get_album_cover', { albumId });

        const objectURL = URL.createObjectURL(new Blob([result]));
        const data = {
          objectURL,
          destroyObjectURL: () => URL.revokeObjectURL(objectURL),
        };

        const existing = this.#cache.get(key);
        if (existing && !existing.revoked) {
          URL.revokeObjectURL(objectURL);
          return existing.data;
        }

        const entry = new RefCountedEntry(data);
        this.#cache.set(key, entry);

        return data;
      } finally {
        this.#loadingPromises.delete(key);
      }
    })();

    this.#loadingPromises.set(key, promise);
    return promise;
  }

  async loadMusicFile(songId) {
    const key = this.#getCacheKey('music', songId);

    const cachedEntry = this.#getValidEntry(key);
    if (cachedEntry) {
      return cachedEntry.data;
    }

    if (this.#loadingPromises.has(key)) {
      return this.#loadingPromises.get(key);
    }

    const promise = (async () => {
      try {
        const result = await invoke('get_music_file', { songId });

        const objectURL = URL.createObjectURL(new Blob([result]));
        const data = {
          objectURL,
          destroyObjectURL: () => URL.revokeObjectURL(objectURL),
        };

        const existing = this.#cache.get(key);
        if (existing && !existing.revoked) {
          URL.revokeObjectURL(objectURL);
          return existing.data;
        }

        const entry = new RefCountedEntry(data);
        this.#cache.set(key, entry);

        return data;
      } finally {
        this.#loadingPromises.delete(key);
      }
    })();

    this.#loadingPromises.set(key, promise);
    return promise;
  }

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

  async preloadBatch(items) {
    const promises = items.map(item =>
      this.preload(item.type, item.id).catch(e => {
        console.warn(`Failed to preload ${item.type}_${item.id}:`, e);
        return null;
      })
    );

    return Promise.all(promises);
  }
}

const lazyLoader = new LazyLoader();

export default lazyLoader;
export { LazyLoader };
