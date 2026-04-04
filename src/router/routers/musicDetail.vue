<script>
import manager from '../../api/manager';
import powerTable_Music from '../../components/tracks/powerTable_music.vue';
import baseMethods from '../../js/baseMethods';

export default {
    data() {
        return {
            currentId: null,
            currentType: null,
            track: null,
            relatedTracks: [],
            isLoading: false
        };
    },
    components: { powerTable_Music },
    inject: ['player', 'regMessage'],
    watch: {
        $route: {
            handler(_result, __) {
                const newParams = _result.query;
                if (newParams.id != undefined && (newParams.id !== this.currentId || newParams.type !== this.currentType)) {
                    this.currentId = newParams.id;
                    this.currentType = newParams.type;
                    this.handleParamChange(newParams.id, newParams.type);
                }
            },
            deep: true,
            immediate: true,
        },
    },
    methods: {
        async handleParamChange(id, type) {
            this.isLoading = true;
            try {
                switch (type) {
                    case 'local':
                        await this.loadLocalTrack(id);
                        break;
                    case 'online':
                        // 在线音乐详情处理
                        break;
                    default:
                        await this.loadLocalTrack(id);
                        break;
                }
            } finally {
                this.isLoading = false;
            }
        },
        async loadLocalTrack(id) {
            // 从音乐列表中查找指定ID的音乐
            const musicList = manager.tauri.appLocalCache.musicList.data;
            this.track = musicList.find(track => String(track.id) === String(id)) || null;

            if (this.track) {
                // 查找相关音乐（同一专辑或同一艺人）
                this.relatedTracks = musicList.filter(t => {
                    if (String(t.id) === String(id)) return false;
                    // 同一专辑
                    if (t.al?.id && this.track.al?.id && t.al.id === this.track.al.id) return true;
                    // 同一艺人
                    if (t.ar?.[0]?.id && this.track.ar?.[0]?.id && t.ar[0].id === this.track.ar[0].id) return true;
                    return false;
                }).slice(0, 20); // 最多显示20首
            }
        },
        playTrack() {
            if (this.track) {
                this.player.push(this.track);
            }
        },
        playAll() {
            if (this.relatedTracks.length > 0) {
                this.player.replace([this.track, ...this.relatedTracks], 0);
            } else if (this.track) {
                this.player.push(this.track);
            }
        },
        goToArtist() {
            if (this.track?.ar?.[0]?.id && this.track.ar[0].id !== -2) {
                this.$router.push({
                    path: '/localArtist/',
                    query: {
                        id: this.track.ar[0].id,
                        type: 'local'
                    }
                });
            }
        },
        goToAlbum() {
            if (this.track?.al?.id && this.track.al.id !== -2) {
                this.$router.push({
                    path: '/localAlbum/',
                    query: {
                        id: this.track.al.id,
                        type: 'local'
                    }
                });
            }
        },
        formatDuration(seconds) {
            if (!seconds || seconds <= 0) return '--:--';
            return baseMethods.formatTime_MMSS(seconds);
        },
        getArtistsString(ar) {
            if (!ar || !Array.isArray(ar)) return '未知艺人';
            return ar.map(artist => artist.name).join(' & ');
        }
    }
}
</script>

<template>
    <div v-if="isLoading" class="loading">
        <i class="bi bi-hourglass-split"></i>
        <span>加载中...</span>
    </div>

    <div v-else-if="track" class="music-detail">
        <!-- 头部信息区 -->
        <div class="header-section">
            <div class="cover-section">
                <LazyLoadCoverImage class="cover-image" :id="track.al?.id || -2" />
            </div>

            <div class="info-section">
                <bodytitle :text="track.name" />

                <div class="meta-info">
                    <div class="meta-item" v-if="track.ar?.length > 0" @click="goToArtist">
                        <i class="bi bi-people"></i>
                        <span class="clickable">{{ getArtistsString(track.ar) }}</span>
                    </div>

                    <div class="meta-item" v-if="track.al?.name && track.al.id !== -2" @click="goToAlbum">
                        <i class="bi bi-disc"></i>
                        <span class="clickable">{{ track.al.name }}</span>
                    </div>

                    <div class="meta-item" v-if="track.duration">
                        <i class="bi bi-clock"></i>
                        <span>{{ formatDuration(track.duration) }}</span>
                    </div>

                    <div class="meta-item" v-if="track.genre">
                        <i class="bi bi-tag"></i>
                        <span>{{ track.genre }}</span>
                    </div>

                    <div class="meta-item" v-if="track.year">
                        <i class="bi bi-calendar"></i>
                        <span>{{ track.year }}</span>
                    </div>

                    <div class="meta-item" v-if="track.bitrate">
                        <i class="bi bi-soundwave"></i>
                        <span>{{ track.bitrate }} kbps</span>
                    </div>
                </div>

                <div class="action-buttons">
                    <iconWithText type="background" @click="playTrack">
                        <template #svg>
                            <i class="bi bi-play-fill"></i>
                        </template>
                        <template #text>播放</template>
                    </iconWithText>

                    <iconWithText type="background" @click="playAll" v-if="relatedTracks.length > 0">
                        <template #svg>
                            <i class="bi bi-collection-play"></i>
                        </template>
                        <template #text>播放全部相关</template>
                    </iconWithText>

                    <iconWithText type="background" @click="goToAlbum" v-if="track.al?.id && track.al.id !== -2">
                        <template #svg>
                            <i class="bi bi-disc"></i>
                        </template>
                        <template #text>查看专辑</template>
                    </iconWithText>

                    <iconWithText type="background" @click="goToArtist" v-if="track.ar?.[0]?.id && track.ar[0].id !== -2">
                        <template #svg>
                            <i class="bi bi-people"></i>
                        </template>
                        <template #text>查看艺人</template>
                    </iconWithText>
                </div>
            </div>
        </div>

        <!-- 详细信息区 -->
        <div class="detail-section" v-if="track.composer || track.lyricist || track.comment">
            <h3>详细信息</h3>
            <div class="detail-grid">
                <div class="detail-item" v-if="track.composer">
                    <span class="label">作曲:</span>
                    <span class="value">{{ track.composer }}</span>
                </div>
                <div class="detail-item" v-if="track.lyricist">
                    <span class="label">作词:</span>
                    <span class="value">{{ track.lyricist }}</span>
                </div>
                <div class="detail-item" v-if="track.comment">
                    <span class="label">注释:</span>
                    <span class="value">{{ track.comment }}</span>
                </div>
                <div class="detail-item" v-if="track.sampleRate">
                    <span class="label">采样率:</span>
                    <span class="value">{{ track.sampleRate }} Hz</span>
                </div>
                <div class="detail-item" v-if="track.channels">
                    <span class="label">声道:</span>
                    <span class="value">{{ track.channels }}</span>
                </div>
            </div>
        </div>

        <!-- 相关音乐列表 -->
        <div class="related-section" v-if="relatedTracks.length > 0">
            <h3>相关音乐 ({{ relatedTracks.length }}首)</h3>
            <p class="subtitle">来自同一专辑或同一艺人的音乐</p>
            <br />
            <powerTable_Music :tableData="{
                cellArray: relatedTracks
            }" />
        </div>
    </div>

    <div v-else class="empty-state">
        <i class="bi bi-music-note-slash"></i>
        <span>未找到音乐信息</span>
    </div>
</template>

<style scoped>
.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
    color: var(--fontColor-content-unimportant);
}

.loading i {
    font-size: 2rem;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
    color: var(--fontColor-content-unimportant);
}

.empty-state i {
    font-size: 3rem;
}

.music-detail {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.header-section {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
}

.cover-section {
    flex-shrink: 0;
}

.cover-image {
    width: 200px;
    height: 200px;
    border-radius: 12px;
    box-shadow: var(--Shadow-value-normal);
    aspect-ratio: 1 / 1;
}

.info-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 250px;
}

.meta-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--fontColor-content-unimportant);
    font-size: 0.95rem;
}

.meta-item i {
    width: 1.2rem;
    text-align: center;
}

.meta-item .clickable {
    cursor: pointer;
    transition: color 0.2s;
}

.meta-item .clickable:hover {
    color: var(--fontColor-content);
    text-decoration: underline;
}

.action-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
}

.detail-section {
    background-color: #00000007;
    border-radius: 12px;
    padding: 1.5rem;
}

.detail-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--fontColor-content);
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem 1.5rem;
}

.detail-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.9rem;
}

.detail-item .label {
    color: var(--fontColor-content-unimportant);
    min-width: 4rem;
}

.detail-item .value {
    color: var(--fontColor-content);
}

.related-section h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--fontColor-content);
}

.related-section .subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.85rem;
    color: var(--fontColor-content-unimportant);
}

@media (max-width: 600px) {
    .header-section {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .cover-image {
        width: 150px;
        height: 150px;
    }

    .action-buttons {
        justify-content: center;
    }

    .detail-grid {
        grid-template-columns: 1fr;
    }
}
</style>
