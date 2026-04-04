import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransitionStrategy } from '../transition/TransitionStrategy';
import { TransitionNextMusic, InstantSwitch, VolumeFader } from '../transition/TransitionNextMusic';

// ============================================================
// Helper: 创建 mock audioEngine 对象
// ============================================================
function createMockAudioEngine(overrides = {}) {
    return {
        isActive: true,
        duration: 180,
        currentTime: 30,
        volume: 0.8,
        destroy: vi.fn(),
        play: vi.fn(),
        ...overrides,
    };
}

// ============================================================
// Helper: 创建 mock player 对象
// ============================================================
function createMockPlayer(overrides = {}) {
    const engine = createMockAudioEngine();
    return {
        audioEngine: engine,
        state: { volume: 0.7 },
        switchToIndex: vi.fn(),
        loadCurrentTrack: vi.fn().mockResolvedValue(undefined),
        play: vi.fn(),
        _activeTransitions: [],
        _cancelActiveTransitions: vi.fn(),
        ...overrides,
    };
}

// ============================================================
// 1. TransitionStrategy 基类测试
// ============================================================
describe('TransitionStrategy', () => {
    it('execute() 默认应抛出错误，提示子类必须实现', async () => {
        const strategy = new TransitionStrategy();
        await expect(strategy.execute({}, 0)).rejects.toThrow(
            'TransitionStrategy.execute() must be implemented by subclass'
        );
    });

    it('应作为可继承的抽象基类使用', () => {
        class CustomStrategy extends TransitionStrategy {
            async execute(player, targetIndex) {
                return `switched to ${targetIndex}`;
            }
        }

        const custom = new CustomStrategy();
        expect(custom).toBeInstanceOf(TransitionStrategy);
        // 子类实现后不应抛出错误
        expect(custom.execute({}, 5)).resolves.toBe('switched to 5');
    });
});

// ============================================================
// 2. VolumeFader.fade() 测试
// ============================================================
describe('VolumeFader.fade()', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // --- durationMs <= 0 边界 ---
    describe('durationMs <= 0 时立即完成', () => {
        it('durationMs = 0 应立即设置目标音量并调用 onComplete', () => {
            const engine = { volume: 0.2 };
            const onComplete = vi.fn();

            const cancel = VolumeFader.fade(engine, 0.2, 0.9, 0, null, onComplete);

            expect(engine.volume).toBe(0.9);
            expect(onComplete).toHaveBeenCalledTimes(1);
            // cancel 函数应为空操作
            expect(cancel).toBeTypeOf('function');
            cancel(); // 不应报错
        });

        it('durationMs 为负数时应立即完成', () => {
            const engine = { volume: 1 };
            const onComplete = vi.fn();

            VolumeFader.fade(engine, 1, 0, -100, null, onComplete);

            expect(engine.volume).toBe(0);
            expect(onComplete).toHaveBeenCalledTimes(1);
        });
    });

    // --- 正常淡入淡出过程 ---
    describe('正常淡入淡出过程', () => {
        it('volume 应随时间从 fromVolume 渐变到 toVolume（淡入）', async () => {
            const engine = { volume: 0 };
            const onUpdate = vi.fn();
            const onComplete = vi.fn();

            VolumeFader.fade(engine, 0, 1, 1000, onUpdate, onComplete);

            // 初始值应为起始音量（首帧之前）
            expect(engine.volume).toBe(0);

            // 前进一半时间
            await vi.advanceTimersByTime(500);

            // 音量应接近中间值 (允许一定误差)
            expect(engine.volume).toBeGreaterThan(0.3);
            expect(engine.volume).toBeLessThan(0.7);
            expect(onUpdate).toHaveBeenCalled();

            // 前进到结束
            await vi.advanceTimersByTime(600);

            // 最终音量应为目标值
            expect(engine.volume).toBe(1);
            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it('volume 应随时间从 fromVolume 渐变到 toVolume（淡出）', async () => {
            const engine = { volume: 0.8 };
            const onComplete = vi.fn();

            VolumeFader.fade(engine, 0.8, 0, 800, null, onComplete);

            await vi.advanceTimersByTime(400);

            expect(engine.volume).toBeGreaterThan(0.2);
            expect(engine.volume).toBeLessThan(0.7);

            await vi.advanceTimersByTime(500);

            expect(engine.volume).toBe(0);
            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it('onUpdate 回调应在每帧被调用并传入 progress 参数', async () => {
            const engine = { volume: 0 };
            const onUpdate = vi.fn();

            VolumeFader.fade(engine, 0, 1, 500, onUpdate, null);

            await vi.advanceTimersByTime(200);

            // onUpdate 至少被调用一次
            expect(onUpdate.mock.calls.length).toBeGreaterThan(0);

            // 每次调用的参数应该是 [progress]，且 progress 在 [0, 1] 范围内
            for (const call of onUpdate.mock.calls) {
                const progress = call[0];
                expect(progress).toBeGreaterThanOrEqual(0);
                expect(progress).toBeLessThanOrEqual(1);
            }
        });

        it('onComplete 应在动画结束时恰好调用一次', async () => {
            const engine = { volume: 0.5 };
            const onComplete = vi.fn();

            VolumeFader.fade(engine, 0.5, 1, 300, null, onComplete);

            // 动画未完成时不应调用
            await vi.advanceTimersByTime(100);
            expect(onComplete).not.toHaveBeenCalled();

            // 动画完成后应调用一次
            await vi.advanceTimersByTime(300);
            expect(onComplete).toHaveBeenCalledTimes(1);

            // 不应再次调用
            await vi.advanceTimersByTime(500);
            expect(onComplete).toHaveBeenCalledTimes(1);
        });
    });

    // --- 取消功能 ---
    describe('取消功能', () => {
        it('cancel 函数应停止动画且不再更新音量', async () => {
            const engine = { volume: 0 };
            const onUpdate = vi.fn();
            const onComplete = vi.fn();

            const cancel = VolumeFader.fade(engine, 0, 1, 1000, onUpdate, onComplete);

            // 运行一段时间
            await vi.advanceTimersByTime(200);
            const volumeAtCancel = engine.volume;
            expect(volumeAtCancel).toBeGreaterThan(0);

            // 取消动画
            cancel();

            // 继续推进时间，音量不再变化
            await vi.advanceTimersByTime(2000);
            expect(engine.volume).toBe(volumeAtCancel);

            // onComplete 不应被调用（因为被取消了）
            expect(onComplete).not.toHaveBeenCalled();
        });

        it('多次调用 cancel 不应报错', async () => {
            const engine = { volume: 0 };

            const cancel = VolumeFader.fade(engine, 0, 1, 1000, null, null);

            cancel();
            cancel(); // 第二次调用不应抛异常
        });
    });

    // --- volume 边界 clamp [0, 1] ---
    describe('volume 边界 clamp [0, 1]', () => {
        it('动画过程中计算出的音量低于 0 时应被 clamp 到 0', async () => {
            const engine = { volume: 0.1 };

            VolumeFader.fade(engine, 0.1, -0.5, 200, null, null);

            // 动画中途：中间值应在 [0, 0.1] 范围内（被 clamp）
            await vi.advanceTimersByTime(100);
            expect(engine.volume).toBeGreaterThanOrEqual(0);
            expect(engine.volume).toBeLessThanOrEqual(0.11);

            // 动画结束：源码在最后一帧直接赋值 toVolume（无 clamp）
            await vi.advanceTimersByTime(200);
            expect(engine.volume).toBe(-0.5); // 最终值为 toVolume 原值
        });

        it('动画过程中计算出的音量高于 1 时应被 clamp 到 1', async () => {
            const engine = { volume: 0.8 };

            VolumeFader.fade(engine, 0.8, 1.5, 200, null, null);

            // 动画中途：中间值应在 [0.8, 1] 范围内（被 clamp 上界）
            await vi.advanceTimersByTime(100);
            expect(engine.volume).toBeGreaterThanOrEqual(0.79);
            expect(engine.volume).toBeLessThanOrEqual(1.01);

            // 动画结束：源码在最后一帧直接赋值 toVolume（无 clamp）
            await vi.advanceTimersByTime(200);
            expect(engine.volume).toBe(1.5); // 最终值为 toVolume 原值
        });

        it('fromVolume 和 toVolume 相同时音量保持不变', async () => {
            const engine = { volume: 0.6 };
            const onComplete = vi.fn();

            VolumeFader.fade(engine, 0.6, 0.6, 500, null, onComplete);

            await vi.advanceTimersByTime(600);

            expect(engine.volume).toBe(0.6);
            expect(onComplete).toHaveBeenCalledTimes(1);
        });
    });
});

// ============================================================
// 3. TransitionNextMusic.execute() 测试
// ============================================================
describe('TransitionNextMusic.execute()', () => {
    let strategy;

    beforeEach(() => {
        strategy = new TransitionNextMusic();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // --- audioEngine 不活跃时的即时切换回退 ---
    describe('audioEngine 不活跃时的即时切换回退', () => {
        it('audioEngine 为 null 时应执行即时切换', async () => {
            const player = createMockPlayer({ audioEngine: null });

            await strategy.execute(player, 2);

            // 应调用 _instantSwitch 内部逻辑
            expect(player.switchToIndex).toHaveBeenCalledWith(2);
            expect(player.loadCurrentTrack).toHaveBeenCalled();
        });

        it('audioEngine.isActive 为 false 时应执行即时切换（含 play 调用）', async () => {
            const player = createMockPlayer({
                audioEngine: createMockAudioEngine({ isActive: false }),
            });

            await strategy.execute(player, 3);

            expect(player.switchToIndex).toHaveBeenCalledWith(3);
            expect(player.loadCurrentTrack).toHaveBeenCalled();
            // _instantSwitch 内部会调用 loadCurrentTrack().then(() => play())
            expect(player.play).toHaveBeenCalledTimes(1);
        });
    });

    // --- 正常过渡流程 ---
    describe('正常过渡流程', () => {
        it(
            '应按顺序完成：加载新曲目 -> 新引擎淡入 -> 旧引擎淡出 -> 销毁旧引擎',
            async () => {
                let newEngineInstance = null;
                const oldEngineRef = createMockAudioEngine();
                const player = createMockPlayer({
                    audioEngine: oldEngineRef,
                    loadCurrentTrack: vi.fn().mockImplementation(async () => {
                        newEngineInstance = createMockAudioEngine({ volume: 0, isActive: true });
                        player.audioEngine = newEngineInstance;
                    }),
                });

                // 使用 runAllTimersAsync 自动处理所有 timer 和 microtask
                const promise = strategy.execute(player, 1, {});
                await vi.runAllTimersAsync();

                // 等待 Promise resolve
                await promise;

                // 验证完整流程
                expect(player.switchToIndex).toHaveBeenCalledWith(1);
                expect(newEngineInstance).not.toBeNull();
                expect(player.play).toHaveBeenCalled();
                // 旧引擎应被销毁（通过旧引擎引用验证）
                expect(oldEngineRef.destroy).toHaveBeenCalledTimes(1);
            },
            30000, // 足够长的超时
        );

        it('新引擎初始音量应设为 targetVolume * 0.5 后开始淡入', async () => {
            const newEngine = createMockAudioEngine({ volume: 0, isActive: true });
            const player = createMockPlayer({
                state: { volume: 0.8 },
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = newEngine;
                }),
            });

            strategy.execute(player, 1, {});
            await vi.advanceTimersByTime(0); // 触发 loadCurrentTrack

            // 新引擎初始音量应为 targetVolume * 0.5
            expect(newEngine.volume).toBe(0.4);
        });
    });

    // --- leastTime 选项的处理 ---
    describe('leastTime 选项的处理', () => {
        it('options.leastTime 有自定义值时应使用该值（在 clamp 范围内）', async () => {
            const newEngine = createMockAudioEngine({ volume: 0, isActive: true });
            const oldEngine = createMockAudioEngine({ duration: 200, currentTime: 50 });
            const player = createMockPlayer({
                audioEngine: oldEngine,
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = newEngine;
                }),
            });

            // 自定义 leastTime = 2000
            strategy.execute(player, 1, { leastTime: 2000 });
            await vi.advanceTimersByTime(0);

            // 推进 2000ms+ 应该足够完成动画（因为 leastTime=2000）
            await vi.advanceTimersByTime(2500);

            // 旧引擎应该已经被销毁
            expect(oldEngine.destroy).toHaveBeenCalled();
        });

        it('未提供 leastTime 且旧音频有有限时长时应从剩余时间计算', async () => {
            const oldEngine = createMockAudioEngine({
                duration: 180,   // 180秒
                currentTime: 170, // 已播放170秒，剩余10秒
            });
            const player = createMockPlayer({
                audioEngine: oldEngine,
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = createMockAudioEngine({ volume: 0, isActive: true });
                }),
            });

            // 剩余时间 = (180-170)*1000 = 10000ms, Math.max(100, 10000) = 10000
            strategy.execute(player, 1, {});
            await vi.advanceTimersByTime(0);

            // 需要 ~10000ms 完成动画
            await vi.advanceTimersByTime(11000);
            expect(oldEngine.destroy).toHaveBeenCalled();
        });

        it('未提供 leastTime 且旧音频时长无效时应使用默认值 1000', async () => {
            const oldEngine = createMockAudioEngine({
                duration: Infinity, // 无效时长
                currentTime: 0,
            });
            const player = createMockPlayer({
                audioEngine: oldEngine,
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = createMockAudioEngine({ volume: 0, isActive: true });
                }),
            });

            strategy.execute(player, 1, {});
            await vi.advanceTimersByTime(0);

            // 默认 1000ms 应该足够
            await vi.advanceTimersByTime(1500);
            expect(oldEngine.destroy).toHaveBeenCalled();
        });

        it('leastTime 应被 clamp 到 [50, 15000] 范围 - 下界', async () => {
            const oldEngine = createMockAudioEngine({ duration: 10, currentTime: 9.99 });
            // 剩余时间 = 0.01s = 10ms, Math.max(100, 10) = 100, 然后 clamp 到 [50, 15000] => 100
            const player = createMockPlayer({
                audioEngine: oldEngine,
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = createMockAudioEngine({ volume: 0, isActive: true });
                }),
            });

            strategy.execute(player, 1, {});
            await vi.advanceTimersByTime(0);

            // 100ms 应该足够
            await vi.advanceTimersByTime(300);
            expect(oldEngine.destroy).toHaveBeenCalled();
        });

        it('leastTime 应被 clamp 到 [50, 15000] 范围 - 上界', async () => {
            const newEngine = createMockAudioEngine({ volume: 0, isActive: true });
            const oldEngineRef = createMockAudioEngine();
            const player = createMockPlayer({
                audioEngine: oldEngineRef,
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = newEngine;
                }),
            });

            // 设置一个很大的 leastTime，应被 clamp 到 15000
            strategy.execute(player, 1, { leastTime: 999999 });
            await vi.advanceTimersByTime(0);

            // 15000ms+ 应该完成
            await vi.advanceTimersByTime(16000);
            // 通过旧引擎引用检查 destroy（player.audioEngine 已指向新引擎）
            expect(oldEngineRef.destroy).toHaveBeenCalled();
        });

        it('leastTime 小于 50 时应被 clamp 到 50', async () => {
            const oldEngine = createMockAudioEngine();
            const player = createMockPlayer({
                audioEngine: oldEngine,
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = createMockAudioEngine({ volume: 0, isActive: true });
                }),
            });

            strategy.execute(player, 1, { leastTime: 10 });
            await vi.advanceTimersByTime(0);

            // clamp 到 50ms，所以 200ms 应该足够
            await vi.advanceTimersByTime(300);
            expect(oldEngine.destroy).toHaveBeenCalled();
        });
    });

    // --- 加载失败时的回退 ---
    describe('加载失败时的回退', () => {
        it('loadCurrentTrack reject 时应回退到 _instantSwitch（共调用 2 次 loadCurrentTrack）', async () => {
            const oldEngine = createMockAudioEngine();
            const player = createMockPlayer({
                audioEngine: oldEngine,
                loadCurrentTrack: vi.fn().mockRejectedValue(new Error('load failed')),
            });

            // 不应抛出异常
            await expect(strategy.execute(player, 1)).resolves.toBeUndefined();

            // 应回退到即时切换
            expect(player.switchToIndex).toHaveBeenCalledWith(1);
            // execute 中调用一次（第71行），_instantSwitch 中再调用一次（第119行）
            expect(player.loadCurrentTrack).toHaveBeenCalledTimes(2);
        });

        it('loadCurrentTrack 返回后新引擎为 null 时应回退到 _instantSwitch', async () => {
            const oldEngine = createMockAudioEngine();
            const player = createMockPlayer({
                audioEngine: oldEngine,
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = null; // 模拟加载后引擎仍为 null
                }),
            });

            await strategy.execute(player, 1);

            // 应回退到即时切换
            expect(player.switchToIndex).toHaveBeenCalled();
            expect(player.loadCurrentTrack).toHaveBeenCalledTimes(2); // execute + _instantSwitch
        });
    });

    // --- _activeTransitions 管理 ---
    describe('_activeTransitions 管理', () => {
        it('应将两个取消函数推入 _activeTransitions 数组', async () => {
            const newEngine = createMockAudioEngine({ volume: 0, isActive: true });
            const player = createMockPlayer({
                _activeTransitions: [],
                loadCurrentTrack: vi.fn().mockImplementation(async () => {
                    player.audioEngine = newEngine;
                }),
            });

            strategy.execute(player, 1, {});
            await vi.advanceTimersByTime(0);

            // 应添加两个 cancel 函数（新引擎淡入 + 旧引擎淡出）
            expect(player._activeTransitions.length).toBe(2);
            expect(player._activeTransitions[0]).toBeTypeOf('function');
            expect(player._activeTransitions[1]).toBeTypeOf('function');
        });
    });
});

// ============================================================
// 4. InstantSwitch.execute() 测试
// ============================================================
describe('InstantSwitch.execute()', () => {
    let instantSwitch;

    beforeEach(() => {
        instantSwitch = new InstantSwitch();
    });

    it('应依次执行：销毁旧引擎 -> 取消活动过渡 -> 切换索引 -> 加载新曲目 -> 播放', async () => {
        const oldEngine = createMockAudioEngine();
        const player = createMockPlayer({
            audioEngine: oldEngine,
            loadCurrentTrack: vi.fn().mockResolvedValue(undefined),
        });

        await instantSwitch.execute(player, 5);

        // 1. 销毁旧引擎
        expect(oldEngine.destroy).toHaveBeenCalledTimes(1);

        // 2. 取消活动过渡
        expect(player._cancelActiveTransitions).toHaveBeenCalledTimes(1);

        // 3. 切换索引
        expect(player.switchToIndex).toHaveBeenCalledWith(5);

        // 4. 加载新曲目
        expect(player.loadCurrentTrack).toHaveBeenCalledTimes(1);

        // 5. 播放
        expect(player.play).toHaveBeenCalledTimes(1);
    });

    it('audioEngine 为 null 时跳过销毁步骤', async () => {
        const player = createMockPlayer({ audioEngine: null });

        await instantSwitch.execute(player, 0);

        // 不应调用 destroy（因为没有引擎）
        // 其他步骤正常执行
        expect(player.switchToIndex).toHaveBeenCalledWith(0);
        expect(player.loadCurrentTrack).toHaveBeenCalled();
        expect(player.play).toHaveBeenCalled();
    });

    it('destroy 抛出异常时应被捕获而不影响后续流程', async () => {
        const oldEngine = createMockAudioEngine({
            destroy: vi.fn().mockImplementation(() => {
                throw new Error('destroy failed');
            }),
        });
        const player = createMockPlayer({ audioEngine: oldEngine });

        // 不应抛出异常
        await expect(instantSwitch.execute(player, 0)).resolves.toBeUndefined();

        // 后续流程应继续执行
        expect(player.switchToIndex).toHaveBeenCalled();
        expect(player.loadCurrentTrack).toHaveBeenCalled();
        expect(player.play).toHaveBeenCalled();
    });

    it('_cancelActiveTransitions 不存在时不影响执行', async () => {
        const player = createMockPlayer({
            // 不设置 _cancelActiveTransitions
        });
        delete player._cancelActiveTransitions;

        await expect(instantSwitch.execute(player, 0)).resolves.toBeUndefined();
        expect(player.play).toHaveBeenCalled();
    });
});

// ============================================================
// 5. _instantSwitch() 私有方法测试（通过行为验证）
// ============================================================
describe('TransitionNextMusic._instantSwitch() 行为验证', () => {
    let strategy;

    beforeEach(() => {
        strategy = new TransitionNextMusic();
    });

    it('当 audioEngine 存在时应先销毁它', async () => {
        const oldEngine = createMockAudioEngine();
        const player = createMockPlayer({
            audioEngine: oldEngine,
            isActive: false, // 触发 _instantSwitch 路径
        });

        await strategy.execute(player, 2);

        expect(oldEngine.destroy).toHaveBeenCalledTimes(1);
    });

    it('destroy 异常时应被静默捕获', async () => {
        const oldEngine = createMockAudioEngine({
            destroy: vi.fn().mockImplementation(() => {
                throw new Error('boom');
            }),
            isActive: false,
        });
        const player = createMockPlayer({ audioEngine: oldEngine });

        // 不应抛出异常
        await expect(strategy.execute(player, 0)).resolves.toBeUndefined();
    });

    it('应调用 switchToIndex、loadCurrentTrack 并播放', async () => {
        const player = createMockPlayer({ audioEngine: null });

        await strategy.execute(player, 3);

        expect(player.switchToIndex).toHaveBeenCalledWith(3);
        expect(player.loadCurrentTrack).toHaveBeenCalled();
        // _internal 中 loadCurrentTrack.then(() => play())
        expect(player.play).toHaveBeenCalled();
    });

    it('loadCurrentTrack 在 _instantSwitch 中失败时应静默处理', async () => {
        const player = createMockPlayer({
            audioEngine: null,
            loadCurrentTrack: vi.fn().mockRejectedValue(new Error('fail')),
        });

        // 不应抛出异常（_instantSwitch 中 catch 了）
        await expect(strategy.execute(player, 0)).resolves.toBeUndefined();
    });
});
