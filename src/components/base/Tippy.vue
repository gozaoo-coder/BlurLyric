<script setup>
/**
 * Tippy - 悬浮提示组件
 * 从 EffiTools 移植
 */
import tippy from 'tippy.js';
import 'tippy.js/animations/scale-subtle.css';
import { ref, onMounted } from 'vue';

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  options: {
    type: Object,
    default: () => ({
      placement: 'top',
      arrow: true,
      animation: 'scale-subtle',
      duration: 200
    })
  }
});

const slotContainer = ref(null);

onMounted(() => {
  if (slotContainer.value) {
    tippy(slotContainer.value, {
      content: props.content,
      ...props.options
    });
  }
});
</script>

<template>
  <span ref="slotContainer">
    <slot />
  </span>
</template>
