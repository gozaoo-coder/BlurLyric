<script setup>
/**
 * WindowControls - 窗口控制组件
 * 从 EffiTools 移植，适配 BlurLyric
 */
import { ref, onMounted } from 'vue';
import Tippy from './base/Tippy.vue';
import DropdownMenu from './base/DropdownMenu.vue';

// 检查是否在 Tauri 环境中
const isTauri = ref(false);

// 窗口状态
const isAlwaysOnTop = ref(false);

//  emits
const emit = defineEmits(['toggle', 'close']);

onMounted(() => {
  isTauri.value = !!(window.__TAURI_INTERNALS__);
});

/**
 * 切换窗口置顶状态
 */
async function toggleAlwaysOnTop() {
  if (!isTauri.value) return;
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    isAlwaysOnTop.value = await invoke('toggle_always_on_top');
    emit('toggle');
  } catch (error) {
    console.error('切换窗口置顶失败:', error);
  }
}

/**
 * 关闭窗口
 */
async function closeWindow() {
  if (!isTauri.value) {
    // 在 Web 环境中，尝试关闭标签页
    window.close();
    return;
  }
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('close_window');
    emit('close');
  } catch (error) {
    console.error('关闭窗口失败:', error);
  }
}

/**
 * 最小化窗口
 */
async function minimizeWindow() {
  if (!isTauri.value) return;
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('minimize_window');
  } catch (error) {
    console.error('最小化窗口失败:', error);
  }
}

/**
 * 最大化/恢复窗口
 */
async function toggleMaximize() {
  if (!isTauri.value) return;
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('toggle_maximize');
  } catch (error) {
    console.error('最大化窗口失败:', error);
  }
}

/**
 * 恢复窗口状态（置顶右上角）
 */
async function restoreWindow() {
  if (!isTauri.value) return;
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // 获取屏幕尺寸
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    // 获取窗口尺寸
    const windowSize = await invoke('get_window_size');
    
    const padding = 16;
    const x = screenWidth - windowSize[0] - 4 - padding;
    const y = padding;
    
    await invoke('set_window_position', { x, y });
  } catch (error) {
    console.error('恢复窗口状态失败:', error);
  }
}

// 菜单项配置
const menuItems = ref([
  {
    label: '恢复窗口状态',
    icon: 'bi bi-bounding-box-circles',
    action: restoreWindow
  },
  {
    label: '最小化',
    icon: 'bi bi-dash-lg',
    action: minimizeWindow
  },
  {
    label: '关闭窗口',
    icon: 'bi bi-x-lg',
    action: closeWindow
  }
]);
</script>

<template>
  <div class="window-controls">
    <!-- 置顶按钮 -->
    <Tippy content="切换窗口置顶">
      <button 
        aria-label="切换窗口置顶" 
        @click="toggleAlwaysOnTop" 
        @keydown.enter="toggleAlwaysOnTop"
        @keydown.space="toggleAlwaysOnTop" 
        :class="{ active: isAlwaysOnTop }"
        :disabled="!isTauri"
      >
        <i :class="isAlwaysOnTop ? 'bi bi-pin-angle-fill' : 'bi bi-pin-angle'"></i>
      </button>
    </Tippy>
    
    <!-- 最小化按钮 -->
    <Tippy content="最小化">
      <button 
        aria-label="最小化" 
        @click="minimizeWindow" 
        @keydown.enter="minimizeWindow"
        @keydown.space="minimizeWindow"
        :disabled="!isTauri"
      >
        <i class="bi bi-dash-lg"></i>
      </button>
    </Tippy>
    
    <!-- 最大化按钮 -->
    <Tippy content="最大化/恢复">
      <button 
        aria-label="最大化/恢复" 
        @click="toggleMaximize" 
        @keydown.enter="toggleMaximize"
        @keydown.space="toggleMaximize"
        :disabled="!isTauri"
      >
        <i class="bi bi-fullscreen"></i>
      </button>
    </Tippy>
    
    <!-- 关闭按钮（仅在非置顶状态下显示） -->
    <Tippy v-if="!isAlwaysOnTop" content="关闭窗口">
      <button 
        aria-label="关闭窗口" 
        @click="closeWindow" 
        @keydown.enter="closeWindow"
        @keydown.space="closeWindow"
        class="close-btn"
      >
        <i class="bi bi-x-lg"></i>
      </button>
    </Tippy>

    <!-- 更多选项下拉菜单 -->
    <DropdownMenu :items="menuItems" position="bottom-right">
      <i class="bi bi-three-dots"></i>
    </DropdownMenu>
  </div>
</template>

<style scoped>
.window-controls {
  display: flex;
  gap: 8px;
  z-index: 999;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.window-controls button {
  padding: 4px 8px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  background-color: rgba(15, 15, 15, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: #333;
  font-size: 14px;
}

.window-controls button:hover {
  background-color: rgba(15, 15, 15, 0.08);
}

.window-controls button:active {
  transform: scale(0.95);
}

.window-controls button.active {
  background-color: #0078d7;
  color: #fff;
}

.window-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.window-controls button.close-btn:hover {
  background-color: #e81123;
  color: white;
}

/* 适配 BlurLyric 的深色主题 */
:global(.dark) .window-controls button,
:global([data-theme="dark"]) .window-controls button {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

:global(.dark) .window-controls button:hover,
:global([data-theme="dark"]) .window-controls button:hover {
  background-color: rgba(255, 255, 255, 0.15);
}
</style>
