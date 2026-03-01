<script>
import FlexColumnRow from '../../components/flexColumnRow.vue';
import toggle_lineRow from '../../components/tracks/toggle-line.vue'
import linkLine from '../../components/tracks/link-line.vue';
import tracksRow from '../../components/tracks/tracksRow.vue'
import manager from '../../api/manager.js'

export default {
    data() {
        return {
            localConfig: {

            },
            test: false,
            test_true: true,
            sources: [],
            showAddSourceDialog: false,
            newSource: {
                name: '',
                type: 'web',
                apiUrl: ''
            }
        }
    },
    components: {
        toggle_lineRow,
        tracksRow,
        linkLine
    },
    methods: {
        refreshConfig() {
            this.localConfig = this.config;
        },
        loadSources() {
            // 加载所有已配置的源
            this.sources = manager.source.getAllSources().map(s => ({
                ...s.source.getInfo(),
                instance: s.source
            }));
        },
        addSource() {
            // 验证输入
            if (!this.newSource.name) {
                this.regMessage({
                    type: 'Alert',
                    content: '请填写源名称'
                });
                return false; // 返回false阻止对话框关闭
            }
            
            if (this.newSource.type === 'web' && !this.newSource.apiUrl) {
                this.regMessage({
                    type: 'Alert',
                    content: '请填写API地址'
                });
                return false; // 返回false阻止对话框关闭
            }
            
            try {
                manager.source.addSource(
                    this.newSource.name,
                    this.newSource.type,
                    { apiUrl: this.newSource.apiUrl }
                );
                this.loadSources();
                this.showAddSourceDialog = false;
                this.newSource = { name: '', type: 'web', apiUrl: '' };
                this.regMessage({
                    type: 'Message',
                    content: '音乐源添加成功'
                });
                return true; // 返回true允许对话框关闭
            } catch (error) {
                this.regMessage({
                    type: 'Alert',
                    content: '添加失败: ' + error.message
                });
                return false; // 返回false阻止对话框关闭
            }
        },
        removeSource(name) {
            if (confirm(`确定要删除源 "${name}" 吗？`)) {
                manager.source.removeSource(name);
                this.loadSources();
                this.regMessage({
                    type: 'Message',
                    content: '音乐源已删除'
                });
            }
        },
        setDefaultSource(name) {
            manager.source.setDefaultSource(name);
            this.loadSources();
            this.regMessage({
                type: 'Message',
                content: `已切换到源: ${name}`
            });
        },
        async testSource(name) {
            const source = manager.source.getSource(name);
            if (!source) return;
            
            try {
                const isAvailable = await source.isAvailable();
                if (isAvailable) {
                    this.regMessage({
                        type: 'Message',
                        content: `源 "${name}" 连接正常`
                    });
                } else {
                    this.regMessage({
                        type: 'Alert',
                        content: `源 "${name}" 连接失败`
                    });
                }
            } catch (error) {
                this.regMessage({
                    type: 'Alert',
                    content: `源 "${name}" 测试失败: ${error.message}`
                });
            }
        }
    },
    inject: ['config', 'editConfig', 'regMessage'],
    created() {
        this.refreshConfig();
        this.loadSources();
    },
    watch: {
        config: {
            handler: (newVal) => {
                this.refreshConfig()
            }
        },
        localConfig: {
            deep: true,
            handler: function () {
                console.log(this.localConfig);

                this.editConfig(() => {
                    return this.localConfig
                })

            }
        }
    }
}
</script>

<template>
    <bodytitle text="设置" />
    
    <!-- 来源管理 -->
    <h2>来源管理</h2>
    <tracksRow>
        <linkLine @click="this.$router.push('/musicFolder/')">
            <template #icon>
                <i class="bi bi-folder-fill"></i>
            </template>
            <template #text>
                音乐来源
            </template>
        </linkLine>
    </tracksRow>
    
    <!-- 已配置的源列表 -->
    <tracksRow v-for="source in sources" :key="source.name">
        <div class="source-item">
            <div class="source-info">
                <i class="bi" :class="source.type === 'tauri' ? 'bi-hdd-fill' : 'bi-globe'"></i>
                <div class="source-details">
                    <span class="source-name">{{ source.name }}</span>
                    <span class="source-type">{{ source.type === 'tauri' ? '本地' : '网络' }}</span>
                </div>
                <span v-if="source.name === '本地音乐库'" class="source-badge default">默认</span>
            </div>
            <div class="source-actions">
                <button 
                    v-if="source.name !== '本地音乐库'" 
                    @click="setDefaultSource(source.name)"
                    class="btn btn-sm"
                >
                    设为默认
                </button>
                <button @click="testSource(source.name)" class="btn btn-sm">
                    测试
                </button>
                <button 
                    v-if="source.name !== '本地音乐库'" 
                    @click="removeSource(source.name)"
                    class="btn btn-sm btn-danger"
                >
                    删除
                </button>
            </div>
        </div>
    </tracksRow>
    
    <!-- 添加新源 -->
    <tracksRow>
        <linkLine @click="showAddSourceDialog = true">
            <template #icon>
                <i class="bi bi-plus-circle-fill"></i>
            </template>
            <template #text>
                添加音乐源
            </template>
        </linkLine>
    </tracksRow>
    
    <!-- 添加源对话框 -->
    <dialog_custom v-if="showAddSourceDialog" 
        :cancel="() => { showAddSourceDialog = false; newSource = { name: '', type: 'web', apiUrl: '' }; }" 
        :finish="addSource">
        <div class="add-source-form">
            <h3>添加音乐源</h3>
            <div class="form-group">
                <label>源名称</label>
                <input v-model="newSource.name" type="text" placeholder="例如: 网易云音乐" />
            </div>
            <div class="form-group">
                <label>源类型</label>
                <select v-model="newSource.type">
                    <option value="web">Web API</option>
                    <option value="tauri">本地 (Tauri)</option>
                </select>
            </div>
            <div class="form-group" v-if="newSource.type === 'web'">
                <label>API地址</label>
                <input v-model="newSource.apiUrl" type="text" placeholder="http://localhost:3000/" />
            </div>
        </div>
    </dialog_custom>
    
    <h2>显示</h2>
    <tracksRow>
        <toggle_lineRow :type="'unavailable'" v-model="test_true">
            <template #icon>
                <i class="bi bi-back"></i>
            </template>
            <template #text>
                使用毛玻璃效果 (**当前功能不可用)
            </template>
        </toggle_lineRow>
    </tracksRow>
    <tracksRow>
        <toggle_lineRow :type="'unavailable'" v-model="test">
            <template #icon>
                <i class="bi bi-film"></i>
            </template>
            <template #text>
                锁定复杂画面计算帧数（24fps）
            </template>
        </toggle_lineRow>
    </tracksRow>
    <h2>播放偏好</h2>
    <tracksRow>
        <toggle_lineRow v-model="localConfig.audio.smartStreamAudioList">
            <template #icon>
                <i class="bi bi-water"></i>
            </template>
            <template #text>
                交叉过渡
            </template>
        </toggle_lineRow>
    </tracksRow>
    <h2>操作偏好</h2>
    <tracksRow>
        <toggle_lineRow v-model="test">
            <template #icon>
                <i class="bi bi-water"></i>
            </template>
            <template #text>
                双击音乐列表操作
            </template>
        </toggle_lineRow>
    </tracksRow>
    <h2>基本（敬请期待）</h2>
    <tracksRow>
        <toggle_lineRow :type="'unavailable'" v-model="test">
            <template #icon>
                <i class="bi bi-translate"></i>
            </template>
            <template #text>
                语言 | Language (**当前功能不可用)
            </template>
        </toggle_lineRow>
    </tracksRow>
    <tracksRow>
        <toggle_lineRow :type="'unavailable'" v-model="test">
            <template #icon>
                <i class="bi bi-pci-card-sound"></i>
            </template>
            <template #text>
                音频设备 (**当前功能不可用)
            </template>
        </toggle_lineRow>
    </tracksRow>
    <h2>数据管理</h2>
    <tracksRow>
        <linkLine @click="this.$router.push('/dataManager/')">
            <template #icon>
                <i class="bi bi-database-fill-gear"></i>
            </template>
            <template #text>
                数据管理
            </template>
        </linkLine>
    </tracksRow>

    <h2>其他</h2>
    <tracksRow>
        <linkLine @click="this.$router.push('/demo/')">
            <template #icon>
                <i class="bi bi-bug-fill"></i>
            </template>
            <template #text>
                进入调试面板
            </template>
        </linkLine>
    </tracksRow>
    <bodytitle text="关于" />
    <h2>BlurLyric</h2>

</template>

<style scoped>
.buttomTrack {
    display: flex;
}

.buttomTrack>* {
    width: fit-content;
}

.source-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 0;
}

.source-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.source-info i {
    font-size: 1.2em;
    color: var(--fontColor-content);
}

.source-details {
    display: flex;
    flex-direction: column;
}

.source-name {
    font-weight: 500;
    color: var(--fontColor-title);
}

.source-type {
    font-size: 0.85em;
    color: var(--fontColor-content-moreUnimportant);
}

.source-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75em;
    font-weight: 500;
}

.source-badge.default {
    background: var(--themeColor);
    color: white;
}

.source-actions {
    display: flex;
    gap: 8px;
}

.btn {
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    background: var(--backgroundColor-secondary);
    color: var(--fontColor-content);
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;
}

.btn:hover {
    background: var(--backgroundColor-tertiary);
}

.btn-primary {
    background: var(--themeColor);
    color: white;
}

.btn-primary:hover {
    opacity: 0.9;
}

.btn-danger {
    background: #dc3545;
    color: white;
}

.btn-danger:hover {
    opacity: 0.9;
}

.add-source-form {
    padding: 16px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 4px;
    color: var(--fontColor-content);
    font-size: 0.9em;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--borderColor);
    border-radius: 4px;
    background: var(--backgroundColor-secondary);
    color: var(--fontColor-content);
    font-size: 1em;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
}
</style>
