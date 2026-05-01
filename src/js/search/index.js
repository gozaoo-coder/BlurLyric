import { ref, computed } from 'vue';
import apiManager from '../../api/manager.js';
import baseMethods from '../baseMethods.js';

/**
 * 搜索模块 - 提供搜索功能的核心逻辑和状态管理
 * @returns {Object} 搜索相关的状态和方法
 */
export function useSearch() {
  // 搜索状态
  const searchKeyword = ref('');
  const isSearching = ref(false);
  const searchResults = ref([]);
  const searchHistory = ref([]);
  const searchError = ref(null);

  // 搜索结果表格数据（适配 powerTable_music.vue 格式）
  const tableData = computed(() => {
    return {
      cellArray: searchResults.value
    };
  });

  // 是否有搜索结果
  const hasResults = computed(() => searchResults.value.length > 0);

  // 是否显示空状态
  const showEmpty = computed(() => {
    return !isSearching.value && searchKeyword.value && !hasResults.value;
  });

  /**
   * 执行搜索
   * @param {string} keyword - 搜索关键词
   */
  const performSearch = async (keyword) => {
    if (!keyword || keyword.trim() === '') {
      searchResults.value = [];
      searchKeyword.value = '';
      return;
    }

    const trimmedKeyword = keyword.trim();
    searchKeyword.value = trimmedKeyword;
    isSearching.value = true;
    searchError.value = null;

    try {
      // 调用API搜索歌曲
      const results = await apiManager.searchAll(trimmedKeyword);
      
      // 处理搜索结果，统一格式
      let tracks = [];
      
      if (results && results.tracks) {
        tracks = results.tracks;
      } else if (Array.isArray(results)) {
        tracks = results;
      }

      // 格式化搜索结果，确保字段一致性
      searchResults.value = tracks.map(track => formatTrackData(track));

      // 添加到搜索历史
      addToHistory(trimmedKeyword);
    } catch (error) {
      console.error('搜索失败:', error);
      searchError.value = error.message || '搜索失败，请稍后重试';
      searchResults.value = [];
    } finally {
      isSearching.value = false;
    }
  };

  /**
   * 格式化音轨数据，确保字段一致性
   * @param {Object} track - 原始音轨数据
   * @returns {Object} 格式化后的音轨数据
   */
  const formatTrackData = (track) => {
    return {
      id: track.id || -2,
      name: track.name || '未知歌曲',
      duration: track.duration || track.dt || 0,
      track_number: track.track_number || track.no || 0,
      // 艺术家信息
      ar: track.ar || track.artists || track.artist || [{ name: '未知艺术家', id: -2 }],
      // 专辑信息
      al: track.al || track.album || {
        name: track.album?.name || '未知专辑',
        id: track.album?.id || -2,
        picUrl: track.album?.picUrl || track.picUrl || ''
      },
      // 源信息（用于多来源播放）
      sources: track.sources || [],
      primarySourceIndex: track.primarySourceIndex ?? 0,
      // 其他字段透传
      ...track
    };
  };

  /**
   * 添加到搜索历史
   * @param {string} keyword - 搜索关键词
   */
  const addToHistory = (keyword) => {
    // 去重并限制历史记录数量
    const index = searchHistory.value.indexOf(keyword);
    if (index > -1) {
      searchHistory.value.splice(index, 1);
    }
    searchHistory.value.unshift(keyword);
    
    // 限制历史记录数量为10条
    if (searchHistory.value.length > 10) {
      searchHistory.value = searchHistory.value.slice(0, 10);
    }

    // 保存到本地存储
    try {
      localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
    } catch (e) {
      console.warn('无法保存搜索历史:', e);
    }
  };

  /**
   * 加载搜索历史
   */
  const loadSearchHistory = () => {
    try {
      const saved = localStorage.getItem('searchHistory');
      if (saved) {
        searchHistory.value = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('无法加载搜索历史:', e);
      searchHistory.value = [];
    }
  };

  /**
   * 清除搜索历史
   */
  const clearHistory = () => {
    searchHistory.value = [];
    try {
      localStorage.removeItem('searchHistory');
    } catch (e) {
      console.warn('无法清除搜索历史:', e);
    }
  };

  /**
   * 从历史记录中移除某一项
   * @param {string} keyword - 要移除的关键词
   */
  const removeFromHistory = (keyword) => {
    const index = searchHistory.value.indexOf(keyword);
    if (index > -1) {
      searchHistory.value.splice(index, 1);
      try {
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
      } catch (e) {
        console.warn('无法更新搜索历史:', e);
      }
    }
  };

  /**
   * 清空当前搜索结果
   */
  const clearResults = () => {
    searchResults.value = [];
    searchKeyword.value = '';
    searchError.value = null;
  };

  /**
   * 防抖搜索
   */
  const debouncedSearch = baseMethods.debounce(performSearch, 300);

  return {
    // 状态
    searchKeyword,
    isSearching,
    searchResults,
    searchHistory,
    searchError,
    tableData,
    hasResults,
    showEmpty,

    // 方法
    performSearch,
    debouncedSearch,
    clearResults,
    loadSearchHistory,
    clearHistory,
    removeFromHistory,
    formatTrackData
  };
}

export default useSearch;
