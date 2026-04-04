import { PlayerEventBus } from '../events/PlayerEventBus';
import { PlayerEvents } from '../events/PlayerEvents';
import { createPlayerState, formatTime } from './PlayerState';
import { AudioEngine } from './AudioEngine';
import { PlayModeManager, PlayMode, PlayModeLabels } from './PlayMode';
import { PlaylistManager } from '../playlist/PlaylistOperations';
import { SmartPlaylist } from '../playlist/SmartPlaylist';
import { TransitionNextMusic, InstantSwitch } from '../transition/TransitionNextMusic';

class MusicPlayer {
    #eventBus;
    #state;
    #stateHelpers;
    #audioEngine;
    #playlist;
    #playModeManager;
    #transitionStrategy;
    #config;
    #timeUpdateTimer = null;
    #isDestroyed = false;
    #activeTransitions = [];
    #mediaSessionAvailable = false;

    constructor(options = {}) {
        this.#eventBus = new PlayerEventBus();
        const stateObj = createPlayerState();
        this.#state = stateObj.state;
        this.#stateHelpers = {
            computedProgress: stateObj.computedProgress,
            formattedCurrentTime: stateObj.formattedCurrentTime,
            formattedDuration: stateObj.formattedDuration,
            hasTrack: stateObj.hasTrack
        };
        this.#playModeManager = new PlayModeManager();
        this.#config = {
            smartStreamAudioList: true,
            audioStreamDuration: 7,
            audioStateHandlerTPS: 20,
            ...(options.config ?? {})
        };
        this.#transitionStrategy = new TransitionNextMusic();
        this.#mediaSessionAvailable = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
    }

    static async create(options = {}) {
        const player = new MusicPlayer(options);
        const EngineClass = options.AudioEngineClass || AudioEngine;
        player.#audioEngine = new EngineClass();
        player.#playlist = new PlaylistManager(player.#eventBus);
        player.#bindAudioEvents();
        player.#setupMediaSession?.();
        return player;
    }

    get events() { return this.#eventBus; }
    get state() { return this.#state; }
    get audioEngine() { return this.#audioEngine; }
    get playlist() { return this.#playlist; }
    get playMode() { return this.#playModeManager.current; }
    get playModeLabel() { return this.#playModeManager.label; }
    get isDestroyed() { return this.#isDestroyed; }

    get computedProgress() { return this.#stateHelpers.computedProgress.value; }
    get formattedCurrentTime() { return this.#stateHelpers.formattedCurrentTime.value; }
    get formattedDuration() { return this.#stateHelpers.formattedDuration.value; }
    get hasTrack() { return this.#stateHelpers.hasTrack.value; }

    _cancelActiveTransitions() {
        for (const cancel of this.#activeTransitions) {
            try { cancel(); } catch {}
        }
        this.#activeTransitions = [];
    }

    setPlaylist(playlistManager) {
        if (this.#audioEngine) {
            try { this.#audioEngine.destroy(); } catch {}
            this.#audioEngine = new AudioEngine();
            this.#bindAudioEvents();
        }
        this.#playlist = playlistManager;
        if (this.#playlist.setEventBus) {
            this.#playlist.setEventBus(this.#eventBus);
        }
        this.#syncStateFromPlaylist();
    }

    replace(tracks, startIndex = 0) {
        this._cleanupCurrentAudio();
        this.#playlist.replace(tracks, startIndex);
        this.#syncStateFromPlaylist();
    }

    push(track) {
        const wasEmpty = this.#playlist.isEmpty && this.#isEmptyPlaceholder();
        this.#playlist.push(track);
        this.#syncStateFromPlaylist();
        if (wasEmpty) {
            this.loadAndPlay(this.#playlist.currentIndex);
        }
    }

    pushBatch(tracks) {
        const wasEmpty = this.#playlist.isEmpty && this.#isEmptyPlaceholder();
        this.#playlist.pushBatch(tracks);
        this.#syncStateFromPlaylist();
        if (wasEmpty) {
            this.loadAndPlay(this.#playlist.currentIndex);
        }
    }

    remove(index) {
        this.#playlist.remove(index);
        this.#syncStateFromPlaylist();
    }

    clear() {
        this._cleanupCurrentAudio();
        this.#stopTimeUpdateLoop();
        this.#playlist.clear();
        this.#syncStateFromPlaylist();
    }

    async play() {
        if (!this.#audioEngine || !this.#audioEngine.isActive || !this.hasTrack) return;

        this.#state.loading = true;
        this.#emit(PlayerEvents.RESOURCE_LOADING);

        try {
            if (!this.#audioEngine.src) {
                await this.loadCurrentTrack();
            }
            await this.#audioEngine.play();
        } catch (error) {
            console.warn('[MusicPlayer] play() error:', error);
            if (this.#audioEngine.readyState < 4) {
                this.#waitForCanPlayThenPlay();
            }
        }
    }

    pause() {
        if (this.#audioEngine && this.#audioEngine.isActive) {
            this.#audioEngine.pause();
        }
    }

    togglePlayPause() {
        if (this.#state.playing) {
            this.pause();
        } else {
            this.play();
        }
    }

    seek(time) {
        if (this.#audioEngine && this.#audioEngine.isActive && isFinite(time)) {
            this.#audioElementSafe('currentTime', Math.max(0, Math.min(time, this.#audioEngine.duration || 0)));
        }
    }

    seekByProgress(progress) {
        if (this.#audioEngine && this.#audioEngine.duration > 0) {
            this.seek(progress * this.#audioEngine.duration);
        }
    }

    setVolume(v) {
        const vol = Math.max(0, Math.min(1, v));
        this.#state.volume = vol;
        if (this.#audioEngine && this.#audioEngine.isActive) {
            this.#audioEngine.volume = vol;
        }
    }

    async next(options) {
        if (!this.hasTrack || this.#playlist.length === 0) return;
        const nextIndex = this.#playModeManager.getNextIndex(this.#playlist.currentIndex, this.#playlist.length);
        await this.switchTo(nextIndex, options);
    }

    async prev(options) {
        if (!this.hasTrack || this.#playlist.length === 0) return;
        const prevIndex = this.#playModeManager.getPrevIndex(this.#playlist.currentIndex, this.#playlist.length);
        await this.switchTo(prevIndex, options);
    }

    async switchTo(targetIndex, options = {}) {
        if (targetIndex < 0 || targetIndex >= this.#playlist.length) return;
        if (targetIndex === this.#playlist.currentIndex && !options.force) return;

        this.#emit(PlayerEvents.TRACK_SWITCH_START, { targetIndex });

        if (this.#config.smartStreamAudioList !== false) {
            await this.#transitionStrategy.execute(this, targetIndex, options);
        } else {
            await new InstantSwitch().execute(this, targetIndex);
        }

        this.#emit(PlayerEvents.TRACK_SWITCH_END, { targetIndex });
    }

    switchToIndex(index) {
        this.#playlist.currentIndex = index;
        this.#syncStateFromPlaylist();
    }

    setTransitionStrategy(strategy) {
        this.#transitionStrategy = strategy;
    }

    cyclePlayMode() {
        const prevMode = this.#playModeManager.current;
        this.#playModeManager.next();
        this.#state.playMode = this.#playModeManager.current;
        this.#emit(PlayerEvents.PLAY_MODE_CHANGE, {
            previous: prevMode,
            current: this.#playModeManager.current,
            label: this.#playModeManager.label
        });
    }

    setPlayMode(mode) {
        const prevMode = this.#playModeManager.current;
        this.#playModeManager.set(mode);
        this.#state.playMode = mode;
        this.#emit(PlayerEvents.PLAY_MODE_CHANGE, {
            previous: prevMode,
            current: mode,
            label: this.#playModeManager.label
        });
    }

    async loadCurrentTrack() {
        const track = this.#playlist.current;
        if (!track) return;

        this.#state.loading = true;
        this.#emit(PlayerEvents.RESOURCE_LOADING, { track });

        try {
            const trace = track.primaryTrace;
            if (trace) {
                await this.#audioEngine.loadFromTrace(trace);
            } else if (track.id && track.id > 0) {
                await this.#audioEngine.loadFromTauriLocal(track.id);
            } else if (track.src && (track.src.startsWith('http') || track.src.startsWith('blob:'))) {
                this.#audioEngine.loadFromURL(track.src);
            } else if (track.src) {
                const { invoke } = await import('@tauri-apps/api/core');
                const response = await invoke('get_music_file', { songId: parseInt(track.id) || 0 });
                const blob = new Blob([response]);
                const objectURL = URL.createObjectURL(blob);
                this.#audioEngine.loadFromURL(objectURL);
            } else {
                throw new Error('No supported source found for track');
            }
            this.#emit(PlayerEvents.LOADED, { track });
        } catch (error) {
            console.error('[MusicPlayer] loadCurrentTrack error:', error);
            this.#state.error = error;
            this.#state.errorOnloadSrc = true;
            this.#emit(PlayerEvents.ERROR, { error, track });
        } finally {
            this.#state.loading = false;
        }
    }

    loadAndPlay(index) {
        this.#playlist.currentIndex = index ?? this.#playlist.currentIndex;
        this.#syncStateFromPlaylist();
        return this.loadCurrentTrack().then(() => this.play());
    }

    destroy() {
        if (this.#isDestroyed) return;
        this.#isDestroyed = true;

        this._cancelActiveTransitions();
        this.#stopTimeUpdateLoop();

        if (this.#audioEngine) {
            try { this.#audioEngine.destroy(); } catch {}
            this.#audioEngine = null;
        }

        this.#eventBus.clear();
        this.#state.playing = false;
        this.#state.loading = false;
        this.#state.currentTrack = null;
    }

    _cleanupCurrentAudio() {
        this.#stopTimeUpdateLoop();
        if (this.#audioEngine) {
            try { this.#audioEngine.destroy(); } catch {}
            this.#audioEngine = new AudioEngine();
            this.#bindAudioEvents();
        }
    }

    #bindAudioEvents() {
        if (!this.#audioEngine) return;
        const ae = this.#audioEngine;

        ae.on('loadeddata', () => {
            if (ae.readyState >= 2) this.#state.canplay = true;
            if (ae.readyState >= 3 && isFinite(ae.duration)) {
                this.#state.duration = ae.duration;
                this.#state.durationRound = Math.trunc(ae.duration);
                this.#emit(PlayerEvents.DURATION_CHANGE, { duration: ae.duration });
            }
        });

        ae.on('playing', () => {
            this.#state.playing = true;
            this.#startTimeUpdateLoop();
            this.#emit(PlayerEvents.PLAY);
        });

        ae.on('pause', () => {
            this.#state.playing = false;
            this.#stopTimeUpdateLoop();
            this.#emit(PlayerEvents.PAUSE);
        });

        ae.on('timeupdate', () => {
            if (!this.#audioEngine || !this.#audioEngine.isActive) return;
            this.#state.currentTime = this.#audioEngine.currentTime;
            this.#handleAutoAdvance();
        });

        ae.on('error', () => {
            this.#state.errorOnloadSrc = true;
            this.#emit(PlayerEvents.ERROR, {
                error: new Error('Audio element error'),
                track: this.#state.currentTrack
            });
        });

        ae.on('emptied', () => {
            this.#state.canplay = false;
        });
    }

    #startTimeUpdateLoop() {
        this.#stopTimeUpdateLoop();
        const tps = this.#config.audioStateHandlerTPS || 20;
        const interval = Math.max(16, Math.round(1000 / tps));

        const tick = () => {
            if (this.#isDestroyed || !this.#audioEngine || !this.#audioEngine.isActive) {
                this.#stopTimeUpdateLoop();
                return;
            }
            if (this.#state.playing && isFinite(this.#audioEngine.currentTime)) {
                this.#state.currentTime = this.#audioEngine.currentTime;
                this.#state.currentTimeRound = Math.trunc(this.#audioEngine.currentTime);
                if (isFinite(this.#audioEngine.duration)) {
                    this.#state.durationRound = Math.trunc(this.#audioEngine.duration);
                }
                this.#emit(PlayerEvents.TIME_UPDATE, {
                    currentTime: this.#state.currentTime,
                    duration: this.#state.duration
                });
            }
            this.#timeUpdateTimer = setTimeout(tick, interval);
        };

        this.#timeUpdateTimer = setTimeout(tick, interval);
    }

    #stopTimeUpdateLoop() {
        if (this.#timeUpdateTimer) {
            clearTimeout(this.#timeUpdateTimer);
            this.#timeUpdateTimer = null;
        }
    }

    #handleAutoAdvance() {
        if (!this.#audioEngine || !this.#playModeManager.shouldAutoAdvance()) return;
        if (!isFinite(this.#audioEngine.duration)) return;

        const remaining = this.#audioEngine.duration - this.#audioEngine.currentTime;
        const threshold = this.#config.audioStreamDuration ?? 7;

        if (remaining <= 0.3) {
            this.#stopTimeUpdateLoop();
            this.next().catch(() => {});
        } else if (this.#config.smartStreamAudioList && remaining < threshold) {
            this.next({ leastTime: remaining * 1000 }).catch(() => {});
        }
    }

    #waitForCanPlayThenPlay() {
        if (!this.#audioEngine) return;
        const onCanPlay = () => {
            this.#audioEngine.off('canplay', onCanPlay);
            if (!this.#isDestroyed) {
                this.#audioEngine.play().catch(() => {});
            }
        };
        this.#audioEngine.on('canplay', onCanPlay);
    }

    #setupMediaSession() {
        if (!this.#mediaSessionAvailable) return;

        try {
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        } catch (e) {
            console.warn('[MusicPlayer] MediaSession setup failed:', e);
            this.#mediaSessionAvailable = false;
        }
    }

    #updateMediaSessionMetadata() {
        if (!this.#mediaSessionAvailable || !this.#state.currentTrack) return;
        try {
            const t = this.#state.currentTrack;
            const metadata = new MediaMetadata({
                title: t.name || 'Unknown',
                artist: t.ar ? t.ar.map(a => a.name).join('/') : 'Unknown',
                album: t.al ? t.al.name : ''
            });
            navigator.mediaSession.metadata = metadata;
        } catch {}
    }

    #syncStateFromPlaylist() {
        this.#state.currentTrack = this.#playlist.current;
        this.#state.currentIndex = this.#playlist.currentIndex;
        this.#state.playlistLength = this.#playlist.length;
        this.#updateMediaSessionMetadata();
        this.#emit(PlayerEvents.TRACK_CHANGE, {
            track: this.#state.currentTrack,
            index: this.#state.currentIndex
        });
    }

    #isEmptyPlaceholder() {
        const t = this.#playlist.current;
        return !t || t.id === -2;
    }

    #emit(event, data) {
        this.#eventBus.emit(event, data);
    }

    #audioElementSafe(prop, value) {
        try {
            if (this.#audioEngine && this.#audioEngine.audioDom) {
                this.#audioEngine.audioDom[prop] = value;
            }
        } catch {}
    }
}

export { MusicPlayer };
