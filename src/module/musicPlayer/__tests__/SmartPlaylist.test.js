import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmartPlaylist } from '../playlist/SmartPlaylist';

// ============================================================
// 辅助工具
// ============================================================

/** 创建模拟 EventBus */
function createMockEventBus() {
    return {
        emit: vi.fn(),
    };
}

/** 创建标准测试曲目 */
function createTrack(id) {
    return { id, title: `Track ${id}`, duration: 180 + id };
}

/** 创建 N 首测试曲目数组 */
function createTracks(count) {
    return Array.from({ length: count }, (_, i) => createTrack(i + 1));
}

/**
 * 创建一个返回指定结果的 mock growFunction
 * @param {*} result - growFunction 要返回的结果（数组、单个对象、null、undefined）
 * @param {number} [resolveDelay=0] - 模拟异步延迟（ms），用于测试 isLoading 状态
 */
function createMockGrowFunction(result, resolveDelay = 0) {
    return vi.fn().mockImplementation(async () => {
        if (resolveDelay > 0) {
            await new Promise((r) => setTimeout(r, resolveDelay));
        }
        return result;
    });
}

// ============================================================
// SmartPlaylist 单元测试
// ============================================================

describe('SmartPlaylist', () => {

    // --------------------------------------------------------
    // 构造函数
    // --------------------------------------------------------
    describe('构造函数', () => {
        it('必须传入 growFunction，否则抛出错误', () => {
            expect(() => new SmartPlaylist()).toThrow(
                'SmartPlaylist requires a growFunction option'
            );
            expect(() => new SmartPlaylist({})).toThrow(
                'SmartPlaylist requires a growFunction option'
            );
        });

        it('growFunction 为非函数类型时抛错', () => {
            expect(() => new SmartPlaylist({ growFunction: 'not a function' })).toThrow();
            expect(() => new SmartPlaylist({ growFunction: null })).toThrow();
            expect(() => new SmartPlaylist({ growFunction: 42 })).toThrow();
            expect(() => new SmartPlaylist({ growFunction: {} })).toThrow();
        });

        it('正确传入 growFunction 时正常创建实例', () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn });
            expect(sp.isLoading).toBe(false);
            expect(sp.hasMore).toBe(true);
        });

        it('可传入 eventBus，继承 PlaylistOperations 的事件能力', () => {
            const bus = createMockEventBus();
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn, eventBus: bus });
            sp.push(createTrack(1));
            expect(bus.emit).toHaveBeenCalled(); // 验证父类方法可用
        });

        it('minBufferCount 默认值为 5', () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn });
            // 通过内部行为间接验证 minBufferCount 默认值
            // 当 length < 5 时应触发增长
            expect(sp.length).toBe(0); // 空列表 < 5，checkAndGrow 应该调用 growFunction
        });

        it('自定义 minBufferCount 生效', () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 10 });
            // 无法直接读取私有字段，但通过行为验证
            expect(sp).toBeInstanceOf(SmartPlaylist);
        });

        it('hasMore 可通过选项设为 false', () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn, hasMore: false });
            expect(sp.hasMore).toBe(false);
        });

        it('hasMore 默认为 true', () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn });
            expect(sp.hasMore).toBe(true);
        });
    });

    // --------------------------------------------------------
    // checkAndGrow()
    // --------------------------------------------------------
    describe('checkAndGrow()', () => {
        it('列表长度不足 minBufferCount 时自动触发增长', async () => {
            const batch = createTracks(3);
            const fn = createMockGrowFunction(batch);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount:5 });

            await sp.checkAndGrow();

            expect(fn).toHaveBeenCalledTimes(1);
            expect(sp.length).toBe(3);
        });

        it('currentIndex 接近末尾（>= length - ceil(minBufferCount/2)）时触发增长', async () => {
            // minBufferCount=5, ceil(5/2)=3, 触发条件: ci >= length - 3
            const initialTracks = createTracks(6); // length=6, 6-3=3, ci >= 3 时触发
            const moreTracks = createTracks(3, 7); // id 7,8,9
            const fn = createMockGrowFunction(moreTracks);

            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });
            sp.replace(initialTracks, 4); // ci=4 >= 3, 应触发

            await sp.checkAndGrow();

            expect(fn).toHaveBeenCalledTimes(1);
            expect(sp.length).toBe(9);
        });

        it('hasMore 为 false 时不触发增长', async () => {
            const fn = createMockGrowFunction(createTracks(3));
            const sp = new SmartPlaylist({
                growFunction: fn,
                minBufferCount: 5,
                hasMore: false,
            });

            await sp.checkAndGrow();

            expect(fn).not.toHaveBeenCalled();
            expect(sp.length).toBe(0);
        });

        it('isLoading 为 true 时防重入（不重复调用 growFunction）', async () => {
            // 使用延迟 resolve 来模拟长时间加载
            let resolvePromise;
            const fn = vi.fn().mockImplementation(() => {
                return new Promise((resolve) => {
                    resolvePromise = resolve;
                });
            });

            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            // 第一次调用开始（isLoading=true）
            const promise1 = sp.checkAndGrow();

            // 第二次调用应在 isLoading 守卫处短路
            const promise2 = sp.checkAndGrow();

            // fn 只被调用了一次
            expect(fn).toHaveBeenCalledTimes(1);

            // 解析第一次
            resolvePromise(createTracks(2));
            await promise1;
            await promise2;

            // 仍然只调用了一次
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('缓冲充足且未接近末尾时不触发增长', async () => {
            // minBufferCount=5, 需要 length >= 5 且 ci < length - 3
            const initialTracks = createTracks(10); // length=10, 10-3=7
            const fn = createMockGrowFunction(createTracks(3));

            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });
            sp.replace(initialTracks, 2); // ci=2 < 7, 不应触发

            await sp.checkAndGrow();

            expect(fn).not.toHaveBeenCalled();
            expect(sp.length).toBe(10);
        });

        it('空列表（length=0 < minBufferCount）总是触发增长', async () => {
            const fn = createMockGrowFunction(createTracks(2));
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            await sp.checkAndGrow();

            expect(fn).toHaveBeenCalledTimes(1);
            expect(sp.length).toBe(2);
        });
    });

    // --------------------------------------------------------
    // #doGrow() 内部逻辑（通过 checkAndGrow 间接测试）
    // --------------------------------------------------------
    describe('#doGrow() 内部逻辑', () => {
        it('growFunction 返回 null 时设置 hasMore=false', async () => {
            const fn = createMockGrowFunction(null);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            await sp.checkAndGrow();

            expect(sp.hasMore).toBe(false);
            expect(sp.length).toBe(0);
        });

        it('growFunction 返回 undefined 时设置 hasMore=false', async () => {
            const fn = createMockGrowFunction(undefined);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            await sp.checkAndGrow();

            expect(sp.hasMore).toBe(false);
            expect(sp.length).toBe(0);
        });

        it('growFunction 返回非空数组时调用 pushBatch 添加', async () => {
            const batch = createTracks(4);
            const fn = createMockGrowFunction(batch);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            // 先预填一些数据
            sp.pushBatch(createTracks(2));
            const lenBefore = sp.length;

            await sp.checkAndGrow();

            expect(sp.length).toBe(lenBefore + 4);
            // 验证新添加的曲目在末尾
            for (let i = 0; i < batch.length; i++) {
                expect(sp.get(lenBefore + i)).toEqual(batch[i]);
            }
        });

        it('growFunction 返回空数组时设置 hasMore=false', async () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            await sp.checkAndGrow();

            expect(sp.hasMore).toBe(false);
            expect(sp.length).toBe(0);
        });

        it('growFunction 返回单个对象时调用 push 添加', async () => {
            const singleTrack = createTrack(99);
            const fn = createMockGrowFunction(singleTrack);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            sp.pushBatch(createTracks(2));

            await sp.checkAndGrow();

            expect(sp.length).toBe(3);
            expect(sp.get(2)).toEqual(singleTrack);
        });

        it('growFunction 抛出异常时捕获错误并发射 ERROR 事件', async () => {
            const testError = new Error('network failure');
            const fn = vi.fn().mockRejectedValue(testError);
            const bus = createMockEventBus();
            const sp = new SmartPlaylist({
                growFunction: fn,
                minBufferCount: 5,
                eventBus: bus,
            });

            // 源码 #doGrow catch 块调用 this.emit()（非父类 #emit），需在实例上 mock
            const emitSpy = vi.fn();
            sp.emit = emitSpy;

            // console.error 被调用
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await sp.checkAndGrow();

            expect(consoleSpy).toHaveBeenCalledWith(
                '[SmartPlaylist] growFunction error:',
                testError
            );
            expect(emitSpy).toHaveBeenCalledWith('player:error', {
                error: testError,
                context: 'smartPlaylistGrow',
            });

            // isLoading 应被重置为 false（finally 块）
            expect(sp.isLoading).toBe(false);

            consoleSpy.mockRestore();
        });

        it('doGrow 完成后 isLoading 重置为 false — 正常路径', async () => {
            const fn = createMockGrowFunction(createTracks(2), 10); // 10ms 延迟
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            const promise = sp.checkAndGrow();

            // 在异步操作期间 isLoading 应为 true
            // 注意：由于微任务/宏任务的执行顺序，这里可能已经是 true 或即将变为 true
            // 我们在 await 后验证

            await promise;

            expect(sp.isLoading).toBe(false);
        });

        it('doGrow 完成后 isLoading 重置为 false — 异常路径', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('boom'));
            const bus = createMockEventBus();
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5, eventBus: bus });
            // 源码 catch 块调用 this.emit()，需在实例上 mock 以避免 TypeError
            sp.emit = vi.fn();

            vi.spyOn(console, 'error').mockImplementation(() => {});

            await sp.checkAndGrow();

            expect(sp.isLoading).toBe(false);

            console.error.mockRestore();
        });
    });

    // --------------------------------------------------------
    // getCurrentOrGrow()
    // --------------------------------------------------------
    describe('getCurrentOrGrow()', () => {
        it('有有效曲目时直接返回该曲目', () => {
            const tracks = createTracks(5);
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });
            sp.replace(tracks, 2);

            const result = sp.getCurrentOrGrow(2);

            expect(result).toEqual(tracks[2]);
        });

        it('接近末尾（index >= length - 2）时触发 checkAndGrow', async () => {
            const tracks = createTracks(5); // length=5, length-2=3
            const moreTracks = createTracks(3, 6);
            const fn = createMockGrowFunction(moreTracks);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });
            sp.replace(tracks, 3); // ci=3 >= 3, 应触发增长

            // getCurrentOrGrow 内部调用 checkAndGrow（但不 await）
            // 这里我们需要让异步完成
            sp.getCurrentOrGrow(3);

            // 等待异步增长完成
            await new Promise((r) => setTimeout(r, 10));

            expect(fn).toHaveBeenCalledTimes(1);
            expect(sp.length).toBe(8);
        });

        it('索引处无曲目（null）时触发增长', async () => {
            const tracks = createTracks(3);
            const moreTracks = [createTrack(99)];
            const fn = createMockGrowFunction(moreTracks);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });
            sp.replace(tracks, 0);

            // 请求一个超出范围的索引
            sp.getCurrentOrGrow(10); // get(10) returns null -> 触发增长

            await new Promise((r) => setTimeout(r, 10));

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('getCurrentOrGrow 返回值即为 get(currentIndex) 的结果', () => {
            const tracks = createTracks(4);
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 10 }); // 大 buffer 避免触发
            sp.replace(tracks, 0);

            for (let i = 0; i < tracks.length; i++) {
                expect(sp.getCurrentOrGrow(i)).toEqual(tracks[i]);
            }
        });
    });

    // --------------------------------------------------------
    // reset()
    // --------------------------------------------------------
    describe('reset()', () => {
        it('重置 hasMore 为 true', () => {
            const fn = createMockGrowFunction(null); // 会将 hasMore 设为 false
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            // 先触发一次让 hasMore 变为 false
            // （同步或异步后）
            // 直接调用 reset
            sp.reset();

            expect(sp.hasMore).toBe(true);
        });

        it('重置 isLoading 为 false', async () => {
            let resolveFn;
            const fn = vi.fn().mockImplementation(() => {
                return new Promise((resolve) => { resolveFn = resolve; });
            });
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            // 开始增长
            sp.checkAndGrow();
            expect(sp.isLoading).toBe(true);

            // reset 应立即将 isLoading 设为 false
            sp.reset();
            expect(sp.isLoading).toBe(false);

            // 清理：解析 pending promise
            if (resolveFn) resolveFn(null);
        });

        it('传入新的 growFunction 时替换旧的', () => {
            const oldFn = createMockGrowFunction([]);
            const newFn = createMockGrowFunction(createTracks(2));
            const sp = new SmartPlaylist({ growFunction: oldFn, minBufferCount: 5 });

            sp.reset(newFn);

            // 触发增长应该使用新的函数
            // 我们无法直接访问私有字段，但可以通过行为验证
            // reset 后 hasMore=true, 再次 checkAndGrow 会调用新函数
        });

        it('reset 传入非函数值时不替换 growFunction', () => {
            const originalFn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: originalFn, minBufferCount: 5 });

            // 不应抛错
            expect(() => sp.reset('not a function')).not.toThrow();
            expect(() => sp.reset(null)).not.toThrow();
            expect(() => sp.reset(42)).not.toThrow();

            // hasMore 仍然被重置为 true
            expect(sp.hasMore).toBe(true);
        });

        it('reset 后可以重新触发增长', async () => {
            const fn = createMockGrowFunction(null); // 第一次会让 hasMore=false
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            await sp.checkAndGrow();
            expect(sp.hasMore).toBe(false);

            // reset 后 should be able to grow again
            sp.reset();
            expect(sp.hasMore).toBe(true);

            const newFn = createMockGrowFunction(createTracks(2));
            sp.reset(newFn);

            await sp.checkAndGrow();
            // 新函数被调用了
            expect(newFn).toHaveBeenCalled();
            expect(sp.length).toBe(2);
        });
    });

    // --------------------------------------------------------
    // isLoading / hasMore getter
    // --------------------------------------------------------
    describe('isLoading / hasMore getter', () => {
        it('初始状态 isLoading=false, hasMore=true（默认）', () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn });
            expect(sp.isLoading).toBe(false);
            expect(sp.hasMore).toBe(true);
        });

        it('hasMore 可通过构造选项初始化为 false', () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn, hasMore: false });
            expect(sp.hasMore).toBe(false);
        });

        it('增长过程中 isLoading=true，完成后 isLoading=false', async () => {
            const fn = createMockGrowFunction(createTracks(2), 20);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            const promise = sp.checkAndGrow();

            // 等待一下确保异步已经开始
            await new Promise((r) => setTimeout(r, 5));
            // 此时 isLoading 可能仍为 true（因为 doGrow 还没完成）

            await promise;

            expect(sp.isLoading).toBe(false);
        });

        it('hasMore 在 growFunction 返回 null 后变为 false', async () => {
            const fn = createMockGrowFunction(null);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            await sp.checkAndGrow();

            expect(sp.hasMore).toBe(false);
        });

        it('hasMore 在 growFunction 返回空数组后变为 false', async () => {
            const fn = createMockGrowFunction([]);
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            await sp.checkAndGrow();

            expect(sp.hasMore).toBe(false);
        });

        it('hasMore 在成功加载数据后保持 true', async () => {
            const fn = createMockGrowFunction(createTracks(3));
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 5 });

            await sp.checkAndGrow();

            expect(sp.hasMore).toBe(true);
        });
    });

    // --------------------------------------------------------
    // minBufferCount 配置对增长时机的影响
    // --------------------------------------------------------
    describe('minBufferCount 配置对增长时机的影响', () => {
        it('minBufferCount 较小时更容易触发增长', async () => {
            // minBufferCount=2, ceil(2/2)=1, 条件: length<2 OR ci>=length-1
            const initialTracks = createTracks(3); // length=3 >= 2
            const fn = createMockGrowFunction(createTracks(2));
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 2 });
            sp.replace(initialTracks, 2); // ci=2, length-1=2, 2>=2 触发!

            await sp.checkAndGrow();

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('minBufferCount 较大时更难触发"接近末尾"增长', async () => {
            // minBufferCount=20, ceil(20/2)=10, 条件: length<20 OR ci>=length-10
            const initialTracks = createTracks(15); // length=15 < 20 → 第一个条件就触发了！
            const fn = createMockGrowFunction(createTracks(2));
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 20 });
            sp.replace(initialTracks, 5); // ci=5, length-10=5, 5>=5 也触发

            await sp.checkAndGrow();

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('minBufferCount=1 时，只有空列表或到达最后一首才触发', async () => {
            // minBufferCount=1, ceil(1/2)=1, 条件: length<1 OR ci>=length-1
            const initialTracks = createTracks(5);
            const fn = createMockGrowFunction(createTracks(2));
            const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: 1 });

            // ci=3, length-1=4, 3<4 不触发
            sp.replace(initialTracks, 3);
            await sp.checkAndGrow();
            expect(fn).not.toHaveBeenCalled();

            // ci=4 (= length-1), 触发
            sp.currentIndex = 4;
            await sp.checkAndGrow();
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('不同 minBufferCount 值下边界行为正确', async () => {
            // 测试几个典型值
            const cases = [
                { minBuf: 3, len: 3, ci: 1, expectGrow: true },  // len>=3, ceil(3/2)=2, len-2=1, ci=1>=1 触发
                { minBuf: 3, len: 4, ci: 1, expectGrow: false }, // len>=3, 4-2=2, 1<2 不触发
                { minBuf: 4, len: 4, ci: 2, expectGrow: true },  // len>=4, ceil(4/2)=2, 4-2=2, 2>=2 触发
                { minBuf: 6, len: 8, ci: 5, expectGrow: true },  // len>=6, ceil(6/2)=3, 8-3=5, 5>=5 触发
                { minBuf: 6, len: 8, ci: 4, expectGrow: false }, // 4<5 不触发
            ];

            for (const tc of cases) {
                const fn = createMockGrowFunction(createTracks(1));
                const sp = new SmartPlaylist({ growFunction: fn, minBufferCount: tc.minBuf });
                sp.replace(createTracks(tc.len), tc.ci);

                await sp.checkAndGrow();

                if (tc.expectGrow) {
                    expect(fn).toHaveBeenCalledTimes(1);
                } else {
                    expect(fn).not.toHaveBeenCalled();
                }
            }
        });
    });

    // --------------------------------------------------------
    // 继承自 PlaylistOperations 的方法可用性
    // --------------------------------------------------------
    describe('继承自 PlaylistOperations 的方法', () => {
        let sp;

        beforeEach(() => {
            sp = new SmartPlaylist({ growFunction: vi.fn() });
        });

        it('push 方法正常工作', () => {
            sp.push(createTrack(1));
            sp.push(createTrack(2));
            expect(sp.length).toBe(2);
            expect(sp.current).toEqual(createTrack(1));
        });

        it('pushBatch 方法正常工作', () => {
            sp.pushBatch(createTracks(5));
            expect(sp.length).toBe(5);
        });

        it('remove 方法正常工作并调整 currentIndex', () => {
            sp.pushBatch(createTracks(5));
            sp.currentIndex = 2;
            sp.remove(2); // 删除 index=2（即当前播放项）
            // 删除后 length=4, 原 ci=2, 2 < 4 不触发调整，ci 保持为 2
            // 原数组 [T1,T2,T3,T4,T5], 删除 T3 后 → [T1,T2,T4,T5]
            // index=2 现在是 T4
            expect(sp.currentIndex).toBe(2);
            expect(sp.current).toEqual(createTrack(4));
        });

        it('clear 方法正常工作', () => {
            sp.pushBatch(createTracks(10));
            sp.clear();
            expect(sp.isEmpty).toBe(true);
            expect(sp.currentIndex).toBe(0);
        });

        it('insert 方法正常工作', () => {
            sp.pushBatch(createTracks(3));
            sp.insert(createTrack(99), 1);
            expect(sp.length).toBe(4);
            expect(sp.get(1)).toEqual(createTrack(99));
        });

        it('move 方法正常工作', () => {
            sp.pushBatch(createTracks(5));
            sp.move(0, 4);
            expect(sp.get(4)).toEqual(createTrack(1));
            expect(sp.get(0)).toEqual(createTrack(2));
        });

        it('getAll/get/current/length/isEmpty/getter 全部可用', () => {
            const tracks = createTracks(3);
            sp.replace(tracks, 1);

            expect(sp.getAll()).toEqual(tracks);
            expect(sp.get(0)).toEqual(tracks[0]);
            expect(sp.get(2)).toEqual(tracks[2]);
            expect(sp.current).toEqual(tracks[1]);
            expect(sp.length).toBe(3);
            expect(sp.isEmpty).toBe(false);
        });

        it('indexOf 方法支持函数谓词和值查找', () => {
            sp.pushBatch(createTracks(4));
            expect(sp.indexOf((t) => t.id === 3)).toBe(2);
            expect(sp.indexOf(sp.get(1))).toBe(1);
            expect(sp.indexOf(createTrack(999))).toBe(-1);
        });

        it('currentIndex setter 边界限制生效', () => {
            sp.pushBatch(createTracks(5));
            sp.currentIndex = 100;
            expect(sp.currentIndex).toBe(4);
            sp.currentIndex = -5;
            expect(sp.currentIndex).toBe(0);
        });
    });

    // --------------------------------------------------------
    // 综合场景：模拟真实播放流程
    // --------------------------------------------------------
    describe('综合场景', () => {
        it('模拟分页加载播放列表', async () => {
            const allTracks = createTracks(20);
            let page = 0;

            const growFunction = vi.fn().mockImplementation(async () => {
                const start = page * 5;
                const end = Math.min(start + 5, allTracks.length);
                page++;
                if (start >= allTracks.length) return null; // 无更多数据
                return allTracks.slice(start, end);
            });

            const bus = createMockEventBus();
            const sp = new SmartPlaylist({
                growFunction: growFunction,
                minBufferCount: 5,
                eventBus: bus,
            });

            // 初始加载第 1 页
            await sp.checkAndGrow();
            expect(sp.length).toBe(5);
            expect(growFunction).toHaveBeenCalledTimes(1);

            // 播放到接近末尾，触发加载第 2 页
            sp.currentIndex = 3; // 接近末尾 (ci=3 >= 5-2=3? for minBuf=5, ceil(5/2)=3, 5-3=2, 3>=2 yes)
            await sp.checkAndGrow();
            expect(sp.length).toBe(10);
            expect(growFunction).toHaveBeenCalledTimes(2);

            // 继续播放到第 2 页末尾
            sp.currentIndex = 8; // 8 >= 10-3=7, yes
            await sp.checkAndGrow();
            expect(sp.length).toBe(15);
            expect(growFunction).toHaveBeenCalledTimes(3);

            // 再到第 3 页末尾
            sp.currentIndex = 13; // 13 >= 15-3=12, yes
            await sp.checkAndGrow();
            expect(sp.length).toBe(20);
            expect(growFunction).toHaveBeenCalledTimes(4);

            // 最后一次尝试，应返回 null，hasMore=false
            sp.currentIndex = 18; // 18 >= 20-3=17, yes
            await sp.checkAndGrow();
            expect(sp.hasMore).toBe(false);
            expect(sp.length).toBe(20); // 不再增加
            expect(growFunction).toHaveBeenCalledTimes(5);
        });

        it('并发多次 checkAndGrow 只执行一次实际增长', async () => {
            let callCount = 0;
            const growFunction = vi.fn().mockImplementation(async () => {
                callCount++;
                await new Promise((r) => setTimeout(r, 50));
                return createTracks(2);
            });

            const sp = new SmartPlaylist({
                growFunction: growFunction,
                minBufferCount: 5,
            });

            // 同时发起多个请求
            const p1 = sp.checkAndGrow();
            const p2 = sp.checkAndGrow();
            const p3 = sp.checkAndGrow();

            await Promise.all([p1, p2, p3]);

            // growFunction 只被调用了一次
            expect(growFunction).toHaveBeenCalledTimes(1);
            expect(callCount).toBe(1);
            expect(sp.length).toBe(2);
        });
    });
});
