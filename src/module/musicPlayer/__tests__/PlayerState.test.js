import { describe, it, expect } from 'vitest';
import { formatTime, createPlayerState } from '../core/PlayerState';

describe('formatTime', () => {
  describe('正常值测试', () => {
    it('应正确格式化0秒', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    it('应正确格式化不足1分钟的秒数', () => {
      expect(formatTime(5)).toBe('00:05');
      expect(formatTime(30)).toBe('00:30');
      expect(formatTime(59)).toBe('00:59');
    });

    it('应正确格式化整分钟数', () => {
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(120)).toBe('02:00');
      expect(formatTime(600)).toBe('10:00');
      expect(formatTime(3600)).toBe('60:00');
    });

    it('应正确格式化分钟和秒数的组合', () => {
      expect(formatTime(65)).toBe('01:05');
      expect(formatTime(125)).toBe('02:05');
      expect(formatTime(3661)).toBe('61:01');
    });

    it('应处理小数秒数（向下取整）', () => {
      expect(formatTime(65.9)).toBe('01:05');
      expect(formatTime(125.5)).toBe('02:05');
    });

    it('应处理较大的时间值', () => {
      expect(formatTime(7200)).toBe('120:00'); // 2小时
      expect(formatTime(9999)).toBe('166:39');
    });
  });

  describe('边界值测试', () => {
    it('0 应返回 "00:00"', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    it('负数应返回 "00:00"', () => {
      expect(formatTime(-1)).toBe('00:00');
      expect(formatTime(-100)).toBe('00:00');
      expect(formatTime(-0.001)).toBe('00:00');
    });

    it('null 应返回 "00:00"', () => {
      expect(formatTime(null)).toBe('00:00');
    });

    it('undefined 应返回 "00:00"', () => {
      expect(formatTime(undefined)).toBe('00:00');
    });

    it('空字符串应返回 "00:00"（falsy值）', () => {
      expect(formatTime('')).toBe('00:00');
    });

    it('NaN 应返回 "00:00"', () => {
      expect(formatTime(NaN)).toBe('00:00');
    });

    it('Infinity 应返回 "00:00"', () => {
      expect(formatTime(Infinity)).toBe('00:00');
    });

    it('-Infinity 应返回 "00:00"', () => {
      expect(formatTime(-Infinity)).toBe('00:00');
    });
  });

  describe('输出格式验证', () => {
    it('输出应始终为 MM:SS 格式', () => {
      const result = formatTime(123);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('分钟和秒数都应为两位数，不足补零', () => {
      expect(formatTime(5)).toBe('00:05'); // 秒数补零
      expect(formatTime(60)).toBe('01:00'); // 分钟数补零
      expect(formatTime(61)).toBe('01:01'); // 都补零
    });
  });
});

describe('createPlayerState', () => {
  let playerState;

  beforeEach(() => {
    playerState = createPlayerState();
  });

  describe('初始状态值', () => {
    it('应返回包含 state 和计算属性的对象', () => {
      expect(playerState).toHaveProperty('state');
      expect(playerState).toHaveProperty('computedProgress');
      expect(playerState).toHaveProperty('formattedCurrentTime');
      expect(playerState).toHaveProperty('formattedDuration');
      expect(playerState).toHaveProperty('hasTrack');
    });

    it('state 应为 reactive 对象', () => {
      expect(playerState.state).toBeDefined();
      expect(typeof playerState.state).toBe('object');
    });

    describe('state 初始属性值', () => {
      it('playing 初始为 false', () => {
        expect(playerState.state.playing).toBe(false);
      });

      it('loading 初始为 false', () => {
        expect(playerState.state.loading).toBe(false);
      });

      it('canplay 初始为 false', () => {
        expect(playerState.state.canplay).toBe(false);
      });

      it('error 初始为 null', () => {
        expect(playerState.state.error).toBeNull();
      });

      it('errorOnloadSrc 初始为 false', () => {
        expect(playerState.state.errorOnloadSrc).toBe(false);
      });

      it('currentTime 初始为 0', () => {
        expect(playerState.state.currentTime).toBe(0);
      });

      it('currentTimeRound 初始为 0', () => {
        expect(playerState.state.currentTimeRound).toBe(0);
      });

      it('duration 初始为 0', () => {
        expect(playerState.state.duration).toBe(0);
      });

      it('durationRound 初始为 0', () => {
        expect(playerState.state.durationRound).toBe(0);
      });

      it('volume 初始为 1（最大音量）', () => {
        expect(playerState.state.volume).toBe(1);
      });

      it('currentTrack 初始为 null', () => {
        expect(playerState.state.currentTrack).toBeNull();
      });

      it('currentIndex 初始为 -1', () => {
        expect(playerState.state.currentIndex).toBe(-1);
      });

      it('playMode 初始为 loopPlaylist', () => {
        expect(playerState.state.playMode).toBe('loopPlaylist');
      });

      it('playlistLength 初始为 0', () => {
        expect(playerState.state.playlistLength).toBe(0);
      });
    });
  });

  describe('computedProgress 计算属性', () => {
    it('当 duration 为 0 时应返回 0', () => {
      playerState.state.duration = 0;
      playerState.state.currentTime = 50;
      expect(playerState.computedProgress.value).toBe(0);
    });

    it('当 duration 为负数时应返回 0', () => {
      playerState.state.duration = -100;
      playerState.state.currentTime = 50;
      expect(playerState.computedProgress.value).toBe(0);
    });

    it('当 duration 为 null/undefined 时应返回 0', () => {
      playerState.state.duration = null;
      expect(playerState.computedProgress.value).toBe(0);

      playerState.state.duration = undefined;
      expect(playerState.computedProgress.value).toBe(0);
    });

    it('应正确计算进度比例', () => {
      playerState.state.duration = 100;
      playerState.state.currentTime = 50;
      expect(playerState.computedProgress.value).toBe(0.5);

      playerState.state.currentTime = 25;
      expect(playerState.computedProgress.value).toBe(0.25);

      playerState.state.currentTime = 75;
      expect(playerState.computedProgress.value).toBe(0.75);
    });

    it('进度为 0 时应返回 0', () => {
      playerState.state.duration = 100;
      playerState.state.currentTime = 0;
      expect(playerState.computedProgress.value).toBe(0);
    });

    it('进度完成时应返回 1', () => {
      playerState.state.duration = 100;
      playerState.state.currentTime = 100;
      expect(playerState.computedProgress.value).toBe(1);
    });

    it('超过 duration 时应截断为 1（不超过1）', () => {
      playerState.state.duration = 100;
      playerState.state.currentTime = 150;
      expect(playerState.computedProgress.value).toBe(1);

      playerState.state.currentTime = 99999;
      expect(playerState.computedProgress.value).toBe(1);
    });

    it('应是响应式的（state 变化时自动更新）', () => {
      playerState.state.duration = 200;
      playerState.state.currentTime = 0;
      expect(playerState.computedProgress.value).toBe(0);

      playerState.state.currentTime = 100;
      expect(playerState.computedProgress.value).toBe(0.5);

      playerState.state.duration = 400;
      expect(playerState.computedProgress.value).toBe(0.25); // 100/400
    });

    it('处理浮点精度问题', () => {
      playerState.state.duration = 3;
      playerState.state.currentTime = 1;
      const progress = playerState.computedProgress.value;
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });
  });

  describe('formattedCurrentTime 计算属性', () => {
    it('初始状态应返回 "00:00"', () => {
      expect(playerState.formattedCurrentTime.value).toBe('00:00');
    });

    it('应根据 currentTimeRound 格式化时间', () => {
      playerState.state.currentTimeRound = 65;
      expect(playerState.formattedCurrentTime.value).toBe('01:05');

      playerState.state.currentTimeRound = 125;
      expect(playerState.formattedCurrentTime.value).toBe('02:05');
    });

    it('应为 MM:SS 格式', () => {
      playerState.state.currentTimeRound = 3661;
      expect(playerState.formattedCurrentTime.value).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('formattedDuration 计算属性', () => {
    it('初始状态应返回 "00:00"', () => {
      expect(playerState.formattedDuration.value).toBe('00:00');
    });

    it('应根据 durationRound 格式化时间', () => {
      playerState.state.durationRound = 180;
      expect(playerState.formattedDuration.value).toBe('03:00');

      playerState.state.durationRound = 245;
      expect(playerState.formattedDuration.value).toBe('04:05');
    });

    it('应为 MM:SS 格式', () => {
      playerState.state.durationRound = 5000;
      expect(playerState.formattedDuration.value).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('hasTrack 计算属性', () => {
    it('currentTrack 为 null 时应返回 falsy', () => {
      playerState.state.currentTrack = null;
      expect(playerState.hasTrack.value).toBeFalsy();
    });

    it('currentTrack 为 undefined 时应返回 falsy', () => {
      playerState.state.currentTrack = undefined;
      expect(playerState.hasTrack.value).toBeFalsy();
    });

    it('id 为 -2 的占位符 track 应返回 false', () => {
      playerState.state.currentTrack = { id: -2, name: 'placeholder' };
      expect(playerState.hasTrack.value).toBe(false);
    });

    it('正常的 track 应返回 true', () => {
      playerState.state.currentTrack = { id: 1, name: 'Test Song' };
      expect(playerState.hasTrack.value).toBe(true);
    });

    it('id 为 0 的 track 应返回 true（有效ID）', () => {
      playerState.state.currentTrack = { id: 0, name: 'Song with ID 0' };
      expect(playerState.hasTrack.value).toBe(true);
    });

    it('id 为正数的 track 应返回 true', () => {
      playerState.state.currentTrack = { id: 12345, name: 'Normal Song' };
      expect(playerState.hasTrack.value).toBe(true);
    });

    it('id 为 -1 的 track 应返回 true（非-2即为有效）', () => {
      playerState.state.currentTrack = { id: -1, name: 'Special Song' };
      expect(playerState.hasTrack.value).toBe(true);
    });

    it('track 对象没有 id 属性时应返回 true（undefined !== -2）', () => {
      playerState.state.currentTrack = { name: 'No ID Song' };
      // 注意：undefined !== -2 为 true
      expect(playerState.hasTrack.value).toBe(true);
    });
  });

  describe('响应性测试', () => {
    it('修改 state 后计算属性应更新', () => {
      // 初始状态
      expect(playerState.hasTrack.value).toBeFalsy();
      expect(playerState.formattedDuration.value).toBe('00:00');

      // 修改 state
      playerState.state.currentTrack = { id: 1, name: 'Test' };
      playerState.state.durationRound = 200;

      // 验证更新
      expect(playerState.hasTrack.value).toBe(true);
      expect(playerState.formattedDuration.value).toBe('03:20');
    });

    it('多次修改 state 应保持一致性', () => {
      for (let i = 0; i < 100; i++) {
        playerState.state.currentTime = i;
        playerState.state.duration = 100;
        expect(playerState.computedProgress.value).toBe(i / 100);
      }
    });
  });
});
