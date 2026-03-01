import { ref, computed, watch, inject } from 'vue';
import baseMethods from '../../../js/baseMethods';
import { useTableVirtualList } from '../utils/virtualList';
import { createMusicTableMenuItems, tableColumnConfig, sortConditions } from '../config/menuConfig';

/**
 * 音乐表格组合式函数
 * @param {Object} options - 配置选项
 * @returns {Object} 表格相关的状态和方法
 */
export function useMusicTable(props, emit) {
  // 注入依赖
  const scrollState = inject('scrollState');
  const pushMusic = inject('pushMusic');
  const coverMusicTrack = inject('coverMusicTrack');
  const nextMusic = inject('nextMusic');
  const musicTrack = inject('musicTrack');
  const regMessage = inject('regMessage');

  // DOM 引用
  const tableHeaderRef = ref(null);

  // 表格数据状态
  const currentTable = ref({
    cellName: [...tableColumnConfig],
    cellArray: []
  });

  // 当前排序条件
  const currentSortKey = ref('default');
  const arraySortCondition = computed(() => sortConditions[currentSortKey.value] || sortConditions.default);

  // 双击检测状态
  const lastClick = ref([
    { index: 0, timeStamp: Date.now() },
    { index: 0, timeStamp: Date.now() }
  ]);

  // 使用虚拟列表优化
  const totalCount = computed(() => currentTable.value.cellArray?.length || 0);
  
  const {
    startIndex,
    endIndex,
    visibleRange,
    updateHeaderInfo,
    shouldRenderRow,
    shouldRenderImage
  } = useTableVirtualList({
    scrollState,
    tableHeaderRef,
    itemHeight: 54,
    itemGap: 4,
    bufferSize: 2,
    totalCount
  });

  // 设置排序条件
  const setSortCondition = (sortKey) => {
    if (!sortConditions[sortKey]) return;
    currentSortKey.value = sortKey;
    
    // 应用排序
    if (currentTable.value.cellArray?.length > 0) {
      currentTable.value.cellArray = baseMethods.filterAndSort(
        currentTable.value.cellArray,
        sortConditions[sortKey]
      );
    }
    
    regMessage?.({
      type: 'Message',
      content: `已按${getSortName(sortKey)}排序`
    });
  };

  // 获取排序名称
  const getSortName = (key) => {
    const names = {
      default: '默认',
      trackNumber: '曲目编号',
      name: '歌名',
      artist: '歌手',
      album: '专辑',
      duration: '时长'
    };
    return names[key] || key;
  };

  // 处理条件变化（来自 conditioner 组件）
  const handleConditionChange = (newCondition) => {
    if (newCondition && props.tableData?.cellArray) {
      currentTable.value.cellArray = baseMethods.filterAndSort(
        props.tableData.cellArray,
        newCondition
      );
    }
  };

  // 处理双击/三连击
  const handleRowClick = (line_index) => {
    const newTimestamp = Date.now();
    const cellArray = currentTable.value.cellArray;
    
    // 检测双击
    if (lastClick.value[0].index === line_index && 
        newTimestamp - lastClick.value[0].timeStamp < 300) {
      
      let hasBeenActived = false;

      // 检测三连击 - 覆盖播放列表
      if (
        (2 * newTimestamp - lastClick.value[0].timeStamp - lastClick.value[1].timeStamp < 600) &&
        lastClick.value[0].index === line_index &&
        lastClick.value[1].index === line_index
      ) {
        coverMusicTrack(cellArray, line_index);
        hasBeenActived = true;
      }

      // 处理双击逻辑
      if (!hasBeenActived) {
        const currentMusicArray = musicTrack?.value;
        const isSameArray = Object.is(currentMusicArray, cellArray);
        
        if (isSameArray) {
          // 当前歌单就是播放歌单，切到当前 index
          nextMusic(line_index);
        } else {
          // 将选中曲目插入播放列表
          pushMusic(cellArray[line_index]);
        }
      }
    }

    // 更新点击历史
    lastClick.value[1] = { ...lastClick.value[0] };
    lastClick.value[0] = { index: line_index, timeStamp: newTimestamp };
  };

  // 获取行的菜单配置
  const getRowMenuItems = (line, line_index) => {
    return createMusicTableMenuItems({
      line,
      line_index,
      currentTable,
      pushMusic,
      coverMusicTrack,
      nextMusic,
      musicTrack,
      setSortCondition,
      regMessage
    });
  };

  // 播放全部
  const playAll = () => {
    if (currentTable.value.cellArray?.length > 0) {
      coverMusicTrack(currentTable.value.cellArray, 0);
    }
  };

  // 监听 tableData 变化
  watch(
    () => props.tableData,
    (newValue) => {
      if (!newValue) return;
      
      if (newValue.cellName !== undefined) {
        // 完整替换
        currentTable.value = {
          cellName: [...(newValue.cellName || tableColumnConfig)],
          cellArray: baseMethods.filterAndSort(
            newValue.cellArray || [],
            arraySortCondition.value
          )
        };
      } else if (newValue.cellArray !== undefined) {
        // 只更新数据
        currentTable.value.cellArray = baseMethods.filterAndSort(
          newValue.cellArray,
          arraySortCondition.value
        );
      }
      
      // 处理无封面模式
      if (props.noCover && currentTable.value.cellName.length > 1) {
        const imageIndex = currentTable.value.cellName.findIndex(col => col.type === 'image');
        if (imageIndex > -1) {
          currentTable.value.cellName.splice(imageIndex, 1);
        }
      }
    },
    { deep: true, immediate: true }
  );

  // 监听排序条件变化
  watch(
    arraySortCondition,
    (newCondition) => {
      if (currentTable.value.cellArray?.length > 0) {
        currentTable.value.cellArray = baseMethods.filterAndSort(
          currentTable.value.cellArray,
          newCondition
        );
      }
    },
    { deep: true }
  );

  return {
    // 状态
    currentTable,
    arraySortCondition,
    tableHeaderRef,
    visibleRange,
    startIndex,
    endIndex,
    
    // 方法
    updateHeaderInfo,
    shouldRenderRow,
    shouldRenderImage,
    handleRowClick,
    getRowMenuItems,
    handleConditionChange,
    setSortCondition,
    playAll,
    
    // 工具
    baseMethods
  };
}
