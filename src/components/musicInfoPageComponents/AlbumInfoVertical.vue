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
    <div class="musicDetailButton">
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
  justify-content: space-evenly;
  box-sizing: border-box;
  padding-bottom: 2.5em;
  gap: 1.4em;
  width: v-bind(maxColumnWidth);
}

.coverImagePlaceHolder {
  background-position: center;
  background-size: cover;
  border-radius: 1%;
  overflow: hidden;
  image-rendering: auto;
  width: v-bind(maxColumnWidth);
  aspect-ratio: 1 / 1;
  cursor: pointer;
  flex-shrink: 0;
}

.musicInfo {
  width: 100%;
}

.musicInfo > .name {
  font-weight: 900;
  color: #fffe;
  font-size: 1.3125em;
}

.musicInfo > .artists {
  font-size: 0.875em;
  color: #fff9;
}

.musicDetailButton {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: v-bind(maxColumnWidth);
}

.musicDetailButton > * {
  flex-shrink: 0;
  font-size: 1em;
}
</style>
