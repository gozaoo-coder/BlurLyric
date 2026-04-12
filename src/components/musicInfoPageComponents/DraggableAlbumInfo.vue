<template>
  <div ref="rootEl" class="draggable-album-info">
    <AlbumInfoHorizontal
      :track="track"
      :coverSize="coverSize"
      @detailClick="$emit('detailClick')"
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import AlbumInfoHorizontal from './AlbumInfoHorizontal.vue'
import drag from '../../js/drag.js'

const props = defineProps({
  track: {
    type: Object,
    default: () => ({ id: -2, name: '', ar: [], al: { id: -2, name: '', picUrl: '' } })
  },
  coverSize: {
    type: Number,
    default: 48
  },
  active: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['swipeDown', 'detailClick'])

const rootEl = ref(null)
let dragInstance = null

const setupDrag = () => {
  if (dragInstance) dragInstance.destroy()
  dragInstance = drag.create(
    rootEl.value,
    (info) => {}, // on start
    (info) => {}, // on move
    (info) => {
      // on end - only handle downward swipe
      if (info.offsetY > 80 || info.speedY > 1.5) {
        emit('swipeDown', info)
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

watch(() => props.active, (newVal) => {
  if (newVal) {
    nextTick(setupDrag)
  } else {
    destroyDrag()
  }
})

onUnmounted(() => {
  destroyDrag()
})
</script>

<style scoped>
.draggable-album-info {
  cursor: grab;
  touch-action: none;
}
</style>
