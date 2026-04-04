<template>
  <div class="image-container" ref="containerRef">
    <div class="placeholder" v-show="!currentSrc || imageOpacity === 0">
      <i class="bi bi-music-note"></i>
    </div>
    <div class="loading-skeleton" v-show="isLoading && imageOpacity === 0"></div>
    <img
      v-show="currentSrc"
      :src="currentSrc"
      class="loaded-image"
      :style="{ opacity: imageOpacity }"
      @load="handleImageLoad"
      @error="handleImageError"
    />
  </div>
</template>

<script>
import manager from '../../api/manager';
import lazyLoader from '../../api/lazyLoader';

export default {
  data() {
    return {
      imageOpacity: 0,
      currentSrc: '',
      nextTransilateTime: 0,
      timerID: undefined,
      isLoading: false,
      cacheKey: null,
      pendingId: null,
    };
  },
  inject: ['regMessage'],
  props: {
    id: {
      type: [String, Number],
      default: "",
    },
    maxResolution: {
      type: [Number, String],
      default: 368,
    },
  },
  methods: {
    handleImageLoad(event) {
      let delay = this.nextTransilateTime - Date.now();
      if (this.timerID !== undefined) {
        clearTimeout(this.timerID);
      }
      if (delay >= 0) {
        this.timerID = setTimeout(() => {
          this.imageOpacity = 1;
        }, delay);
      } else {
        this.imageOpacity = 1;
      }
      this.$emit("imageLoaded", event);
    },
    handleImageError(error) {
      this.$emit("imageError", error);
    },

    _getResourceCacheKey() {
      const res = Number(this.maxResolution) || 368;
      return `cover_${res}_${this.id}`;
    },

    fadeOutImage() {
      this.imageOpacity = 0;
      this.nextTransilateTime = Date.now() + 500;
      setTimeout(() => {
        this.fetchAlbumCover();
      }, 500);
    },

    acquireResource(data) {
      if (!data?.objectURL) return;

      const newCacheKey = this._getResourceCacheKey();

      if (this.cacheKey && this.cacheKey !== newCacheKey) {
        this._releaseRefOnly();
      }

      this.cacheKey = newCacheKey;
      const cached = lazyLoader.acquire(this.cacheKey, this.$refs.containerRef);

      if (cached) {
        this.currentSrc = cached.objectURL;
      } else {
        this.currentSrc = data.objectURL;
      }
    },

    _releaseRefOnly() {
      if (!this.cacheKey) return;
      lazyLoader.release(this.cacheKey, this.$refs.containerRef);
      this.cacheKey = null;
    },

    async fetchAlbumCover() {
      const targetId = this.id;
      const targetKey = this._getResourceCacheKey();

      if (this.cacheKey === targetKey && this.currentSrc) {
        this.handleImageLoad();
        return;
      }

      this.pendingId = targetId;
      this.isLoading = true;
      this._releaseRefOnly();

      let result_message = null;
      const resolution = Number(this.maxResolution) || 0;

      if (resolution !== 0) {
        const isFromCache = lazyLoader.isCached(targetKey);
        if (!isFromCache) {
          result_message = this.regMessage({
            type: "LongMessage",
            content: "正在加载封面...",
          });
        }
      }

      try {
        const result = await manager.tauri.getAlbumCover(targetId, this.maxResolution);

        if (this.pendingId !== targetId) return;

        this.acquireResource(result);
        result_message?.destoryMessage?.();

        this.handleImageLoad();
      } catch (err) {
        if (err != 'Album cover not found') {
          console.log(err);
        }
        result_message?.destoryMessage?.();
      } finally {
        if (this.pendingId === targetId) {
          this.isLoading = false;
          this.pendingId = null;
        }
      }
    },
  },
  watch: {
    id: {
      handler(newId, oldId) {
        if (newId !== oldId && newId >= 0) {
          this.fadeOutImage();
        }
      },
    },
  },
  unmounted() {
    this._releaseRefOnly();
    this.currentSrc = '';
    this.imageOpacity = 0;
  },
  mounted() {
    if (this.id >= 0) {
      this.fetchAlbumCover();
    }
  },
};
</script>

<style scoped>
.image-container {
  position: relative;
  overflow: hidden;
  box-shadow: var(--Shadow-value-normal);
}

.placeholder {
  height: 100%;
  width: 100%;
  background-color: #00000007;
  color: var(--fontColor-content-moreUnimportant);
  display: flex;
  font-size: 1.3em;
  align-items: center;
  justify-content: center;
}

.loading-skeleton {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    110deg,
    rgba(0, 0, 0, 0.04) 8%,
    rgba(0, 0, 0, 0.08) 18%,
    rgba(0, 0, 0, 0.04) 33%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.loaded-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: auto;
  object-fit: cover;
  transition: opacity .5s;
}
</style>
