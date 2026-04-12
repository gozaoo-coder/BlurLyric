<template>
    <!-- Detail variant: used inside music detail view -->
    <div v-if="variant === 'detail'" class="musicDetailButton">
        <button_circle @click="$emit('cyclePlayMode')">
            <playModeSvg style="transform: scale(.75) translateY(1%);transform-origin: 50% 50%;"></playModeSvg>
        </button_circle>
        <button_circle @click="$emit('prev')">
            <i class="bi bi-skip-start-fill"></i>
        </button_circle>
        <button_circle @click="playing ? $emit('pause') : $emit('play')" class="playButtom">
            <div style="transform: scale(1.5);transform-origin: 50% 50%;">
                <i v-if="playing" class="bi bi-pause-fill"></i>
                <i v-if="!playing" class="bi bi-play-fill"></i>
            </div>
        </button_circle>
        <button_circle @click="$emit('next')">
            <i class="bi bi-skip-end-fill"></i>
        </button_circle>
        <button_circle>
            <i style="transform: scale(.75) translateY(1%);transform-origin: 50% 50%;" class="bi-volume-up bi"></i>
        </button_circle>
    </div>

    <!-- Bar variant: used inside bottom control bar -->
    <div v-else-if="variant === 'bar'" v-show="showTrackId !== -2" class="control">
        <buttom_icon_circleBackground @click="$emit('prev')">
            <template #icon><i class="bi bi-skip-start-fill"></i></template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground @click="playing ? $emit('pause') : $emit('play')" class="playButtom">
            <template #icon>
                <div style="transform: scale(1.5);transform-origin: 50% 50%;">
                    <i v-if="playing" class="bi bi-pause-fill"></i>
                    <i v-if="!playing" class="bi bi-play-fill"></i>
                </div>
            </template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground @click="$emit('next')">
            <template #icon><i class="bi bi-skip-end-fill"></i></template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground @click="$emit('cyclePlayMode')">
            <template #icon>
                <playModeSvg style="transform: scale(.7) translateY(1%);transform-origin: 50% 50%;"></playModeSvg>
            </template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground>
            <template #icon>
                <i style="transform: scale(.7) translateY(1%);transform-origin: 50% 50%;" class="bi-volume-up bi"></i>
            </template>
        </buttom_icon_circleBackground>
        <buttom_icon_circleBackground>
            <template #icon>
                <i style="transform: scale(.7) translateY(1%);transform-origin: 50% 50%;" class="bi-three-dots bi"></i>
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

defineEmits(['play', 'pause', 'next', 'prev', 'cyclePlayMode']);
</script>

<style scoped>
.musicDetailButton {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.musicDetailButton > * {
    flex-shrink: 0;
    font-size: 1em;
}
.musicDetailButton .playButtom {
    font-size: 1.75em;
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
.control > * {
    flex-shrink: 0;
    height: 30px;
}
.playButtom {
    font-size: 28px;
    padding: 0.4em;
}
@media screen and (max-width: 560px) {
    .control > * {
        display: none;
    }
    .control > *.playButtom {
        display: inline-flex;
    }
}
</style>
