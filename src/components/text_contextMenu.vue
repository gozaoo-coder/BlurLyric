<template>
  <contextMenu :menuItems="menuItems" @item-click="handleItemClick">
    <div ref="innerDom">
      <slot />
    </div>
  </contextMenu>
</template>

<script setup>
import { ref, computed } from 'vue';
import contextMenu from './base/contextMenu.vue';
import baseMethods from '../js/baseMethods';

// Props 定义
const props = defineProps({
  /** 自定义菜单项，如果不提供则使用默认的复制菜单 */
  customMenuItems: {
    type: Array,
    default: null
  },
  /** 是否显示复制文字选项 */
  showCopyText: {
    type: Boolean,
    default: true
  }
});

// Emits 定义
const emit = defineEmits(['copy', 'item-click']);

// 响应式引用
const innerDom = ref(null);

// 默认菜单项
const defaultMenuItems = computed(() => {
  if (props.customMenuItems) {
    return props.customMenuItems;
  }

  const items = [];

  if (props.showCopyText) {
    items.push({
      iconClass: ['bi', 'bi-clipboard'],
      name: '复制文字',
      handleClick: () => {
        const text = innerDom.value?.innerText || '';
        if (text) {
          baseMethods.copy(text);
          emit('copy', text);
        }
      }
    });
  }

  return items;
});

// 菜单项
const menuItems = computed(() => defaultMenuItems.value);

// 处理菜单项点击
const handleItemClick = (item) => {
  emit('item-click', item);
};

// 暴露方法供外部调用
defineExpose({
  innerDom,
  copyText: () => {
    const text = innerDom.value?.innerText || '';
    if (text) {
      baseMethods.copy(text);
      emit('copy', text);
    }
  }
});
</script>
