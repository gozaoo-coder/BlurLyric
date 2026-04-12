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

            this.registration = baseMethods.progressBarReg(dom, () => {
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
</script>

<style scoped>
.bar_ProgressBoxContainer {
    width: 100%;
    height: 4px;
    margin: 0;
    background-color: rgba(0, 0, 0, 0.1);
    box-shadow: var(--Shadow-value-low);
    border-radius: 2px;
    overflow: hidden;
}

.bar_ProgressBoxContainer .insert {
    width: calc(var(--progress) * 100%);
    height: 100%;
    background-color: var(--color-toggle-actived);
    box-shadow: var(--Shadow-value-low);
    transition: width 0.3s ease;
}

.infoPage_ProgressContainer {
    width: 100%;
}

.infoPage_ProgressContainer .progressBoxContainer {
    height: 2em;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-bottom: 0.5em;
}

.infoPage_ProgressContainer .progressBox {
    position: relative;
    width: 100%;
    height: 0.875em;
    border-radius: 0.4375em;
    box-shadow: var(--Shadow-value-offsetY-low);
    background-color: rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    overflow: hidden;
}

.infoPage_ProgressContainer .progressBox:hover {
    background-color: rgba(255, 255, 255, 0.3);
    height: 1em;
}

.infoPage_ProgressContainer .progressInsert {
    height: 100%;
    background-color: var(--color-toggle-actived);
    width: calc(var(--progress) * 100%);
    transition: all 0.3s ease;
    box-shadow: var(--Shadow-value-low);
}

.infoPage_ProgressContainer .progressBox:hover .progressInsert {
    background-color: var(--color-button-active);
}

.infoPage_ProgressContainer > .progressInfo {
    display: flex;
    justify-content: space-between;
    font-size: 0.75em;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .infoPage_ProgressContainer .progressBox {
        height: 0.75em;
    }
    
    .infoPage_ProgressContainer .progressBox:hover {
        height: 0.875em;
    }
    
    .infoPage_ProgressContainer > .progressInfo {
        font-size: 0.625em;
    }
}

@media (max-width: 480px) {
    .bar_ProgressBoxContainer {
        height: 3px;
    }
    
    .infoPage_ProgressContainer .progressBox {
        height: 0.625em;
    }
    
    .infoPage_ProgressContainer .progressBox:hover {
        height: 0.75em;
    }
    
    .infoPage_ProgressContainer > .progressInfo {
        font-size: 0.5625em;
    }
}
</style>
