<script>
import topBar from './components/topBar.vue'
import rightBlock from './components/rightBlock.vue'
import leftBar from './components/leftBar.vue'
import musicInfoPage from './components/musicInfoPage.vue'
import manager from './api/manager'
import messageDisplay from './components/messageDisplay.vue'
import oobe from './components/oobe.vue'
import { computed, ref, markRaw } from 'vue'
import { createMusicPlayer, FixedStrategy } from './module/musicPlayer/index.js'

const ALL_PLAY_MODES = ['loopPlaylist', 'loopSingle', 'stopAfterSingle', 'randomPlay', 'smartRecommend']

export default {
    name: 'app',
    components: {
        topBar,
        leftBar,
        rightBlock,
        musicInfoPage,
        messageDisplay,
        oobe
    },
    data() {
        return {
            leftBarState: 'short',
            player: null,
            playerState: ref({
                playing: false,
                currentTime: 0,
                currentTimeRounded: 0,
                duration: 0,
                durationRounded: 0,
                volume: 1,
                loading: false,
                error: null,
                canplay: false,
                currentTrack: null,
                currentIndex: 0,
                playMode: 'loopPlaylist',
            }),
            scrollState: {
                scrollTop: 0,
                scrollSize: 0
            },
            titles: [],
            _trackVersion: 0,
            title: {
                type: 'text',
                text: '主页',
                components: []
            },
            titleOffsetTop: 0,
            config: {
                language: 'zh_cn',
                audio: {
                    smartStreamAudioList: true,
                    audioStreamDuration: 7,
                    audioStateHandlerTPS: 20
                },
                ui: {
                    musicDetailFontScale: 1,
                    musicDetailFontSizeAdaptive: true,
                    lyricComponentStyle: 'normal',
                    dynamicBackground: false,
                    wordByWordLyrics: true,
                    lyricBlurEffect: false,
                    lyricAnimationType: 'spring',
                    lyricAnimationPreset: {
                        spring: { mass: 1, stiffness: 95, damping: 14.5 },
                        cubic_bezier: [[.3, .7], [.2, 1]]
                    },
                    lyricScrollDelayPropagation: true,
                    lyricScrollDelayAmount: 50,
                }
            },
            appState: {
                runOnTauri: (window.__TAURI_INTERNALS__) ? true : false,
                screenType: null,
            },
            source: {
                local: {
                    musicList: { lastUpdateTimestamp: 0, data: [] },
                    folders: { lastUpdateTimestamp: 0, data: [] },
                    albums: { lastUpdateTimestamp: 0, data: [] },
                    artists: { lastUpdateTimestamp: 0, data: [] },
                },
                online: [{
                    name: 'API1',
                    type: 'NeteaseCloudMusicApi',
                    apiUrl: 'http://localhost:3000/'
                }]
            },
            resizeEvent: {},
            messageList: []
        }
    },
    provide() {
        return {
            scrollState: computed(() => this.scrollState),
            leftBarState: computed(() => this.leftBarState),
            config: computed(() => this.config),

            // 播放器实例 + 响应式状态
            player: computed(() => this.player),
            playerState: computed(() => this.playerState),

            // 旧版兼容适配层
            currentMusicInfo: computed(() => this.playerState.currentTrack || { id: -2, name: '', al: { id: -2, name: '' }, ar: [] }),
            audioManager: computed(() => this.player?.engine || null),
            audioState: computed(() => ({
                playing: this.playerState.playing,
                currentTime: this.playerState.currentTime,
                currentTime_round: this.playerState.currentTimeRounded,
                duration: this.playerState.duration,
                duration_round: this.playerState.durationRounded,
                volume: this.playerState.volume,
                loading: this.playerState.loading,
                canplay: this.playerState.canplay,
                error_onloadSrc: !!this.playerState.error,
            })),
            trackState: computed(() => ({
                playMode: this.playerState.playMode,
                allPlayModes: ALL_PLAY_MODES,
            })),
            musicTrack: computed(() => {
                // 依赖 _trackVersion 以确保 trackList 变化时重新计算
                this._trackVersion;
                const tracks = this.player?.trackList?.getAll() || [];
                return tracks.length > 0 ? tracks : [{ id: -2, name: '请选择您的音乐' }];
            }),
            musicTrackIndex: computed(() => this.playerState.currentIndex),

            // 兼容的播放操作方法
            pushMusic: (song) => this.player?.pushMusic(song),
            pushMusicTrack: (tracks) => this.player?.pushMusicTrack(tracks),
            coverMusicTrack: (tracks, index) => this.player?.coverMusicTrack(tracks, index),
            cleanUpMusicTrack: () => this.player?.cleanUpMusicTrack(),
            checkMusicListIsEmpty: () => !this.player?.trackList || this.player.trackList.isEmpty(),
            nextMusic: (index) => this.player?.next(),
            prevMusic: () => this.player?.prev(),
            changePlayMode: () => this.player?.cyclePlayMode(),
            getNextMusicIndex: () => this.player?.trackList?.getNextIndex(this.playerState.playMode) || 0,
            getPrevMusicIndex: () => this.player?.trackList?.getPrevIndex(this.playerState.playMode) || 0,

            // 非播放器提供
            editConfig: this.editConfig,
            setScrollState: this.setScrollState,
            regTitle: this.regTitle,
            appState: computed(() => this.appState),
            source: computed(() => ({
                local: this.source.local,
                online: this.source.online
            })),
            regResizeHandle: this.regResizeHandle,

            messageList: computed(() => this.messageList),
            regMessage: this.regMessage,
            getAllMessages: this.getAllMessages,
            destoryMessage: this.destoryMessage,
        };
    },
    methods: {
        regResizeHandle(key, event) {
            this.resizeEvent[key] = event;
            return {
                cancelReg: () => { delete this.resizeEvent[key] }
            }
        },
        handleResize() {
            for (const key in this.resizeEvent) {
                if (Object.prototype.hasOwnProperty.call(this.resizeEvent, key)) {
                    this.resizeEvent[key]()
                }
            }
            const width = window.innerWidth;
            if (width >= 768) {
                this.appState.screenType = 'landscape';
            } else if (width >= 480) {
                this.appState.screenType = 'portrait';
            } else {
                this.appState.screenType = 'mini';
            }
        },
        regTitle(detail = { type: 'text', text: '主页', components: [] }, offsetTop, minHiddenTop) {
            let currentIndex = this.title.length;
            this.titles.push({ detail, offsetTop, minHiddenTop });
            this.titles.sort((a, b) => a.offsetTop - b.offsetTop);
            this.updateTitle();
            return {
                cancelReg: () => {
                    const index = this.titles.findIndex(title => title.offsetTop === offsetTop);
                    if (index !== -1) this.titles.splice(index, 1);
                }
            };
        },
        setScrollState(state) {
            this.scrollState = state;
            this.updateTitle();
        },
        updateTitle() {
            let activeTitle = null;
            let titleOffsetTop = 0;
            for (let title of this.titles) {
                if (title.offsetTop - this.scrollState.scrollTop < title.minHiddenTop) {
                    activeTitle = title;
                    titleOffsetTop = title.offsetTop - this.scrollState.scrollTop;
                } else {
                    break;
                }
            }
            if (activeTitle) {
                this.title = activeTitle;
                this.titleOffsetTop = titleOffsetTop;
            }
        },
        editConfig(editEvent) {
            this.config = editEvent(this.config)
        },
        async getAllMessages() {
            return this.messageList;
        },
        regMessage(message) {
            let timeStamp = Date.now()
            message["timeStamp"] = timeStamp
            let currentIndex = this.messageList.length;
            if (message.type == 'LongMessage') {
                let longMessageIndex = this.messageList.findIndex(_message => _message.content == message.content)
                if (longMessageIndex != -1) {
                    this.messageList[longMessageIndex].repeatTimes++;
                    return {
                        destoryMessage: () => {
                            if (this.messageList[longMessageIndex].repeatTimes > 1) {
                                this.messageList[longMessageIndex].repeatTimes--;
                                return;
                            }
                            this.messageList[longMessageIndex].state = 'hidden';
                            setTimeout(() => {
                                if (this.messageList[longMessageIndex].repeatTimes == 1) {
                                    this.messageList = this.messageList.filter(_message => _message.content != message.content);
                                    return;
                                }
                            }, 260);
                        }
                    }
                }
            }
            this.messageList.push(message);
            switch (message.type) {
                case 'Message':
                    break;
                case 'Alert':
                    break;
                case 'LongMessage':
                    this.messageList[currentIndex]['repeatTimes'] = 1;
                    this.messageList[currentIndex]['state'] = 'display';
                    return {
                        destoryMessage: () => {
                            if (this.messageList[currentIndex].repeatTimes > 1) {
                                this.messageList[currentIndex].repeatTimes--;
                                return;
                            }
                            this.messageList[currentIndex].state = 'hidden';
                            setTimeout(() => {
                                if (this.messageList[currentIndex].repeatTimes == 1) {
                                    this.messageList = this.messageList.filter(_message => _message.content != message.content);
                                    return;
                                }
                            }, 260);
                        }
                    }
                    break;
                default:
                    setTimeout(() => {
                        this.messageList = this.messageList.filter(_message => _message.timeStamp != timeStamp);
                    }, message.leastTime || 7 * 1000);
                    return this.messageList.length - 1
                    break;
            }
        },
        destoryMessage(index) {
            if (this.messageList[index]) {
                this.messageList[index].state = 'hidden';
                setTimeout(() => {
                    this.messageList = this.messageList.filter((_, i) => i != index);
                }, 260);
            }
        },
    },
    computed: {},
    beforeUnmount() {
        if (this.player) this.player.destroy()
    },
    created() {
        this.appState.runOnTauri = (window.__TAURI_INTERNALS__) ? true : false;
        window.addEventListener('resize', () => { this.handleResize() })
    },
    mounted() {
        // 初始化播放器（markRaw 防止 Vue reactive proxy 破坏 # 私有字段）
        this.player = markRaw(createMusicPlayer({
            apiAdapter: manager.tauri,
            config: {
                smartStreamAudioList: this.config.audio.smartStreamAudioList,
                audioStreamDuration: this.config.audio.audioStreamDuration,
                audioStateHandlerTPS: this.config.audio.audioStateHandlerTPS,
            },
        }));

        // 同步播放器状态到响应式 playerState
        const syncState = (state) => {
            this.playerState.playing = state.playing;
            this.playerState.currentTime = state.currentTime;
            this.playerState.currentTimeRounded = state.currentTimeRounded;
            this.playerState.duration = state.duration;
            this.playerState.durationRounded = state.durationRounded;
            this.playerState.volume = state.volume;
            this.playerState.loading = state.loading;
            this.playerState.error = state.error;
            this.playerState.canplay = state.canplay;
            this.playerState.playMode = this.player.playMode;
            this.playerState.currentTrack = this.player.currentTrack;
            this.playerState.currentIndex = this.player.currentIndex;
        };

        this.player.events.on('stateChange', syncState);

        this.player.events.on('trackChange', ({ track, index }) => {
            this.playerState.currentTrack = track;
            this.playerState.currentIndex = index;
            this._trackVersion++;
        });

        // 监听歌单变更，确保 musicTrack computed 及时更新
        this.player.events.on('listChange', () => { this._trackVersion++; });
        this.player.events.on('listReplace', () => { this._trackVersion++; });
        this.player.events.on('listAdd', () => { this._trackVersion++; });
        this.player.events.on('listRemove', () => { this._trackVersion++; });
        this.player.events.on('listClear', () => { this._trackVersion++; });

        this.player.events.on('playModeChange', ({ playMode }) => {
            this.playerState.playMode = playMode;
            let modeName = {
                'loopPlaylist': "列表循环", 'loopSingle': '单曲循环',
                'stopAfterSingle': '播完本曲暂停', 'randomPlay': '随机播放',
                'smartRecommend': '智能推荐'
            };
            this.regMessage({ type: 'Message', content: '播放模式已经调为 ' + (modeName[playMode] || playMode) });
        });

        this.player.events.on('error', ({ message }) => {
            console.error('[Player]', message);
        });

        // 当tauri API存在时，初始化本地资源
        if (this.appState.runOnTauri) {
            const loadInitialData = async () => {
                try {
                    await manager.tauri.initApplication();
                    await manager.tauri.getMusicList();
                    await manager.tauri.getAllMusicDirs();
                    await manager.tauri.getAlbums();
                    await manager.tauri.getArtists();
                } catch (error) {
                    console.error('初始化数据加载失败:', error);
                }
            };

            this.source.local = {
                get musicList() { return manager.tauri.appLocalCache.musicList; },
                get folders() { return manager.tauri.appLocalCache.folders; },
                get albums() { return manager.tauri.appLocalCache.albums; },
                get artists() { return manager.tauri.appLocalCache.artists; }
            };

            const createUpdateListener = (type) => {
                return (newData) => {
                    console.log(`Cache updated for ${type},length:`, newData.length);
                    this.source.local[type].data = newData;
                    this.source.local[type].lastUpdateTimestamp = Date.now();
                };
            };

            manager.tauri.onCacheUpdate('musicList', createUpdateListener('musicList'));
            manager.tauri.onCacheUpdate('folders', createUpdateListener('folders'));
            manager.tauri.onCacheUpdate('albums', createUpdateListener('albums'));
            manager.tauri.onCacheUpdate('artists', createUpdateListener('artists'));

            loadInitialData();
        }
    },
    watch: {}
}
</script>

<template>
    <oobe />
    <messageDisplay />
    <topBar :titleOffsetTop="titleOffsetTop" :leftBarState="leftBarState">
        <template #title>
            <textspawn :text="this.title.detail" />
        </template>
    </topBar>

    <div class="bottom">
        <leftBar @leftBarChange="(newState) => { leftBarState = newState }">
            <template #buttons>
                <iconWithText style="width: 100%;" @click="this.$router.push('/')"
                    :type="(leftBarState == 'short') ? 'hidden' : null">
                    <template #svg>
                        <i class="bi bi-house-fill"></i>
                    </template>
                    <template #text>
                        音乐库
                    </template>
                </iconWithText>

                <iconWithText style="width: 100%;" @click="this.$router.push('/')"
                    :type="(leftBarState == 'short') ? 'hidden' : null">
                    <template #svg>
                        <i class="bi bi-collection-fill"></i>
                    </template>
                    <template #text>
                        我的收藏
                    </template>
                </iconWithText>

                <iconWithText style="width: 100%;" @click="this.$router.push('/search/')"
                    :type="(leftBarState == 'short') ? 'hidden' : null">
                    <template #svg>
                        <i class="bi bi-search"></i>
                    </template>
                    <template #text>
                        搜索
                    </template>
                </iconWithText>
                <!--placeholder-->
                <div style="margin-top: auto;"></div>

                <iconWithText style="width: 100%;" @click="this.$router.push('/musicTrack/')"
                    :type="(leftBarState == 'short') ? 'hidden' : null">
                    <template #svg>
                        <i class="bi bi-music-note-list"></i>
                    </template>
                    <template #text>
                        播放列表
                    </template>
                </iconWithText>
                <iconWithText style="width: 100%;" @click="this.$router.push('/setting/')"
                    :type="(leftBarState == 'short') ? 'hidden' : null">
                    <template #svg>
                        <i class="bi bi-gear-fill"></i>
                    </template>
                    <template #text>
                        设置
                    </template>
                </iconWithText>
            </template>
        </leftBar>
        <rightBlock :leftBarState="leftBarState"></rightBlock>
    </div>

    <musicInfoPage></musicInfoPage>
</template>

<style scoped>
.bottom {
    display: flex;
    height: calc(100vh - 48px);
    width: fit-content;
    z-index: 1;
    margin-left: -8px;
}
</style>
