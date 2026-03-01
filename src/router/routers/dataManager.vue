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

