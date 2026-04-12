<template>
  <div class="view-mode-control-bar">
    <suspendingBox :theme="'light'" :direction="'top'" :hoverOnly="true">
      <template #placeholder>
        <button_block :actived="isMusicListActive" @click="handleMusicListClick" class="control-button">
          <i class="bi bi-music-note-list"></i>
        </button_block>
      </template>
      <template #suspendContent>
        <div>展示音乐列表</div>
      </template>
    </suspendingBox>
    <suspendingBox :theme="'light'" :direction="'top'" :hoverOnly="true">
      <template #placeholder>
        <button_block :actived="isAlbumActive" @click="handleAlbumClick" class="control-button">
          <i class="bi bi-vinyl"></i>
        </button_block>
      </template>
      <template #suspendContent>
        <div>仅显示专辑信息</div>
      </template>
    </suspendingBox>
    <suspendingBox :theme="'light'" :direction="'top'" :hoverOnly="true">
      <template #placeholder>
        <button_block :actived="isLyricActive" @click="handleLyricClick" class="control-button">
          <i class="bi bi-text-left"></i>
        </button_block>
      </template>
      <template #suspendContent>
        <div>展示歌词</div>
      </template>
    </suspendingBox>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import button_block from './button_block.vue';
import suspendingBox from '../base/suspendingBox.vue';

const MODES = {
  ALBUM_ONLY: 'albumOnly',
  LYRIC_ONLY: 'lyricOnly',
  ALBUM_AND_LYRIC: 'albumAndLyric',
  ALBUM_AND_MUSIC_LIST: 'albumAndMusicList'
};

const props = defineProps({
  activeMode: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['modeChange']);

const isMobile = computed(() => props.deviceType === 'mobile');

const isAlbumActive = computed(() => {
  if (isMobile.value) {
    return props.activeMode === MODES.ALBUM_ONLY;
  }
  return [MODES.ALBUM_ONLY, MODES.ALBUM_AND_LYRIC, MODES.ALBUM_AND_MUSIC_LIST].includes(props.activeMode);
});

const isMusicListActive = computed(() => {
  if (isMobile.value) {
    return false;
  }
  return props.activeMode === MODES.ALBUM_AND_MUSIC_LIST;
});

const isLyricActive = computed(() => {
  if (isMobile.value) {
    return props.activeMode === MODES.LYRIC_ONLY;
  }
  return props.activeMode === MODES.ALBUM_AND_LYRIC;
});

function handleMusicListClick() {
  if (isMobile.value) {
    emit('modeChange', 'musicList');
    return;
  }

  const modeTransitions = {
    [MODES.ALBUM_ONLY]: MODES.ALBUM_AND_MUSIC_LIST,
    [MODES.ALBUM_AND_MUSIC_LIST]: MODES.ALBUM_ONLY,
    [MODES.ALBUM_AND_LYRIC]: MODES.ALBUM_AND_MUSIC_LIST,
    [MODES.LYRIC_ONLY]: MODES.ALBUM_AND_MUSIC_LIST
  };

  const nextMode = modeTransitions[props.activeMode];
  if (nextMode) {
    emit('modeChange', nextMode);
  }
}

function handleAlbumClick() {
  if (isMobile.value) {
    emit('modeChange', MODES.ALBUM_ONLY);
    return;
  }

  if (props.activeMode !== MODES.ALBUM_ONLY) {
    emit('modeChange', MODES.ALBUM_ONLY);
  }
}

function handleLyricClick() {
  if (isMobile.value) {
    emit('modeChange', MODES.LYRIC_ONLY);
    return;
  }

  const modeTransitions = {
    [MODES.ALBUM_ONLY]: MODES.ALBUM_AND_LYRIC,
    [MODES.ALBUM_AND_LYRIC]: MODES.ALBUM_ONLY,
    [MODES.ALBUM_AND_MUSIC_LIST]: MODES.ALBUM_AND_LYRIC,
    [MODES.LYRIC_ONLY]: MODES.ALBUM_AND_LYRIC
  };

  const nextMode = modeTransitions[props.activeMode];
  if (nextMode) {
    emit('modeChange', nextMode);
  }
}
</script>

<style scoped>
.view-mode-control-bar {
  display: flex;
  gap: clamp(0.5em, 1.5vw, 0.75em);
  align-items: center;
  padding: clamp(0.375em, 1vw, 0.5em);
  border-radius: 0.625em;
  background-color: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  box-shadow: var(--Shadow-value-low);
  transition: all 0.3s ease;
}

.view-mode-control-bar:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.control-button {
  font-size: 1.1em;
  transition: all 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .view-mode-control-bar {
    gap: 0.5em;
    padding: 0.375em;
  }
  
  .control-button {
    font-size: 1em;
  }
}

/* 移动设备特定样式 */
:deep(.mobile-control-bar) {
  justify-content: center;
  margin: 0.5em 0;
  width: 100%;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}
</style>
