<template>
  <div ref="containerRef" class="virtual-grid-container">
    <div 
      class="virtual-grid-content" 
      :style="{ height: `${totalHeight}px` }"
    >
      <template v-for="(item, idx) in items" :key="idx">
        <div
          v-if="shouldRender(idx)"
          class="virtual-grid-item"
          :style="getItemStyle(idx)"
        >
          <slot 
            name="item" 
            :item="item" 
            :index="idx"
            :isVisible="true"
          ></slot>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';
import { useGridVirtualList } from './tracks/utils/virtualList';

export default {
  name: 'VirtualGridAlbum',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    itemHeight: {
      type: Number,
      default: 180
    },
    minColumnWidth: {
      type: Number,
      default: 130
    },
    gapX: {
      type: Number,
      default: 48
    },
    gapY: {
      type: Number,
      default: 36
    },
    bufferRows: {
      type: Number,
      default: 2
    }
  },
  inject: ['scrollState'],
  emits: ['scrollChange'],
  setup(props, { emit }) {
    const containerRef = ref(null);
    const containerWidth = ref(800);
    const scrollState = inject('scrollState');

    const totalCount = computed(() => props.items.length);

    const virtualListOptions = useGridVirtualList({
      scrollState,
      containerWidth,
      itemHeight: props.itemHeight,
      gapX: props.gapX,
      gapY: props.gapY,
      bufferRows: props.bufferRows,
      totalCount,
      minColumnWidth: props.minColumnWidth
    });

    const {
      columnCount,
      actualItemWidth,
      rowHeight,
      totalRows,
      startRow,
      endRow,
      startIndex,
      endIndex,
      visibleItems,
      totalHeight,
      offsetY,
      shouldRender,
      getItemStyle
    } = virtualListOptions;

    const updateContainerWidth = () => {
      if (containerRef.value && containerRef.value.offsetWidth > 0) {
        containerWidth.value = containerRef.value.offsetWidth;
      }
    };

    onMounted(() => {
      requestAnimationFrame(() => {
        updateContainerWidth();
      });
      window.addEventListener('resize', updateContainerWidth);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', updateContainerWidth);
    });

    watch(() => props.items, () => {
      requestAnimationFrame(updateContainerWidth);
    }, { immediate: true });

    watch(scrollState, (newVal) => {
      emit('scrollChange', newVal);
    }, { deep: true });

    return {
      containerRef,
      containerWidth,
      columnCount,
      visibleItems,
      totalHeight,
      getItemStyle,
      shouldRender,
      startIndex,
      endIndex
    };
  }
};
</script>

<style scoped>
.virtual-grid-container {
  width: 100%;
  position: relative;
}

.virtual-grid-content {
  width: 100%;
  position: relative;
}

.virtual-grid-item {
  position: absolute;
}
</style>
