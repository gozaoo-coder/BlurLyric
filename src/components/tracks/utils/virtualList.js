import { computed, ref } from 'vue';

/**
 * O(1) 级别虚拟列表组合式函数
 * @param {Object} options - 配置选项
 * @param {Ref<number>} options.scrollTop - 滚动位置
 * @param {Ref<number>} options.containerHeight - 容器高度
 * @param {number} options.itemHeight - 单项高度
 * @param {number} options.itemGap - 项间距
 * @param {number} options.bufferSize - 缓冲区大小（上下各多渲染的项数）
 * @param {Ref<number>} options.totalCount - 总数据量
 * @returns {Object} 虚拟列表相关计算属性
 */
export function useVirtualList(options) {
  const {
    scrollTop,
    containerHeight,
    itemHeight,
    itemGap = 0,
    bufferSize = 3,
    totalCount
  } = options;

  // 每项实际占用高度（包含间距）
  const actualItemHeight = computed(() => itemHeight + itemGap);

  // 可视区域内能显示的项数
  const visibleCount = computed(() => {
    return Math.ceil(containerHeight.value / actualItemHeight.value) + bufferSize * 2;
  });

  // 起始索引 - O(1) 计算
  const startIndex = computed(() => {
    const rawIndex = Math.floor(scrollTop.value / actualItemHeight.value);
    return Math.max(0, rawIndex - bufferSize);
  });

  // 结束索引 - O(1) 计算
  const endIndex = computed(() => {
    return Math.min(
      totalCount.value,
      startIndex.value + visibleCount.value
    );
  });

  // 可视范围 [start, end]
  const visibleRange = computed(() => [startIndex.value, endIndex.value]);

  // 总高度（用于撑开滚动容器）
  const totalHeight = computed(() => {
    return totalCount.value * actualItemHeight.value - itemGap;
  });

  // 偏移量（将可视项定位到正确位置）
  const offsetY = computed(() => {
    return startIndex.value * actualItemHeight.value;
  });

  // 判断某一项是否应该渲染
  const shouldRender = (index) => {
    return index >= startIndex.value && index < endIndex.value;
  };

  // 快速判断索引是否在可见范围附近（用于图片懒加载等）
  const isNearVisible = (index, extraBuffer = 2) => {
    return index >= startIndex.value - extraBuffer && 
           index < endIndex.value + extraBuffer;
  };

  return {
    startIndex,
    endIndex,
    visibleRange,
    visibleCount,
    totalHeight,
    offsetY,
    shouldRender,
    isNearVisible,
    actualItemHeight
  };
}

/**
 * 表格虚拟列表专用 hook
 * 针对 powerTable_music 的特殊优化
 */
export function useTableVirtualList(options) {
  const {
    scrollState,
    tableHeaderRef,
    itemHeight = 54,
    itemGap = 4,
    bufferSize = 2,
    totalCount
  } = options;

  const scrollTop = computed(() => scrollState.value?.scrollTop || 0);
  const containerHeight = computed(() => window.innerHeight);

  // 表头高度缓存
  const headerHeight = ref(40);
  const headerOffsetTop = ref(0);

  // 更新表头信息（在 mounted 时调用一次）
  const updateHeaderInfo = () => {
    if (tableHeaderRef.value) {
      headerHeight.value = tableHeaderRef.value.offsetHeight;
      headerOffsetTop.value = tableHeaderRef.value.offsetTop;
    }
  };

  // 第一个可见项的索引（考虑表头偏移）
  const startIndex = computed(() => {
    const effectiveScrollTop = scrollTop.value - headerOffsetTop.value - headerHeight.value;
    const rawIndex = Math.floor(effectiveScrollTop / (itemHeight + itemGap));
    return Math.max(0, rawIndex - bufferSize);
  });

  // 结束索引
  const endIndex = computed(() => {
    const visibleCount = Math.ceil(containerHeight.value / (itemHeight + itemGap));
    return Math.min(totalCount.value, startIndex.value + visibleCount + bufferSize * 2);
  });

  // 可见范围
  const visibleRange = computed(() => [startIndex.value, endIndex.value]);

  // 判断是否应该渲染某一行
  const shouldRenderRow = (index) => {
    return index <= endIndex.value;
  };

  // 判断是否应该渲染图片（更严格的条件）
  const shouldRenderImage = (index) => {
    return index >= startIndex.value && index <= endIndex.value;
  };

  return {
    startIndex,
    endIndex,
    visibleRange,
    updateHeaderInfo,
    shouldRenderRow,
    shouldRenderImage,
    headerHeight,
    headerOffsetTop
  };
}
