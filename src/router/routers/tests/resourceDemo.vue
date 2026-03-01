<template>
    <div class="resource-demo">
        <h2>资源请求使用示例</h2>
        <p class="description">展示如何使用优化后的资源管理系统进行专辑封面、音乐文件和歌词请求</p>

        <!-- 性能监控面板 -->
        <div class="panel performance-panel">
            <h3>性能监控</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">GPU可用:</span>
                    <span class="stat-value" :class="{ 'success': gpuAvailable, 'error': !gpuAvailable }">
                        {{ gpuAvailable ? '是' : '否' }}
                    </span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">缓存命中:</span>
                    <span class="stat-value">{{ cacheStats.cacheHits }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">缓存未命中:</span>
                    <span class="stat-value">{{ cacheStats.cacheMisses }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">平均加载时间:</span>
                    <span class="stat-value">{{ cacheStats.avgLoadTime }}ms</span>
                </div>
            </div>
            <button @click="refreshStats" class="btn">刷新统计</button>
            <button @click="resetStats" class="btn btn-secondary">重置统计</button>
        </div>

        <!-- 专辑封面请求示例 -->
        <div class="panel">
            <h3>专辑封面请求示例</h3>
            <div class="control-group">
                <label>专辑ID:</label>
                <input v-model.number="coverAlbumId" type="number" placeholder="输入专辑ID" />
                <label>分辨率:</label>
                <select v-model="coverResolution">
                    <option :value="92">92px (最小)</option>
                    <option :value="184">184px (小)</option>
                    <option :value="368">368px (中)</option>
                    <option :value="512">512px (大)</option>
                    <option :value="1024">1024px (原图)</option>
                </select>
                <button @click="loadCover" class="btn btn-primary" :disabled="loadingCover">
                    {{ loadingCover ? '加载中...' : '加载封面' }}
                </button>
            </div>
            <div class="result-area">
                <div v-if="coverError" class="error-message">{{ coverError }}</div>
                <div v-else-if="coverUrl" class="cover-display">
                    <img :src="coverUrl" alt="专辑封面" />
                    <div class="cover-info">
                        <p>加载时间: {{ coverLoadTime }}ms</p>
                        <p>来源: {{ coverFromCache ? '缓存' : '网络' }}</p>
                    </div>
                </div>
                <div v-else class="placeholder">点击按钮加载专辑封面</div>
            </div>
        </div>

        <!-- 音乐文件请求示例 -->
        <div class="panel">
            <h3>音乐文件请求示例</h3>
            <div class="control-group">
                <label>歌曲ID:</label>
                <input v-model.number="musicSongId" type="number" placeholder="输入歌曲ID" />
                <button @click="loadMusic" class="btn btn-primary" :disabled="loadingMusic">
                    {{ loadingMusic ? '加载中...' : '加载音乐' }}
                </button>
                <button @click="playMusic" class="btn" :disabled="!musicUrl">
                    播放
                </button>
                <button @click="stopMusic" class="btn btn-secondary" :disabled="!isPlaying">
                    停止
                </button>
            </div>
            <div class="result-area">
                <div v-if="musicError" class="error-message">{{ musicError }}</div>
                <div v-else-if="musicUrl" class="music-display">
                    <audio ref="audioPlayer" :src="musicUrl" controls @ended="onMusicEnded"></audio>
                    <div class="music-info">
                        <p>加载时间: {{ musicLoadTime }}ms</p>
                        <p>来源: {{ musicFromCache ? '缓存' : '网络' }}</p>
                    </div>
                </div>
                <div v-else class="placeholder">点击按钮加载音乐文件</div>
            </div>
        </div>

        <!-- 歌词请求示例 -->
        <div class="panel">
            <h3>歌词请求示例</h3>
            <div class="control-group">
                <label>歌曲ID:</label>
                <input v-model.number="lyricSongId" type="number" placeholder="输入歌曲ID" />
                <button @click="loadLyric" class="btn btn-primary" :disabled="loadingLyric">
                    {{ loadingLyric ? '加载中...' : '加载歌词' }}
                </button>
            </div>
            <div class="result-area">
                <div v-if="lyricError" class="error-message">{{ lyricError }}</div>
                <div v-else-if="lyricText" class="lyric-display">
                    <pre>{{ lyricText }}</pre>
                    <div class="lyric-info">
                        <p>加载时间: {{ lyricLoadTime }}ms</p>
                    </div>
                </div>
                <div v-else class="placeholder">点击按钮加载歌词</div>
            </div>
        </div>

        <!-- 批量请求示例 -->
        <div class="panel">
            <h3>批量资源请求示例</h3>
            <div class="control-group">
                <label>请求数量:</label>
                <input v-model.number="batchCount" type="number" min="1" max="20" />
                <button @click="loadBatchCovers" class="btn btn-primary" :disabled="loadingBatch">
                    {{ loadingBatch ? '批量加载中...' : '批量加载封面' }}
                </button>
            </div>
            <div class="result-area">
                <div v-if="batchError" class="error-message">{{ batchError }}</div>
                <div v-else-if="batchCovers.length > 0" class="batch-display">
                    <div class="cover-grid">
                        <div v-for="(cover, index) in batchCovers" :key="index" class="cover-item">
                            <img v-if="cover.url" :src="cover.url" alt="封面" />
                            <div v-else class="cover-error">加载失败</div>
                            <span class="cover-label">ID: {{ cover.id }}</span>
                        </div>
                    </div>
                    <div class="batch-info">
                        <p>总加载时间: {{ batchLoadTime }}ms</p>
                        <p>平均每个: {{ (batchLoadTime / batchCount).toFixed(2) }}ms</p>
                    </div>
                </div>
                <div v-else class="placeholder">点击按钮批量加载封面</div>
            </div>
        </div>

        <!-- 缓存管理示例 -->
        <div class="panel">
            <h3>缓存管理示例</h3>
            <div class="control-group">
                <button @click="showCacheInfo" class="btn">显示缓存信息</button>
                <button @click="clearAllCache" class="btn btn-secondary">清除所有缓存</button>
                <button @click="performIncrementalScan" class="btn btn-primary">执行增量扫描</button>
            </div>
            <div v-if="cacheInfo" class="cache-info">
                <pre>{{ JSON.stringify(cacheInfo, null, 2) }}</pre>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { Track, AlbumCoverResource, MusicFileResource } from '../../api/resources/index.js';
import lazyLoader from '../../api/lazyLoader.js';
import { performanceMonitor } from '../../api/performanceMonitor.js';
import manager from '../../api/manager.js';

export default {
    name: 'ResourceDemo',
    setup() {
        // 性能监控
        const gpuAvailable = ref(false);
        const cacheStats = ref({
            cacheHits: 0,
            cacheMisses: 0,
            avgLoadTime: 0
        });

        // 专辑封面
        const coverAlbumId = ref(1);
        const coverResolution = ref(368);
        const coverUrl = ref('');
        const coverLoadTime = ref(0);
        const coverFromCache = ref(false);
        const loadingCover = ref(false);
        const coverError = ref('');

        // 音乐文件
        const musicSongId = ref(1);
        const musicUrl = ref('');
        const musicLoadTime = ref(0);
        const musicFromCache = ref(false);
        const loadingMusic = ref(false);
        const musicError = ref('');
        const isPlaying = ref(false);
        const audioPlayer = ref(null);

        // 歌词
        const lyricSongId = ref(1);
        const lyricText = ref('');
        const lyricLoadTime = ref(0);
        const loadingLyric = ref(false);
        const lyricError = ref('');

        // 批量请求
        const batchCount = ref(5);
        const batchCovers = ref([]);
        const batchLoadTime = ref(0);
        const loadingBatch = ref(false);
        const batchError = ref('');

        // 缓存信息
        const cacheInfo = ref(null);

        // 刷新性能统计
        const refreshStats = async () => {
            const stats = performanceMonitor.getLocalStats();
            cacheStats.value = stats;
            
            // 检查GPU状态
            try {
                const report = await manager.source.getPerformanceReport();
                if (report && report.backend) {
                    gpuAvailable.value = report.backend.overall_stats !== undefined;
                }
            } catch (e) {
                console.log('GPU check failed:', e);
            }
        };

        // 重置统计
        const resetStats = () => {
            performanceMonitor.resetStats();
            refreshStats();
        };

        // 加载专辑封面
        const loadCover = async () => {
            loadingCover.value = true;
            coverError.value = '';
            
            const timerId = `cover_${coverAlbumId.value}_${Date.now()}`;
            performanceMonitor.startResourceTimer(timerId);
            
            try {
                const startTime = performance.now();
                const result = await lazyLoader.loadAlbumCover(
                    coverAlbumId.value, 
                    coverResolution.value
                );
                
                coverLoadTime.value = Math.round(performance.now() - startTime);
                coverUrl.value = result.objectURL;
                coverFromCache.value = lazyLoader.isCached(`cover_${coverResolution.value}_${coverAlbumId.value}`);
                
                performanceMonitor.endResourceTimer(timerId, 'album_cover', coverFromCache.value);
            } catch (error) {
                coverError.value = `加载失败: ${error.message}`;
                console.error('Cover load error:', error);
            } finally {
                loadingCover.value = false;
                refreshStats();
            }
        };

        // 加载音乐文件
        const loadMusic = async () => {
            loadingMusic.value = true;
            musicError.value = '';
            
            const timerId = `music_${musicSongId.value}_${Date.now()}`;
            performanceMonitor.startResourceTimer(timerId);
            
            try {
                const startTime = performance.now();
                const result = await lazyLoader.loadMusicFile(musicSongId.value);
                
                musicLoadTime.value = Math.round(performance.now() - startTime);
                musicUrl.value = result.objectURL;
                musicFromCache.value = lazyLoader.isCached(`music_${musicSongId.value}`);
                
                performanceMonitor.endResourceTimer(timerId, 'music_file', musicFromCache.value);
            } catch (error) {
                musicError.value = `加载失败: ${error.message}`;
                console.error('Music load error:', error);
            } finally {
                loadingMusic.value = false;
                refreshStats();
            }
        };

        // 播放音乐
        const playMusic = () => {
            if (audioPlayer.value) {
                audioPlayer.value.play();
                isPlaying.value = true;
            }
        };

        // 停止音乐
        const stopMusic = () => {
            if (audioPlayer.value) {
                audioPlayer.value.pause();
                audioPlayer.value.currentTime = 0;
                isPlaying.value = false;
            }
        };

        // 音乐播放结束
        const onMusicEnded = () => {
            isPlaying.value = false;
        };

        // 加载歌词
        const loadLyric = async () => {
            loadingLyric.value = true;
            lyricError.value = '';
            
            const startTime = performance.now();
            
            try {
                // 获取音乐列表并查找对应歌曲
                const musicList = await manager.source.getMusicList();
                const song = musicList.find(s => s.id === lyricSongId.value);
                
                if (song && song.lyric) {
                    lyricText.value = song.lyric;
                } else {
                    lyricText.value = '暂无歌词';
                }
                
                lyricLoadTime.value = Math.round(performance.now() - startTime);
            } catch (error) {
                lyricError.value = `加载失败: ${error.message}`;
                console.error('Lyric load error:', error);
            } finally {
                loadingLyric.value = false;
            }
        };

        // 批量加载封面
        const loadBatchCovers = async () => {
            loadingBatch.value = true;
            batchError.value = '';
            batchCovers.value = [];
            
            const startTime = performance.now();
            
            try {
                const items = [];
                for (let i = 1; i <= batchCount.value; i++) {
                    items.push({ type: 'cover', id: i });
                }
                
                const results = await lazyLoader.preloadBatch(items);
                
                batchCovers.value = results.map((result, index) => ({
                    id: index + 1,
                    url: result ? result.objectURL : null
                }));
                
                batchLoadTime.value = Math.round(performance.now() - startTime);
            } catch (error) {
                batchError.value = `批量加载失败: ${error.message}`;
                console.error('Batch load error:', error);
            } finally {
                loadingBatch.value = false;
                refreshStats();
            }
        };

        // 显示缓存信息
        const showCacheInfo = async () => {
            try {
                const stats = await manager.source.getCacheStats();
                const localStats = lazyLoader.getCacheStats();
                cacheInfo.value = {
                    backend: stats,
                    frontend: localStats
                };
            } catch (e) {
                cacheInfo.value = { error: e.message };
            }
        };

        // 清除所有缓存
        const clearAllCache = async () => {
            try {
                await manager.source.clearCache();
                lazyLoader.clearCache();
                alert('缓存已清除');
                cacheInfo.value = null;
            } catch (e) {
                alert(`清除缓存失败: ${e.message}`);
            }
        };

        // 执行增量扫描
        const performIncrementalScan = async () => {
            try {
                const result = await manager.source.performIncrementalScan();
                alert(`增量扫描完成:\n新增: ${result.added}\n修改: ${result.modified}\n删除: ${result.removed}`);
            } catch (e) {
                alert(`扫描失败: ${e.message}`);
            }
        };

        onMounted(() => {
            refreshStats();
        });

        onUnmounted(() => {
            // 清理资源
            if (coverUrl.value && coverUrl.value.startsWith('blob:')) {
                URL.revokeObjectURL(coverUrl.value);
            }
            if (musicUrl.value && musicUrl.value.startsWith('blob:')) {
                URL.revokeObjectURL(musicUrl.value);
            }
        });

        return {
            // 性能监控
            gpuAvailable,
            cacheStats,
            refreshStats,
            resetStats,
            
            // 专辑封面
            coverAlbumId,
            coverResolution,
            coverUrl,
            coverLoadTime,
            coverFromCache,
            loadingCover,
            coverError,
            loadCover,
            
            // 音乐文件
            musicSongId,
            musicUrl,
            musicLoadTime,
            musicFromCache,
            loadingMusic,
            musicError,
            isPlaying,
            audioPlayer,
            loadMusic,
            playMusic,
            stopMusic,
            onMusicEnded,
            
            // 歌词
            lyricSongId,
            lyricText,
            lyricLoadTime,
            loadingLyric,
            lyricError,
            loadLyric,
            
            // 批量请求
            batchCount,
            batchCovers,
            batchLoadTime,
            loadingBatch,
            batchError,
            loadBatchCovers,
            
            // 缓存管理
            cacheInfo,
            showCacheInfo,
            clearAllCache,
            performIncrementalScan
        };
    }
};
</script>

<style scoped>
.resource-demo {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

h2 {
    margin-bottom: 10px;
    color: var(--color-text-primary);
}

.description {
    color: var(--color-text-secondary);
    margin-bottom: 20px;
}

.panel {
    background: var(--color-background-secondary);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: var(--color-text-primary);
    font-size: 18px;
}

.performance-panel {
    background: linear-gradient(135deg, var(--color-background-secondary), var(--color-background-tertiary));
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 15px;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: var(--color-background-primary);
    border-radius: 8px;
}

.stat-label {
    color: var(--color-text-secondary);
}

.stat-value {
    font-weight: bold;
    color: var(--color-text-primary);
}

.stat-value.success {
    color: #4caf50;
}

.stat-value.error {
    color: #f44336;
}

.control-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 15px;
}

.control-group label {
    color: var(--color-text-secondary);
    font-size: 14px;
}

.control-group input,
.control-group select {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-background-primary);
    color: var(--color-text-primary);
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: var(--color-button);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
}

.btn:hover:not(:disabled) {
    background: var(--color-button-hover);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary {
    background: var(--color-button-active);
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: var(--color-button-active-hover);
}

.btn-secondary {
    background: var(--color-button-secondary);
}

.result-area {
    min-height: 150px;
    background: var(--color-background-primary);
    border-radius: 8px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.placeholder {
    color: var(--color-text-tertiary);
    font-style: italic;
}

.error-message {
    color: #f44336;
    text-align: center;
}

.cover-display {
    text-align: center;
}

.cover-display img {
    max-width: 300px;
    max-height: 300px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.cover-info,
.music-info,
.lyric-info,
.batch-info {
    margin-top: 10px;
    font-size: 14px;
    color: var(--color-text-secondary);
}

.music-display {
    width: 100%;
    text-align: center;
}

.music-display audio {
    width: 100%;
    max-width: 500px;
}

.lyric-display {
    width: 100%;
    max-height: 300px;
    overflow-y: auto;
}

.lyric-display pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    text-align: left;
    padding: 10px;
    background: var(--color-background-secondary);
    border-radius: 6px;
    font-size: 14px;
    line-height: 1.6;
}

.cover-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    width: 100%;
}

.cover-item {
    text-align: center;
}

.cover-item img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 6px;
}

.cover-error {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-background-secondary);
    border-radius: 6px;
    color: var(--color-text-tertiary);
    font-size: 12px;
}

.cover-label {
    display: block;
    margin-top: 5px;
    font-size: 12px;
    color: var(--color-text-secondary);
}

.cache-info {
    margin-top: 15px;
    padding: 15px;
    background: var(--color-background-primary);
    border-radius: 8px;
    overflow-x: auto;
}

.cache-info pre {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
}
</style>
