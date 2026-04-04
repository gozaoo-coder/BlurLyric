<template>
  <div class="image-container" ref="containerRef">
    <div class="placeholder" v-show="!currentSrc || imageOpacity === 0">
      <i class="bi bi-music-note"></i>
    </div>
    <div class="loading-skeleton" v-show="isLoading && !currentSrc"></div>
    <img
      v-if="currentSrc"
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
      objectURL: null,
      destroyObjectURL: () => {},
      isLoading: false,
      cacheKey: null,
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
    fadeOutImage() {
      this.imageOpacity = 0;
      this.nextTransilateTime = Date.now() + 500;
      this.releaseResource();
      setTimeout(() => {
        this.fetchAlbumCover();
      }, 500);
    },
    _getResourceCacheKey() {
      const res = Number(this.maxResolution) || 368;
      return `cover_${res}_${this.id}`;
    },
    acquireResource(data) {
      if (!data?.objectURL) return;

      this.cacheKey = this._getResourceCacheKey();
      const cached = lazyLoader.acquire(this.cacheKey, this.$refs.containerRef);

      if (cached) {
        this.objectURL = cached.objectURL;
        this.currentSrc = cached.objectURL;
        this.destroyObjectURL = () => {};
      } else {
        this.objectURL = data.objectURL;
        this.currentSrc = data.objectURL;
        this.destroyObjectURL = data.destroyObjectURL || (() => {});
      }
    },
    releaseResource() {
      if (!this.cacheKey) return;

      lazyLoader.release(this.cacheKey, this.$refs.containerRef);

      if (this.destroyObjectURL) {
        try {
          this.destroyObjectURL();
        } catch (e) {}
      }

      this.currentSrc = '';
      this.imageOpacity = 0;
      this.cacheKey = null;
    },
    async fetchAlbumCover() {
      this.isLoading = true;
      this.releaseResource();

      let result_message = null;
      const resolution = Number(this.maxResolution) || 0;

      if (resolution !== 0) {
        const cacheKey = this._getResourceCacheKey();
        const isFromCache = lazyLoader.isCached(cacheKey);

        if (!isFromCache) {
          result_message = this.regMessage({
            type: "LongMessage",
            content: "正在加载封面...",
          });
        }
      }

      try {
        const result = await manager.tauri.getAlbumCover(this.id, this.maxResolution);

        this.acquireResource(result);
        result_message?.destoryMessage?.();

        this.handleImageLoad();
      } catch (err) {
        if (err != 'Album cover not found') {
          console.log(err);
        }
        result_message?.destoryMessage?.();
      } finally {
        this.isLoading = false;
      }
    },
  },
  watch: {
    id: {
      immediate: true,
      handler(newId, oldId) {
        if (newId !== oldId && newId >= 0) {
          this.fadeOutImage();
        }
      },
    },
  },
  unmounted() {
    this.releaseResource();
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
