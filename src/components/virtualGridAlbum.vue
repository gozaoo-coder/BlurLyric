<template>
  <div ref="containerRef" class="virtual-grid-container">
    <div 
      class="virtual-grid-content" 
      :style="{ height: `${totalHeight}px` }"
    >
      <div
        v-for="item in visibleItemsComputed"
        :key="item.index"
        class="virtual-grid-item"
        :style="getItemStyle(item.index)"
      >
        <slot 
          name="item" 
          :item="items[item.index]" 
          :index="item.index"
          :isVisible="true"
        ></slot>
      </div>
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
  setup(props) {
    const containerRef = ref(null);
    const containerWidth = ref(800);
    const scrollState = inject('scrollState');

    const totalCount = computed(() => props.items.length);

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
    } = useGridVirtualList({
      scrollState,
      containerWidth,
      itemHeight: props.itemHeight,
      gapX: props.gapX,
      gapY: props.gapY,
      bufferRows: props.bufferRows,
      totalCount,
      minColumnWidth: props.minColumnWidth
    });

    const visibleItemsComputed = computed(() => {
      const result = [];
      const start = startIndex.value;
      const end = endIndex.value;
      const cols = columnCount.value;
      
      for (let i = start; i < end; i++) {
        result.push({
          index: i,
          row: Math.floor(i / cols),
          col: i % cols
        });
      }
      return result;
    });

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

    return {
      containerRef,
      columnCount,
      visibleItemsComputed,
      totalHeight,
      getItemStyle,
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
