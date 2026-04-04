<template>
  <Teleport to="body">
    <Transition name="dialog-fade" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave">
      <div v-if="isVisible" class="base-dialog-mask" :style="{ zIndex }" @click="handleMaskClick">
        <div
          ref="dialogRef"
          class="base-dialog-container"
          :class="{ 'global_backgroundblur_light': true }"
          @click.stop
        >
          <div v-if="showCloseButton" class="base-dialog-close" @click="handleClose">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </div>

          <div v-if="$slots.header || title" class="base-dialog-header">
            <slot name="header">
              <span class="base-dialog-title">{{ title }}</span>
            </slot>
          </div>

          <div class="base-dialog-body">
            <slot></slot>
          </div>

          <div v-if="$slots.footer" class="base-dialog-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { runAnimation, getAnimation } from '../../animations/NotificationAnimations.js';

defineOptions({ name: 'BaseDialog' });

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  maskClosable: {
    type: Boolean,
    default: true
  },
  showCloseButton: {
    type: Boolean,
    default: true
  },
  closableOnEsc: {
    type: Boolean,
    default: true
  },
  zIndex: {
    type: Number,
    default: 2000
  },
  animationType: {
    type: String,
    default: 'scaleIn'
  },
  closeAnimation: {
    type: String,
    default: 'scaleOut'
  },
  duration: {
    type: Number,
    default: 300
  },
  title: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel', 'close', 'after-enter', 'after-leave']);

const dialogRef = ref(null);
const isVisible = ref(false);
const isClosing = ref(false);

watch(() => props.visible, (val) => {
  if (val) {
    isVisible.value = true;
    isClosing.value = false;
    document.body.classList.add('dialog-open');
    nextTick(() => {
      playEnterAnimation();
    });
  } else if (!isClosing.value) {
    handleClose();
  }
});

function handleMaskClick() {
  if (props.maskClosable) {
    handleCancel();
  }
}

function handleEscKey(e) {
  if (e.key === 'Escape' && props.closableOnEsc && props.visible) {
    handleCancel();
  }
}

function handleCancel() {
  emit('cancel');
  emit('close');
  closeWithAnimation();
}

function handleClose() {
  emit('close');
  closeWithAnimation();
}

function closeWithAnimation() {
  if (!dialogRef.value) {
    isVisible.value = false;
    document.body.classList.remove('dialog-open');
    emit('update:visible', false);
    return;
  }

  isClosing.value = true;
  const animConfig = getAnimation(props.closeAnimation);
  if (animConfig) {
    animConfig.duration = props.duration;
  }

  runAnimation(dialogRef.value, animConfig || props.closeAnimation, () => {
    isVisible.value = false;
    isClosing.value = false;
    document.body.classList.remove('dialog-open');
    emit('update:visible', false);
  });
}

function playEnterAnimation() {
  if (!dialogRef.value) return;
  const animConfig = getAnimation(props.animationType);
  if (animConfig) {
    animConfig.duration = props.duration;
  }
  runAnimation(dialogRef.value, animConfig || props.animationType);
}

function handleAfterEnter() {
  emit('after-enter');
}

function handleAfterLeave() {
  emit('after-leave');
}

onMounted(() => {
  window.addEventListener('keydown', handleEscKey);
  if (props.visible) {
    isVisible.value = true;
    document.body.classList.add('dialog-open');
    nextTick(() => {
      playEnterAnimation();
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscKey);
  document.body.classList.remove('dialog-open');
});

defineExpose({
  close: handleClose,
  confirm: () => emit('confirm')
});
</script>

<style scoped>
.base-dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.base-dialog-container {
  position: relative;
  background-color: var(--bg-color, #ffffff);
  border-radius: 11px;
  box-shadow: var(--Shadow-value-card-high, 0 8px 32px rgba(0, 0, 0, 0.15));
  padding: 14px;
  min-width: min(240px, 80vw);
  max-width: min(480px, 90vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.base-dialog-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary, #999);
  border-radius: 4px;
  transition: all 0.2s ease;
  z-index: 1;
}

.base-dialog-close:hover {
  color: var(--text-primary, #333);
  background-color: rgba(0, 0, 0, 0.06);
}

.base-dialog-header {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color-light, #f0f0f0);
  margin-bottom: 12px;
}

.base-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  line-height: 1.4;
}

.base-dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.base-dialog-footer {
  padding-top: 12px;
  border-top: 1px solid var(--border-color-light, #f0f0f0);
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-fade-enter-active {
  transition: opacity 0.25s ease;
}

.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
