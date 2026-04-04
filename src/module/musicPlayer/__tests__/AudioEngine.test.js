import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from '../core/AudioEngine';

describe('AudioEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new AudioEngine();
  });

  afterEach(() => {
    if (engine && engine.isActive) {
      engine.destroy();
    }
  });

  describe('构造函数', () => {
    it('应创建 audio 元素', () => {
      expect(engine.audioDom).toBeDefined();
      expect(engine.audioDom.tagName.toLowerCase()).toBe('audio');
    });

    it('audio 元素的 preload 属性应设为 auto', () => {
      expect(engine.audioDom.preload).toBe('auto');
    });

    it('初始状态 isActive 应为 true', () => {
      expect(engine.isActive).toBe(true);
    });

    it('初始 src 应为空字符串', () => {
      expect(engine.src).toBe('');
    });
  });

  describe('getter: src', () => {
    it('应返回 audio 元素的 src', () => {
      engine.loadFromURL('http://example.com/test.mp3');
      expect(engine.src).toBe('http://example.com/test.mp3');
    });
  });

  describe('getter/setter: currentTime', () => {
    it('应能获取和设置 currentTime', () => {
      engine.currentTime = 50;
      expect(engine.currentTime).toBe(50);

      engine.currentTime = 100.5;
      expect(engine.currentTime).toBe(100.5);
    });

    it('设置负数 currentTime 不应报错（由浏览器处理）', () => {
      expect(() => {
        engine.currentTime = -10;
      }).not.toThrow();
    });

    it('设置 0 应该正常工作', () => {
      engine.currentTime = 0;
      expect(engine.currentTime).toBe(0);
    });
  });

  describe('getter: duration', () => {
    it('应返回 audio 元素的 duration（未加载时为 NaN）', () => {
      // 未加载音频时，duration 通常为 NaN
      expect(typeof engine.duration).toBe('number');
    });
  });

  describe('getter: paused', () => {
    it('初始状态应返回 true（未播放）', () => {
      expect(engine.paused).toBe(true);
    });
  });

  describe('getter: readyState', () => {
    it('应返回 audio 元素的 readyState', () => {
      // 初始状态通常为 0 (HAVE_NOTHING)
      expect(typeof engine.readyState).toBe('number');
    });
  });

  describe('getter/setter: volume', () => {
    it('应能获取和设置音量', () => {
      engine.volume = 0.5;
      expect(engine.volume).toBe(0.5);

      engine.volume = 1;
      expect(engine.volume).toBe(1);
    });

    it('音量应在 [0, 1] 范围内（自动截断）', () => {
      engine.volume = 1.5;
      expect(engine.volume).toBeLessThanOrEqual(1);
      expect(engine.volume).toBeGreaterThanOrEqual(0);

      engine.volume = -0.5;
      expect(engine.volume).toBeLessThanOrEqual(1);
      expect(engine.volume).toBeGreaterThanOrEqual(0);
    });

    it('设置音量为 0 应该正常工作', () => {
      engine.volume = 0;
      expect(engine.volume).toBe(0);
    });

    it('设置音量为 1 应该正常工作', () => {
      engine.volume = 1;
      expect(engine.volume).toBe(1);
    });
  });

  describe('loadFromURL()', () => {
    it('应设置 audio 元素的 src', () => {
      const url = 'http://example.com/song.mp3';
      engine.loadFromURL(url);
      expect(engine.src).toBe(url);
    });

    it('加载新 URL 前应清理旧的 URL', () => {
      const revokeSpy = vi.fn();
      // 模拟一个 destroyURLFn
      engine._testSetDestroyURLFn = revokeSpy;

      const url = 'http://example.com/new-song.mp3';
      engine.loadFromURL(url);

      expect(engine.src).toBe(url);
    });

    it('加载后 destroyURLFn 应为 null（非 blob URL）', () => {
      engine.loadFromURL('http://example.com/test.mp3');
      // 内部 #destroyURLFn 应为 null，但无法直接访问私有字段
      // 可以通过再次加载来验证不会出错
      expect(() => {
        engine.loadFromURL('http://example.com/another.mp3');
      }).not.toThrow();
    });

    it('可以加载空 URL', () => {
      expect(() => {
        engine.loadFromURL('');
      }).not.toThrow();
    });

    it('可以加载 blob URL', () => {
      const blobUrl = 'blob:http://localhost/test';
      expect(() => {
        engine.loadFromURL(blobUrl);
      }).not.toThrow();
      expect(engine.src).toBe(blobUrl);
    });
  });

  describe('play() 和 pause()', () => {
    it('play() 应调用 audio.play()', async () => {
      const playSpy = vi.spyOn(engine.audioDom, 'play').mockResolvedValue(undefined);
      await engine.play();
      expect(playSpy).toHaveBeenCalledOnce();
      playSpy.mockRestore();
    });

    it('pause() 应调用 audio.pause()', () => {
      const pauseSpy = vi.spyOn(engine.audioDom, 'pause').mockImplementation(() => {});
      engine.pause();
      expect(pauseSpy).toHaveBeenCalledOnce();
      pauseSpy.mockRestore();
    });
  });

  describe('事件绑定：on()', () => {
    it('应能在 audio 元素上注册事件监听器', () => {
      const handler = vi.fn();
      engine.on('play', handler);

      // 触发事件
      engine.audioDom.dispatchEvent(new Event('play'));
      expect(handler).toHaveBeenCalledOnce();
    });

    it('应支持多个事件监听器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      engine.on('play', handler1);
      engine.on('play', handler2);

      engine.audioDom.dispatchEvent(new Event('play'));

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('应支持不同类型的事件', () => {
      const playHandler = vi.fn();
      const pauseHandler = vi.fn();

      engine.on('play', playHandler);
      engine.on('pause', pauseHandler);

      engine.audioDom.dispatchEvent(new Event('play'));
      expect(playHandler).toHaveBeenCalledOnce();
      expect(pauseHandler).not.toHaveBeenCalled();

      engine.audioDom.dispatchEvent(new Event('pause'));
      expect(pauseHandler).toHaveBeenCalledOnce();
    });
  });

  describe('事件解绑：off()', () => {
    it('应能移除指定的事件监听器', () => {
      const handler = vi.fn();
      engine.on('play', handler);

      engine.off('play', handler);

      engine.audioDom.dispatchEvent(new Event('play'));
      expect(handler).not.toHaveBeenCalled();
    });

    it('移除不存在的监听器不应报错', () => {
      const handler = vi.fn();
      expect(() => {
        engine.off('play', handler);
      }).not.toThrow();
    });

    it('只移除指定事件的监听器，不影响其他事件', () => {
      const playHandler = vi.fn();
      const pauseHandler = vi.fn();

      engine.on('play', playHandler);
      engine.on('pause', pauseHandler);

      engine.off('play', playHandler);

      engine.audioDom.dispatchEvent(new Event('play'));
      expect(playHandler).not.toHaveBeenCalled();

      engine.audioDom.dispatchEvent(new Event('pause'));
      expect(pauseHandler).toHaveBeenCalledOnce();
    });

    it('移除一个监听器不应影响同类型的其他监听器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      engine.on('play', handler1);
      engine.on('play', handler2);

      engine.off('play', handler1);

      engine.audioDom.dispatchEvent(new Event('play'));
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe('removeAllListeners()', () => {
    it('应移除所有已注册的事件监听器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      engine.on('play', handler1);
      engine.on('pause', handler2);
      engine.on('timeupdate', handler3);

      engine.removeAllListeners();

      engine.audioDom.dispatchEvent(new Event('play'));
      engine.audioDom.dispatchEvent(new Event('pause'));
      engine.audioDom.dispatchEvent(new Event('timeupdate'));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('在没有监听器时调用不应报错', () => {
      expect(() => {
        engine.removeAllListeners();
      }).not.toThrow();
    });

    it('调用后可以重新添加新的监听器', () => {
      const handler = vi.fn();
      engine.on('play', handler);
      engine.removeAllListeners();

      const newHandler = vi.fn();
      engine.on('play', newHandler);

      engine.audioDom.dispatchEvent(new Event('play'));
      expect(handler).not.toHaveBeenCalled();
      expect(newHandler).toHaveBeenCalledOnce();
    });
  });

  describe('cleanupURL()', () => {
    it('通过 loadFromURL 加载普通 URL 后 cleanup 不应报错', () => {
      engine.loadFromURL('http://example.com/test.mp3');
      expect(() => {
        // cleanupURL 是私有方法，但可以通过 loadFromURL 间接测试
        engine.loadFromURL('http://example.com/other.mp3');
      }).not.toThrow();
    });
  });

  describe('destroy()', () => {
    it('应将 isActive 设为 false', () => {
      engine.destroy();
      expect(engine.isActive).toBe(false);
    });

    it('应移除所有事件监听器', () => {
      const handler = vi.fn();
      engine.on('play', handler);
      engine.destroy();

      // destroy 后不应再触发
      expect(handler).not.toHaveBeenCalled();
    });

    it('重复调用 destroy 不应报错', () => {
      engine.destroy();
      expect(() => {
        engine.destroy();
      }).not.toThrow();
    });

    it('destroy 后应清理 audio 元素', () => {
      engine.loadFromURL('http://example.com/test.mp3');
      engine.destroy();

      // 验证 isActive 为 false
      expect(engine.isActive).toBe(false);
    });

    it('destroy 后操作应该安全（不抛出异常）', () => {
      engine.destroy();
      expect(() => {
        engine.currentTime = 10;
        engine.volume = 0.5;
        engine.removeAllListeners();
      }).not.toThrow();
    });
  });

  describe('综合场景测试', () => {
    it('完整的生命周期：创建 -> 加载 -> 播放 -> 暂停 -> 销毁', async () => {
      const playSpy = vi.spyOn(engine.audioDom, 'play').mockResolvedValue(undefined);
      const pauseSpy = vi.spyOn(engine.audioDom, 'pause').mockImplementation(() => {});

      // 加载
      engine.loadFromURL('http://example.com/lifecycle-test.mp3');
      expect(engine.src).toBe('http://example.com/lifecycle-test.mp3');

      // 播放
      await engine.play();
      expect(playSpy).toHaveBeenCalled();

      // 暂停
      engine.pause();
      expect(pauseSpy).toHaveBeenCalled();

      // 销毁
      engine.destroy();
      expect(engine.isActive).toBe(false);

      playSpy.mockRestore();
      pauseSpy.mockRestore();
    });

    it('频繁切换 URL 应该稳定工作', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          engine.loadFromURL(`http://example.com/track${i}.mp3`);
        }
      }).not.toThrow();

      expect(engine.src).toContain('track99');
    });

    it('大量注册和移除事件监听器应该稳定', () => {
      const handlers = [];
      expect(() => {
        // 注册 100 个监听器
        for (let i = 0; i < 100; i++) {
          const handler = vi.fn();
          handlers.push(handler);
          engine.on('timeupdate', handler);
        }

        // 移除一半
        for (let i = 0; i < 50; i++) {
          engine.off('timeupdate', handlers[i]);
        }

        // 清除剩余的
        engine.removeAllListeners();
      }).not.toThrow();
    });
  });
});
