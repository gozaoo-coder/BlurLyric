<script>
import topBar from './components/topBar.vue'
import rightBlock from './components/rightBlock.vue'
import leftBar from './components/leftBar.vue'
import musicInfoPage from './components/musicInfoPage.vue'
import manager from './api/manager'
import messageDisplay from './components/messageDisplay.vue'
import oobe from './components/oobe.vue'
import { createPlayer } from './module/musicPlayer'
import {
    computed,
    ref,
    onMounted,
    markRaw
} from 'vue'

let templateEmptyMusicTrack = [{
    name: "请选择您的音乐",
    id: -2,
    ar: [{
        id: -2,
        name: "享受 BlurLyric 为您带来的舒适体验",
        alias: []
    }],
    lyric: {
        type: "yrc",
        lines: [{
            startTime: 0,
            duration: 2,
            endTime: 2,
            words: [{
                startTime: 0,
                duration: 1,
                endTime: 1,
                word: "Hello "
            },
            {
                startTime: 1,
                duration: 0.5,
                endTime: 1.5,
                word: "World"
            }
            ],
            text: "Hello World"
        }]
    },
    al: {
        id: -2,
        name: "",
        picUrl: "&quot;&quot;",
    },
    src: null
}]

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
            player: null,
            leftBarState: 'short',
            musicTrack: null,
            scrollState: {
                scrollTop: 0,
                scrollSize: 0
            },
            titles: [

            ],
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
                    audioStateHandlerTPS: 20,
                    manualTransitionDuration: 3000
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
                        spring: {
                            mass: 1,
                            stiffness: 95,
                            damping: 14.5
                        },
                        cubic_bezier: [
                            [.3, .7],
                            [.2, 1]
                        ]
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
                    musicList: {
                        lastUpdateTimestamp: 0,
                        data: []
                    },
                    folders: {
                        lastUpdateTimestamp: 0,
                        data: []
                    },
                    albums: {
                        lastUpdateTimestamp: 0,
                        data: []
                    },
                    artists: {
                        lastUpdateTimestamp: 0,
                        data: []
                    },
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
            player: computed(() => this.player),
            scrollState: computed(() => this.scrollState),
            leftBarState: computed(() => this.leftBarState),
            config: computed(() => this.config),

            source: computed(() => ({
                local: this.source.local,
                online: this.source.online
            })),

            editConfig: this.editConfig,

            setScrollState: this.setScrollState,
            regTitle: this.regTitle,

            appState: computed(() => this.appState),
            regResizeHandle: this.regResizeHandle,

            messageList: computed(() => this.messageList),
            regMessage: this.regMessage,
            getAllMessages: this.getAllMessages,
            destoryMessage: this.destoryMessage,

            musicTrack: computed(() => this.musicTrack),
            pushMusic: this.pushMusic,
            coverMusicTrack: this.coverMusicTrack,
            nextMusic: this.nextMusic,
            testMusic: (track) => {
                if (!this.player || !track) return;
                this.player.replace([track], 0);
                this.musicTrack = [track];
                this.player.loadAndPlay(0).catch(() => {});
            },

        };
    },
    methods: {
        regResizeHandle(key, event) {
            this.resizeEvent[key] = event;
            return {
                cancelReg: () => {
                    delete this.resizeEvent[key]
                }
            }
        },
        handleResize() {
            for (const key in this.resizeEvent) {
                if (Object.prototype.hasOwnProperty.call(this.resizeEvent, key)) {
                    const element = this.resizeEvent[key];
                    element()
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

        regTitle(detail = {
            type: 'text',
            text: '主页',
            components: []
        }, offsetTop, minHiddenTop) {
            let currentIndex = this.title.length;
            this.titles.push({
                detail,
                offsetTop,
                minHiddenTop
            });

            this.titles.sort((a, b) => a.offsetTop - b.offsetTop);

            this.updateTitle();

            return {
                cancelReg: () => {
                    const index = this.titles.findIndex(title => title.offsetTop === offsetTop);
                    if (index !== -1) {
                        this.titles.splice(index, 1);
                    }
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

        pushMusic(track) {
            if (!this.player || !track) return;
            this.player.push(track);
            this.musicTrack = this.player.playlist.getAll();
        },

        coverMusicTrack(tracks, startIndex = 0) {
            if (!this.player || !tracks?.length) return;
            this.player.replace(tracks, startIndex);
            this.musicTrack = tracks;
            this.player.loadAndPlay(startIndex).catch(() => {});
        },

        nextMusic(index) {
            if (!this.player) return;
            this.player.switchTo(index);
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
    },
    computed: {
    },
    beforeUnmount() {
        if (this.player) this.player.destroy()
    },
    created() {
        this.appState.runOnTauri = (window.__TAURI_INTERNALS__) ? true : false;

        window.addEventListener('resize', () => {
            this.handleResize()
        })
    },
    async mounted() {
        this.player = markRaw(await createPlayer({
            config: this.config.audio
        }));

        this.player.replace(templateEmptyMusicTrack);

        this.player.events.on('player:playModeChange', ({ label }) => {
            this.regMessage({
                type: 'Message',
                content: '播放模式已经调为 ' + label
            });
        });

        this.player.events.on('player:playlistReplace', ({ tracks }) => {
            this.regMessage({
                type: 'Message',
                content: `已替换播放列表，共 ${tracks.length} 首音乐`
            });
        });

        this.player.events.on('player:playlistPush', (data) => {
            const count = data.track ? 1 : (data.tracks?.length ?? 0);
            this.regMessage({
                type: 'Message',
                content: `已添加 ${count} 首音乐至播放列表`
            });
        });

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
                get musicList() {
                    return manager.tauri.appLocalCache.musicList;
                },
                get folders() {
                    return manager.tauri.appLocalCache.folders;
                },
                get albums() {
                    return manager.tauri.appLocalCache.albums;
                },
                get artists() {
                    return manager.tauri.appLocalCache.artists;
                }
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
                <!--音乐库-->
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
                
                <iconWithText style="width: 100%;" @click="this.$router.push('/allLocalArtist/')"
                    :type="(leftBarState == 'short') ? 'hidden' : null">
                    <template #svg>
                        <i class="bi bi-person-fill"></i>
                    </template>
                    <template #text>
                        本地艺人
                    </template>
                </iconWithText>
                
                <iconWithText style="width: 100%;" @click="this.$router.push('/allLocalAlbum/')"
                    :type="(leftBarState == 'short') ? 'hidden' : null">
                    <template #svg>
                        <i class="bi bi-disc-fill"></i>
                    </template>
                    <template #text>
                        本地专辑
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
