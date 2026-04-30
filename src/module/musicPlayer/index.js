/**
 * musicPlayer - 音乐播放器模块入口
 *
 * 导出：
 * - createMusicPlayer(options): 工厂函数，创建 MusicPlayer 实例
 * - MusicPlayer: 播放器类
 * - TrackListManager: 播放列表管理器
 * - HtmlAudioEngine: 默认音频引擎
 * - Trace: 来源追踪类
 * - TraceResolver: 资源解析器
 * - TransitionManager: 过渡管理器
 * - FixedStrategy / FMStrategy: 歌单增长策略
 * - PLAY_MODE: 播放模式枚举
 */

import { MusicPlayer } from './MusicPlayer.js';
import { TrackListManager, PLAY_MODE } from './TrackListManager.js';
import { HtmlAudioEngine } from './AudioEngine.js';
import { PlayerEventEmitter } from './PlayerEventEmitter.js';
import { Trace } from './Trace.js';
import { TraceResolver } from './TraceResolver.js';
import { TransitionManager } from './TransitionManager.js';
import { FixedStrategy } from './strategies/FixedStrategy.js';
import { FMStrategy } from './strategies/FMStrategy.js';

/**
 * 工厂函数：创建 MusicPlayer 实例
 * @param {Object} options
 * @returns {MusicPlayer}
 */
function createMusicPlayer(options = {}) {
    return new MusicPlayer(options);
}

export {
    createMusicPlayer,
    MusicPlayer,
    TrackListManager,
    HtmlAudioEngine,
    PlayerEventEmitter,
    Trace,
    TraceResolver,
    TransitionManager,
    FixedStrategy,
    FMStrategy,
    PLAY_MODE,
};
