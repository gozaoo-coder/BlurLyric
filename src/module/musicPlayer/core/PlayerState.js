import { reactive, computed } from 'vue';

function formatTime(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function createPlayerState() {
    const state = reactive({
        playing: false,
        loading: false,
        canplay: false,
        error: null,
        errorOnloadSrc: false,
        currentTime: 0,
        currentTimeRound: 0,
        duration: 0,
        durationRound: 0,
        volume: 1,
        currentTrack: null,
        currentIndex: -1,
        playMode: 'loopPlaylist',
        playlistLength: 0
    });

    return {
        state,

        computedProgress: computed(() => {
            if (!state.duration || state.duration <= 0) return 0;
            return Math.min(state.currentTime / state.duration, 1);
        }),

        formattedCurrentTime: computed(() => formatTime(state.currentTimeRound)),
        formattedDuration: computed(() => formatTime(state.durationRound)),

        hasTrack: computed(() => {
            return state.currentTrack && state.currentTrack.id !== -2;
        })
    };
}

export { formatTime };
