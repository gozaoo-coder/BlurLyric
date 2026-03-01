<script>
import tracksRow from '../../components/tracks/tracksRow.vue'
import linkLine from '../../components/tracks/link-line.vue';
import dialog_custom from '../../components/base/dialog.vue';
import manager from '../../api/manager.js'

export default {
    data() {
        return {
            cacheStats: {
                totalSize: 0,
                imageCacheSize: 0,
                dataCacheSize: 0,
                imageCount: 0,
                fileCount: 0
            },
            isLoading: false,
            showResetConfirmDialog: false,
            resetConfirmText: '',
            resetInput: ''
        }
    },
    components: {
        tracksRow,
        linkLine,
        dialog_custom
    },
    methods: {
        async loadCacheStats() {
            this.isLoading = true;
            try {
                const stats = await manager.tauri.getCacheSizeInfo();
                if (stats) {
                    this.cacheStats = stats;
                }
            } catch (e) {
                console.error('Failed to load cache stats:', e);
                this.regMessage({
                    type: 'Alert',
                    content: '加载缓存统计失败: ' + e.message
                });
            } finally {
                this.isLoading = false;
            }
        },

        formatSize(bytes) {
            if (bytes === 0) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            const k = 1024;
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
        },

        async clearImageCache() {
            if (!confirm('确定要清除所有封面缓存图片吗？这将释放磁盘空间，但下次查看封面时需要重新生成。')) {
                return;
            }

            this.isLoading = true;
            try {
                await manager.tauri.clearImageCache();
                this.regMessage({
                    type: 'Message',
                    content: '封面缓存已清除'
                });
                await this.loadCacheStats();
            } catch (e) {
                console.error('Failed to clear image cache:', e);
                this.regMessage({
                    type: 'Alert',
                    content: '清除封面缓存失败: ' + e.message
                });
            } finally {
                this.isLoading = false;
            }
        },

        async clearAllCache() {
            if (!confirm('确定要清除所有缓存吗？这将清除音乐库缓存和封面图片，但会保留您的音乐目录设置。')) {
                return;
            }

            this.isLoading = true;
            try {
                await manager.tauri.clearCache();
                this.regMessage({
                    type: 'Message',
                    content: '所有缓存已清除，正在重新扫描...'
                });
                await manager.tauri.refreshMusicCache();
                this.regMessage({
                    type: 'Message',
                    content: '重新扫描完成'
                });
                await this.loadCacheStats();
            } catch (e) {
                console.error('Failed to clear all cache:', e);
                this.regMessage({
                    type: 'Alert',
                    content: '清除缓存失败: ' + e.message
                });
            } finally {
                this.isLoading = false;
            }
        },

        openResetConfirmDialog() {
            this.resetConfirmText = this.generateConfirmText();
            this.resetInput = '';
            this.showResetConfirmDialog = true;
        },

        generateConfirmText() {
            const words = ['RESET', 'CLEAR', 'DELETE', 'REMOVE'];
            return words[Math.floor(Math.random() * words.length)];
        },

        async executeReset() {
            if (this.resetInput !== this.resetConfirmText) {
                this.regMessage({
                    type: 'Alert',
                    content: '输入的确认文本不正确'
                });
                return false;
            }

            this.isLoading = true;
            this.showResetConfirmDialog = false;

            try {
                await manager.tauri.resetAllData();
                this.regMessage({
                    type: 'Message',
                    content: '应用数据已重置，正在重新初始化...'
                });

                await manager.tauri.initApplication();
                this.regMessage({
                    type: 'Message',
                    content: '重新初始化完成'
                });

                await this.loadCacheStats();
            } catch (e) {
                console.error('Failed to reset application data:', e);
                this.regMessage({
                    type: 'Alert',
                    content: '重置数据失败: ' + e.message
                });
            } finally {
                this.isLoading = false;
            }

            return true;
        },

        cancelReset() {
            this.showResetConfirmDialog = false;
            this.resetInput = '';
        }
    },
    inject: ['regMessage'],
    created() {
        this.loadCacheStats();
    }
}
</script>

<template>
    <bodytitle text="数据管理" />

    <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>处理中...</p>
    </div>

    <h2>缓存统计</h2>
    <tracksRow>
        <div class="cache-stats">
            <div class="stat-item">
                <span class="stat-label">总缓存大小</span>
                <span class="stat-value">{{ formatSize(cacheStats.totalSize) }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">封面图片缓存</span>
                <span class="stat-value">{{ formatSize(cacheStats.imageCacheSize) }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">数据缓存</span>
                <span class="stat-value">{{ formatSize(cacheStats.dataCacheSize) }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">图片文件数</span>
                <span class="stat-value">{{ cacheStats.imageCount }} 个</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">总文件数</span>
                <span class="stat-value">{{ cacheStats.fileCount }} 个</span>
            </div>
        </div>
    </tracksRow>

    <tracksRow>
        <button class="btn btn-primary" @click="loadCacheStats">
            <i class="bi bi-arrow-clockwise"></i> 刷新统计
        </button>
    </tracksRow>

    <h2>缓存管理</h2>
    <tracksRow>
        <linkLine @click="clearImageCache">
            <template #icon>
                <i class="bi bi-image"></i>
            </template>
            <template #text>
                仅清除封面缓存
            </template>
        </linkLine>
    </tracksRow>

    <tracksRow>
        <linkLine @click="clearAllCache">
            <template #icon>
                <i class="bi bi-trash"></i>
            </template>
            <template #text>
                清除所有缓存（保留目录设置）
            </template>
        </linkLine>
    </tracksRow>

    <h2>数据重置</h2>
    <tracksRow>
        <div class="warning-box">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>警告：重置将清除所有应用数据，包括音乐目录设置、缓存和配置。此操作不可撤销！</span>
        </div>
    </tracksRow>

    <tracksRow>
        <linkLine @click="openResetConfirmDialog">
            <template #icon>
                <i class="bi bi-exclamation-circle-fill" style="color: #dc3545;"></i>
            </template>
            <template #text>
                <span style="color: #dc3545;">重置所有数据并重新初始化</span>
            </template>
        </linkLine>
    </tracksRow>

    <!-- 重置确认对话框 -->
    <dialog_custom v-if="showResetConfirmDialog"
        :cancel="cancelReset"
        :finish="executeReset">
        <div class="reset-confirm-dialog">
            <h3>确认重置应用数据</h3>
            <p class="warning-text">
                <i class="bi bi-exclamation-triangle-fill"></i>
                此操作将删除所有应用数据，包括：
            </p>
            <ul class="reset-list">
                <li>音乐库缓存</li>
                <li>封面图片缓存</li>
                <li>音乐目录设置</li>
                <li>所有配置数据</li>
            </ul>
            <p class="confirm-instruction">
                请输入 <strong>{{ resetConfirmText }}</strong> 以确认重置：
            </p>
            <input
                type="text"
                v-model="resetInput"
                :placeholder="resetConfirmText"
                class="confirm-input"
                @keyup.enter="resetInput === resetConfirmText && executeReset()"
            />
        </div>
    </dialog_custom>
</template>

<style scoped>
.cache-stats {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--backgroundColor-secondary);
    border-radius: 8px;
    width: 100%;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--borderColor);
}

.stat-item:last-child {
    border-bottom: none;
}

.stat-label {
    color: var(--fontColor-content);
    font-size: 0.95em;
}

.stat-value {
    color: var(--fontColor-title);
    font-weight: 500;
    font-size: 1em;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
}

.btn-primary {
    background: var(--themeColor);
    color: white;
}

.btn-primary:hover {
    opacity: 0.9;
}

.warning-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.3);
    border-radius: 6px;
    color: #dc3545;
    font-size: 0.9em;
}

.warning-box i {
    font-size: 1.2em;
    flex-shrink: 0;
}

.reset-confirm-dialog {
    padding: 20px;
    max-width: 400px;
}

.reset-confirm-dialog h3 {
    margin-bottom: 16px;
    color: var(--fontColor-title);
}

.warning-text {
    color: #dc3545;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.reset-list {
    margin: 12px 0;
    padding-left: 20px;
    color: var(--fontColor-content);
}

.reset-list li {
    margin: 6px 0;
}

.confirm-instruction {
    margin: 16px 0 8px;
    color: var(--fontColor-content);
}

.confirm-instruction strong {
    color: #dc3545;
    font-weight: 600;
}

.confirm-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--borderColor);
    border-radius: 6px;
    background: var(--backgroundColor-secondary);
    color: var(--fontColor-content);
    font-size: 1em;
    margin-top: 8px;
}

.confirm-input:focus {
    outline: none;
    border-color: var(--themeColor);
}

.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    gap: 16px;
}

.loading-overlay p {
    color: white;
    font-size: 1.1em;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
