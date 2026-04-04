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
    :title="title"
    @update:visible="$emit('update:visible', $event)"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="confirm-content">
      {{ content }}
      <slot></slot>
    </div>

    <template #footer>
      <button class="dialog-btn dialog-btn-default" @click="handleCancel">
        {{ cancelText }}
      </button>
      <button
        class="dialog-btn"
        :class="[confirmDanger ? 'dialog-btn-danger' : 'dialog-btn-primary']"
        @click="handleConfirm"
      >
        {{ confirmText }}
      </button>
    </template>
  </BaseDialog>
</template>

<script setup>
import BaseDialog from './BaseDialog.vue';
import { NotificationLevel } from '../../core/NotificationTypes.js';

defineOptions({ name: 'ConfirmDialog' });

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
  },
  content: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  confirmDanger: {
    type: Boolean,
    default: false
  },
  level: {
    type: String,
    default: NotificationLevel.WARNING
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

function handleConfirm() {
  emit('confirm');
  emit('update:visible', false);
}

function handleCancel() {
  emit('cancel');
  emit('close');
  emit('update:visible', false);
}
</script>

<style scoped>
.confirm-content {
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

.dialog-btn-default {
  background-color: #f5f5f5;
  color: var(--text-primary, #333);
  border: 1px solid #d9d9d9;
}

.dialog-btn-default:hover {
  background-color: #e8e8e8;
  border-color: #bfbfbf;
}

.dialog-btn-primary {
  background-color: #1890ff;
  color: #fff;
}

.dialog-btn-primary:hover {
  background-color: #40a9ff;
}

.dialog-btn-danger {
  background-color: #ff4d4f;
  color: #fff;
}

.dialog-btn-danger:hover {
  background-color: #ff7875;
}
</style>
