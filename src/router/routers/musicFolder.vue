<script>
import folder from '../../components/tracks/folder.vue';
import dialog from '../../components/base/dialog.vue';
import dialog_vue from '../../components/base/dialog.vue';
import powerTable from '../../components/tracks/powerTable.vue';
import manager from '../../api/manager';
import { sourceManager, NeteaseSource } from '../../api/source/index.js';

export default {
    data() {
        return {
            manager,
            localFolders: [],
            askAddLocalDirs: false,
            addLocalDirInputValue: "",
            // 在线源配置
            askAddOnlineSource: false,
            newOnlineSource: {
                name: '',
                apiUrl: '',
                type: 'netease'
            },
            onlineSources: [],
            testingSourceId: null
        }
    },
    components: {
        dialog,
        dialog_vue,
        powerTable,
        folder
    },
    computed: {
        onlineSourceTableData() {
            return {
                cellName: [{
                    type: 'content',
                    path: 'sourceName',
                    name: '名称',
                }, {
                    type: 'content',
                    path: 'baseUrl',
                    name: 'API 地址',
                }, {
                    type: 'content',
                    path: 'type',
                    name: '来源类型',
                }, {
                    type: 'status',
                    path: 'available',
                    name: '状态',
                }],
                cellArray: this.onlineSources,
            }
        },
    },
    methods: {
        async loadOnlineSources() {
            try {
                const sources = await sourceManager.getAvailableSources();
                this.onlineSources = sources.map(s => ({
                    sourceId: s.sourceId,
                    sourceName: s.sourceName,
                    baseUrl: s.source?.baseUrl || '-',
                    type: s.type,
                    available: s.available
                }));
            } catch (e) {
                console.error('Failed to load online sources:', e);
            }
        },

        async addOnlineSource() {
            if (!this.newOnlineSource.name || !this.newOnlineSource.apiUrl) {
                this.$root.regMessage({
                    type: 'Alert',
                    content: '请填写完整的源名称和 API 地址'
                });
                return;
            }

            try {
                const sourceId = `online_${Date.now()}`;
                const source = sourceManager.addSource(
                    sourceId,
                    this.newOnlineSource.name,
                    this.newOnlineSource.type,
                    { baseUrl: this.newOnlineSource.apiUrl }
                );

                // 保存到本地存储
                this.saveOnlineSourceConfig({
                    sourceId,
                    name: this.newOnlineSource.name,
                    apiUrl: this.newOnlineSource.apiUrl,
                    type: this.newOnlineSource.type
                });

                this.$root.regMessage({
                    type: 'Message',
                    content: `已添加网络源: ${this.newOnlineSource.name}`
                });

                this.askAddOnlineSource = false;
                this.newOnlineSource = { name: '', apiUrl: '', type: 'netease' };
                
                await this.loadOnlineSources();
            } catch (e) {
                this.$root.regMessage({
                    type: 'Alert',
                    content: `添加失败: ${e.message}`
                });
            }
        },

        async testOnlineSource(sourceId) {
            this.testingSourceId = sourceId;
            try {
                const source = sourceManager.getSource(sourceId);
                if (source && source.isAvailable) {
                    const available = await source.isAvailable();
                    this.$root.regMessage({
                        type: 'Message',
                        content: available ? `${source.sourceName} 连接正常` : `${source.sourceName} 无法连接`
                    });
                }
            } catch (e) {
                this.$root.regMessage({
                    type: 'Alert',
                    content: `测试失败: ${e.message}`
                });
            } finally {
                this.testingSourceId = null;
                await this.loadOnlineSources();
            }
        },

        removeOnlineSource(sourceId) {
            try {
                sourceManager.removeSource(sourceId);
                this.removeOnlineSourceConfig(sourceId);
                this.$root.regMessage({
                    type: 'Message',
                    content: '已删除网络源'
                });
                this.loadOnlineSources();
            } catch (e) {
                this.$root.regMessage({
                    type: 'Alert',
                    content: `删除失败: ${e.message}`
                });
            }
        },

        saveOnlineSourceConfig(config) {
            const saved = JSON.parse(localStorage.getItem('onlineSources') || '[]');
            saved.push(config);
            localStorage.setItem('onlineSources', JSON.stringify(saved));
        },

        removeOnlineSourceConfig(sourceId) {
            const saved = JSON.parse(localStorage.getItem('onlineSources') || '[]');
            const filtered = saved.filter(s => s.sourceId !== sourceId);
            localStorage.setItem('onlineSources', JSON.stringify(filtered));
        },

        loadSavedOnlineSources() {
            const saved = JSON.parse(localStorage.getItem('onlineSources') || '[]');
            for (const config of saved) {
                try {
                    if (!sourceManager.getSource(config.sourceId)) {
                        sourceManager.addSource(
                            config.sourceId,
                            config.name,
                            config.type,
                            { baseUrl: config.apiUrl }
                        );
                    }
                } catch (e) {
                    console.warn('Failed to load saved source:', config.sourceId, e);
                }
            }
        }
    },
    async created() {
        // 加载保存的在线源配置
        this.loadSavedOnlineSources();
        // 加载在线源列表
        await this.loadOnlineSources();
    },
    inject: ['appState', 'source']
}
</script>

<template>
    <bodytitle text="音乐来源" />
    <div v-if="appState.runOnTauri == true">

        <h2>管理本地文件夹</h2>
        <iconFlexRow>

            <iconWithText @click="manager.tauri.refreshMusicCache();" type="background">
                <template #icon>
                    <i class="bi bi-arrow-clockwise"></i>
                </template>
                <template #text>刷新</template>
            </iconWithText>
            <iconWithText @click="askAddLocalDirs = true" type="background">
                <template #icon>
                    <i class="bi bi-plus-circle-dotted"></i>
                </template>
                <template #text>添加</template>
            </iconWithText>
            <iconWithText @click="this.$router.push('/allmusic/')" type="background">
                <template #svg>
                    <i class="bi bi-folder-fill"></i>
                </template>
                <template #text>
                    全部音乐
                </template>
            </iconWithText>
            <iconWithText @click="this.$router.push('/allLocalArtist/')" type="background">
                <template #svg>
                    <i class="bi bi-person-circle"></i>
                </template>
                <template #text>
                    所有本地艺人
                </template>
            </iconWithText>
            <iconWithText @click="this.$router.push('/allLocalAlbum/')" type="background">
                <template #svg>
                    <i class="bi bi-disc-fill"></i>
                </template>
                <template #text>
                    所有本地专辑
                </template>
            </iconWithText>
        </iconFlexRow>
        <dialog_vue v-if="askAddLocalDirs == true" :cancel="() => { askAddLocalDirs = false }"
            :finish="() => { askAddLocalDirs = false; manager.tauri.addMusicDirs(addLocalDirInputValue); manager.tauri.refreshMusicCache(); }">
            <h2>
                请输入一个地址
            </h2>
            <p class="tips">示例：C:\Users\gozaoo\Music\</p>
            <input style="width: 210px" type="text" placeholder="" v-model="addLocalDirInputValue">
        </dialog_vue>
        <folder @del="() => { manager.tauri.removeMusicDirs(item); manager.tauri.refreshMusicCache();  }"
            v-for="(item) in source.local.folders.data">
            <template #name>
            </template>
            <template #path>
                {{ item }}
            </template>

        </folder>
        <p class="tips" v-if="source.local.folders.data.length == 0">当前还没有添加的目录，请先添加</p>
    </div>

    <h2>在线来源</h2>
    <iconFlexRow>
        <iconWithText @click="askAddOnlineSource = true" type="background">
            <template #icon>
                <i class="bi bi-plus-circle-dotted"></i>
            </template>
            <template #text>添加</template>
        </iconWithText>
        <iconWithText @click="loadOnlineSources()" type="background">
            <template #icon>
                <i class="bi bi-arrow-clockwise"></i>
            </template>
            <template #text>刷新</template>
        </iconWithText>
    </iconFlexRow>

    <!-- 添加在线源对话框 -->
    <dialog_vue v-if="askAddOnlineSource == true" 
        :cancel="() => { askAddOnlineSource = false }"
        :finish="addOnlineSource">
        <h2>添加在线音乐源</h2>
        <div class="add-source-form">
            <div class="form-group">
                <label>源名称</label>
                <input type="text" v-model="newOnlineSource.name" placeholder="例如：我的音乐API">
            </div>
            <div class="form-group">
                <label>API 地址</label>
                <input type="text" v-model="newOnlineSource.apiUrl" placeholder="例如：http://localhost:3000">
            </div>
            <div class="form-group">
                <label>源类型</label>
                <select v-model="newOnlineSource.type">
                    <option value="netease">网易云音乐 API</option>
                    <option value="api">自定义 API</option>
                </select>
            </div>
            <p class="tips">支持 NeteaseCloudMusicApiEnhanced 兼容的 API</p>
        </div>
    </dialog_vue>

    <!-- 在线源列表 -->
    <div class="online-source-list">
        <div v-for="source in onlineSources" :key="source.sourceId" class="online-source-item">
            <div class="source-info">
                <span class="source-name">{{ source.sourceName }}</span>
                <span class="source-url">{{ source.baseUrl }}</span>
                <span class="source-type">{{ source.type }}</span>
                <span :class="['source-status', source.available ? 'available' : 'unavailable']">
                    {{ source.available ? '可用' : '不可用' }}
                </span>
            </div>
            <div class="source-actions">
                <button @click="testOnlineSource(source.sourceId)" :disabled="testingSourceId === source.sourceId">
                    {{ testingSourceId === source.sourceId ? '测试中...' : '测试连接' }}
                </button>
                <button v-if="source.sourceId !== 'local'" @click="removeOnlineSource(source.sourceId)" class="danger">删除</button>
            </div>
        </div>
        <p class="tips" v-if="onlineSources.length === 0">当前没有添加在线源，点击上方"添加"按钮添加</p>
    </div>
</template>

<style scoped>
.buttomTrack {
    display: flex;
}

.buttomTrack>* {
    width: fit-content;
}

/* 添加源表单 */
.add-source-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 300px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.form-group label {
    font-size: 14px;
    font-weight: 500;
    color: var(--fontColor-content, #666);
}

.form-group input,
.form-group select {
    padding: 8px 12px;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 6px;
    font-size: 14px;
    background: var(--background-color-element, #f5f5f5);
    color: var(--fontColor-main, #333);
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: var(--primary-color, #007aff);
}

/* 在线源列表 */
.online-source-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
}

.online-source-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--background-color-element, #f5f5f5);
    border-radius: 8px;
    gap: 16px;
}

.source-info {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
}

.source-name {
    font-weight: 500;
    color: var(--fontColor-main, #333);
}

.source-url {
    font-size: 12px;
    color: var(--fontColor-content, #666);
    font-family: monospace;
}

.source-type {
    font-size: 12px;
    padding: 2px 8px;
    background: var(--primary-color-light, rgba(0, 122, 255, 0.1));
    color: var(--primary-color, #007aff);
    border-radius: 4px;
}

.source-status {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
}

.source-status.available {
    background: rgba(52, 199, 89, 0.1);
    color: #34c759;
}

.source-status.unavailable {
    background: rgba(255, 59, 48, 0.1);
    color: #ff3b30;
}

.source-actions {
    display: flex;
    gap: 8px;
}

.source-actions button {
    padding: 6px 12px;
    font-size: 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    background: var(--background-color-element-hover, #e8e8e8);
    color: var(--fontColor-content, #666);
    transition: all 0.2s ease;
}

.source-actions button:hover {
    background: var(--primary-color-light, rgba(0, 122, 255, 0.1));
    color: var(--primary-color, #007aff);
}

.source-actions button.danger:hover {
    background: rgba(255, 59, 48, 0.1);
    color: #ff3b30;
}

.source-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
