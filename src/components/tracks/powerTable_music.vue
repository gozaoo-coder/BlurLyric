<template>
  <div class="buttomTrack">
    <iconWithText @click="playAll" type="background">
      <template #svg>
        <i class="bi bi-play-fill"></i>
      </template>
      <template #text>播放全部</template>
    </iconWithText>
  </div>
  <br />

  <conditioner
    :condition="arraySortCondition"
    @conditionChange="handleConditionChange"
  />

  <div class="table-container">
    <!-- 表头 -->
    <div ref="tableHeaderRef" class="table-name">
      <div
        v-for="(item, index) in currentTable.cellName"
        :key="index"
        class="table-name-cell"
        :style="{
          ['flex' + (item.sizing ? '-' + item.sizing : '')]: item.sizingValue || 1,
          ...item.spacialStyle
        }"
      >
        {{ item.name }}
      </div>
    </div>

    <!-- 表格行 -->
    <contextMenu
      v-for="(line, line_index) in currentTable.cellArray"
      :key="line.id || line_index"
      :menuItems="getRowMenuItems(line, line_index)"
      @click="handleRowClick(line_index)"
    >
      <div v-if="shouldRenderRow(line_index)" class="table-row">
        <div
          v-for="(item, index) in currentTable.cellName"
          :key="index"
          :class="['table-cell', item.type]"
          :style="{
            ['flex' + (item.sizing ? '-' + item.sizing : '')]: item.sizingValue || 1,
            ...item.spacialStyle
          }"
        >
          <div class="relativeBox">
            <!-- 文本类型 -->
            <span v-if="item.type === 'content' || item.type === 'trackOrdinalNumber'">
              {{ item.path.call({ line, line_index, item, index }) }}
            </span>

            <!-- 图片类型 -->
            <lazy-load-cover-image-vue
              v-if="item.type === 'image' && shouldRenderImage(line_index)"
              :id="item.path.call({ line, line_index, item, index })"
              style="border-radius: 5%; left: 0; top: 0; height: 100%; width: 100%; position: absolute"
            />
          </div>
        </div>
      </div>
    </contextMenu>
  </div>
</template>

<style scoped>
.table-container {
  display: flex;
  width: 100%;
  border-collapse: collapse;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
}

.table-row {
  display: flex;
  height: 54px;
  padding: 4px;
  box-sizing: border-box;
  gap: 3px;
}

.table-name {
  background-color: #00000007;
  border-radius: 9px;
  display: flex;
  box-shadow: var(--Shadow-value-low);
  color: var(--fontColor-content-unimportant);
  height: 40px;
  gap: 3px;
  padding: 4px;
  box-sizing: border-box;
}

.table-name-cell {
  display: flex;
  align-items: center;
  padding: 4px;
}

.table-row:hover {
  background-color: #0001;
  border-radius: 9px;
  box-shadow: var(--Shadow-value-normal);
}

.table-cell {
  display: flex;
  padding: 4px;
  text-overflow: ellipsis;
  position: relative;
  align-items: center;
  white-space: nowrap;
}

.relativeBox {}

.table-cell.content {
  display: flex;
  padding: 4px;
  text-overflow: ellipsis;
  overflow: hidden;
  align-items: center;
  white-space: nowrap;
}
</style>

<script>
import { onMounted } from 'vue';
import contextMenu from '../base/contextMenu.vue';
import lazyLoadCoverImageVue from '../base/lazyLoadCoverImage.vue';
import conditioner from './conditioner.vue';
import { useMusicTable } from './composables/useMusicTable';

export default {
  name: 'PowerTableMusic',
  components: {
    contextMenu,
    lazyLoadCoverImageVue,
    conditioner
  },
  props: {
    tableData: {
      type: Object,
      default: () => ({})
    },
    noCover: {
      type: Boolean,
      default: false
    }
  },
  emits: [],
  setup(props) {
    const {
      currentTable,
      arraySortCondition,
      tableHeaderRef,
      visibleRange,
      updateHeaderInfo,
      shouldRenderRow,
      shouldRenderImage,
      handleRowClick,
      getRowMenuItems,
      handleConditionChange,
      playAll
    } = useMusicTable(props);

    onMounted(() => {
      updateHeaderInfo();
    });

    return {
      // 状态
      currentTable,
      arraySortCondition,
      tableHeaderRef,
      visibleRange,

      // 方法
      shouldRenderRow,
      shouldRenderImage,
      handleRowClick,
      getRowMenuItems,
      handleConditionChange,
      playAll
    };
  }
};
</script>
