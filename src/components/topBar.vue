<script>
import WindowControls from './WindowControls.vue';

export default {
  components: {
    WindowControls
  },
  data() {
    return {}
  },
  props: {
    titleOffsetTop: Number
  },
  inject: ['leftBarState'],
}
</script>

<template>
  <div :class="['topbar', leftBarState]">
    <!-- 左侧：返回按钮 -->
    <iconToClick @click="this.$router.go(-1)">
      <i class="bi bi-chevron-left"></i>
    </iconToClick>
    
    <!-- 中间：拖拽区域和标题 -->
    <div data-tauri-drag-region class="drag">
      <div class="blur"></div>
      <div data-tauri-drag-region class="title">
        <slot name="title" />
        <slot name="appname" />
      </div>
    </div>
    
    <!-- 右侧：窗口控制按钮 -->
    <div class="window-controls-wrapper">
      <WindowControls />
    </div>
  </div>
</template>

<style scoped>
.topbar {
  height: 34px;
  display: flex;
  gap: 7px;
  width: 100%;
  margin: -8px 0 0 -8px;
  z-index: 10;
  padding: 7px;
  position: relative;
  user-select: none;
}

.drag {
  -webkit-app-drag: drag;
  app-region: drag;
  display: block;
  height: calc(100% + 16px);
  flex: 1;
  display: flex;
}

.title {
  font-size: 32px;
  font-weight: 900;
  color: #222;
  padding-left: 16px;
  transition: 0.25s cubic-bezier(.5, .3, .2, 1);
  width: 100%;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.blur {
  position: absolute;
  height: 75px;
  width: 100%;
  left: 52px;
  background-color: #fff8;
  backdrop-filter: blur(12px);
  transition: 0.25s cubic-bezier(.5, .3, .2, 1);
  z-index: -1;
  margin-top: -7px;
  mask-image: linear-gradient(180deg, #000f 0%, #000f 76%, transparent 100%);
}

.wide .blur {
  left: 200px;
}

.wide .title {
  padding-left: 164px;
}

.window-controls-wrapper {
  display: flex;
  align-items: center;
  margin-right: 8px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
</style>
