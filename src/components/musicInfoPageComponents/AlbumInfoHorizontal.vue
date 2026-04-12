<template>
  <div class="album-info-horizontal">
    <div ref="coverImagePlaceHolder" class="cover">
      <lazyLoadCoverImage :id="track.al.id" />
    </div>
    <div class="info">
      <div class="name">{{ track.name }}</div>
      <div class="meta">
        <span v-for="(value, index) in track.ar" :key="index">{{ value.name + (index != track.ar.length - 1 ? '/' : '') }}</span>
        <span v-if="track.al.id != -2"> - </span>{{ track.al.name }}
      </div>
    </div>
    <div class="detail" @click="$emit('detailClick')">
      <i class="bi bi-three-dots"></i>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import lazyLoadCoverImage from '../base/lazyLoadCoverImage.vue'

const props = defineProps({
  track: {
    type: Object,
    default: () => ({ id: -2, name: '', ar: [], al: { id: -2, name: '', picUrl: '' } })
  },
  coverSize: {
    type: Number,
    default: 48
  }
})

defineEmits(['detailClick'])

const coverImagePlaceHolder = ref(null)

defineExpose({ coverImagePlaceHolder })
</script>

<style scoped>
.album-info-horizontal {
  display: flex;
  align-items: center;
  height: 48px;
  gap: 12px;
  padding: 0 12px;
  background: transparent;
}

.cover {
  width: v-bind(coverSize + 'px');
  height: v-bind(coverSize + 'px');
  aspect-ratio: 1 / 1;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-weight: 900;
  font-size: 14px;
  color: #fffe;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 12px;
  color: #fff9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail {
  flex-shrink: 0;
  cursor: pointer;
  padding: 8px;
  color: #fff9;
  font-size: 16px;
}
</style>
