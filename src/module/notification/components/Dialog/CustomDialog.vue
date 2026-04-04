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
    @confirm="$emit('confirm')"
    @cancel="handleCancel"
  >
    <slot></slot>

    <template #header v-if="$slots.header || title">
      <slot name="header">
        <span class="custom-dialog-title">{{ title }}</span>
      </slot>
    </template>

    <template #footer>
      <slot name="footer">
        <div class="default-footer">
          <button class="dialog-btn dialog-btn-default" @click="handleCancel">
            取消
          </button>
          <button class="dialog-btn dialog-btn-primary" @click="$emit('confirm')">
            确定
          </button>
        </div>
      </slot>
    </template>
  </BaseDialog>
</template>

<script setup>
import BaseDialog from './BaseDialog.vue';

defineOptions({ name: 'CustomDialog' });

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
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

function handleCancel() {
  emit('cancel');
  emit('close');
  emit('update:visible', false);
}
</script>

<style scoped>
.custom-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  line-height: 1.4;
}

.default-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
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
</style>
