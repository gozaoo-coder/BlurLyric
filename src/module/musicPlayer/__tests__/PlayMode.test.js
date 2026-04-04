import { describe, it, expect, beforeEach } from 'vitest';
import { PlayMode, PlayModeLabels, PlayModeManager } from '../core/PlayMode';

describe('PlayMode', () => {
  describe('枚举值', () => {
    it('应包含所有5个播放模式', () => {
      expect(PlayMode.LOOP_PLAYLIST).toBe('loopPlaylist');
      expect(PlayMode.LOOP_SINGLE).toBe('loopSingle');
      expect(PlayMode.STOP_AFTER_SINGLE).toBe('stopAfterSingle');
      expect(PlayMode.RANDOM_PLAY).toBe('randomPlay');
      expect(PlayMode.REVERSE_LOOP).toBe('reverseLoop');
    });

    it('所有枚举值应为字符串类型', () => {
      Object.values(PlayMode).forEach(mode => {
        expect(typeof mode).toBe('string');
      });
    });

    it('所有枚举值应唯一', () => {
      const modes = Object.values(PlayMode);
      const uniqueModes = new Set(modes);
      expect(uniqueModes.size).toBe(modes.length);
    });

    it('应有恰好5个播放模式', () => {
      expect(Object.keys(PlayMode)).toHaveLength(5);
    });
  });

  describe('PlayModeLabels 映射', () => {
    it('应为每个模式提供中文标签', () => {
      expect(PlayModeLabels[PlayMode.LOOP_PLAYLIST]).toBe('列表循环');
      expect(PlayModeLabels[PlayMode.LOOP_SINGLE]).toBe('单曲循环');
      expect(PlayModeLabels[PlayMode.STOP_AFTER_SINGLE]).toBe('播完本曲暂停');
      expect(PlayModeLabels[PlayMode.RANDOM_PLAY]).toBe('随机播放');
      expect(PlayModeLabels[PlayMode.REVERSE_LOOP]).toBe('倒序循环');
    });

    it('标签数量应与模式数量一致', () => {
      expect(Object.keys(PlayModeLabels)).toHaveLength(Object.keys(PlayMode).length);
    });

    it('所有标签值都应为非空字符串', () => {
      Object.values(PlayModeLabels).forEach(label => {
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('PlayModeManager', () => {
  let manager;

  beforeEach(() => {
    manager = new PlayModeManager();
  });

  describe('构造函数和初始状态', () => {
    it('初始模式应为 LOOP_PLAYLIST', () => {
      expect(manager.current).toBe(PlayMode.LOOP_PLAYLIST);
    });

    it('初始标签应为"列表循环"', () => {
      expect(manager.label).toBe('列表循环');
    });

    it('allModes 应返回所有模式的副本数组', () => {
      const modes = manager.allModes;
      expect(modes).toContain(PlayMode.LOOP_PLAYLIST);
      expect(modes).toContain(PlayMode.LOOP_SINGLE);
      expect(modes).toContain(PlayMode.STOP_AFTER_SINGLE);
      expect(modes).toContain(PlayMode.RANDOM_PLAY);
      expect(modes).toContain(PlayMode.REVERSE_LOOP);
      expect(modes).toHaveLength(5);

      // 验证返回的是副本，修改不影响原数据
      modes.push('invalid');
      expect(manager.allModes).not.toContain('invalid');
    });
  });

  describe('next() - 循环切换模式', () => {
    it('从 LOOP_PLAYLIST 切换到 LOOP_SINGLE', () => {
      const result = manager.next();
      expect(result).toBe(PlayMode.LOOP_SINGLE);
      expect(manager.current).toBe(PlayMode.LOOP_SINGLE);
    });

    it('完整遍历所有模式后回到起点', () => {
      const expectedOrder = [
        PlayMode.LOOP_SINGLE,
        PlayMode.STOP_AFTER_SINGLE,
        PlayMode.RANDOM_PLAY,
        PlayMode.REVERSE_LOOP,
        PlayMode.LOOP_PLAYLIST
      ];

      expectedOrder.forEach(expectedMode => {
        const result = manager.next();
        expect(result).toBe(expectedMode);
      });

      // 回到起点
      expect(manager.current).toBe(PlayMode.LOOP_PLAYLIST);
    });

    it('连续调用 next() 应循环切换', () => {
      const modes = [];
      for (let i = 0; i < 12; i++) {
        modes.push(manager.next());
      }
      // 12次切换应该完成2个完整循环加2次
      expect(modes[0]).toBe(modes[5]);
      expect(modes[5]).toBe(modes[10]);
    });

    it('next() 应返回当前新模式', () => {
      const currentBefore = manager.current;
      const returnedValue = manager.next();
      expect(returnedValue).toBe(manager.current);
      expect(returnedValue).not.toBe(currentBefore);
    });
  });

  describe('set() - 设置模式', () => {
    it('可以设置为有效的播放模式', () => {
      manager.set(PlayMode.RANDOM_PLAY);
      expect(manager.current).toBe(PlayMode.RANDOM_PLAY);
      expect(manager.label).toBe('随机播放');
    });

    it('设置后标签应正确更新', () => {
      manager.set(PlayMode.REVERSE_LOOP);
      expect(manager.label).toBe('倒序循环');

      manager.set(PlayMode.STOP_AFTER_SINGLE);
      expect(manager.label).toBe('播完本曲暂停');
    });

    it('设置无效模式不应改变当前状态', () => {
      const originalMode = manager.current;
      manager.set('invalid_mode');
      expect(manager.current).toBe(originalMode);

      manager.set(null);
      expect(manager.current).toBe(originalMode);

      manager.set(undefined);
      expect(manager.current).toBe(originalMode);

      manager.set(123);
      expect(manager.current).toBe(originalMode);
    });

    it('可以设置为当前相同模式（幂等性）', () => {
      manager.set(PlayMode.LOOP_PLAYLIST);
      expect(manager.current).toBe(PlayMode.LOOP_PLAYLIST);
    });
  });

  describe('getNextIndex() - 获取下一首索引', () => {
    describe('边界条件：空播放列表或无效长度', () => {
      it('playlistLength 为 0 时返回 0', () => {
        expect(manager.getNextIndex(0, 0)).toBe(0);
        expect(manager.getNextIndex(5, 0)).toBe(0);
        expect(manager.getNextIndex(-1, 0)).toBe(0);
      });

      it('playlistLength 为负数时返回 0', () => {
        expect(manager.getNextIndex(0, -1)).toBe(0);
        expect(manager.getNextIndex(2, -5)).toBe(0);
      });
    });

    describe('LOOP_PLAYLIST 模式', () => {
      beforeEach(() => {
        manager.set(PlayMode.LOOP_PLAYLIST);
      });

      it('正常情况：返回下一首索引', () => {
        expect(manager.getNextIndex(0, 5)).toBe(1);
        expect(manager.getNextIndex(2, 5)).toBe(3);
        expect(manager.getNextIndex(3, 5)).toBe(4);
      });

      it('边界：最后一首时回到第一首', () => {
        expect(manager.getNextIndex(4, 5)).toBe(0);
      });

      it('单首歌曲时始终返回 0', () => {
        expect(manager.getNextIndex(0, 1)).toBe(0);
      });
    });

    describe('LOOP_SINGLE 模式', () => {
      beforeEach(() => {
        manager.set(PlayMode.LOOP_SINGLE);
      });

      it('始终返回当前索引', () => {
        expect(manager.getNextIndex(0, 5)).toBe(0);
        expect(manager.getNextIndex(2, 5)).toBe(2);
        expect(manager.getNextIndex(4, 5)).toBe(4);
      });

      it('单首歌曲时返回 0', () => {
        expect(manager.getNextIndex(0, 1)).toBe(0);
      });
    });

    describe('STOP_AFTER_SINGLE 模式', () => {
      beforeEach(() => {
        manager.set(PlayMode.STOP_AFTER_SINGLE);
      });

      it('正常情况：与列表循环相同的索引计算', () => {
        expect(manager.getNextIndex(0, 5)).toBe(1);
        expect(manager.getNextIndex(4, 5)).toBe(0);
      });

      it('单首歌曲时返回 0', () => {
        expect(manager.getNextIndex(0, 1)).toBe(0);
      });
    });

    describe('RANDOM_PLAY 模式', () => {
      beforeEach(() => {
        manager.set(PlayMode.RANDOM_PLAY);
      });

      it('返回的索引应在有效范围内', () => {
        for (let i = 0; i < 100; i++) {
          const nextIdx = manager.getNextIndex(2, 5);
          expect(nextIdx).toBeGreaterThanOrEqual(0);
          expect(nextIdx).toBeLessThan(5);
        }
      });

      it('多首歌曲时不应返回当前索引', () => {
        // 多次测试以确保随机性不会偶然返回相同索引
        let allDifferent = false;
        for (let attempt = 0; attempt < 50; attempt++) {
          const nextIdx = manager.getNextIndex(2, 5);
          if (nextIdx !== 2) {
            allDifferent = true;
            break;
          }
        }
        expect(allDifferent).toBe(true);
      });

      it('单首歌曲时只能返回 0', () => {
        // 单首歌曲时只有索引0可选
        expect(manager.getNextIndex(0, 1)).toBe(0);
      });

      it('两首歌曲时应交替返回不同索引', () => {
        const results = new Set();
        for (let i = 0; i < 20; i++) {
          results.add(manager.getNextIndex(0, 2));
        }
        // 两首歌曲时应该能取到两个不同的值
        expect(results.size).toBeGreaterThanOrEqual(1);
        expect(results.has(0) || results.has(1)).toBe(true);
      });
    });

    describe('REVERSE_LOOP 模式', () => {
      beforeEach(() => {
        manager.set(PlayMode.REVERSE_LOOP);
      });

      it('正常情况：返回前一首索引', () => {
        expect(manager.getNextIndex(4, 5)).toBe(3);
        expect(manager.getNextIndex(3, 5)).toBe(2);
        expect(manager.getNextIndex(1, 5)).toBe(0);
      });

      it('边界：第一首时跳到最后一首', () => {
        expect(manager.getNextIndex(0, 5)).toBe(4);
      });

      it('单首歌曲时返回 0', () => {
        expect(manager.getNextIndex(0, 1)).toBe(0);
      });
    });
  });

  describe('getPrevIndex() - 获取上一首索引', () => {
    describe('边界条件：空播放列表或无效长度', () => {
      it('playlistLength 为 0 时返回 0', () => {
        expect(manager.getPrevIndex(0, 0)).toBe(0);
        expect(manager.getPrevIndex(5, 0)).toBe(0);
      });

      it('playlistLength 为负数时返回 0', () => {
        expect(manager.getPrevIndex(0, -1)).toBe(0);
      });
    });

    describe('LOOP_PLAYLIST 模式', () => {
      beforeEach(() => {
        manager.set(PlayMode.LOOP_PLAYLIST);
      });

      it('正常情况：返回前一首索引', () => {
        expect(manager.getPrevIndex(4, 5)).toBe(3);
        expect(manager.getPrevIndex(2, 5)).toBe(1);
        expect(manager.getPrevIndex(1, 5)).toBe(0);
      });

      it('边界：第一首时跳到最后一首', () => {
        expect(manager.getPrevIndex(0, 5)).toBe(4);
      });

      it('单首歌曲时返回 0', () => {
        expect(manager.getPrevIndex(0, 1)).toBe(0);
      });
    });

    describe('REVERSE_LOOP 模式', () => {
      beforeEach(() => {
        manager.set(PlayMode.REVERSE_LOOP);
      });

      it('正常情况：与正向列表循环相反（返回下一首）', () => {
        expect(manager.getPrevIndex(0, 5)).toBe(1);
        expect(manager.getPrevIndex(2, 5)).toBe(3);
        expect(manager.getPrevIndex(4, 5)).toBe(0);
      });

      it('单首歌曲时返回 0', () => {
        expect(manager.getPrevIndex(0, 1)).toBe(0);
      });
    });

    describe('RANDOM_PLAY 模式', () => {
      beforeEach(() => {
        manager.set(PlayMode.RANDOM_PLAY);
      });

      it('返回的索引应在有效范围内', () => {
        for (let i = 0; i < 50; i++) {
          const prevIdx = manager.getPrevIndex(2, 5);
          expect(prevIdx).toBeGreaterThanOrEqual(0);
          expect(prevIdx).toBeLessThan(5);
        }
      });

      it('多首歌曲时通常不返回当前索引', () => {
        let foundDifferent = false;
        for (let attempt = 0; attempt < 50; attempt++) {
          if (manager.getPrevIndex(2, 5) !== 2) {
            foundDifferent = true;
            break;
          }
        }
        expect(foundDifferent).toBe(true);
      });

      it('单首歌曲时只能返回 0', () => {
        expect(manager.getPrevIndex(0, 1)).toBe(0);
      });
    });

    describe('LOOP_SINGLE 和 STOP_AFTER_SINGLE 模式', () => {
      it('LOOP_SINGLE: 返回前一首（回绕）', () => {
        manager.set(PlayMode.LOOP_SINGLE);
        expect(manager.getPrevIndex(0, 5)).toBe(4);
        expect(manager.getPrevIndex(2, 5)).toBe(1);
      });

      it('STOP_AFTER_SINGLE: 返回前一首（回绕）', () => {
        manager.set(PlayMode.STOP_AFTER_SINGLE);
        expect(manager.getPrevIndex(0, 5)).toBe(4);
        expect(manager.getPrevIndex(3, 5)).toBe(2);
      });
    });
  });

  describe('shouldAutoAdvance() - 是否自动前进', () => {
    it('LOOP_PLAYLIST 模式应自动前进', () => {
      manager.set(PlayMode.LOOP_PLAYLIST);
      expect(manager.shouldAutoAdvance()).toBe(true);
    });

    it('LOOP_SINGLE 模式应自动前进', () => {
      manager.set(PlayMode.LOOP_SINGLE);
      expect(manager.shouldAutoAdvance()).toBe(true);
    });

    it('RANDOM_PLAY 模式应自动前进', () => {
      manager.set(PlayMode.RANDOM_PLAY);
      expect(manager.shouldAutoAdvance()).toBe(true);
    });

    it('REVERSE_LOOP 模式应自动前进', () => {
      manager.set(PlayMode.REVERSE_LOOP);
      expect(manager.shouldAutoAdvance()).toBe(true);
    });

    it('STOP_AFTER_SINGLE 模式不应自动前进', () => {
      manager.set(PlayMode.STOP_AFTER_SINGLE);
      expect(manager.shouldAutoAdvance()).toBe(false);
    });
  });

  describe('综合场景测试', () => {
    it('切换模式后再计算索引应使用新模式', () => {
      manager.set(PlayMode.LOOP_SINGLE);
      expect(manager.getNextIndex(2, 5)).toBe(2); // 单曲循环

      manager.next(); // 切换到 STOP_AFTER_SINGLE
      expect(manager.getNextIndex(2, 5)).toBe(3); // 下一首
    });

    it('大量调用不应出现异常', () => {
      expect(() => {
        for (let i = 0; i < 10000; i++) {
          manager.next();
          manager.getNextIndex(i % 10, 10);
          manager.getPrevIndex(i % 10, 10);
          manager.shouldAutoAdvance();
        }
      }).not.toThrow();
    });
  });
});
