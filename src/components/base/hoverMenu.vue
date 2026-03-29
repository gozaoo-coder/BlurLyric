<template>
  <div @mouseover="showMenu" @mouseleave="hideMenu" class="context-menu-container">
    <div class="slot">
      <slot></slot>
    </div>
    <div v-if="visible" class="vue-context-menu" role="menu" :aria-hidden="!visible">
      <template v-for="(item, index) in normalizedMenuItems" :key="index">
        <!-- 分隔线 -->
        <div v-if="item.type === 'divider'" class="hr" role="separator" />

        <!-- 普通菜单项 -->
        <div
          v-else
          class="li"
          role="menuitem"
          tabindex="0"
          @click="handleItemClick(item)"
          @keydown.enter="handleItemClick(item)"
          @keydown.space.prevent="handleItemClick(item)"
        >
          <div v-if="item.iconClass" :class="[...item.iconClass, 'icon']"></div>
          <span class="menu-text">{{ item.name }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

// Props 定义
const props = defineProps({
  /** 菜单项配置数组 */
  menuItems: {
    type: Array,
    default: () => []
  },
  /** 调试模式：始终显示菜单 */
  debugAlwaysOpen: {
    type: Boolean,
    default: false
  }
});

// Emits 定义
const emit = defineEmits(['menu-show', 'menu-hide', 'item-click']);

// 响应式状态
const visible = ref(false);

// 标准化菜单项，统一处理类型
const normalizedMenuItems = computed(() => {
  return (props.menuItems || []).map(item => {
    // 处理旧版本的分隔符判断 '&Split Lines'
    let type = item.type;
    if (item.name === '&Split Lines' || type === 'hr') {
      type = 'divider';
    } else if (type === undefined || type === 'normal') {
      type = 'normal';
    }
    return { ...item, type };
  });
});

// 显示菜单
const showMenu = () => {
  visible.value = true;
  emit('menu-show');
};

// 隐藏菜单
const hideMenu = () => {
  if (props.debugAlwaysOpen) return;
  visible.value = false;
  emit('menu-hide');
};

// 处理菜单项点击
const handleItemClick = (item) => {
  if (item.handleClick && typeof item.handleClick === 'function') {
    item.handleClick();
    emit('item-click', item);
  }
  hideMenu();
};

// 生命周期
onMounted(() => {
  if (props.debugAlwaysOpen) {
    visible.value = true;
  }
});

// 暴露方法供外部调用
defineExpose({
  showMenu,
  hideMenu,
  visible
});
</script>

<style scoped>
.context-menu-container {
  position: relative;
  user-select: none;
}

.icon {
  float: left;
  padding: 0 12px 0 4px;
  box-sizing: border-box;
}

.menu-text {
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.vue-context-menu {
  position: absolute;
  left: 100%;
  top: 50%;
  border-radius: 9px;
  max-width: 200px;
  background-color: #fff;
  box-sizing: border-box;
  padding: 6px;
  min-width: max-content;
  display: flex;
  flex-direction: column;
  font-size: 15px;
  transition: 0.3s cubic-bezier(0.3, 0.7, 0.2, 1);
  gap: 5px;
  user-select: none;
  border: 1px solid rgba(0, 0, 0, 0.12);
  transform: scale(1) translateY(-50%);
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
  transform-origin: 0% 0%;
  animation: spawn_context_menu 0.2s cubic-bezier(0.3, 0.7, 0.2, 1);
}

.vue-context-menu div.hr {
  background: rgba(0, 0, 0, 0.12);
  width: calc(100% - 12px);
  margin: 0 6px;
  height: 1px;
}

.vue-context-menu div.li {
  padding: 6px 10px 6px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: 0.314s cubic-bezier(0.3, 0.7, 0.2, 1);
  width: 100%;
  display: inline-block;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  box-sizing: border-box;
}

.vue-context-menu div.li:hover,
.vue-context-menu div.li:focus {
  background-color: rgba(0, 0, 0, 0.04);
  outline: none;
}

.vue-context-menu div.li:active {
  background-color: rgba(0, 0, 0, 0.08);
}

.li_hoverMenu {
  padding: 6px 25px 6px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: 0.314s cubic-bezier(0.3, 0.7, 0.2, 1);
}

.flexRight {
  position: absolute;
  right: 0;
  color: rgba(0, 0, 0, 0.5);
}

.vue-context-menu div.li:hover,
.li_hoverMenu:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

@keyframes spawn_context_menu {
  from {
    transform: scale(0.7) translate(-10px, calc(-50% - 10px));
    opacity: 0;
    filter: blur(6px);
  }
  to {
    transform: scale(1) translate(0, -50%);
    opacity: 1;
    filter: blur(0);
  }
}
</style>
