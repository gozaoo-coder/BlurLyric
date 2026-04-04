<template>
  <div class="toast-container" :class="containerClass" ref="containerRef">
    <TransitionGroup :name="transitionName" tag="div" class="toast-list">
      <ToastItem
        v-for="item in displayItems"
        :key="item.id"
        :item="item"
        :position="normalizedPosition"
        @dismiss="handleDismiss"
      />
    </TransitionGroup>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToastItem from './ToastItem.vue'

defineOptions({ name: 'ToastContainer' })

const props = defineProps({
  items: {
    type: Array,
    required: true,
    default: () => []
  },
  position: {
    type: String,
    default: 'TOP'
  },
  maxCount: {
    type: Number,
    default: 5
  }
})

const emit = defineEmits(['dismiss'])

const containerRef = ref(null)

const normalizedPosition = computed(() => props.position.toUpperCase())

const displayItems = computed(() => {
  const list = [...props.items]
  if (list.length > props.maxCount) {
    return list.slice(-props.maxCount)
  }
  return list
})

const containerClass = computed(() => {
  const pos = normalizedPosition.value
  const map = {
    TOP: 'position-top',
    BOTTOM: 'position-bottom',
    TOP_LEFT: 'position-top-left',
    TOP_RIGHT: 'position-top-right',
    BOTTOM_LEFT: 'position-bottom-left',
    BOTTOM_RIGHT: 'position-bottom-right'
  }
  return map[pos] || 'position-top'
})

const transitionName = computed(() => {
  const pos = normalizedPosition.value
  if (pos.includes('BOTTOM')) return 'toast-slide-up'
  return 'toast-slide-down'
})

function handleDismiss(id) {
  emit('dismiss', id)
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  pointer-events: none;
  z-index: 3000;
  padding: 12px;
  display: flex;
  max-width: 420px;
}

.toast-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.position-top {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.position-bottom {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.position-bottom .toast-list {
  flex-direction: column-reverse;
}

.position-top-left {
  top: 0;
  left: 0;
}

.position-top-right {
  top: 0;
  right: 0;
}

.position-bottom-left {
  bottom: 0;
  left: 0;
}

.position-bottom-left .toast-list {
  flex-direction: column-reverse;
}

.position-bottom-right {
  bottom: 0;
  right: 0;
}

.position-bottom-right .toast-list {
  flex-direction: column-reverse;
}

.toast-slide-down-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-down-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.toast-slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.toast-slide-up-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-up-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.toast-slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
