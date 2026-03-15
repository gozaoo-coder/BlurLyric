<template>
  <bodytitle :text="'搜索'" />

  <div class="search-container">
    <!-- 搜索输入框 -->
    <div class="search-input-wrapper">
      <i class="bi bi-search search-icon"></i>
      <input
        v-model="inputKeyword"
        type="text"
        class="search-input"
        placeholder="搜索歌曲、艺术家、专辑..."
        @keyup.enter="handleSearch"
        @input="handleInput"
      />
      <button
        v-if="inputKeyword"
        class="clear-btn"
        @click="clearSearch"
      >
        <i class="bi bi-x-circle"></i>
      </button>
    </div>

    <!-- 搜索历史 -->
    <div v-if="searchHistory.length > 0 && !searchKeyword" class="search-history">
      <div class="history-header">
        <span class="history-title">搜索历史</span>
        <button class="clear-history-btn" @click="clearHistory">
          <i class="bi bi-trash"></i>
          清空
        </button>
      </div>
      <div class="history-tags">
        <span
          v-for="item in searchHistory"
          :key="item"
          class="history-tag"
          @click="searchFromHistory(item)"
        >
          {{ item }}
          <i class="bi bi-x" @click.stop="removeFromHistory(item)"></i>
        </span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isSearching" class="search-loading">
      <i class="bi bi-arrow-repeat spinning"></i>
      <span>搜索中...</span>
    </div>

    <!-- 搜索结果 - 复用 powerTable_music 组件 -->
    <div v-if="hasResults" class="search-results">
      <div class="results-header">
        <span class="results-count">找到 {{ searchResults.length }} 首歌曲</span>
      </div>
      <powerTableMusic :tableData="tableData" />
    </div>

    <!-- 空状态 -->
    <div v-if="showEmpty" class="search-empty">
      <i class="bi bi-inbox"></i>
      <span>未找到与 "{{ searchKeyword }}" 相关的歌曲</span>
    </div>

    <!-- 错误状态 -->
    <div v-if="searchError" class="search-error">
      <i class="bi bi-exclamation-triangle"></i>
      <span>{{ searchError }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import bodytitle from '../../components/base/bodytitle.vue';
import powerTableMusic from '../../components/tracks/powerTable_music.vue';
import { useSearch } from '../../js/search/index.js';

// 使用搜索模块
const {
  searchKeyword,
  isSearching,
  searchResults,
  searchHistory,
  searchError,
  tableData,
  hasResults,
  showEmpty,
  performSearch,
  debouncedSearch,
  clearResults,
  loadSearchHistory,
  clearHistory,
  removeFromHistory
} = useSearch();

// 本地输入状态
const inputKeyword = ref('');

// 处理搜索输入
const handleInput = () => {
  // 可以在这里实现实时搜索
  // debouncedSearch(inputKeyword.value);
};

// 执行搜索
const handleSearch = () => {
  performSearch(inputKeyword.value);
};

// 从历史记录搜索
const searchFromHistory = (keyword) => {
  inputKeyword.value = keyword;
  performSearch(keyword);
};

// 清空搜索
const clearSearch = () => {
  inputKeyword.value = '';
  clearResults();
};

// 组件挂载时加载搜索历史
onMounted(() => {
  loadSearchHistory();
});
</script>

<style scoped>
.search-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 搜索输入框 */
.search-input-wrapper {
  margin-top: 10px;
  position: relative;
  display: flex;
  align-items: center;
  background-color: var(--background-color-element, #f5f5f5);
  border-radius: 12px;
  padding: 0px 13px;
  transition: box-shadow 0.2s ease;
}

.search-input-wrapper:focus-within {
  box-shadow: 0 0 0 2px var(--primary-color, #007aff);
}

.search-icon {
  font-size: 18px;
  color: var(--fontColor-content-unimportant, #999);
  margin-right: 12px;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent !important;
  font-size: 16px;
  color: var(--fontColor-main, #333);
  outline: none !important;
}

.search-input::placeholder {
  color: var(--fontColor-content-unimportant, #999);
}

.clear-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--fontColor-content-unimportant, #999);
  transition: color 0.2s ease;
}

.clear-btn:hover {
  color: var(--fontColor-main, #333);
}

/* 搜索历史 */
.search-history {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fontColor-content, #666);
}

.clear-history-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--fontColor-content-unimportant, #999);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s ease;
}

.clear-history-btn:hover {
  color: var(--fontColor-content, #666);
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background-color: var(--background-color-element, #f5f5f5);
  border-radius: 16px;
  font-size: 13px;
  color: var(--fontColor-content, #666);
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-tag:hover {
  background-color: var(--background-color-element-hover, #e8e8e8);
}

.history-tag i {
  font-size: 12px;
  opacity: 0.6;
}

.history-tag i:hover {
  opacity: 1;
  color: var(--fontColor-main, #333);
}

/* 加载状态 */
.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--fontColor-content-unimportant, #999);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 搜索结果 */
.search-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.results-count {
  font-size: 14px;
  color: var(--fontColor-content-unimportant, #999);
}

/* 空状态 */
.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--fontColor-content-unimportant, #999);
}

.search-empty i {
  font-size: 48px;
  opacity: 0.5;
}

.search-empty span {
  font-size: 14px;
}

/* 错误状态 */
.search-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #ff6b6b;
}

.search-error i {
  font-size: 48px;
  opacity: 0.5;
}

.search-error span {
  font-size: 14px;
}
</style>
