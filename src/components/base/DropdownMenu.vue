<script setup>
/**
 * DropdownMenu - 下拉菜单组件
 * 从 EffiTools 移植
 */
import { ref, onMounted, onUnmounted } from 'vue';
import Tippy from './Tippy.vue';

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  position: {
    type: String,
    default: 'bottom-right'
  }
});

const emit = defineEmits(['select', 'close']);
const isOpen = ref(false);
const menuRef = ref(null);

function toggleMenu() {
  isOpen.value = !isOpen.value;
}

function closeMenu() {
  isOpen.value = false;
  emit('close');
}

function handleItemClick(item, index) {
  if (item.action && typeof item.action === 'function') {
    item.action();
  }
  emit('select', { item, index });
  closeMenu();
}

function handleClickOutside(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="dropdown-container" ref="menuRef">
    <Tippy content="更多选项">
      <button 
        class="dropdown-toggle" 
        @click.stop="toggleMenu" 
        @keydown.enter="toggleMenu" 
        @keydown.space="toggleMenu"
        aria-haspopup="true" 
        :aria-expanded="isOpen"
      >
        <slot></slot>
      </button>
    </Tippy>

    <div v-if="isOpen" class="dropdown-menu" :class="position">
      <button 
        v-for="(item, index) in items" 
        :key="index" 
        class="dropdown-item" 
        @click="handleItemClick(item, index)"
        @keydown.enter="handleItemClick(item, index)" 
        @keydown.space="handleItemClick(item, index)"
      >
        <i v-if="item.icon" :class="item.icon"></i>
        <span>{{ typeof item.label === 'function' ? item.label() : item.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.dropdown-container {
  position: relative;
  display: inline-block;
}

.dropdown-toggle {
  padding: 4px 8px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  width: 36px;
  height: 36px;
  background-color: rgba(15, 15, 15, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.dropdown-toggle:hover {
  background-color: rgba(15, 15, 15, 0.08);
}

.dropdown-toggle:active {
  transform: scale(0.95);
}

.dropdown-menu {
  position: absolute;
  min-width: 180px;
  background-color: white;
  border-radius: 4px;
  padding: 8px 0;
  z-index: 1000;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  background: #FBFBFB;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-width: 800px;
  transition: all 0.3s ease;
}

.dropdown-menu.bottom-right {
  right: 0;
  top: 100%;
}

.dropdown-menu.bottom-left {
  left: 0;
  top: 100%;
}

.dropdown-menu.top-right {
  right: 0;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 8px;
}

.dropdown-menu.top-left {
  left: 0;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 8px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 9px 18px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 14px;
  color: #333;
}

.dropdown-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.dropdown-item i {
  margin-right: 8px;
}
</style>
