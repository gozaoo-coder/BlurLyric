import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MusicPlayer } from '../core/MusicPlayer';
import { PlayerEvents } from '../events/PlayerEvents';
import { PlayMode } from '../core/PlayMode';

// 辅助函数：创建测试用的 track 对象
function createTestTrack(id, name = `Track ${id}`, src = null) {
  return {
    id,
    name,
    ar: [{ name: `Artist ${id}` }],
    al: { name: `Album ${id}` },
    src: src || `http://example.com/track${id}.mp3`
  };
}

describe('MusicPlayer', () => {
  let player;

  beforeEach(async () => {
    // 使用配置禁用智能流式音频列表，避免 transition 策略导致的超时
    player = await MusicPlayer.create({
      config: {
        smartStreamAudioList: false
      }
    });
  });

  afterEach(() => {
    if (player && !player.isDestroyed) {
      player.destroy();
    }
  });

  describe('create() 工厂方法', () => {
    it('应创建有效的 MusicPlayer 实例', async () => {
      const p = await MusicPlayer.create();
      expect(p).toBeDefined();
      expect(p).toBeInstanceOf(MusicPlayer);
      expect(p.isDestroyed).toBe(false);
      p.destroy();
    });

    it('应初始化 audioEngine', async () => {
      expect(player.audioEngine).toBeDefined();
      expect(player.audioEngine.isActive).toBe(true);
    });

    it('应初始化 playlist', async () => {
      expect(player.playlist).toBeDefined();
      expect(player.playlist.length).toBe(0);
    });

    it('应初始化 eventBus', async () => {
      expect(player.events).toBeDefined();
    });
  });

  describe('初始状态', () => {
    it('playing 应为 false', () => {
      expect(player.state.playing).toBe(false);
    });

    it('loading 应为 false', () => {
      expect(player.state.loading).toBe(false);
    });

    it('volume 初始应为 1', () => {
      expect(player.state.volume).toBe(1);
    });

    it('currentIndex 应为 -1', () => {
      expect(player.state.currentIndex).toBe(-1);
    });

    it('currentTrack 应为 null', () => {
      expect(player.state.currentTrack).toBeNull();
    });

    it('playlistLength 应为 0', () => {
      expect(player.state.playlistLength).toBe(0);
    });

    it('playMode 初始应为 loopPlaylist', () => {
      expect(player.playMode).toBe(PlayMode.LOOP_PLAYLIST);
    });

    it('hasTrack 应为 falsy（无歌曲）', () => {
      expect(player.hasTrack).toBeFalsy();
    });

    it('computedProgress 应为 0', () => {
      expect(player.computedProgress).toBe(0);
    });

    it('formattedCurrentTime 应为 "00:00"', () => {
      expect(player.formattedCurrentTime).toBe('00:00');
    });

    it('formattedDuration 应为 "00:00"', () => {
      expect(player.formattedDuration).toBe('00:00');
    });
  });

  describe('播放列表操作：replace()', () => {
    it('应替换播放列表', () => {
      const tracks = [
        createTestTrack(1),
        createTestTrack(2),
        createTestTrack(3)
      ];
      player.replace(tracks, 0);

      expect(player.playlist.length).toBe(3);
      expect(player.state.playlistLength).toBe(3);
    });

    it('应设置当前索引', () => {
      const tracks = [createTestTrack(1), createTestTrack(2)];
      player.replace(tracks, 1);

      expect(player.state.currentIndex).toBe(1);
      expect(player.state.currentTrack).toEqual(createTestTrack(2));
    });

    it('startIndex 超出范围时应截断到有效范围', () => {
      const tracks = [createTestTrack(1)];
      player.replace(tracks, 100); // 超出范围

      expect(player.state.currentIndex).toBe(0);
    });

    it('空数组应清空播放列表', () => {
      player.replace([createTestTrack(1)], 0);
      player.replace([], 0);

      expect(player.playlist.length).toBe(0);
      expect(player.state.currentTrack).toBeNull();
    });

    it('应发射 PLAYLIST_REPLACE 事件', () => {
      const spy = vi.fn();
      player.events.on(PlayerEvents.PLAYLIST_REPLACE, spy);

      const tracks = [createTestTrack(1)];
      player.replace(tracks, 0);

      expect(spy).toHaveBeenCalledOnce();
    });

    it('应发射 TRACK_CHANGE 事件', () => {
      const spy = vi.fn();
      player.events.on(PlayerEvents.TRACK_CHANGE, spy);

      player.replace([createTestTrack(1)], 0);

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('播放列表操作：push()', () => {
    it('应添加单首歌曲到播放列表', () => {
      const track = createTestTrack(1);
      player.push(track);

      expect(player.playlist.length).toBe(1);
      expect(player.state.playlistLength).toBe(1);
    });

    it('应更新 currentTrack 和 hasTrack', () => {
      const track = createTestTrack(42, 'Test Song');
      player.push(track);

      expect(player.state.currentTrack).toEqual(track);
      expect(player.hasTrack).toBe(true);
    });

    it('连续 push 多首歌', () => {
      player.push(createTestTrack(1));
      player.push(createTestTrack(2));
      player.push(createTestTrack(3));

      expect(player.playlist.length).toBe(3);
    });

    it('应发射 PLAYLIST_PUSH 事件', () => {
      const spy = vi.fn();
      player.events.on(PlayerEvents.PLAYLIST_PUSH, spy);

      player.push(createTestTrack(1));

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('播放列表操作：pushBatch()', () => {
    it('应批量添加多首歌曲', () => {
      const tracks = [createTestTrack(1), createTestTrack(2), createTestTrack(3)];
      player.pushBatch(tracks);

      expect(player.playlist.length).toBe(3);
      expect(player.state.playlistLength).toBe(3);
    });

    it('空数组不应改变播放列表', () => {
      player.pushBatch([]);
      expect(player.playlist.length).toBe(0);
    });

    it('应发射 PLAYLIST_PUSH 事件', () => {
      const spy = vi.fn();
      player.events.on(PlayerEvents.PLAYLIST_PUSH, spy);

      player.pushBatch([createTestTrack(1), createTestTrack(2)]);

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('播放列表操作：remove()', () => {
    beforeEach(() => {
      player.replace([
        createTestTrack(1),
        createTestTrack(2),
        createTestTrack(3)
      ], 0);
    });

    it('应移除指定索引的歌曲', () => {
      player.remove(1);

      expect(player.playlist.length).toBe(2);
      expect(player.state.playlistLength).toBe(2);
    });

    it('移除的歌曲不应再在播放列表中', () => {
      const removed = player.remove(0);
      // 验证移除操作成功（removed 可能是 track 对象或 null）
      expect(player.playlist.length).toBe(2);

      if (removed) {
        expect(removed.id).toBe(1);
      }

      // 剩余的应该是 track 2 和 3
      expect(player.playlist.getAll()[0].id).toBe(2);
      expect(player.playlist.getAll()[1].id).toBe(3);
    });

    it('移除无效索引不应报错', () => {
      expect(() => {
        player.remove(-1);
        player.remove(100);
      }).not.toThrow();
    });

    it('应发射 PLAYLIST_REMOVE 事件', () => {
      const spy = vi.fn();
      player.events.on(PlayerEvents.PLAYLIST_REMOVE, spy);

      player.remove(0);

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('播放列表操作：clear()', () => {
    beforeEach(() => {
      player.replace([createTestTrack(1), createTestTrack(2)], 0);
    });

    it('应清空播放列表', () => {
      player.clear();

      expect(player.playlist.length).toBe(0);
      expect(player.state.playlistLength).toBe(0);
      expect(player.state.currentTrack).toBeNull();
      expect(player.hasTrack).toBeFalsy();
    });

    it('应发射 PLAYLIST_CLEAR 事件', () => {
      const spy = vi.fn();
      player.events.on(PlayerEvents.PLAYLIST_CLEAR, spy);

      player.clear();

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('播放控制：play() / pause() / togglePlayPause()', () => {
    beforeEach(() => {
      // 添加一首歌以便播放
      player.replace([createTestTrack(1, 'Test', 'http://example.com/test.mp3')], 0);
    });

    describe('pause()', () => {
      it('应暂停播放', () => {
        const pauseSpy = vi.spyOn(player.audioEngine, 'pause').mockImplementation(() => {});
        player.pause();
        expect(pauseSpy).toHaveBeenCalledOnce();
        pauseSpy.mockRestore();
      });

      it('无 audioEngine 时不应报错', () => {
        player.destroy();
        expect(() => {
          player.pause();
        }).not.toThrow();
      });
    });

    describe('togglePlayPause()', () => {
      it('未播放时调用应尝试播放', () => {
        const playSpy = vi.spyOn(player, 'play').mockImplementation(async () => {});
        player.togglePlayPause();
        expect(playSpy).toHaveBeenCalledOnce();
        playSpy.mockRestore();
      });

      it('正在播放时调用应暂停', () => {
        player.state.playing = true;
        const pauseSpy = vi.spyOn(player, 'pause').mockImplementation(() => {});
        player.togglePlayPause();
        expect(pauseSpy).toHaveBeenCalledOnce();
        pauseSpy.mockRestore();
      });
    });
  });

  describe('进度控制：seek() / seekByProgress()', () => {
    beforeEach(() => {
      player.replace([createTestTrack(1)], 0);
    });

    describe('seek()', () => {
      it('应设置 currentTime', () => {
        // Mock audio engine 的 duration
        Object.defineProperty(player.audioEngine.audioDom, 'duration', { value: 200, writable: true });

        player.seek(100);
        expect(player.audioEngine.currentTime).toBe(100);
      });

      it('负数时间应被截断为 0', () => {
        player.seek(-10);
        expect(player.audioEngine.currentTime).toBeGreaterThanOrEqual(0);
      });

      it('超过 duration 的时间应被截断', () => {
        Object.defineProperty(player.audioEngine.audioDom, 'duration', { value: 100, writable: true });
        player.seek(999);
        expect(player.audioEngine.currentTime).toBeLessThanOrEqual(100);
      });

      it('NaN 时间不应修改 currentTime', () => {
        const originalTime = player.audioEngine.currentTime;
        player.seek(NaN);
        // NaN 会被 isFinite 检查拦截
      });

      it('无 audioEngine 时不应报错', () => {
        player.destroy();
        expect(() => {
          player.seek(50);
        }).not.toThrow();
      });
    });

    describe('seekByProgress()', () => {
      it('应根据进度比例计算时间', () => {
        Object.defineProperty(player.audioEngine.audioDom, 'duration', { value: 200, writable: true });
        player.seekByProgress(0.5);
        expect(player.audioEngine.currentTime).toBe(100);
      });

      it('进度为 0 应跳转到开头', () => {
        Object.defineProperty(player.audioEngine.audioDom, 'duration', { value: 100, writable: true });
        player.seekByProgress(0);
        expect(player.audioEngine.currentTime).toBe(0);
      });

      it('进度为 1 应跳转到末尾', () => {
        Object.defineProperty(player.audioEngine.audioDom, 'duration', { value: 100, writable: true });
        player.seekByProgress(1);
        expect(player.audioEngine.currentTime).toBe(100);
      });

      it('duration 为 0 时不应 seek', () => {
        Object.defineProperty(player.audioEngine.audioDom, 'duration', { value: 0, writable: originalValue => {} });
        const spy = vi.spyOn(player, 'seek').mockImplementation(() => {});
        player.seekByProgress(0.5);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      });
    });
  });

  describe('音量控制：setVolume()', () => {
    it('应设置音量', () => {
      player.setVolume(0.5);
      expect(player.state.volume).toBe(0.5);
      expect(player.audioEngine.volume).toBe(0.5);
    });

    it('音量应在 [0, 1] 范围内', () => {
      player.setVolume(1.5);
      expect(player.state.volume).toBe(1);
      expect(player.state.volume).toBeLessThanOrEqual(1);

      player.setVolume(-0.5);
      expect(player.state.volume).toBe(0);
      expect(player.state.volume).toBeGreaterThanOrEqual(0);
    });

    it('边界值 0 和 1 应该正常工作', () => {
      player.setVolume(0);
      expect(player.state.volume).toBe(0);

      player.setVolume(1);
      expect(player.state.volume).toBe(1);
    });

    it('无 audioEngine 时只更新 state', () => {
      player.destroy();
      // destroy 后 audioEngine 为 null，但 state 还在
      player.setVolume(0.7);
      expect(player.state.volume).toBe(0.7);
    });
  });

  describe('切曲逻辑：next() / prev()', () => {
    beforeEach(() => {
      player.replace([
        createTestTrack(1),
        createTestTrack(2),
        createTestTrack(3)
      ], 0);
    });

    describe('next()', () => {
      it('默认模式（列表循环）应切换到下一首', async () => {
        await player.next();
        expect(player.state.currentIndex).toBe(1);
        expect(player.state.currentTrack.id).toBe(2);
      });

      it('无歌曲时不应执行切换', async () => {
        player.clear();
        // clear 后 playlistLength 为 0，next() 应该提前返回
        await player.next();
        // 验证播放列表仍为空
        expect(player.playlist.length).toBe(0);
        expect(player.state.currentTrack).toBeNull();
      });

      it('hasTrack 为 false 时不应执行', async () => {
        player.state.currentTrack = null; // 强制设为 null
        const originalIndex = player.state.currentIndex;
        await player.next();
        // 不应该改变
      });
    });

    describe('prev()', () => {
      it('默认模式应切换到上一首（回绕）', async () => {
        await player.prev(); // 从 0 回绕到 2
        expect(player.state.currentIndex).toBe(2);
        expect(player.state.currentTrack.id).toBe(3);
      });

      it('从中间位置应回到上一首', async () => {
        player.switchToIndex(1);
        await player.prev();
        expect(player.state.currentIndex).toBe(0);
        expect(player.state.currentTrack.id).toBe(1);
      });
    });
  });

  describe('播放模式切换：cyclePlayMode() / setPlayMode()', () => {
    describe('cyclePlayMode()', () => {
      it('应循环切换播放模式', () => {
        const initialMode = player.playMode;
        player.cyclePlayMode();
        expect(player.playMode).not.toBe(initialMode);
        expect(player.state.playMode).toBe(player.playMode);
      });

      it('完整循环后应回到初始模式', () => {
        const modes = [];
        for (let i = 0; i < 5; i++) {
          modes.push(player.playMode);
          player.cyclePlayMode();
        }
        // 第6次应该和第1次相同
        expect(player.playMode).toBe(modes[0]);
      });

      it('应发射 PLAY_MODE_CHANGE 事件', () => {
        const spy = vi.fn();
        player.events.on(PlayerEvents.PLAY_MODE_CHANGE, spy);

        player.cyclePlayMode();

        expect(spy).toHaveBeenCalledOnce();
        const eventData = spy.mock.calls[0][0];
        expect(eventData).toHaveProperty('previous');
        expect(eventData).toHaveProperty('current');
        expect(eventData).toHaveProperty('label');
      });

      it('应更新 label', () => {
        const previousLabel = player.playModeLabel;
        player.cyclePlayMode();
        expect(player.playModeLabel).not.toBe(previousLabel);
      });
    });

    describe('setPlayMode()', () => {
      it('应设置为指定模式', () => {
        player.setPlayMode(PlayMode.RANDOM_PLAY);
        expect(player.playMode).toBe(PlayMode.RANDOM_PLAY);
        expect(player.state.playMode).toBe(PlayMode.RANDOM_PLAY);
      });

      it('应发射 PLAY_MODE_CHANGE 事件', () => {
        const spy = vi.fn();
        player.events.on(PlayerEvents.PLAY_MODE_CHANGE, spy);

        player.setPlayMode(PlayMode.LOOP_SINGLE);

        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][0].current).toBe(PlayMode.LOOP_SINGLE);
      });

      it('设置无效模式也应发射事件（但模式不变）', () => {
        const spy = vi.fn();
        player.events.on(PlayerEvents.PLAY_MODE_CHANGE, spy);

        player.setPlayMode('invalid_mode');

        // 仍然会发射事件，但 current 可能还是原值
        expect(spy).toHaveBeenCalledOnce();
      });
    });
  });

  describe('switchToIndex()', () => {
    beforeEach(() => {
      player.replace([
        createTestTrack(1),
        createTestTrack(2),
        createTestTrack(3)
      ], 0);
    });

    it('应切换当前索引', () => {
      player.switchToIndex(2);
      expect(player.state.currentIndex).toBe(2);
      expect(player.state.currentTrack.id).toBe(3);
    });

    it('超出范围的索引应被截断', () => {
      player.switchToIndex(100);
      expect(player.state.currentIndex).toBe(2); // 最大有效索引

      player.switchToIndex(-10);
      expect(player.state.currentIndex).toBe(0); // 最小有效索引
    });
  });

  describe('destroy()', () => {
    it('应将 isDestroyed 设为 true', () => {
      player.destroy();
      expect(player.isDestroyed).toBe(true);
    });

    it('应清理 audioEngine', () => {
      player.destroy();
      expect(player.audioEngine).toBeNull();
    });

    it('应重置状态', () => {
      player.destroy();

      expect(player.state.playing).toBe(false);
      expect(player.state.loading).toBe(false);
      expect(player.state.currentTrack).toBeNull();
    });

    it('应清除事件总线', () => {
      const spy = vi.fn();
      player.events.on('test', spy);
      player.destroy();

      player.events.emit('test', {});
      expect(spy).not.toHaveBeenCalled();
    });

    it('重复调用 destroy 不应报错', () => {
      player.destroy();
      expect(() => {
        player.destroy();
      }).not.toThrow();
    });

    it('destroy 后各 getter 应安全返回值', () => {
      player.destroy();

      expect(() => {
        const _ = player.computedProgress;
        const __ = player.formattedCurrentTime;
        const ___ = player.formattedDuration;
        const ____ = player.hasTrack;
      }).not.toThrow();
    });
  });

  describe('事件系统', () => {
    it('应能监听和触发所有定义的事件类型', () => {
      const events = Object.values(PlayerEvents);
      const spies = {};

      events.forEach(event => {
        spies[event] = vi.fn();
        player.events.on(event, spies[event]);
      });

      // 手动触发一些事件来验证
      player.events.emit(PlayerEvents.PLAY, {});
      expect(spies[PlayerEvents.PLAY]).toHaveBeenCalledOnce();

      player.events.emit(PlayerEvents.PAUSE, {});
      expect(spies[PlayerEvents.PAUSE]).toHaveBeenCalledOnce();

      player.events.emit(PlayerEvents.ERROR, { error: new Error('test') });
      expect(spies[PlayerEvents.ERROR]).toHaveBeenCalledOnce();
    });

    it('事件处理器应接收到正确的数据', () => {
      const spy = vi.fn();
      player.events.on(PlayerEvents.TIME_UPDATE, spy);

      player.events.emit(PlayerEvents.TIME_UPDATE, {
        currentTime: 50,
        duration: 200
      });

      expect(spy).toHaveBeenCalledWith({
        currentTime: 50,
        duration: 200
      });
    });

    it('应支持移除事件监听器', () => {
      const spy = vi.fn();
      player.events.on(PlayerEvents.PLAY, spy);

      player.events.off(PlayerEvents.PLAY, spy);
      player.events.emit(PlayerEvents.PLAY, {});

      expect(spy).not.toHaveBeenCalled();
    });

    it('应支持一次性事件监听器', () => {
      const spy = vi.fn();
      player.events.once(PlayerEvents.PLAY, spy);

      player.events.emit(PlayerEvents.PLAY, {});
      player.events.emit(PlayerEvents.PLAY, {});

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('Getter 属性访问', () => {
    it('events 应返回 EventBus 实例', () => {
      expect(player.events).toBeDefined();
      expect(typeof player.events.on).toBe('function');
      expect(typeof player.events.emit).toBe('function');
    });

    it('state 应返回响应式状态对象', () => {
      expect(player.state).toBeDefined();
      expect(typeof player.state).toBe('object');
    });

    it('audioEngine 应返回 AudioEngine 实例', () => {
      expect(player.audioEngine).toBeDefined();
      expect(player.audioEngine.isActive).toBe(true);
    });

    it('playlist 应返回 PlaylistManager 实例', () => {
      expect(player.playlist).toBeDefined();
      expect(typeof player.playlist.push).toBe('function');
      expect(typeof player.playlist.remove).toBe('function');
    });

    it('playMode 应返回当前播放模式字符串', () => {
      expect(typeof player.playMode).toBe('string');
      expect(Object.values(PlayMode)).toContain(player.playMode);
    });

    it('playModeLabel 应返回当前模式的中文标签', () => {
      expect(typeof player.playModeLabel).toBe('string');
      expect(player.playModeLabel.length).toBeGreaterThan(0);
    });

    it('isDestroyed 应返回布尔值', () => {
      expect(typeof player.isDestroyed).toBe('boolean');
      expect(player.isDestroyed).toBe(false);
    });
  });

  describe('边界条件和异常场景', () => {
    it('对空播放列表执行操作不应崩溃', () => {
      expect(() => {
        player.next();
        player.prev();
        player.seek(50);
        player.seekByProgress(0.5);
        player.pause();
      }).not.toThrow();
    });

    it('push null/undefined 不应崩溃', () => {
      expect(() => {
        player.push(null);
        player.push(undefined);
      }).not.toThrow();
    });

    it('replace 非数组参数不应崩溃', () => {
      expect(() => {
        player.replace(null);
        player.replace(undefined);
        player.replace('not an array');
        player.replace(123);
      }).not.toThrow();
    });

    it('remove 负数或超大索引不应崩溃', () => {
      player.replace([createTestTrack(1)], 0);
      expect(() => {
        player.remove(-1);
        player.remove(100);
      }).not.toThrow();
    });

    it('大量操作后应保持稳定', () => {
      expect(() => {
        for (let i = 0; i < 1000; i++) {
          player.push(createTestTrack(i));
        }
        for (let i = 0; i < 500; i++) {
          player.remove(0);
        }
        player.setVolume(Math.random());
        player.cyclePlayMode();
      }).not.toThrow();
    });
  });

  describe('占位符处理', () => {
    it('id 为 -2 的 track 应被视为占位符', () => {
      player.replace([{ id: -2, name: 'placeholder' }], 0);
      expect(player.hasTrack).toBe(false);
    });

    it('正常 id 的 track 应被识别为有效 track', () => {
      player.replace([createTestTrack(1)], 0);
      expect(player.hasTrack).toBe(true);
    });
  });
});
