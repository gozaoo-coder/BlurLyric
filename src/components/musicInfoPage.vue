<script>
import lazyLoadCoverImage from './base/lazyLoadCoverImage.vue';
import buttom_icon_circleBackground from './base/buttom_icon_circleBackground.vue';
import playModeSvg from './musicInfoPageComponents/playModeSvg.vue';
import drag from '../js/drag';
import textSpawn from './base/text-spawn.vue';
import anime from 'animejs';
import background from './musicInfoPageComponents/background.vue';
import ProgressBar from './musicInfoPageComponents/ProgressBar.vue';
import AdaptiveLayout from './musicInfoPageComponents/AdaptiveLayout.vue';
import { useViewportAdapter } from './musicInfoPageComponents/composables/useViewportAdapter.js';
import {
    computed,
} from 'vue'
import baseMethods from '../js/baseMethods';

const EMPTY_TRACK = {
    id: -2,
    name: '',
    ar: [],
    al: { id: -2, name: '', picUrl: '' }
};

function safePlayer(player) {
    return player || {
        state: { currentTrack: EMPTY_TRACK, playing: false, currentTime: 0, duration: 1, currentTimeRound: 0, durationRound: 0, currentIndex: 0 },
        playMode: 'loopPlaylist',
        playlist: { getAll: () => [], getNextIndex: () => 0 },
        audioEngine: { play() {}, pause() {} },
        next() {},
        prev() {},
        play() {},
        pause() {},
        cyclePlayMode() {},
        seekByProgress() {},
        switchTo() {}
    };
}

export default {
    setup() {
        const viewportAdapter = useViewportAdapter();
        return {
            deviceType: viewportAdapter.deviceType,
            displayMode: viewportAdapter.displayMode,
            setDisplayMode: viewportAdapter.setDisplayMode,
            isDesktop: viewportAdapter.isDesktop,
            isMobile: viewportAdapter.isMobile,
            isSquare: viewportAdapter.isSquare,
            isStrip: viewportAdapter.isStrip,
        };
    },
    data() {
        return {
            baseMethods,
            style: {
                musicDetailRender: {
                    transformX: 0,
                }
            },

            UIScale_userSet: 1,
            UIScale_autoSet: 1,
            maxColumnWidth: "min(50vh, 40vw)",

            dragInfo: null,

            musicInfoPagePosition: 'bottom',

            eventListenerRemovers: [],
            cancelCoverBindReg: () => { },

            changePositionTimeStamps: 0,

            activeAnimations: [],
            activeTimeouts: []
        }
    },
    computed: {
        p() {
            return safePlayer(this.player);
        },
        progress: function () {
            const s = this.p.state;
            if (!s.duration || s.duration <= 0) return 0;
            return Number((s.currentTime / s.duration).toFixed(3));
        },
        nextTrackName: function () {
            const p = this.p;
            const playlist = p.playlist.getAll();
            const nextIndex = p.playlist.getNextIndex ? p.playlist.getNextIndex() : 0;
            if (p.playMode === 'randomPlay') {
                return '随机播放';
            }
            return playlist[nextIndex]?.name || '';
        },
        playlistTracks() {
            return this.p.playlist.getAll();
        },
        UIScale() {
            const scale = this.UIScale_userSet !== 1 ? this.UIScale_userSet : this.UIScale_autoSet;
            return scale + 'rem';
        }
    },
    components: {
        lazyLoadCoverImage,
        buttom_icon_circleBackground,
        playModeSvg,
        textSpawn,
        background,
        ProgressBar,
        AdaptiveLayout,
    },
    provide() {
        return {
            musicInfoPagePositionState: computed(() => this.musicInfoPagePosition)
        }
    },
    inject: ['player', 'regResizeHandle', 'config', 'scrollState'],
    mounted() {
        this.onBottomListener();
    },
    beforeUnmount() {
        this.eventListenerRemovers.map((value) => value())
        this.cancelAllAnimationsAndTimeouts()
    },
    methods: {
        cancelAllAnimationsAndTimeouts() {
            this.activeAnimations.forEach(anim => {
                if (anim && typeof anim.pause === 'function') {
                    anim.pause()
                }
            })
            this.activeAnimations = []

            this.activeTimeouts.forEach(timeoutId => {
                clearTimeout(timeoutId)
            })
            this.activeTimeouts = []
        },

        trackAnimation(anim) {
            if (anim) {
                this.activeAnimations.push(anim)
            }
            return anim
        },

        trackTimeout(callback, delay) {
            const timeoutId = setTimeout(() => {
                const index = this.activeTimeouts.indexOf(timeoutId)
                if (index > -1) {
                    this.activeTimeouts.splice(index, 1)
                }
                callback()
            }, delay)
            this.activeTimeouts.push(timeoutId)
            return timeoutId
        },
        toTop(info) {
            this.cancelAllAnimationsAndTimeouts()

            this.eventListenerRemovers.forEach((value) => value());

            this.onTopListener();
            this.musicInfoPagePosition = "toTop";

            let timeStamps = Date.now();
            this.changePositionTimeStamps = timeStamps;

            const stillIsThisAnimation = () => this.changePositionTimeStamps == timeStamps;

            this.trackAnimation(anime({
                targets: this.$refs.musicInfoPageRow,
                easing: 'spring(1, 80, 16,' + Math.abs(info.speedY).toFixed(2) + ')',
                translateY: -document.body.offsetHeight + 'px',
                complete: () => {
                    if (stillIsThisAnimation()) {
                        this.musicInfoPagePosition = "top";
                    }
                }
            }));

            this.trackAnimation(anime({
                targets: this.$refs.musicControlBar,
                opacity: 0,
                easing: 'linear',
                duration: 100
            }));

            this.trackAnimation(anime({
                targets: this.style.musicDetailRender,
                transformX: 1,
                easing: 'linear',
                duration: 100
            }));

            this.trackTimeout(() => {
                if (stillIsThisAnimation()) {
                    anime.set(this.$refs.musicInfoPageRow, {
                        background: 'rgb(233,233,233)',
                        backdropFilter: 'blur(0px)'
                    });
                }
            }, 300);

            this.trackTimeout(() => {
                if (stillIsThisAnimation()) {
                    this.trackAnimation(anime({
                        targets: this.$refs.mainContainer,
                        opacity: 1,
                        easing: 'linear',
                        duration: 100,
                    }));
                }
            }, 100);


            let position_bind = (speed) => {

                anime.set(this.$refs.musicInfoPageRow, {
                    translateY: -document.body.offsetHeight + 'px',
                })
                cover_position_bind(speed)
            }
            let cover_position_bind = (speed) => {
                let coverImagePlaceHolder = this.$refs.adaptiveLayoutRef?.coverImagePlaceHolder;
                if (!coverImagePlaceHolder) return;

                let positionData = coverImagePlaceHolder.getBoundingClientRect()

                this.trackAnimation(anime({
                    targets: this.$refs.cover,
                    easing: 'spring(1, 80, 15,' + speed + ')',
                    width: positionData.width,
                    height: positionData.height,
                    translateY: (coverImagePlaceHolder.offsetTop) + 'px',
                    translateX: positionData.x + 'px'
                }))
            }
            this.$nextTick(() => { cover_position_bind(Math.abs(info.speedY).toFixed(2)) })
            this.cancelCoverBindReg = this.regResizeHandle('coverMove', () => { position_bind(0) }).cancelReg

        },

        toBottom(info) {
            this.cancelAllAnimationsAndTimeouts()

            this.musicInfoPagePosition = "toBottom";

            this.cancelCoverBindReg();

            this.eventListenerRemovers.forEach((value) => value());
            const timeStamps = Date.now();
            this.changePositionTimeStamps = timeStamps;

            const stillIsThisAnimation = () => this.changePositionTimeStamps === timeStamps;

            anime.set(this.$refs.musicInfoPageRow, {
                background: 'rgba(0, 0, 0, 0.0625)',
                backdropFilter: 'blur(30px)'
            });

            this.trackAnimation(anime({
                targets: this.$refs.musicInfoPageRow,
                easing: 'spring(1, 80, 16,' + Math.abs(info.speedY).toFixed(2) + ')',
                translateY: -88,
                complete: () => {
                    if (stillIsThisAnimation()) {
                        this.musicInfoPagePosition = "bottom";
                    }
                }
            }));

            this.trackAnimation(anime({
                targets: this.$refs.musicControlBar,
                opacity: 1,
                easing: 'linear',
                duration: 300,
                delay: 300,
            }));

            this.trackAnimation(anime({
                targets: this.$refs.mainContainer,
                opacity: 0,
                easing: 'linear',
                duration: 100,
            }));

            this.trackAnimation(anime({
                targets: this.$refs.cover,
                width: 54,
                height: 54,
                easing: 'spring(1, 80, 15,' + Math.abs(info.speedY).toFixed(2) + ')',
                translateY: 17,
                translateX: 17
            }));

            this.onBottomListener();
        },

        onBottomListener() {
            let musicControlBar_animeJsCallBack = null
            let lastTransformX, lastTransformY
            const p = this.p;
            let callBack_drag = drag.create(this.$refs.musicControlBar,
                (info) => {
                    lastTransformX = this.style.musicDetailRender.transformX
                    if (musicControlBar_animeJsCallBack != null) musicControlBar_animeJsCallBack.pause()

                    if (info.offsetDirectionX != 'none') {
                        this.style.musicDetailRender.transformX = info.offsetX + lastTransformX
                    }
                    anime.set(this.$refs.musicInfoPageRow, {
                        backdropFilter: 'blur(30px)',
                    })

                    this.dragInfo = info
                },
                (info) => {

                    if (info.offsetDirectionX != 'none') {
                        this.style.musicDetailRender.transformX = info.offsetX + lastTransformX
                    }

                    if (info.offsetY < -100 || info.speedY < -1.5) {
                        if (navigator.vibrate) navigator.vibrate(50);
                        this.toTop(info)
                    }
                    this.dragInfo = info

                },
                (info) => {

                    if (info.offsetX < -100 || info.speedX < -1) {
                        if (navigator.vibrate) navigator.vibrate(50);
                        p.next({ isManual: true })
                    }
                    if (info.offsetX > 100 || info.speedX > 1) {
                        if (navigator.vibrate) navigator.vibrate(50);
                        p.prev({ isManual: true })
                    }
                    musicControlBar_animeJsCallBack = anime({
                        targets: this.style.musicDetailRender,
                        transformX: 0,
                        easing: 'spring(1, 80, 14,0)'
                    })


                    this.dragInfo = null

                })

            this.eventListenerRemovers.push(callBack_drag.destroy)
        },
        onTopListener() {

            let callBack_drag = drag.create(this.$refs.cover,
                (info) => {
                    this.dragInfo = info

                },
                (info) => {

                    if (info.offsetY < -100 || info.speedY > 1.5) {

                        if (navigator.vibrate) navigator.vibrate(50);
                        this.toBottom(info)
                    }
                    this.dragInfo = info

                },
                (info) => {

                })
            this.eventListenerRemovers.push(callBack_drag.destroy)
        },

        handleModeChange(mode) {
            this.setDisplayMode(mode);
        },
        handleSwitchTrack(index) {
            this.p.switchTo(index);
        },
        handleSwipeDown() {
            this.toBottom({ speedY: 1.5 });
        },
        handleDetailClick() {
            // placeholder for detail click handling
        }
    }
}
</script>
<template>
    <div ref="musicInfoPageRow" style="
        transform: translateY(-88px);background:rgba(0,0,0,0.0625);
        " class="global_backgroundblur_light musicInfoPageRow">

        <div :class="['relativeBox', `mode-${deviceType}`]">

            <div ref="cover" style="transform: translateX(17px) translateY(17px); " class="cover">
                <lazyLoadCoverImage class="blur" :id="p.state.currentTrack.al.id"></lazyLoadCoverImage>
                <lazyLoadCoverImage :maxResolution="0" :id="p.state.currentTrack.al.id"></lazyLoadCoverImage>
            </div>

            <ProgressBar ref="barProgressBar" variant="bar" :progress="progress" />

            <div ref="musicControlBar" class="musicControlBar">
                <div class="cover placeholder">
                </div>
                <div ref="barDetail" class="detail">
                    <div :style="{
                        transform: 'translateX(' + style.musicDetailRender.transformX + 'px)'
                    }" class="dragRender">
                        <div class="prev">
                            <div class="event">上一首</div>
                            <div class="name">{{ nextTrackName }}</div>
                        </div>
                        <div class="currentMusic">
                            <div class="name">
                                <textSpawn :text="p.state.currentTrack.name" />
                            </div>
                            <div class="artists">
                                <span v-for="(value, index) in p.state.currentTrack.ar" :key="index">
                                    <textSpawn
                                        :text="value.name + ((index != p.state.currentTrack.ar.length - 1) ? '/' : '')" />
                                </span>
                                <span v-if="p.state.currentTrack.al.id != -2"> - </span>{{ p.state.currentTrack.al.name }}
                            </div>
                        </div>
                        <div class="next">
                            <div class="event">下一首</div>
                            <div v-if="p.playMode != 'randomPlay'" class="name">
                                {{ nextTrackName }}</div>
                            <div v-if="p.playMode == 'randomPlay'" class="name">随机播放</div>
                        </div>
                    </div>
                </div>
                <div v-show="p.state.currentTrack.id != -2" class="control">
                    <buttom_icon_circleBackground @click="p.prev({ isManual: true })">
                        <template #icon>
                            <i class="bi bi-skip-start-fill"></i>
                        </template>
                    </buttom_icon_circleBackground>
                    <buttom_icon_circleBackground
                        @click="(p.state.playing == true) ? p.pause() : p.play()"
                        class="playButtom">
                        <template #icon>
                            <div style="transform: scale(1.5);transform-origin: 50% 50%;">
                                <i v-if="p.state.playing == true" class="bi bi-pause-fill"></i>
                                <i v-if="p.state.playing == false" class="bi bi-play-fill"></i>
                            </div>
                        </template>
                    </buttom_icon_circleBackground>
                    <buttom_icon_circleBackground @click="p.next({ isManual: true })">
                        <template #icon>
                            <i class="bi bi-skip-end-fill"></i>
                        </template>
                    </buttom_icon_circleBackground>
                    <buttom_icon_circleBackground @click="p.cyclePlayMode()">
                        <template #icon>
                            <playModeSvg style="transform: scale(.7) translateY(1%);transform-origin: 50% 50%;">
                            </playModeSvg>
                        </template>
                    </buttom_icon_circleBackground>
                    <buttom_icon_circleBackground>
                        <template #icon>
                            <i style="transform: scale(.7) translateY(1%);transform-origin: 50% 50%;"
                                class="bi-volume-up bi"></i>
                        </template>
                    </buttom_icon_circleBackground>
                    <buttom_icon_circleBackground>
                        <template #icon>
                            <i style="transform: scale(.7) translateY(1%);transform-origin: 50% 50%;"
                                class="bi-three-dots bi"></i>
                        </template>
                    </buttom_icon_circleBackground>
                </div>
            </div>

            <div :style="{
                'fontSize': UIScale,
                'pointer-events': (musicInfoPagePosition == 'top') ? 'auto' : 'none',
            }" ref="mainContainer" class="mainContainer">
                <background class="player-background" :coverId="p.state.currentTrack.al.id"
                    :musicInfoPagePosition="musicInfoPagePosition" />

                <div class="controlBar">
                    <div ref="controlTapBar" class="tapBar"></div>
                </div>

                <AdaptiveLayout
                    ref="adaptiveLayoutRef"
                    :deviceType="deviceType"
                    :displayMode="displayMode"
                    :track="p.state.currentTrack"
                    :progress="progress"
                    :currentTime="p.state.currentTime"
                    :duration="p.state.duration"
                    :currentTimeRound="p.state.currentTimeRound"
                    :durationRound="p.state.durationRound"
                    :playing="p.state.playing"
                    :playMode="p.playMode"
                    :tracks="playlistTracks"
                    :currentIndex="p.state.currentIndex"
                    :maxColumnWidth="maxColumnWidth"
                    :musicInfoPagePosition="musicInfoPagePosition"
                    @play="p.play()"
                    @pause="p.pause()"
                    @next="p.next({ isManual: true })"
                    @prev="p.prev({ isManual: true })"
                    @cyclePlayMode="p.cyclePlayMode()"
                    @seekByProgress="p.seekByProgress($event)"
                    @modeChange="handleModeChange"
                    @switchTrack="handleSwitchTrack"
                    @swipeDown="handleSwipeDown"
                    @detailClick="handleDetailClick"
                />
            </div>
        </div>
    </div>
</template>
<style scoped>
.prev .event,
.next .event {
    font-weight: 900;
    font-size: 18px;
    color: #0066cd;
}

.currentMusic>.name {
    font-size: 18px;
    font-weight: 900;
    color: #000c;
    width: 100%;
    word-break: break-all;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
}

.currentMusic>.artists,
.prev>.name,
.next>.name {
    font-size: 14px;
    color: #000000AD;
    width: 100%;
    word-break: break-all;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
}

.player-background {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    z-index: 0;
    height: 100%
}

.mainContainer {
    user-select: none;
    opacity: 0;
    font-size: var(--adaptiveSize);
    color: rgb(255, 255, 255);
    position: absolute;
    inset: 0;
}

.tapBar {
    margin: 0.6em auto;
    height: .8em;
    cursor: n-resize;
    z-index: 1;

    width: 5em;
    border-radius: 1em;
    background-color: #fff2;
}

.controlBar {
    height: 2em
}

.mainContainer {
    font-size: 1rem;
    z-index: 1;
}

.musicInfoPageRow {
    position: absolute;
    height: 100%;
    width: 100%;
    left: 0;
    top: 100%;
    background: rgba(0, 0, 0, 0.0625);
    -webkit-user-drag: none !important;
    user-select: none;
    z-index: 100;
    box-sizing: border-box;

    box-shadow: 0 0px 15px rgba(0, 0, 0, 0.14);

    transform: translateY(0);
    overflow: hidden;
}

.relativeBox {
    position: relative;
    height: 100%;
    width: 100%;
}

.musicControlBar {
    position: absolute;
    height: 88px;
    width: 100%;
    top: 0;
    box-sizing: border-box;
    display: flex;
    gap: 17px;
    padding: 17px;
    overflow: hidden;
    z-index: 0;
    pointer-events: all
}

.cover {
    position: absolute;
    height: 54px;
    width: 54px;

    z-index: 5;
    top: 0;
    left: 0;
    aspect-ratio: 1/1;
}

.cover.placeholder {
    min-height: 54px !important;
    width: 54px !important;
    user-select: none;
    position: relative;
    flex: 0 1 0;
}

.cover>* {
    border-radius: 1%;
    overflow: hidden;
    height: inherit;
    width: inherit;
}

.cover * {
    -webkit-user-drag: none;

    -moz-user-drag: none;

    -ms-user-drag: none;

    user-drag: none;
}

.cover>.blur {
    filter: blur(0.75em);
    position: absolute;
    transform-origin: 50% 100%;
    transform: scale(0.85);
}

.detail {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    position: relative;
    width: 100%;
    flex: 1 0 1;
    margin: 0 -10px;
    white-space: nowrap;
    padding: 0 10px;
    user-select: none;
    mask-image: linear-gradient(90deg, #0000 0%, #000f 10px, #000f calc(100% - 10px), #0000 100%)
}

.detail>.dragRender {
    position: absolute;
    display: flex;
    width: inherit;
}

.prev {
    position: absolute;
    text-align: end;
    transform: translateX(calc(-100% - 10px))
}

.next {
    transform: translateX(-10px);
    position: absolute;
    width: max-content;
    left: 100%;
}

.control {
    display: flex;
    color: #000c;
    align-items: center;
    gap: 6px;
    flex: 0 1 0;
    margin-left: auto;
    font-size: 25px;
}

.control>* {
    flex-shrink: 0;
    height: 30px;
}

.playButtom {
    font-size: 28px;

    padding: 0.4em;
}

@media screen and (max-width: 560px) {
    .control>* {
        display: none;
    }

    .control>*.playButtom {
        display: inline-flex;
    }
}
</style>
