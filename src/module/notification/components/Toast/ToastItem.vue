<template>
  <div
    class="toast-item"
    :class="[`toast-${item.level || 'info'}`]"
    ref="toastRef"
    @mouseenter="pauseTimer"
    @mouseleave="resumeTimer"
  >
    <div class="toast-indicator" :class="`indicator-${item.level || 'info'}`"></div>

    <div class="toast-icon">
      <svg v-if="item.level === 'success'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <svg v-else-if="item.level === 'warning'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <svg v-else-if="item.level === 'error'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    </div>

    <div class="toast-content">
      <span class="toast-message">{{ item.message }}</span>
      <span v-if="item.repeatTimes > 1" class="toast-badge">{{ item.repeatTimes }}</span>
    </div>

    <button class="toast-close" @click="handleDismiss" aria-label="关闭">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <div v-if="item.duration > 0" class="toast-progress" :style="{ animationDuration: `${item.duration}ms` }"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { runAnimation } from '../../animations/NotificationAnimations.js'

defineOptions({ name: 'ToastItem' })

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  position: {
    type: String,
    default: 'TOP'
  }
})

const emit = defineEmits(['dismiss'])

const toastRef = ref(null)
let timerId = null
let remainingTime = (props.item && props.item.duration) || 3000
let startTime = null
let isUnmounted = false

onMounted(() => {
  playEnterAnimation()
  startAutoDismiss()
})

onUnmounted(() => {
  isUnmounted = true
  clearAutoDismiss()
})

function playEnterAnimation() {
  if (!toastRef.value) return
  const pos = (props.position || 'TOP').toUpperCase()
  let animName = 'slideInDown'
  if (pos.includes('BOTTOM')) animName = 'slideInUp'
  else if (pos.includes('LEFT')) animName = 'slideInLeft'
  else if (pos.includes('RIGHT')) animName = 'slideInRight'
  runAnimation(toastRef.value, animName)
}

function playExitAnimation() {
  return new Promise((resolve) => {
    if (!toastRef.value) return resolve()
    runAnimation(toastRef.value, { properties: { opacity: [1, 0], translateY: [0, '-10px'] }, duration: 200, easing: 'easeInQuad' }, resolve)
  })
}

function handleDismiss() {
  clearAutoDismiss()
  playExitAnimation().then(() => {
    if (!isUnmounted) {
      emit('dismiss', props.item.id)
    }
  })
}

function startAutoDismiss() {
  const duration = props.item.duration || 3000
  if (duration <= 0) return
  remainingTime = duration
  startTime = Date.now()
  timerId = setTimeout(() => {
    handleDismiss()
  }, duration)
}

function clearAutoDismiss() {
  if (timerId) {
    clearTimeout(timerId)
    timerId = null
  }
}

function pauseTimer() {
  if (!timerId) return
  clearTimeout(timerId)
  timerId = null
  remainingTime -= Date.now() - startTime
}

function resumeTimer() {
  if (remainingTime <= 0) return
  startTime = Date.now()
  timerId = setTimeout(() => handleDismiss(), remainingTime)
}
</script>

<style scoped>
.toast-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  min-width: 280px;
  max-width: 360px;
  font-size: 0.85rem;
  line-height: 1.45;
  color: #fff;
  pointer-events: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: hidden;
}

.toast-indicator {
  position: absolute;
  left: 0;
  top: 8%;
  bottom: 8%;
  width: 3px;
  border-radius: 0 2px 2px 0;
}

.indicator-info { background-color: #1677ff; }
.indicator-success { background-color: #52c41a; }
.indicator-warning { background-color: #faad14; }
.indicator-error { background-color: #ff4d4f; }

.toast-info {
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.92), rgba(22, 119, 255, 0.78));
}
.toast-success {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.92), rgba(82, 196, 26, 0.78));
}
.toast-warning {
  background: linear-gradient(135deg, rgba(250, 173, 20, 0.92), rgba(250, 173, 20, 0.78));
}
.toast-error {
  background: linear-gradient(135deg, rgba(255, 77, 79, 0.92), rgba(255, 77, 79, 0.78));
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.95;
}

.toast-content {
  flex: 1;
  min-width: 0;
  position: relative;
}

.toast-message {
  word-break: break-word;
}

.toast-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
  background: rgba(255, 255, 255, 0.3);
  border: 1.5px solid rgba(255, 255, 255, 0.5);
}

.toast-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -4px -6px -4px 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.2s ease;
}

.toast-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.45);
  border-radius: 0 0 10px 10px;
  animation: toast-timer linear forwards;
}

@keyframes toast-timer {
  from { width: 100%; }
  to { width: 0%; }
}
</style>
