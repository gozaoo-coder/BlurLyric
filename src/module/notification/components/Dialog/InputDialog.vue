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
    @after-enter="focusInput"
  >
    <div class="input-dialog-content">
      <textarea
        v-if="multiline"
        ref="inputRef"
        v-model="inputValue"
        class="input-field input-textarea"
        :placeholder="placeholder"
        :maxlength="maxLength > 0 ? maxLength : undefined"
        rows="4"
        @keydown.enter.exact.prevent="handleConfirm"
      ></textarea>
      <input
        v-else
        ref="inputRef"
        v-model="inputValue"
        type="text"
        class="input-field input-text"
        :placeholder="placeholder"
        :maxlength="maxLength > 0 ? maxLength : undefined"
        @keydown.enter.exact="handleConfirm"
      />
      <div v-if="maxLength > 0" class="input-counter">
        {{ inputValue.length }} / {{ maxLength }}
      </div>
    </div>

    <template #footer>
      <button class="dialog-btn dialog-btn-default" @click="handleCancel">
        {{ cancelText }}
      </button>
      <button
        class="dialog-btn dialog-btn-primary"
        :disabled="!inputValue.trim()"
        @click="handleConfirm"
      >
        {{ confirmText }}
      </button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import BaseDialog from './BaseDialog.vue';

defineOptions({ name: 'InputDialog' });

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '请输入'
  },
  placeholder: {
    type: String,
    default: '请输入内容...'
  },
  defaultValue: {
    type: String,
    default: ''
  },
  maxLength: {
    type: Number,
    default: 0
  },
  multiline: {
    type: Boolean,
    default: false
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
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

const inputRef = ref(null);
const inputValue = ref(props.defaultValue);

watch(() => props.visible, (val) => {
  if (val) {
    inputValue.value = props.defaultValue;
  }
});

watch(() => props.defaultValue, (val) => {
  if (!props.visible) {
    inputValue.value = val;
  }
});

function focusInput() {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
    }
  });
}

function handleConfirm() {
  if (!inputValue.value.trim()) return;
  emit('confirm', inputValue.value);
  emit('update:visible', false);
}

function handleCancel() {
  emit('cancel');
  emit('close');
  emit('update:visible', false);
}
</script>

<style scoped>
.input-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #d9d9d9);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary, #333);
  background-color: #fff;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
  font-family: inherit;
}

.input-field:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.input-field::placeholder {
  color: var(--text-placeholder, #bfbfbf);
}

.input-text {
  height: 38px;
  line-height: 20px;
}

.input-textarea {
  min-height: 100px;
  resize: vertical;
  line-height: 1.5;
}

.input-counter {
  text-align: right;
  font-size: 12px;
  color: var(--text-placeholder, #999);
  padding: 0 4px;
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

.dialog-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.dialog-btn:active:not(:disabled) {
  transform: translateY(0);
}

.dialog-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dialog-btn-default {
  background-color: #f5f5f5;
  color: var(--text-primary, #333);
  border: 1px solid #d9d9d9;
}

.dialog-btn-default:hover:not(:disabled) {
  background-color: #e8e8e8;
  border-color: #bfbfbf;
}

.dialog-btn-primary {
  background-color: #1890ff;
  color: #fff;
}

.dialog-btn-primary:hover:not(:disabled) {
  background-color: #40a9ff;
}
</style>
