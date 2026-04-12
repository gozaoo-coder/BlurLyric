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
  padding: 8px 12px;
  background: transparent;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.album-info-horizontal:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.cover {
  width: v-bind(coverSize + 'px');
  height: v-bind(coverSize + 'px');
  aspect-ratio: 1 / 1;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: var(--Shadow-value-low, 0px 0px 0.3125em #0002);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.cover:hover {
  transform: scale(1.02);
  box-shadow: var(--Shadow-value-offsetY-low, 0px 0.125em 0.4375em #0002);
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-weight: 900;
  font-size: 14px;
  color: #fffe;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.meta {
  font-size: 12px;
  color: #fff9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.detail {
  flex-shrink: 0;
  cursor: pointer;
  padding: 8px;
  color: #fff9;
  font-size: 16px;
  border-radius: 50%;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.detail:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.detail:active {
  transform: scale(0.95);
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .album-info-horizontal {
    gap: 10px;
    padding: 6px 10px;
  }
  
  .info {
    gap: 3px;
  }
  
  .name {
    font-size: 13px;
  }
  
  .meta {
    font-size: 11px;
  }
  
  .detail {
    padding: 6px;
    font-size: 14px;
  }
}

@media screen and (max-width: 480px) {
  .album-info-horizontal {
    gap: 8px;
    padding: 4px 8px;
  }
  
  .name {
    font-size: 12px;
  }
  
  .meta {
    font-size: 10px;
  }
  
  .detail {
    padding: 5px;
    font-size: 13px;
  }
}
</style>
