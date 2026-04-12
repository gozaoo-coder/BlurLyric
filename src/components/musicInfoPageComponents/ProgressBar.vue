<template>
    <div v-if="variant === 'bar'" ref="progressBarDom" :style="{
        '--progress': progress
    }" class="bar_ProgressBoxContainer">
        <div class="insert"></div>
    </div>
    <div v-else class="infoPage_ProgressContainer">
        <div ref="progressBarDom" :style="{
            '--progress': progress
        }" class="progressBoxContainer">
            <div class="progressBox">
                <div class="progressInsert"></div>
            </div>
        </div>
        <div class="progressInfo">
            <div class="current">
                {{ baseMethods.formatTime_MMSS(currentTime) }}
            </div>
            <div class="duration">
                {{ baseMethods.formatTime_MMSS(duration) }}
            </div>
        </div>
    </div>
</template>

<script>
import baseMethods from '../../js/baseMethods.js';

export default {
    name: 'ProgressBar',
    props: {
        progress: {
            type: Number,
            default: 0
        },
        currentTime: {
            type: Number,
            default: 0
        },
        duration: {
            type: Number,
            default: 0
        },
        variant: {
            type: String,
            default: 'detail',
            validator: (value) => ['detail', 'bar'].includes(value)
        }
    },
    emits: ['seekByProgress'],
    data() {
        return {
            registration: null
        };
    },
    computed: {
        baseMethods() {
            return baseMethods;
        }
    },
    mounted() {
        this.registerProgressBar();
    },
    beforeUnmount() {
        this.unregisterProgressBar();
    },
    methods: {
        registerProgressBar() {
            const dom = this.$refs.progressBarDom;
            if (!dom) return;

            this.registration = progressBarReg(dom, () => {
                return this.progress;
            }, (info) => {
                if (info.draging === true) {
                    this.$emit('seekByProgress', info.currentProgress);
                }
            });
        },
        unregisterProgressBar() {
            if (this.registration) {
                this.registration.cancelReg();
                this.registration = null;
            }
        }
    }
};

/**
 * 进度条交互注册逻辑，提取自 baseMethods.progressBarReg
 * 支持鼠标拖拽、触摸拖拽和悬停交互
 */
function progressBarReg(progressBarDom, getCurrentProgress, progressUpdate) {
    let info = {
        currentProgress: 0,
        beforeDragProgress: 0,
        dragProgress: 0,
        BeforeHoveringProgress: 0,
        hoveringProgress: 0,
        draging: false,
        hovering: false,
        domWidth: null,
        offsetX: null,
    };

    let onInfoChange = () => {
        progressUpdate(info);
        progressBarDom.style.setProperty('--currentProgress', info.currentProgress);
        progressBarDom.style.setProperty('--beforeDragProgress', info.beforeDragProgress);
        progressBarDom.style.setProperty('--dragProgress', info.dragProgress);
        progressBarDom.style.setProperty('--BeforeHoveringProgress', info.BeforeHoveringProgress);
        progressBarDom.style.setProperty('--hoveringProgress', info.hoveringProgress);
        progressBarDom.style.setProperty('--draging', info.draging);
        progressBarDom.style.setProperty('--hovering', info.hovering);
    };

    const handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            info.beforeDragProgress = getCurrentProgress();

            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
            info.draging = true;
            const rect = progressBarDom.getBoundingClientRect();
            info.offsetX = e.touches[0].clientX - rect.left;
            info.domWidth = rect.width;
            onInfoChange();
        }
    };

    const handleTouchMove = (e) => {
        if (info.draging && e.touches.length === 1) {
            const x = e.touches[0].clientX;
            const rect = progressBarDom.getBoundingClientRect();
            info.dragProgress = (x - rect.left - info.offsetX) / info.domWidth;
            info.currentProgress = info.beforeDragProgress + info.dragProgress;
            onInfoChange();
        }
    };

    const handleTouchEnd = () => {
        if (info.draging) {
            info.draging = false;
            info.currentProgress = info.beforeDragProgress + info.dragProgress;
            onInfoChange();
        }
    };

    const handleMouseDown = (e) => {
        info.beforeDragProgress = getCurrentProgress();

        info.draging = true;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        const rect = progressBarDom.getBoundingClientRect();
        info.offsetX = e.clientX - rect.left;
        info.domWidth = rect.width;
        onInfoChange();
    };

    const handleMouseMove = (e) => {
        if (info.draging) {
            const x = e.clientX;
            const rect = progressBarDom.getBoundingClientRect();
            info.dragProgress = (x - rect.left - info.offsetX) / info.domWidth;
            info.currentProgress = info.beforeDragProgress + info.dragProgress;
            onInfoChange();
        }
    };

    const handleMouseUp = (e) => {
        if (info.draging) {
            info.draging = false;
            info.currentProgress = info.beforeDragProgress + info.dragProgress;
            onInfoChange();
        }
    };

    const handleMouseEnter = (e) => {
        info.hovering = true;
        info.BeforeHoveringProgress = info.currentProgress;
        progressBarDom.addEventListener('mouseleave', handleMouseLeave);
        onInfoChange();
    };

    const handleMouseLeave = (e) => {
        info.hovering = false;
        info.currentProgress = info.BeforeHoveringProgress;
        onInfoChange();
    };

    progressBarDom.addEventListener('touchstart', handleTouchStart);
    progressBarDom.addEventListener('mousedown', handleMouseDown);
    progressBarDom.addEventListener('mouseenter', handleMouseEnter);

    return {
        cancelReg: () => {
            progressBarDom.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            progressBarDom.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            progressBarDom.removeEventListener('mouseenter', handleMouseEnter);
            progressBarDom.removeEventListener('mouseleave', handleMouseLeave);
        }
    };
}
</script>

<style scoped>
.bar_ProgressBoxContainer {
    width: 100%;
    height: 3px;
    margin: -0px 0 0 0;
    background-color: #0002;
    box-shadow: var(--Shadow-value-low);
}

.bar_ProgressBoxContainer .insert {
    width: calc(var(--progress) * 100%);
    height: 100%;
    background-color: var(--color-toggle-actived);
    box-shadow: var(--Shadow-value-low);
}

.infoPage_ProgressContainer .progressBoxContainer {
    height: 1.875em;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-bottom: 0.125em;
}

.infoPage_ProgressContainer .progressBoxContainer:hover .progressBox {
    background-color: #fff5;
    width: 104%;
    height: 1.125em;
    border-radius: 0.5625em;
    margin: 0 -2%;
}

.infoPage_ProgressContainer .progressBoxContainer:hover .progressInsert {
    background-color: #fffd;
}

.infoPage_ProgressContainer .progressBox {
    position: relative;
    margin: 0 0%;
    width: 100%;
    height: 0.875em;
    border-radius: 0.4375em;
    box-shadow: var(--Shadow-value-offsetY-low);
    background-color: #fff3;
    cursor: pointer;
    transition: 0.2s ease-in-out;
    overflow: hidden;
}

.infoPage_ProgressContainer .progressInsert {
    height: 100%;
    transition: background-color 0.2s ease-in-out;
    background-color: #fff7;
    width: calc(var(--progress) * 100%);
}

.infoPage_ProgressContainer > .progressInfo {
    display: flex;
    justify-content: space-between;
    font-size: 0.5625em;
    color: #fff9;
}
</style>
