import { PlayerEventEmitter } from './PlayerEventEmitter.js';
import { TrackListManager, PLAY_MODE, ALL_PLAY_MODES } from './TrackListManager.js';
import { HtmlAudioEngine } from './AudioEngine.js';
import { TransitionManager } from './TransitionManager.js';
import { TraceResolver } from './TraceResolver.js';
import { FixedStrategy } from './strategies/FixedStrategy.js';
import { FMStrategy } from './strategies/FMStrategy.js';

/**
 * MusicPlayer - 核心音乐播放器
 *
 * 整合 TrackListManager、AudioEngine、TransitionManager、TraceResolver
 * 播放器初始化后返回完整对象，通过事件系统与视图层解耦。
 *
 * @example
 * const player = new MusicPlayer({
 *   tracks: [],
 *   strategy: new FixedStrategy(),
 *   createEngine: () => new HtmlAudioEngine(),
 *   volume: 0.8,
 * });
 * player.events.on('playStateChange', ({ playing }) => { ... });
 * await player.play();
 */
class MusicPlayer {
    #events;
    #trackList;
    #engine;
    #transition;
    #traceResolver;
    #playMode = PLAY_MODE.LOOP_PLAYLIST;
    #state;
    #config;
    #destroyed = false;
    #transitioning = false;
    #timeUpdateTimer = null;

    /**
     * @param {Object} options
     * @param {Array} [options.tracks] 初始歌单
     * @param {AbstractStrategy} [options.strategy] 歌单增长策略
     * @param {Function} [options.createEngine] 自定义引擎工厂
     * @param {Object} [options.apiAdapter] 外部 API 适配器
     * @param {string} [options.playMode] 初始播放模式
     * @param {number} [options.volume] 初始音量 0-1
     * @param {Object} [options.config] 额外配置
     * @param {number} [options.config.audioStreamDuration=7] 提前加载秒数
     * @param {number} [options.config.audioStateHandlerTPS=20] 状态更新频率
     * @param {boolean} [options.config.smartStreamAudioList=true] 启用智能流
     * @param {boolean} [options.config.enableMediaSession=true] 启用 Media Session API
     */
    constructor(options = {}) {
        this.#events = new PlayerEventEmitter();
        this.#config = {
            audioStreamDuration: options.config?.audioStreamDuration ?? 7,
            audioStateHandlerTPS: options.config?.audioStateHandlerTPS ?? 20,
            smartStreamAudioList: options.config?.smartStreamAudioList ?? true,
            enableMediaSession: options.config?.enableMediaSession ?? true,
        };

        this.#state = {
            playing: false,
            currentTime: 0,
            currentTimeRounded: 0,
            duration: 0,
            durationRounded: 0,
            volume: options.volume ?? 1,
            loading: false,
            error: null,
            canplay: false,
        };

        this.#traceResolver = new TraceResolver(options.apiAdapter || null);

        const strategy = options.strategy || new FixedStrategy();
        this.#trackList = new TrackListManager(options.tracks || [], strategy, this.#events);

        this.#engine = null;
        this.#transition = new TransitionManager();

        this.#playMode = options.playMode || PLAY_MODE.LOOP_PLAYLIST;

        // 监听列表变化 Media Session
        this.#events.on('trackChange', () => this.#updateMediaSession());
    }

    // ========== 属性 ==========

    get events() { return this.#events; }
    get trackList() { return this.#trackList; }
    get playMode() { return this.#playMode; }
    get state() { return { ...this.#state }; }
    get destroyed() { return this.#destroyed; }
    get engine() { return this.#engine; }
    get traceResolver() { return this.#traceResolver; }
    get transition() { return this.#transition; }
    get config() { return { ...this.#config }; }

    get currentTrack() {
        return this.#trackList.getCurrent();
    }

    get currentIndex() {
        return this.#trackList.currentIndex;
    }

    get allPlayModes() {
        return ALL_PLAY_MODES;
    }

    // ========== 播放控制 ==========

    /**
     * 播放
     */
    async play() {
        if (this.#destroyed) return;

        if (this.#engine && !this.#engine.paused) return;

        const track = this.#trackList.getCurrent();
        if (!track) {
            this.#setError('No track to play');
            return;
        }

        if (this.#engine && this.#engine.destroyed === false && this.#engine.paused) {
            await this.#engine.play();
            this.#updateState({ playing: true });
            return;
        }

        await this.#loadAndPlay(track);
    }

    /**
     * 暂停
     */
    pause() {
        if (this.#destroyed) return;
        if (this.#engine) {
            this.#engine.pause();
            this.#updateState({ playing: false });
        }
    }

    /**
     * 切换播放/暂停
     */
    togglePlay() {
        if (this.#state.playing) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * 下一首
     */
    async next() {
        if (this.#destroyed) return;

        await this.#trackList.checkAndGrow(this.#playMode);
        const nextIndex = this.#trackList.getNextIndex(this.#playMode);
        await this.#switchToIndex(nextIndex);
    }

    /**
     * 上一首
     */
    async prev() {
        if (this.#destroyed) return;

        const prevIndex = this.#trackList.getPrevIndex(this.#playMode);
        await this.#switchToIndex(prevIndex);
    }

    /**
     * 跳转到指定时间
     */
    seek(time) {
        if (this.#destroyed || !this.#engine) return;
        const clamped = Math.max(0, Math.min(time, this.#state.duration));
        this.#engine.setCurrentTime(clamped);
        this.#updateState({ currentTime: clamped });
    }

    /**
     * 设置音量
     */
    setVolume(v) {
        const vol = Math.max(0, Math.min(1, v));
        this.#updateState({ volume: vol });
        if (this.#engine) {
            this.#engine.setVolume(vol);
        }
        this.#events.emit('volumeChange', { volume: vol });
    }

    /**
     * 设置播放模式
     */
    setPlayMode(mode) {
        if (!ALL_PLAY_MODES.includes(mode)) return;
        this.#playMode = mode;
        this.#events.emit('playModeChange', { playMode: mode });
    }

    getPlayMode() {
        return this.#playMode;
    }

    /**
     * 切换到下一个播放模式（循环）
     */
    cyclePlayMode() {
        const currentIndex = ALL_PLAY_MODES.indexOf(this.#playMode);
        const nextIndex = (currentIndex + 1) % ALL_PLAY_MODES.length;
        this.setPlayMode(ALL_PLAY_MODES[nextIndex]);
    }

    // ========== 歌单操作（兼容现有 API） ==========

    /**
     * 添加一首歌到歌单末尾
     */
    pushMusic(song) {
        const wasEmpty = this.#trackList.isEmpty();
        this.#trackList.push(song);

        if (wasEmpty) {
            this.#trackList.setCurrentIndex(0);
            this.#loadAndPlay(song);
        }
    }

    /**
     * 添加多首歌到歌单末尾
     */
    pushMusicTrack(tracks) {
        if (!Array.isArray(tracks)) return;
        const wasEmpty = this.#trackList.isEmpty();
        this.#trackList.pushTracks(tracks);

        if (wasEmpty && tracks.length > 0) {
            this.#trackList.setCurrentIndex(0);
            this.#loadAndPlay(tracks[0]);
        }
    }

    /**
     * 替换整个歌单并从指定位置播放
     */
    coverMusicTrack(tracks, startIndex = 0) {
        this.#destroyCurrentEngine();
        this.#trackList.replace(tracks, startIndex);
        const track = this.#trackList.getCurrent();
        if (track) {
            this.#loadAndPlay(track);
        }
    }

    /**
     * 清空歌单（恢复空状态）
     */
    cleanUpMusicTrack() {
        this.#destroyCurrentEngine();
        this.#trackList.clear();
        this.#updateState({
            playing: false,
            currentTime: 0,
            duration: 0,
            canplay: false,
        });
    }

    // ========== 内部方法 ==========

    /**
     * 加载并播放指定曲目
     */
    async #loadAndPlay(track) {
        if (this.#destroyed || !track) return;

        const oldEngine = this.#engine;

        // 创建新引擎
        const newEngine = new HtmlAudioEngine();
        this.#engine = newEngine;

        // 设置音量
        newEngine.setVolume(this.#state.volume);

        // 解析资源 URL
        this.#updateState({ loading: true, error: null, canplay: false });
        let objectURL = null;
        let destroyObjectURL = null;

        try {
            const result = await this.#traceResolver.resolveMusicFile(track);
            objectURL = result.objectURL;
            destroyObjectURL = result.destroyObjectURL;
            newEngine.setSrc(objectURL);
        } catch (e) {
            this.#setError(`Failed to load audio: ${e.message}`);
            return;
        }

        // 事件绑定
        this.#bindEngineEvents(newEngine, track, { objectURL, destroyObjectURL });

        // 执行过渡
        try {
            await this.#transition.execute(oldEngine, newEngine);
        } catch (e) {
            console.warn('[MusicPlayer] Transition error:', e);
            newEngine.setVolume(this.#state.volume);
            await newEngine.play().catch(() => {});
        }

        // 销毁旧引擎
        if (oldEngine && oldEngine !== this.#engine) {
            oldEngine.destroy();
        }

        // Media Session
        if (this.#config.enableMediaSession) {
            this.#setupMediaSession();
        }

        this.#updateState({ loading: false });

        // 启动 TPS 循环（timeupdateHandler 会通过引擎事件触发）
    }

    /**
     * 绑定引擎事件
     */
    #bindEngineEvents(engine, track, resource) {
        const loadeddata = () => {
            if (engine.destroyed) return;
            this.#updateState({
                canplay: engine.readyState >= 2,
                duration: engine.duration || 0,
                durationRounded: Math.trunc(engine.duration || 0),
            });
            this.#events.emit('durationChange', { duration: engine.duration });
        };

        const playing = () => {
            if (engine.destroyed) return;
            this.#updateState({ playing: true, loading: false });
            this.#startTimeUpdateLoop(engine);
        };

        const pause = () => {
            if (engine.destroyed) return;
            this.#updateState({ playing: false });
        };

        const timeupdate = () => {
            if (engine.destroyed) return;
            this.#updateState({ currentTime: engine.currentTime });

            // 智能流：提前加载下一首
            if (this.#config.smartStreamAudioList) {
                const leastTime = engine.duration - engine.currentTime;
                if (leastTime <= this.#config.audioStreamDuration && leastTime > 0) {
                    this.#onTrackEnd(engine);
                }
            }
        };

        const ended = () => {
            if (engine.destroyed) return;
            this.#onTrackEnd(engine);
        };

        const error = () => {
            if (engine.destroyed) return;
            console.error('[MusicPlayer] Audio error:', engine.audioDom?.error);
            this.#setError('Audio playback error');
        };

        engine.on('loadeddata', loadeddata);
        engine.on('playing', playing);
        engine.on('pause', pause);
        engine.on('timeupdate', timeupdate);
        engine.on('ended', ended);
        engine.on('error', error);
    }

    /**
     * 处理曲目结束
     */
    #onTrackEnd(currentEngine) {
        if (this.#destroyed || this.#transitioning) return;

        if (this.#playMode === PLAY_MODE.STOP_AFTER_SINGLE) {
            this.#updateState({ playing: false });
            return;
        }

        this.#transitioning = true;
        this.next().finally(() => {
            this.#transitioning = false;
        });
    }

    /**
     * TPS 时间更新循环
     */
    #startTimeUpdateLoop(engine) {
        if (this.#timeUpdateTimer) {
            clearTimeout(this.#timeUpdateTimer);
            this.#timeUpdateTimer = null;
        }

        const tick = () => {
            if (this.#destroyed || engine.destroyed || !this.#state.playing) return;

            this.#updateState({
                currentTimeRounded: Math.trunc(engine.currentTime),
                durationRounded: Math.trunc(engine.duration),
            });

            this.#timeUpdateTimer = setTimeout(tick, 1000 / this.#config.audioStateHandlerTPS);
        };

        tick();
    }

    /**
     * 切换到指定索引的曲目
     */
    async #switchToIndex(index) {
        if (this.#destroyed) return;

        this.#trackList.setCurrentIndex(index);
        const track = this.#trackList.getCurrent();

        if (!track || track.id === -2) {
            this.#destroyCurrentEngine();
            this.#updateState({ playing: false, currentTime: 0, duration: 0 });
            this.#events.emit('trackChange', { track: null, index });
            return;
        }

        await this.#loadAndPlay(track);
        this.#events.emit('trackChange', { track, index });
    }

    /**
     * 销毁当前引擎
     */
    #destroyCurrentEngine() {
        if (this.#engine) {
            this.#engine.destroy();
            this.#engine = null;
        }
        if (this.#timeUpdateTimer) {
            clearTimeout(this.#timeUpdateTimer);
            this.#timeUpdateTimer = null;
        }
    }

    /**
     * 更新内部状态并触发事件
     */
    #updateState(partial) {
        Object.assign(this.#state, partial);
        this.#events.emit('stateChange', { ...this.#state });
    }

    /**
     * 设置错误状态
     */
    #setError(message) {
        this.#updateState({ error: message, loading: false });
        this.#events.emit('error', { type: 'playback', message });
    }

    // ========== Media Session API ==========

    #setupMediaSession() {
        if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

        const track = this.currentTrack;
        if (!track) return;

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.name || '',
                artist: Array.isArray(track.ar)
                    ? track.ar.map(a => a.name).join('/')
                    : '',
                album: track.al?.name || '',
            });
        } catch (e) {
            // 某些环境不支持 MediaMetadata
        }
    }

    #updateMediaSession() {
        this.#setupMediaSession();
    }

    // ========== 生命周期 ==========

    /**
     * 销毁播放器
     */
    destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;

        this.#destroyCurrentEngine();
        this.#trackList.clear();
        this.#events.removeAllListeners();
        this.#events.emit('destroy');
    }
}

export { MusicPlayer };
