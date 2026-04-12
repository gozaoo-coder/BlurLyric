<template>
  <div class="adaptive-layout-root">
    <!-- ===== Desktop Layouts ===== -->
    <div
      v-if="deviceType === 'desktop'"
      :class="['adaptive-layout', 'layout-desktop', desktopModeClass]"
    >
      <!-- Desktop - albumOnly -->
      <template v-if="displayMode === 'albumOnly'">
        <div class="album-info-vertical-wrapper">
          <AlbumInfoVertical
            ref="albumInfoVerticalRef"
            :track="track"
            :progress="progress"
            :currentTime="currentTime"
            :duration="duration"
            :currentTimeRound="currentTimeRound"
            :durationRound="durationRound"
            :playing="playing"
            :playMode="playMode"
            :maxColumnWidth="maxColumnWidth"
            :active-mode="displayMode"
            :device-type="deviceType"
            @play="$emit('play')"
            @pause="$emit('pause')"
            @next="$emit('next')"
            @prev="$emit('prev')"
            @cyclePlayMode="$emit('cyclePlayMode')"
            @seekByProgress="$emit('seekByProgress', $event)"
            @mode-change="handleModeChange"
          />
        </div>
      </template>

      <!-- Desktop - lyricOnly -->
      <template v-else-if="displayMode === 'lyricOnly'">
        <AlbumInfoHorizontal
          :track="track"
          @detailClick="$emit('detailClick')"
        />
        <LyricPlaceholder class="flex-grow" />
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
        <ViewModeControlBar
          :activeMode="displayMode"
          :deviceType="deviceType"
          @modeChange="handleModeChange"
        />
      </template>

      <!-- Desktop - albumAndLyric / albumAndMusicList (dual-column) -->
      <template v-else>
        <div class="left-column">
          <AlbumInfoVertical
            ref="albumInfoVerticalRef"
            :track="track"
            :progress="progress"
            :currentTime="currentTime"
            :duration="duration"
            :currentTimeRound="currentTimeRound"
            :durationRound="durationRound"
            :playing="playing"
            :playMode="playMode"
            :maxColumnWidth="maxColumnWidth"
            :active-mode="displayMode"
            :device-type="deviceType"
            @play="$emit('play')"
            @pause="$emit('pause')"
            @next="$emit('next')"
            @prev="$emit('prev')"
            @cyclePlayMode="$emit('cyclePlayMode')"
            @seekByProgress="$emit('seekByProgress', $event)"
            @mode-change="handleModeChange"
          />
        </div>
        <div class="right-column">
          <LyricPlaceholder v-if="displayMode === 'albumAndLyric'" />
          <MusicListPanel
            v-if="displayMode === 'albumAndMusicList'"
            :tracks="tracks"
            :currentIndex="currentIndex"
            @switchTrack="$emit('switchTrack', $event)"
          />
        </div>
      </template>
    </div>

    <!-- ===== Mobile Layouts ===== -->
    <div
      v-else-if="deviceType === 'mobile'"
      :class="['adaptive-layout', 'layout-mobile', mobileModeClass]"
    >
      <!-- Mobile - albumOnly (also fallback for non-lyricOnly modes) -->
      <template v-if="displayMode !== 'lyricOnly'">
        <div class="album-info-vertical-wrapper">
          <AlbumInfoVertical
            ref="albumInfoVerticalRef"
            :track="track"
            :progress="progress"
            :currentTime="currentTime"
            :duration="duration"
            :currentTimeRound="currentTimeRound"
            :durationRound="durationRound"
            :playing="playing"
            :playMode="playMode"
            :maxColumnWidth="maxColumnWidth"
            :active-mode="displayMode"
            :device-type="deviceType"
            @play="$emit('play')"
            @pause="$emit('pause')"
            @next="$emit('next')"
            @prev="$emit('prev')"
            @cyclePlayMode="$emit('cyclePlayMode')"
            @seekByProgress="$emit('seekByProgress', $event)"
            @mode-change="handleModeChange"
          />
        </div>
      </template>

      <!-- Mobile - lyricOnly -->
      <template v-else>
        <DraggableAlbumInfo
          :track="track"
          :active="true"
          @swipeDown="$emit('swipeDown')"
          @detailClick="$emit('detailClick')"
        />
        <LyricPlaceholder class="mobile-lyric" />
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
        <ViewModeControlBar
          :activeMode="displayMode"
          :deviceType="deviceType"
          class="mobile-control-bar"
          @modeChange="handleModeChange"
        />
      </template>
    </div>

    <!-- Mobile music list drawer overlay -->
    <MusicListDrawer
      v-if="deviceType === 'mobile'"
      :visible="musicListDrawerVisible"
      :tracks="tracks"
      :currentIndex="currentIndex"
      @close="handleDrawerClose"
      @switchTrack="$emit('switchTrack', $event)"
    />

    <!-- ===== Square Layout ===== -->
    <div v-else-if="deviceType === 'square'" class="adaptive-layout layout-square">
      <AlbumInfoHorizontal
        :track="track"
        @detailClick="$emit('detailClick')"
      />
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
    </div>

    <!-- ===== Strip Layout ===== -->
    <div v-else-if="deviceType === 'strip'" class="adaptive-layout layout-strip">
      <AlbumInfoHorizontal
        :track="track"
        @detailClick="$emit('detailClick')"
      />
    </div>

    <!-- ===== Unsupported Layout ===== -->
    <div v-else class="adaptive-layout layout-unsupported">
      <div class="unsupported-message">该布局未适应</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AlbumInfoVertical from './AlbumInfoVertical.vue'
import AlbumInfoHorizontal from './AlbumInfoHorizontal.vue'
import ProgressBar from './ProgressBar.vue'
import PlaybackControls from './PlaybackControls.vue'
import ViewModeControlBar from './ViewModeControlBar.vue'
import LyricPlaceholder from './LyricPlaceholder.vue'
import MusicListPanel from './MusicListPanel.vue'
import MusicListDrawer from './MusicListDrawer.vue'
import DraggableAlbumInfo from './DraggableAlbumInfo.vue'

const props = defineProps({
  deviceType: {
    type: String,
    required: true,
    validator: (value) => ['desktop', 'mobile', 'square', 'strip', 'unsupported'].includes(value)
  },
  displayMode: {
    type: String,
    required: true,
    validator: (value) => ['albumOnly', 'lyricOnly', 'albumAndLyric', 'albumAndMusicList'].includes(value)
  },
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
  tracks: {
    type: Array,
    default: () => []
  },
  currentIndex: {
    type: Number,
    default: 0
  },
  maxColumnWidth: {
    type: String,
    default: 'min(50vh, 40vw)'
  },
  musicInfoPagePosition: {
    type: String,
    default: 'bottom',
    validator: (value) => ['top', 'bottom', 'toTop', 'toBottom'].includes(value)
  }
})

const emit = defineEmits([
  'play',
  'pause',
  'next',
  'prev',
  'cyclePlayMode',
  'seekByProgress',
  'modeChange',
  'switchTrack',
  'swipeDown',
  'detailClick'
])

const musicListDrawerVisible = ref(false)

const albumInfoVerticalRef = ref(null)

const coverImagePlaceHolder = computed(() => {
  return albumInfoVerticalRef.value?.coverImagePlaceHolder
})

const desktopModeClass = computed(() => {
  if (props.displayMode === 'albumOnly') return 'layout-album-only'
  if (props.displayMode === 'lyricOnly') return 'layout-lyric-only'
  return 'layout-dual-column'
})

const mobileModeClass = computed(() => {
  if (props.displayMode === 'lyricOnly') return 'layout-lyric-only'
  return 'layout-album-only'
})

const handleModeChange = (newMode) => {
  if (props.deviceType === 'mobile' && newMode === 'musicList') {
    musicListDrawerVisible.value = true
  } else {
    emit('modeChange', newMode)
  }
}

const handleDrawerClose = () => {
  musicListDrawerVisible.value = false
}

defineExpose({ coverImagePlaceHolder })
</script>

<style scoped>
.adaptive-layout-root {
  width: 100%;
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  height: 100%;
}

.adaptive-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* ===== Padding System ===== */
.layout-desktop {
  --pad-x: clamp(16px, 3vw, 48px);
  --pad-y: clamp(12px, 2vh, 32px);
  --gap: clamp(8px, 1.5vh, 20px);
}

.layout-mobile {
  --pad-x: clamp(12px, 4vw, 28px);
  --pad-y: clamp(8px, 1.5vh, 20px);
  --gap: clamp(6px, 1vh, 14px);
}

.layout-square {
  --pad-x: clamp(10px, 3vw, 24px);
  --pad-y: clamp(8px, 2vh, 20px);
  --gap: clamp(6px, 1vh, 12px);
}

.layout-strip {
  --pad-x: clamp(8px, 2vw, 20px);
  --pad-y: 0px;
  --gap: 0px;
}

/* ===== Desktop - albumOnly ===== */
.layout-desktop.layout-album-only {
  align-items: center;
  justify-content: center;
  padding: var(--pad-y) var(--pad-x);
}

.layout-desktop.layout-album-only .album-info-vertical-wrapper {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  min-height: 0;
}

/* ===== Desktop - lyricOnly ===== */
.layout-desktop.layout-lyric-only {
  padding: var(--pad-y) var(--pad-x);
  gap: var(--gap);
}

.layout-desktop.layout-lyric-only .flex-grow {
  flex: 1;
  min-height: 0;
}

/* ===== Desktop - dual-column (albumAndLyric / albumAndMusicList) ===== */
.layout-dual-column {
  display: grid;
  grid-template-columns: var(--maxColumnWidth) 1fr;
  grid-template-rows: 1fr auto;
  gap: var(--gap);
  padding: var(--pad-y) var(--pad-x);
}

.layout-dual-column .left-column {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  justify-content: center;
}

.layout-dual-column .right-column {
  grid-column: 2;
  grid-row: 1 / 3;
  overflow: hidden;
  min-height: 0;
}

.layout-dual-column .ViewModeControlBar-wrapper {
  grid-column: 1;
  grid-row: 2;
}

/* ===== Mobile - albumOnly ===== */
.layout-mobile.layout-album-only {
  align-items: center;
  justify-content: center;
  padding: var(--pad-y) var(--pad-x);
}

.layout-mobile.layout-album-only .album-info-vertical-wrapper {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  min-height: 0;
}

/* ===== Mobile - lyricOnly ===== */
.layout-mobile.layout-lyric-only {
  gap: var(--gap);
  padding: var(--pad-y) var(--pad-x);
}

.mobile-lyric {
  flex: 1;
  min-height: 0;
}

.mobile-control-bar {
  background: rgba(0, 0, 0, 0.0625);
  backdrop-filter: blur(30px);
  padding: 8px 0;
  flex-shrink: 0;
}

/* ===== Square Layout ===== */
.layout-square {
  align-items: center;
  justify-content: center;
  gap: var(--gap);
  padding: var(--pad-y) var(--pad-x);
}

/* ===== Strip Layout ===== */
.layout-strip {
  align-items: center;
  padding: var(--pad-y) var(--pad-x);
}

/* ===== Unsupported Layout ===== */
.layout-unsupported {
  align-items: center;
  justify-content: center;
}

.unsupported-message {
  color: #fff8;
  font-size: 14px;
}
</style>
