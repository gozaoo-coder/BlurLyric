<template>
  <div ref="containerRef" class="music-list-panel" @scroll="onScroll">
    <div class="music-list-scroll" :style="{ height: totalHeight + 'px' }">
      <div class="music-list-items" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="item in visibleItems"
          :key="item.index"
          :class="['music-list-item', { active: item.index === currentIndex }]"
          @click="handleClick(item.index)"
        >
          <div class="item-index">{{ item.index + 1 }}</div>
          <div class="item-cover">
            <lazyLoadCoverImage :id="item.track?.al?.id" :maxResolution="0" />
          </div>
          <div class="item-info">
            <div class="item-name">{{ item.track?.name }}</div>
            <div class="item-meta">
              <span v-for="(ar, i) in item.track?.ar" :key="i">
                {{ ar.name }}{{ i < item.track.ar.length - 1 ? '/' : '' }}
              </span>
              <span v-if="item.track?.al?.id != -2"> - {{ item.track?.al?.name }}</span>
            </div>
          </div>
          <div class="item-duration">
            {{ baseMethods.formatTime_MMSS(item.track?.dt ? Math.floor(item.track.dt / 1000) : 0) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import lazyLoadCoverImage from '../base/lazyLoadCoverImage.vue'
import baseMethods from '../../js/baseMethods.js'

const ITEM_HEIGHT = 56
const BUFFER_SIZE = 3

const props = defineProps({
  tracks: {
    type: Array,
    default: () => []
  },
  currentIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['switchTrack'])

const containerRef = ref(null)
const scrollTop = ref(0)
const containerHeight = ref(0)

const totalCount = computed(() => props.tracks.length)

const startIndex = computed(() => {
  const raw = Math.floor(scrollTop.value / ITEM_HEIGHT)
  return Math.max(0, raw - BUFFER_SIZE)
})

const endIndex = computed(() => {
  const visibleCount = Math.ceil(containerHeight.value / ITEM_HEIGHT)
  return Math.min(totalCount.value, startIndex.value + visibleCount + BUFFER_SIZE * 2)
})

const totalHeight = computed(() => totalCount.value * ITEM_HEIGHT)

const offsetY = computed(() => startIndex.value * ITEM_HEIGHT)

const visibleItems = computed(() => {
  const items = []
  for (let i = startIndex.value; i < endIndex.value; i++) {
    items.push({ index: i, track: props.tracks[i] })
  }
  return items
})

const onScroll = (e) => {
  scrollTop.value = e.target.scrollTop
}

const scrollToIndex = (index) => {
  if (!containerRef.value) return
  const targetTop = Math.max(0, (index - 1) * ITEM_HEIGHT)
  containerRef.value.scrollTop = targetTop
}

const handleDoubleClick = (index) => {
  emit('switchTrack', index)
}

let lastClickTime = 0
let lastClickIndex = -1

const handleClick = (index) => {
  const now = Date.now()
  if (now - lastClickTime < 300 && lastClickIndex === index) {
    handleDoubleClick(index)
  }
  lastClickTime = now
  lastClickIndex = index
}

let resizeObserver = null

onMounted(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
    nextTick(() => scrollToIndex(props.currentIndex))

    resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        containerHeight.value = entries[0].contentRect.height
      }
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

watch(() => props.currentIndex, () => {
  // 不自动滚动，避免干扰用户正在浏览的位置
})
</script>

<style scoped>
.music-list-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  scrollbar-width: none;
}

.music-list-panel::-webkit-scrollbar {
  width: 0;
}

.music-list-scroll {
  position: relative;
}

.music-list-items {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
}

.music-list-item {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 12px;
  gap: 10px;
  cursor: pointer;
  border-radius: 4px;
  margin: 2px 4px;
  transition: background 0.15s;
}

.music-list-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.music-list-item.active {
  background: rgba(255, 255, 255, 0.12);
}

.item-index {
  width: 24px;
  font-size: 12px;
  color: #fff6;
  flex-shrink: 0;
}

.item-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 13px;
  font-weight: 700;
  color: #fffe;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 11px;
  color: #fff8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-duration {
  font-size: 11px;
  color: #fff6;
  flex-shrink: 0;
}

.active .item-name {
  color: #fffd;
  font-weight: 900;
}

.active .item-index {
  color: var(--color-toggle-actived);
  font-weight: 700;
}
</style>
