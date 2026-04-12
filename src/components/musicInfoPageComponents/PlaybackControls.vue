<template>
    <!-- Detail variant: used inside music detail view -->
    <div v-if="variant === 'detail'" class="musicDetailButton">
        <button_circle @click="$emit('cyclePlayMode')" class="control-button">
            <playModeSvg class="control-icon control-icon-small"></playModeSvg>
        </button_circle>
        <button_circle @click="$emit('prev')" class="control-button">
            <i class="bi bi-skip-start-fill control-icon"></i>
        </button_circle>
        <button_circle @click="playing ? $emit('pause') : $emit('play')" class="control-button play-button">
            <div class="play-icon-container">
                <i v-if="playing" class="bi bi-pause-fill control-icon"></i>
                <i v-if="!playing" class="bi bi-play-fill control-icon"></i>
            </div>
        </button_circle>
        <button_circle @click="$emit('next')" class="control-button">
            <i class="bi bi-skip-end-fill control-icon"></i>
        </button_circle>
        <button_circle @click="$emit('toggleVolume')" class="control-button">
            <i class="bi bi-volume-up control-icon control-icon-small"></i>
        </button_circle>
    </div>

    <!-- Bar variant: used inside bottom control bar -->
    <div v-else-if="variant === 'bar'" v-show="showTrackId !== -2" class="control">
        <buttom_icon_circleBackground @click="$emit('prev')" class="control-button-bar">
            <template #icon><i class="bi bi-skip-start-fill control-icon-bar"></i></template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground @click="playing ? $emit('pause') : $emit('play')" class="control-button-bar play-button-bar">
            <template #icon>
                <div class="play-icon-container-bar">
                    <i v-if="playing" class="bi bi-pause-fill control-icon-bar"></i>
                    <i v-if="!playing" class="bi bi-play-fill control-icon-bar"></i>
                </div>
            </template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground @click="$emit('next')" class="control-button-bar">
            <template #icon><i class="bi bi-skip-end-fill control-icon-bar"></i></template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground @click="$emit('cyclePlayMode')" class="control-button-bar">
            <template #icon>
                <playModeSvg class="control-icon-bar control-icon-bar-small"></playModeSvg>
            </template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground @click="$emit('toggleVolume')" class="control-button-bar">
            <template #icon>
                <i class="bi bi-volume-up control-icon-bar control-icon-bar-small"></i>
            </template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground @click="$emit('toggleMoreOptions')" class="control-button-bar">
            <template #icon>
                <i class="bi bi-three-dots control-icon-bar control-icon-bar-small"></i>
            </template>
        </buttom_icon_circleBackground>
    </div>
</template>

<script setup>
import button_circle from './button_circle.vue';
import buttom_icon_circleBackground from '../base/buttom_icon_circleBackground.vue';
import playModeSvg from './playModeSvg.vue';

defineProps({
    playing: {
        type: Boolean,
        required: true
    },
    playMode: {
        type: String,
        default: 'loopPlaylist'
    },
    variant: {
        type: String,
        default: 'detail',
        validator: (value) => ['detail', 'bar'].includes(value)
    },
    showTrackId: {
        type: Number,
        default: -2
    }
});

defineEmits(['play', 'pause', 'next', 'prev', 'cyclePlayMode', 'toggleVolume', 'toggleMoreOptions']);
</script>

<style scoped>
/* Detail variant styles */
.musicDetailButton {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    padding: clamp(12px, 3vh, 16px) 0;
}

.control-button {
    flex-shrink: 0;
    font-size: 1em;
    transition: all 0.2s ease;
}

.control-button:hover {
    transform: scale(1.05);
}

.control-icon {
    font-size: 1em;
    transition: all 0.2s ease;
}

.control-icon-small {
    transform: scale(0.75);
}

.play-button {
    font-size: 1.75em;
}

.play-icon-container {
    transform: scale(1.5);
    transform-origin: 50% 50%;
}

/* Bar variant styles */
.control {
    display: flex;
    color: var(--fontColor-content, #000c);
    align-items: center;
    gap: 8px;
    flex: 0 1 0;
    margin-left: auto;
    font-size: 20px;
}

.control-button-bar {
    flex-shrink: 0;
    height: 32px;
    width: 32px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.control-button-bar:hover {
    transform: scale(1.05);
}

.control-icon-bar {
    font-size: 1em;
    transition: all 0.2s ease;
}

.control-icon-bar-small {
    transform: scale(0.7);
}

.play-button-bar {
    font-size: 1.1em;
}

.play-icon-container-bar {
    transform: scale(1.5);
    transform-origin: 50% 50%;
}

/* Responsive design */
@media screen and (max-width: 560px) {
    .control > .control-button-bar:not(.play-button-bar) {
        display: none;
    }
    
    .control > .play-button-bar {
        display: inline-flex;
    }
    
    .musicDetailButton {
        gap: 12px;
    }
    
    .control-button {
        font-size: 0.9em;
    }
    
    .play-button {
        font-size: 1.5em;
    }
}

@media screen and (max-width: 360px) {
    .musicDetailButton {
        gap: 8px;
    }
    
    .control-button {
        font-size: 0.8em;
    }
    
    .play-button {
        font-size: 1.3em;
    }
}
</style>
