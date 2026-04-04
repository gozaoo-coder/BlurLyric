const PlayMode = {
    LOOP_PLAYLIST: 'loopPlaylist',
    LOOP_SINGLE: 'loopSingle',
    STOP_AFTER_SINGLE: 'stopAfterSingle',
    RANDOM_PLAY: 'randomPlay',
    REVERSE_LOOP: 'reverseLoop'
};

const PlayModeLabels = {
    [PlayMode.LOOP_PLAYLIST]: '列表循环',
    [PlayMode.LOOP_SINGLE]: '单曲循环',
    [PlayMode.STOP_AFTER_SINGLE]: '播完本曲暂停',
    [PlayMode.RANDOM_PLAY]: '随机播放',
    [PlayMode.REVERSE_LOOP]: '倒序循环'
};

const ALL_PLAY_MODES = Object.values(PlayMode);

class PlayModeManager {
    #currentMode = PlayMode.LOOP_PLAYLIST;

    get current() {
        return this.#currentMode;
    }

    get label() {
        return PlayModeLabels[this.#currentMode] || '';
    }

    get allModes() {
        return [...ALL_PLAY_MODES];
    }

    next() {
        const idx = ALL_PLAY_MODES.indexOf(this.#currentMode);
        this.#currentMode = ALL_PLAY_MODES[(idx + 1) % ALL_PLAY_MODES.length];
        return this.#currentMode;
    }

    set(mode) {
        if (ALL_PLAY_MODES.includes(mode)) {
            this.#currentMode = mode;
        }
    }

    getNextIndex(currentIndex, playlistLength) {
        if (playlistLength <= 0) return 0;

        switch (this.#currentMode) {
            case PlayMode.LOOP_PLAYLIST:
                return (currentIndex + 1) % playlistLength;

            case PlayMode.LOOP_SINGLE:
                return currentIndex;

            case PlayMode.STOP_AFTER_SINGLE:
                return (currentIndex + 1) % playlistLength;

            case PlayMode.RANDOM_PLAY: {
                let rnd;
                if (playlistLength > 1) {
                    do {
                        rnd = Math.floor(Math.random() * playlistLength);
                    } while (rnd === currentIndex);
                } else {
                    rnd = 0;
                }
                return rnd;
            }

            case PlayMode.REVERSE_LOOP:
                return currentIndex <= 0 ? playlistLength - 1 : currentIndex - 1;

            default:
                return (currentIndex + 1) % playlistLength;
        }
    }

    getPrevIndex(currentIndex, playlistLength) {
        if (playlistLength <= 0) return 0;

        switch (this.#currentMode) {
            case PlayMode.LOOP_PLAYLIST:
                return currentIndex <= 0 ? playlistLength - 1 : currentIndex - 1;

            case PlayMode.REVERSE_LOOP:
                return (currentIndex + 1) % playlistLength;

            case PlayMode.RANDOM_PLAY: {
                let rnd;
                if (playlistLength > 1) {
                    do {
                        rnd = Math.floor(Math.random() * playlistLength);
                    } while (rnd === currentIndex);
                } else {
                    rnd = 0;
                }
                return rnd;
            }

            default:
                return currentIndex <= 0 ? playlistLength - 1 : currentIndex - 1;
        }
    }

    shouldAutoAdvance() {
        return this.#currentMode !== PlayMode.STOP_AFTER_SINGLE;
    }
}

export { PlayMode, PlayModeLabels, PlayModeManager };
