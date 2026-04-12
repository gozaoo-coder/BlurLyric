<template>
  <div v-if="visible" class="drawer-overlay" @click="handleOverlayClick">
    <div ref="drawerContent" class="drawer-content" @click.stop>
      <div ref="dragBar" class="drag-bar">
        <div class="drag-handle"></div>
        <button class="close-btn" @click="handleClose">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="drawer-list">
        <MusicListPanel
          :tracks="tracks"
          :currentIndex="currentIndex"
          @switchTrack="(index) => $emit('switchTrack', index)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import MusicListPanel from './MusicListPanel.vue'
import anime from 'animejs'
import drag from '../../js/drag.js'

const DRAG_CLOSE_THRESHOLD = 80

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  tracks: {
    type: Array,
    default: () => []
  },
  currentIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'switchTrack'])

const drawerContent = ref(null)
const dragBar = ref(null)
let dragInstance = null
let currentAnimation = null

const setupDrag = () => {
  if (dragInstance) dragInstance.destroy()
  if (!dragBar.value || !drawerContent.value) return

  dragInstance = drag.create(
    dragBar.value,
    () => {
      // on start - cancel any running animation
      if (currentAnimation) {
        currentAnimation.pause()
        currentAnimation = null
      }
    },
    (info) => {
      // on move - translate drawer content by offsetY, only allow downward drag
      if (!drawerContent.value) return
      const clampedOffsetY = Math.max(0, info.offsetY)
      drawerContent.value.style.transform = `translateY(${clampedOffsetY}px)`
    },
    (info) => {
      // on end - close if dragged past threshold, else snap back
      if (info.offsetY > DRAG_CLOSE_THRESHOLD) {
        closeDrawer()
      } else {
        snapBack()
      }
    }
  )
}

const destroyDrag = () => {
  if (dragInstance) {
    dragInstance.destroy()
    dragInstance = null
  }
}

const openDrawer = () => {
  nextTick(() => {
    if (!drawerContent.value) return
    currentAnimation = anime({
      targets: drawerContent.value,
      translateY: ['100%', '0px'],
      easing: 'spring(1, 80, 10, 0)',
      duration: 500,
      complete: () => {
        currentAnimation = null
        setupDrag()
      }
    })
  })
}

const closeDrawer = () => {
  destroyDrag()
  if (!drawerContent.value) {
    emit('close')
    return
  }
  currentAnimation = anime({
    targets: drawerContent.value,
    translateY: ['0px', '100%'],
    easing: 'spring(1, 80, 10, 0)',
    duration: 400,
    complete: () => {
      currentAnimation = null
      emit('close')
    }
  })
}

const snapBack = () => {
  if (!drawerContent.value) return
  currentAnimation = anime({
    targets: drawerContent.value,
    translateY: '0px',
    easing: 'spring(1, 80, 10, 0)',
    duration: 300,
    complete: () => {
      currentAnimation = null
    }
  })
}

const handleOverlayClick = () => {
  closeDrawer()
}

const handleClose = () => {
  closeDrawer()
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    openDrawer()
  } else {
    destroyDrag()
  }
})

onUnmounted(() => {
  destroyDrag()
  if (currentAnimation) {
    currentAnimation.pause()
    currentAnimation = null
  }
})
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.drawer-content {
  width: 100%;
  max-height: 70vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(30px);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
}

.drag-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  cursor: grab;
  position: relative;
  min-height: 40px;
  touch-action: none;
}

.drag-bar:active {
  cursor: grabbing;
}

.drag-handle {
  width: 36px;
  height: 4px;
  background: #0003;
  border-radius: 2px;
}

.close-btn {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 16px;
  color: #0008;
  cursor: pointer;
  padding: 4px 8px;
}

.close-btn:hover {
  color: #000c;
}

.drawer-list {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
</style>
