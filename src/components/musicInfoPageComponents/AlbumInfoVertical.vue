<template>
  <div class="album-info-vertical">
    <div ref="coverImagePlaceHolder" class="coverImagePlaceHolder"></div>
    <div class="musicInfo">
      <div class="name">
        <textSpawn :text="track.name" />
      </div>
      <div class="artists">
        <span v-for="(value, index) in track.ar" :key="index">
          <textSpawn :text="value.name + ((index != track.ar.length - 1) ? '/' : '')" />
        </span>
        <span v-if="track.al.id != -2"> - </span>{{ track.al.name }}
      </div>
    </div>
    <ProgressBar
      variant="detail"
      :progress="progress"
      :currentTime="currentTimeRound"
      :duration="durationRound"
      @seekByProgress="$emit('seekByProgress', $event)"
    />
    <PlaybackControls
      variant="detail"
      :playing="playing"
      :playMode="playMode"
      @play="$emit('play')"
      @pause="$emit('pause')"
      @next="$emit('next')"
      @prev="$emit('prev')"
      @cyclePlayMode="$emit('cyclePlayMode')"
    />
    <div class="viewModeControls">
      <slot name="viewModeControls"></slot>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ProgressBar from './ProgressBar.vue'
import PlaybackControls from './PlaybackControls.vue'
import textSpawn from '../base/text-spawn.vue'

const props = defineProps({
  track: {
    type: Object,
    default: () => ({ id: -2, name: '', ar: [], al: { id: -2, name: '', picUrl: '' } })
  },
  progress: {
    type: Number,
    default: 0
  },
  currentTime: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  },
  currentTimeRound: {
    type: Number,
    default: 0
  },
  durationRound: {
    type: Number,
    default: 0
  },
  playing: {
    type: Boolean,
    default: false
  },
  playMode: {
    type: String,
    default: 'loopPlaylist'
  },
  maxColumnWidth: {
    type: String,
    default: 'min(50vh, 40vw)'
  }
})

defineEmits(['play', 'pause', 'next', 'prev', 'cyclePlayMode', 'seekByProgress'])

const coverImagePlaceHolder = ref(null)

defineExpose({ coverImagePlaceHolder })
</script>

<style scoped>
.album-info-vertical {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  box-sizing: border-box;
  padding-bottom: clamp(1.5em, 4vh, 2em);
  gap: clamp(0.8em, 2vh, 1.2em);
  width: v-bind(maxColumnWidth);
}

.coverImagePlaceHolder {
  background-position: center;
  background-size: cover;
  border-radius: 8px;
  overflow: hidden;
  image-rendering: auto;
  width: v-bind(maxColumnWidth);
  aspect-ratio: 1 / 1;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.coverImagePlaceHolder:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

.musicInfo {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}

.musicInfo > .name {
  font-weight: 900;
  color: #fffe;
  font-size: 1.25em;
  line-height: 1.3;
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.musicInfo > .artists {
  font-size: 0.875em;
  color: #fff9;
  line-height: 1.4;
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.viewModeControls {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 0.5em;
}

.viewModeControls > * {
  flex-shrink: 0;
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .album-info-vertical {
    gap: 1em;
    padding-bottom: 1.5em;
  }
  
  .musicInfo > .name {
    font-size: 1.125em;
  }
  
  .musicInfo > .artists {
    font-size: 0.8125em;
  }
}

@media screen and (max-width: 480px) {
  .album-info-vertical {
    gap: 0.8em;
    padding-bottom: 1.2em;
  }
  
  .coverImagePlaceHolder {
    border-radius: 6px;
  }
  
  .musicInfo > .name {
    font-size: 1em;
  }
  
  .musicInfo > .artists {
    font-size: 0.75em;
  }
}
</style>
