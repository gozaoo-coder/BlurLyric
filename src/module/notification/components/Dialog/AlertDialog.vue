<template>
  <BaseDialog
    :visible="visible"
    :z-index="zIndex"
    :animation-type="animationType"
    :close-animation="closeAnimation"
    :duration="duration"
    :show-close-button="showCloseButton"
    :mask-closable="maskClosable"
    :closable-on-esc="closableOnEsc"
    @update:visible="$emit('update:visible', $event)"
    @confirm="handleConfirm"
  >
    <template #header>
      <div class="alert-dialog-header-content">
        <div class="alert-icon" :class="[`alert-icon-${level}`]">
          <component :is="iconComponent" />
        </div>
        <span class="alert-title">{{ title }}</span>
      </div>
    </template>

    <div class="alert-content">
      {{ content }}
      <slot></slot>
    </div>

    <template #footer>
      <button class="dialog-btn dialog-btn-primary" :class="[`btn-${level}`]" @click="handleConfirm">
        {{ confirmText }}
      </button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { computed, h } from 'vue';
import BaseDialog from './BaseDialog.vue';
import { NotificationLevel } from '../../core/NotificationTypes.js';

defineOptions({ name: 'AlertDialog' });

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '提示'
  },
  content: {
    type: String,
    default: ''
  },
  level: {
    type: String,
    default: NotificationLevel.INFO
  },
  confirmText: {
    type: String,
    default: '我知道了'
  },
  showCancel: {
    type: Boolean,
    default: false
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
  showCloseButton: {
    type: Boolean,
    default: true
  },
  maskClosable: {
    type: Boolean,
    default: true
  },
  closableOnEsc: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel', 'close']);

const iconMap = {
  [NotificationLevel.INFO]: () => h('svg', { viewBox: '0 0 24 24', width: '22', height: '22', fill: 'currentColor' }, [
    h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z' })
  ]),
  [NotificationLevel.SUCCESS]: () => h('svg', { viewBox: '0 0 24 24', width: '22', height: '22', fill: 'currentColor' }, [
    h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' })
  ]),
  [NotificationLevel.WARNING]: () => h('svg', { viewBox: '0 0 24 24', width: '22', height: '22', fill: 'currentColor' }, [
    h('path', { d: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z' })
  ]),
  [NotificationLevel.ERROR]: () => h('svg', { viewBox: '0 0 24 24', width: '22', height: '22', fill: 'currentColor' }, [
    h('path', { d: 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z' })
  ])
};

const iconComponent = computed(() => iconMap[props.level] || iconMap[NotificationLevel.INFO]);

function handleConfirm() {
  emit('confirm');
  emit('update:visible', false);
}
</script>

<style scoped>
.alert-dialog-header-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.alert-icon-info {
  color: #1890ff;
}

.alert-icon-success {
  color: #52c41a;
}

.alert-icon-warning {
  color: #faad14;
}

.alert-icon-error {
  color: #ff4d4f;
}

.alert-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  line-height: 1.4;
}

.alert-content {
  color: var(--text-secondary, #666);
  font-size: 14px;
  line-height: 1.6;
  padding: 8px 0;
  min-height: 20px;
}

.dialog-btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  outline: none;
  min-width: 80px;
}

.dialog-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.dialog-btn:active {
  transform: translateY(0);
}

.dialog-btn-primary {
  color: #fff;
}

.btn-info {
  background-color: #1890ff;
}

.btn-info:hover {
  background-color: #40a9ff;
}

.btn-success {
  background-color: #52c41a;
}

.btn-success:hover {
  background-color: #73d13d;
}

.btn-warning {
  background-color: #faad14;
  color: #1a1a1a;
}

.btn-warning:hover {
  background-color: #ffc53d;
}

.btn-error {
  background-color: #ff4d4f;
}

.btn-error:hover {
  background-color: #ff7875;
}
</style>
