<template>
  <div
    class="snackbar-item"
    :class="[`snackbar-${data.level || 'info'}`]"
    ref="snackbarRef"
    @mouseenter="pauseTimer"
    @mouseleave="resumeTimer"
  >
    <span class="snackbar-message">{{ data.message }}</span>
    <button
      v-if="data.actionText"
      class="snackbar-action"
      @click="handleAction"
    >
      {{ data.actionText }}
    </button>
    <div class="snackbar-progress" :style="{ animationDuration: `${duration}ms` }"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { runAnimation } from '../../animations/NotificationAnimations.js'

defineOptions({ name: 'SnackbarItem' })

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['action', 'dismiss'])

const snackbarRef = ref(null)
let timerId = null
let remainingTime = 0
let startTime = null
let isUnmounted = false

const duration = computed(() => props.data.duration || 5000)

onMounted(() => {
  playEnterAnimation()
  startAutoDismiss()
})

onUnmounted(() => {
  isUnmounted = true
  clearAutoDismiss()
})

function playEnterAnimation() {
  if (!snackbarRef.value) return
  runAnimation(snackbarRef.value, 'slideInUp')
}

function playExitAnimation() {
  return new Promise((resolve) => {
    if (!snackbarRef.value) return resolve()
    runAnimation(snackbarRef.value, { properties: { opacity: [1, 0], translateY: [0, '20px'] }, duration: 200, easing: 'easeInQuad' }, resolve)
  })
}

function handleAction() {
  clearAutoDismiss()
  emit('action', { id: (props.data && props.data.id), actionCallback: (props.data && props.data.onAction) })
}

function handleDismiss() {
  clearAutoDismiss()
  playExitAnimation().then(() => {
    if (!isUnmounted) {
      emit('dismiss', props.data.id)
    }
  })
}

function startAutoDismiss() {
  const dur = duration.value
  if (dur <= 0) return
  remainingTime = dur
  startTime = Date.now()
  timerId = setTimeout(() => handleDismiss(), dur)
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
.snackbar-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-radius: 10px;
  max-width: min(500px, 85vw);
  min-width: 280px;
  font-size: 0.875rem;
  color: #fff;
  pointer-events: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: hidden;
}

.snackbar-info {
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.92), rgba(22, 119, 255, 0.78));
}
.snackbar-success {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.92), rgba(82, 196, 26, 0.78));
}
.snackbar-warning {
  background: linear-gradient(135deg, rgba(250, 173, 20, 0.92), rgba(250, 173, 20, 0.78));
}
.snackbar-error {
  background: linear-gradient(135deg, rgba(255, 77, 79, 0.92), rgba(255, 77, 79, 0.78));
}

.snackbar-message {
  flex: 1;
  word-break: break-word;
  line-height: 1.5;
}

.snackbar-action {
  flex-shrink: 0;
  padding: 4px 14px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.snackbar-action:hover {
  background: rgba(255, 255, 255, 0.32);
}

.snackbar-action:active {
  transform: scale(0.96);
}

.snackbar-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.45);
  border-radius: 0 0 10px 10px;
  animation: snackbar-timer linear forwards;
}

@keyframes snackbar-timer {
  from { width: 100%; }
  to { width: 0%; }
}
</style>
