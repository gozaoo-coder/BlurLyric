<template>
  <div class="musicDetailButton">
    <suspendingBox :theme="'light'" :direction="'top'" :hoverOnly="true">
      <template #placeholder>
        <button_block :actived="isMusicListActive" @click="handleMusicListClick">
          <i class="bi bi-music-note-list"></i>
        </button_block>
      </template>
      <template #suspendContent>
        <div>展示音乐列表</div>
      </template>
    </suspendingBox>
    <suspendingBox :theme="'light'" :direction="'top'" :hoverOnly="true">
      <template #placeholder>
        <button_block :actived="isAlbumActive" @click="handleAlbumClick">
          <i class="bi bi-vinyl"></i>
        </button_block>
      </template>
      <template #suspendContent>
        <div>仅显示专辑信息</div>
      </template>
    </suspendingBox>
    <suspendingBox :theme="'light'" :direction="'top'" :hoverOnly="true">
      <template #placeholder>
        <button_block :actived="isLyricActive" @click="handleLyricClick">
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
.musicDetailButton {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.musicDetailButton > * {
  flex-shrink: 0;
  font-size: 1em;
}
</style>
