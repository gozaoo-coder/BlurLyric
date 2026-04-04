import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaylistOperations } from '../playlist/PlaylistOperations';

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

// ============================================================
// PlaylistOperations 单元测试
// ============================================================

describe('PlaylistOperations', () => {

    // --------------------------------------------------------
    // 构造函数 & setEventBus
    // --------------------------------------------------------
    describe('构造函数与 setEventBus', () => {
        it('不传 eventBus 时，#eventBus 为 null，操作不会发射事件', () => {
            const pl = new PlaylistOperations();
            pl.push(createTrack(1));
            expect(pl.length).toBe(1);
            expect(pl.current).toEqual(createTrack(1));
        });

        it('传入 eventBus 时，构造函数正确保存引用', () => {
            const bus = createMockEventBus();
            const pl = new PlaylistOperations(bus);
            pl.push(createTrack(1));
            expect(bus.emit).toHaveBeenCalledTimes(1);
        });

        it('setEventBus 可以在构造后设置事件总线', () => {
            const pl = new PlaylistOperations();
            const bus = createMockEventBus();
            pl.setEventBus(bus);
            pl.push(createTrack(99));
            expect(bus.emit).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ track: expect.objectContaining({ id: 99 }) })
            );
        });

        it('setEventBus 覆盖已有的 eventBus', () => {
            const oldBus = createMockEventBus();
            const newBus = createMockEventBus();
            const pl = new PlaylistOperations(oldBus);
            pl.setEventBus(newBus);
            pl.push(createTrack(1));
            expect(oldBus.emit).not.toHaveBeenCalled();
            expect(newBus.emit).toHaveBeenCalledTimes(1);
        });
    });

    // --------------------------------------------------------
    // replace()
    // --------------------------------------------------------
    describe('replace()', () => {
        let pl;
        let bus;

        beforeEach(() => {
            bus = createMockEventBus();
            pl = new PlaylistOperations(bus);
        });

        it('用新列表替换旧列表，重置 tracks 和 currentIndex', () => {
            const tracks = createTracks(5);
            pl.replace(tracks, 2);
            expect(pl.getAll()).toEqual(tracks);
            expect(pl.currentIndex).toBe(2);
            expect(pl.current).toEqual(tracks[2]);
        });

        it('替换为空数组时清空列表，currentIndex 归零', () => {
            pl.push(createTrack(1));
            pl.replace([]);
            expect(pl.isEmpty).toBe(true);
            expect(pl.currentIndex).toBe(0);
            expect(pl.current).toBeNull();
        });

        it('传入非数组参数时视为空数组', () => {
            pl.replace(null);
            expect(pl.isEmpty).toBe(true);

            pl.replace(undefined);
            expect(pl.isEmpty).toBe(true);

            pl.replace('not an array');
            expect(pl.isEmpty).toBe(true);

            pl.replace(42);
            expect(pl.isEmpty).toBe(true);
        });

        it('startIndex 超出上界时被钳制到 length - 1', () => {
            const tracks = createTracks(3);
            pl.replace(tracks, 100);
            expect(pl.currentIndex).toBe(2);
        });

        it('startIndex 为负数时被钳制到 0', () => {
            const tracks = createTracks(3);
            pl.replace(tracks, -5);
            expect(pl.currentIndex).toBe(0);
        });

        it('startIndex 恰好等于 length - 1 时正常工作', () => {
            const tracks = createTracks(4);
            pl.replace(tracks, 3);
            expect(pl.currentIndex).toBe(3);
            expect(pl.current).toEqual(tracks[3]);
        });

        it('replace 发射 PLAYLIST_REPLACE 事件，携带正确数据', () => {
            const tracks = createTracks(3);
            pl.replace(tracks, 1);
            expect(bus.emit).toHaveBeenCalledTimes(1);
            expect(bus.emit).toHaveBeenCalledWith(
                'player:playlistReplace',
                { tracks, index: 1 }
            );
        });

        it('replace 创建的是浅拷贝，修改原数组不影响内部状态', () => {
            const tracks = createTracks(3);
            pl.replace(tracks);
            tracks.pop();           // 修改外部引用
            expect(pl.length).toBe(3); // 内部不受影响
        });
    });

    // --------------------------------------------------------
    // push()
    // --------------------------------------------------------
    describe('push()', () => {
        let pl;
        let bus;

        beforeEach(() => {
            bus = createMockEventBus();
            pl = new PlaylistOperations(bus);
        });

        it('添加单首歌曲到列表末尾', () => {
            const track = createTrack(1);
            pl.push(track);
            expect(pl.length).toBe(1);
            expect(pl.current).toEqual(track);
        });

        it('连续添加多首歌曲', () => {
            pl.push(createTrack(1));
            pl.push(createTrack(2));
            pl.push(createTrack(3));
            expect(pl.length).toBe(3);
            expect(pl.getAll()).toEqual([createTrack(1), createTrack(2), createTrack(3)]);
        });

        it('push null 时静默忽略，不改变列表', () => {
            pl.push(null);
            expect(pl.isEmpty).toBe(true);
            expect(bus.emit).not.toHaveBeenCalled();
        });

        it('push undefined 时静默忽略', () => {
            pl.push(undefined);
            expect(pl.isEmpty).toBe(true);
        });

        it('push 空字符串 / 0 / false 等 falsy 但非 null/undefined 的值应被忽略（!track 判定）', () => {
            pl.push('');
            expect(pl.isEmpty).toBe(true);

            pl.push(0);
            expect(pl.isEmpty).toBe(true);
        });

        it('push 发射 PLAYLIST_PUSH 事件，包含 track 和 index', () => {
            const track = createTrack(42);
            pl.push(track);
            expect(bus.emit).toHaveBeenCalledWith(
                'player:playlistPush',
                { track, index: 0 }
            );
        });

        it('push 多首后 index 正确递增', () => {
            pl.push(createTrack(1));
            expect(bus.emit).toHaveBeenLastCalledWith(
                'player:playlistPush',
                { track: createTrack(1), index: 0 }
            );
            pl.push(createTrack(2));
            expect(bus.emit).toHaveBeenLastCalledWith(
                'player:playlistPush',
                { track: createTrack(2), index: 1 }
            );
        });
    });

    // --------------------------------------------------------
    // pushBatch()
    // --------------------------------------------------------
    describe('pushBatch()', () => {
        let pl;
        let bus;

        beforeEach(() => {
            bus = createMockEventBus();
            pl = new PlaylistOperations(bus);
        });

        it('批量添加多首歌曲', () => {
            const batch = createTracks(5);
            pl.pushBatch(batch);
            expect(pl.length).toBe(5);
            expect(pl.getAll()).toEqual(batch);
        });

        it('空数组不触发任何操作和事件', () => {
            pl.pushBatch([]);
            expect(pl.isEmpty).toBe(true);
            expect(bus.emit).not.toHaveBeenCalled();
        });

        it('非数组输入（如字符串、数字、null）静默忽略', () => {
            pl.pushBatch(null);
            pl.pushBatch(undefined);
            pl.pushBatch('hello');
            pl.pushBatch(42);
            expect(pl.isEmpty).toBe(true);
            expect(bus.emit).not.toHaveBeenCalled();
        });

        it('pushBatch 发射 PLAYLIST_PUSH 事件，携带 tracks 和 startIndex', () => {
            const batch = createTracks(3);
            pl.pushBatch(batch);
            expect(bus.emit).toHaveBeenCalledWith(
                'player:playlistPush',
                { tracks: batch, startIndex: 0 }
            );
        });

        it('在已有列表上追加，startIndex 从当前长度开始', () => {
            pl.push(createTrack(0));          // length = 1
            const batch = createTracks(3);     // 再加 3 首
            pl.pushBatch(batch);
            expect(bus.emit).toHaveBeenLastCalledWith(
                'player:playlistPush',
                { tracks: batch, startIndex: 1 }
            );
            expect(pl.length).toBe(4);
        });

        it('批量添加后 currentIndex 指向第一首（默认行为）', () => {
            const batch = createTracks(4);
            pl.pushBatch(batch);
            expect(pl.currentIndex).toBe(0);
            expect(pl.current).toEqual(batch[0]);
        });
    });

    // --------------------------------------------------------
    // remove()
    // --------------------------------------------------------
    describe('remove()', () => {
        let pl;
        let bus;
        let tracks;

        beforeEach(() => {
            bus = createMockEventBus();
            pl = new PlaylistOperations(bus);
            tracks = createTracks(5);
            pl.replace(tracks, 2);
        });

        it('正常删除指定索引的歌曲，返回被删除的项', () => {
            const removed = pl.remove(1);
            expect(removed).toEqual(tracks[1]);
            expect(pl.length).toBe(4);
            expect(pl.get(1)).toEqual(tracks[2]); // 后面的前移
        });

        it('删除最后一首歌', () => {
            const removed = pl.remove(4);
            expect(removed).toEqual(tracks[4]);
            expect(pl.length).toBe(4);
        });

        it('删除第一首歌', () => {
            const removed = pl.remove(0);
            expect(removed).toEqual(tracks[0]);
            expect(pl.get(0)).toEqual(tracks[1]);
        });

        it('越界索引（负数）返回 null 且不改变列表', () => {
            bus.emit.mockClear(); // 清除 beforeEach 中 replace 产生的事件
            const result = pl.remove(-1);
            expect(result).toBeNull();
            expect(pl.length).toBe(5);
            expect(bus.emit).not.toHaveBeenCalled();
        });

        it('越界索引（>= length）返回 null 且不改变列表', () => {
            bus.emit.mockClear(); // 清除 beforeEach 中 replace 产生的事件
            const result = pl.remove(10);
            expect(result).toBeNull();
            expect(pl.length).toBe(5);
            expect(bus.emit).not.toHaveBeenCalled();
        });

        it('删除当前播放项之前的歌曲，currentIndex 不变（源码仅当 ci >= newLength 时才调整）', () => {
            // currentIndex = 2, 删除 index=0
            // 删除后: [T2,T3,T4,T5], length=4, ci=2, 2 >= 4? 否 → ci 保持 2
            pl.remove(0);
            expect(pl.currentIndex).toBe(2);
            expect(pl.current).toEqual(tracks[3]); // 原 tracks[3] 现在在 index=2
        });

        it('删除当前播放项之后的歌曲，currentIndex 不变', () => {
            // currentIndex = 2, 删除 index=4
            pl.remove(4);
            expect(pl.currentIndex).toBe(2);
            expect(pl.current).toEqual(tracks[2]);
        });

        it('删除当前正在播放的歌曲，currentIndex 保持不变（ci < newLength 时不触发调整）', () => {
            // currentIndex = 2, 删除 index=2
            // 删除后: [T1,T2,T4,T5], length=4, ci=2, 2 >= 4? 否 → ci 保持 2
            pl.remove(2);
            expect(pl.currentIndex).toBe(2);
            expect(pl.current).toEqual(tracks[3]); // 原 tracks[3] 现在在 index=2
        });

        it('删除当前歌曲且它是唯一一首时，currentIndex 归零', () => {
            const single = [createTrack(1)];
            pl.replace(single, 0);
            pl.remove(0);
            expect(pl.isEmpty).toBe(true);
            expect(pl.currentIndex).toBe(0);
        });

        it('remove 发射 PLAYLIST_REMOVE 事件', () => {
            pl.remove(1);
            expect(bus.emit).toHaveBeenCalledWith(
                'player:playlistRemove',
                { track: tracks[1], index: 1 }
            );
        });

        it('连续删除所有元素后列表为空', () => {
            pl.remove(0);
            pl.remove(0);
            pl.remove(0);
            pl.remove(0);
            pl.remove(0);
            expect(pl.isEmpty).toBe(true);
            expect(pl.currentIndex).toBe(0);
        });
    });

    // --------------------------------------------------------
    // clear()
    // --------------------------------------------------------
    describe('clear()', () => {
        let pl;
        let bus;

        beforeEach(() => {
            bus = createMockEventBus();
            pl = new PlaylistOperations(bus);
            pl.pushBatch(createTracks(10));
            pl.currentIndex = 5;
        });

        it('清空列表，tracks 数组归零', () => {
            pl.clear();
            expect(pl.isEmpty).toBe(true);
            expect(pl.length).toBe(0);
        });

        it('清空后 currentIndex 重置为 0', () => {
            pl.clear();
            expect(pl.currentIndex).toBe(0);
        });

        it('清空后 current 返回 null', () => {
            pl.clear();
            expect(pl.current).toBeNull();
        });

        it('clear 发射 PLAYLIST_CLEAR 事件', () => {
            pl.clear();
            expect(bus.emit).toHaveBeenLastCalledWith('player:playlistClear', undefined);
        });

        it('对已空的列表调用 clear 不报错', () => {
            pl.clear();
            pl.clear(); // 二次清空
            expect(pl.isEmpty).toBe(true);
        });
    });

    // --------------------------------------------------------
    // insert()
    // --------------------------------------------------------
    describe('insert()', () => {
        let pl;
        let bus;

        beforeEach(() => {
            bus = createMockEventBus();
            pl = new PlaylistOperations(bus);
            pl.pushBatch(createTracks(5));
            pl.currentIndex = 2;
        });

        it('在指定位置插入歌曲', () => {
            const newTrack = createTrack(99);
            pl.insert(newTrack, 2);
            expect(pl.length).toBe(6);
            expect(pl.get(2)).toEqual(newTrack);
            expect(pl.get(3)).toEqual(createTrack(3)); // 原来的被后推
        });

        it('在头部插入（index=0）', () => {
            const newTrack = createTrack(0);
            pl.insert(newTrack, 0);
            expect(pl.get(0)).toEqual(newTrack);
            expect(pl.get(1)).toEqual(createTrack(1));
        });

        it('在尾部插入（index=length）', () => {
            const newTrack = createTrack(99);
            pl.insert(newTrack, 5);
            expect(pl.get(5)).toEqual(newTrack);
            expect(pl.length).toBe(6);
        });

        it('index 超过上界时钳制到 length（即追加到末尾）', () => {
            const newTrack = createTrack(99);
            pl.insert(newTrack, 100);
            expect(pl.get(5)).toEqual(newTrack);
            expect(pl.length).toBe(6);
        });

        it('index 为负数时钳制到 0（即在头部插入）', () => {
            const newTrack = createTrack(99);
            pl.insert(newTrack, -10);
            expect(pl.get(0)).toEqual(newTrack);
            expect(pl.length).toBe(6);
        });

        it('插入位置 <= currentIndex 时，currentIndex 自增 1', () => {
            // currentIndex = 2, 在 index=1 插入
            pl.insert(createTrack(99), 1);
            expect(pl.currentIndex).toBe(3);
            // 原来在 index=2 的现在应该在 index=3
            expect(pl.current).toEqual(createTrack(3));
        });

        it('插入位置 === currentIndex 时，currentIndex 自增 1', () => {
            pl.insert(createTrack(99), 2);
            expect(pl.currentIndex).toBe(3);
            expect(pl.current).toEqual(createTrack(3));
        });

        it('插入位置 > currentIndex 时，currentIndex 不变', () => {
            pl.insert(createTrack(99), 4);
            expect(pl.currentIndex).toBe(2);
            expect(pl.current).toEqual(createTrack(3));
        });

        it('插入 null 值时静默忽略', () => {
            pl.insert(null, 2);
            expect(pl.length).toBe(5);
        });

        it('insert 不发射事件（源码中 insert 无 #emit 调用）', () => {
            bus.emit.mockClear(); // 清除 beforeEach 中 pushBatch 产生的事件
            pl.insert(createTrack(99), 2);
            // 注意：根据源码实现，insert 方法没有调用 #emit
            // 此处验证实际行为
            expect(bus.emit).not.toHaveBeenCalled();
        });
    });

    // --------------------------------------------------------
    // move()
    // --------------------------------------------------------
    describe('move()', () => {
        let pl;
        let bus;
        let tracks;

        beforeEach(() => {
            bus = createMockEventBus();
            pl = new PlaylistOperations(bus);
            tracks = createTracks(6);
            pl.replace(tracks, 2);
        });

        it('将项目从 fromIndex 移动到 toIndex', () => {
            pl.move(0, 4);
            expect(pl.get(0)).toEqual(tracks[1]);       // 原 [1] 前移
            expect(pl.get(4)).toEqual(tracks[0]);       // 原 [0] 到了 4
            expect(pl.length).toBe(6);                   // 总数不变
        });

        it('fromIndex 与 toIndex 相同时不做任何操作', () => {
            const before = pl.getAll();
            pl.move(2, 2);
            expect(pl.getAll()).toEqual(before);
        });

        it('fromIndex 越界（< 0）时不做操作', () => {
            const before = pl.getAll();
            pl.move(-1, 3);
            expect(pl.getAll()).toEqual(before);
        });

        it('fromIndex 越界（>= length）时不做操作', () => {
            const before = pl.getAll();
            pl.move(10, 3);
            expect(pl.getAll()).toEqual(before);
        });

        it('toIndex 越界（< 0）时不做操作', () => {
            const before = pl.getAll();
            pl.move(2, -1);
            expect(pl.getAll()).toEqual(before);
        });

        it('toIndex 越界（>= length）时不做操作', () => {
            const before = pl.getAll();
            pl.move(2, 10);
            expect(pl.getAll()).toEqual(before);
        });

        it('向前移动（toIndex < fromIndex），currentIndex 追踪更新：移动的是当前项', () => {
            // currentIndex=2, move(2, 0)
            pl.move(2, 0);
            expect(pl.currentIndex).toBe(0);
            expect(pl.current).toEqual(tracks[2]);
        });

        it('向后移动（toIndex > fromIndex），currentIndex 追踪更新：移动的是当前项', () => {
            // currentIndex=2, move(2, 5)
            pl.move(2, 5);
            expect(pl.currentIndex).toBe(5);
            expect(pl.current).toEqual(tracks[2]);
        });

        it('fromIndex < currentIndex 且 toIndex >= currentIndex 时，currentIndex 减 1', () => {
            // currentIndex=2, 把 index=0 移到 index=3（跨过 currentIndex）
            pl.move(0, 3);
            expect(pl.currentIndex).toBe(1);
            expect(pl.current).toEqual(tracks[2]); // tracks[2] 左移了一位
        });

        it('fromIndex > currentIndex 且 toIndex <= currentIndex 时，currentIndex 加 1', () => {
            // currentIndex=2, 把 index=5 移到 index=1（跨过 currentIndex）
            pl.move(5, 1);
            expect(pl.currentIndex).toBe(3);
            expect(pl.current).toEqual(tracks[2]); // tracks[2] 右移了一位
        });

        it('fromIndex < currentIndex 且 toIndex < currentIndex 时，currentIndex 不变', () => {
            // currentIndex=2, 把 index=0 移到 index=1（都在 currentIndex 左侧）
            pl.move(0, 1);
            expect(pl.currentIndex).toBe(2);
        });

        it('fromIndex > currentIndex 且 toIndex > currentIndex 时，currentIndex 不变', () => {
            // currentIndex=2, 把 index=5 移到 index=4（都在右侧）
            pl.move(5, 4);
            expect(pl.currentIndex).toBe(2);
        });

        it('move 操作后列表顺序完全符合预期 — 复杂场景', () => {
            // [T1,T2,T3,T4,T5,T6], ci=2(T3)
            // move(5 -> 1): [T1,T6,T2,T3,T4,T5], ci=3(T3右移)
            pl.move(5, 1);
            expect(pl.get(0)).toEqual(tracks[0]);
            expect(pl.get(1)).toEqual(tracks[5]);
            expect(pl.get(2)).toEqual(tracks[1]);
            expect(pl.get(3)).toEqual(tracks[2]);
            expect(pl.currentIndex).toBe(3);
        });

        it('move 不发射事件（源码中 move 无 #emit 调用）', () => {
            // beforeEach 中 replace 已调用过 emit，重置后验证 move 不产生新调用
            bus.emit.mockClear();
            pl.move(0, 3);
            expect(bus.emit).not.toHaveBeenCalled();
        });
    });

    // --------------------------------------------------------
    // Getter 属性
    // --------------------------------------------------------
    describe('Getter 属性', () => {
        let pl;

        beforeEach(() => {
            pl = new PlaylistOperations();
        });

        describe('current', () => {
            it('空列表返回 null', () => {
                expect(pl.current).toBeNull();
            });

            it('有数据时返回当前索引对应的曲目', () => {
                const tracks = createTracks(3);
                pl.replace(tracks, 1);
                expect(pl.current).toEqual(tracks[1]);
            });
        });

        describe('getAll()', () => {
            it('返回内部数组的副本（非同一引用）', () => {
                const tracks = createTracks(3);
                pl.replace(tracks);
                const result = pl.getAll();
                expect(result).toEqual(tracks);
                expect(result).not.toBe(tracks); // 浅拷贝
            });

            it('空列表返回空数组', () => {
                expect(pl.getAll()).toEqual([]);
            });
        });

        describe('length', () => {
            it('空列表返回 0', () => {
                expect(pl.length).toBe(0);
            });

            it('添加后返回正确的数量', () => {
                pl.push(createTrack(1));
                pl.push(createTrack(2));
                expect(pl.length).toBe(2);
            });
        });

        describe('isEmpty', () => {
            it('空列表返回 true', () => {
                expect(pl.isEmpty).toBe(true);
            });

            it('有数据返回 false', () => {
                pl.push(createTrack(1));
                expect(pl.isEmpty).toBe(false);
            });

            it('清空后再次返回 true', () => {
                pl.push(createTrack(1));
                pl.clear();
                expect(pl.isEmpty).toBe(true);
            });
        });

        describe('get(index)', () => {
            it('有效索引返回对应曲目', () => {
                const tracks = createTracks(3);
                pl.replace(tracks);
                expect(pl.get(0)).toEqual(tracks[0]);
                expect(pl.get(2)).toEqual(tracks[2]);
            });

            it('越界索引返回 null', () => {
                pl.push(createTrack(1));
                expect(pl.get(-1)).toBeNull();
                expect(pl.get(1)).toBeNull();
                expect(pl.get(100)).toBeNull();
            });
        });
    });

    // --------------------------------------------------------
    // indexOf()
    // --------------------------------------------------------
    describe('indexOf()', () => {
        let pl;
        let tracks;

        beforeEach(() => {
            pl = new PlaylistOperations();
            tracks = createTracks(5);
            pl.replace(tracks);
        });

        it('使用函数谓词查找 — 找到匹配项', () => {
            const idx = pl.indexOf((t) => t.id === 3);
            expect(idx).toBe(2);
        });

        it('使用函数谓词查找 — 未找到返回 -1', () => {
            const idx = pl.indexOf((t) => t.id === 999);
            expect(idx).toBe(-1);
        });

        it('使用值查找 — 找到匹配项', () => {
            const idx = pl.indexOf(tracks[3]);
            expect(idx).toBe(3);
        });

        it('使用值查找 — 未找到返回 -1', () => {
            const idx = pl.indexOf(createTrack(999));
            expect(idx).toBe(-1);
        });

        it('谓词接收 (item, index, array) 参数', () => {
            let receivedArgs = null;
            pl.indexOf((item, index, array) => {
                receivedArgs = { item, index, arrayLength: array.length };
                return false; // 始终返回 false，findIndex 会遍历到末尾
            });
            // findIndex 遍历全部元素后停止，receivedArgs 保存的是最后一次调用参数
            expect(receivedArgs).toEqual({
                item: tracks[4],       // 最后一个元素
                index: 4,
                arrayLength: 5,
            });
        });

        it('空列表中 indexOf 返回 -1', () => {
            const empty = new PlaylistOperations();
            expect(empty.indexOf((t) => true)).toBe(-1);
            expect(empty.indexOf({})).toBe(-1);
        });
    });

    // --------------------------------------------------------
    // currentIndex setter 边界限制
    // --------------------------------------------------------
    describe('currentIndex setter 边界限制', () => {
        let pl;

        beforeEach(() => {
            pl = new PlaylistOperations();
            pl.pushBatch(createTracks(5));
        });

        it('设置合法值正常生效', () => {
            pl.currentIndex = 3;
            expect(pl.currentIndex).toBe(3);
            expect(pl.current).toEqual(createTrack(4));
        });

        it('设置为负数时钳制到 0', () => {
            pl.currentIndex = -10;
            expect(pl.currentIndex).toBe(0);
        });

        it('超出上界时钳制到 length - 1', () => {
            pl.currentIndex = 100;
            expect(pl.currentIndex).toBe(4);
        });

        it('恰好等于 length - 1 时正常接受', () => {
            pl.currentIndex = 4;
            expect(pl.currentIndex).toBe(4);
        });

        it('空列表时设置任意值都被钳制到 0', () => {
            const empty = new PlaylistOperations();
            empty.currentIndex = 5;
            expect(empty.currentIndex).toBe(0);
        });

        it('设置 0 在空列表中保持 0', () => {
            const empty = new PlaylistOperations();
            empty.currentIndex = 0;
            expect(empty.currentIndex).toBe(0);
        });
    });

    // --------------------------------------------------------
    // 事件发射综合验证
    // --------------------------------------------------------
    describe('事件发射综合验证', () => {
        it('各操作只发射自己对应的事件类型', () => {
            const bus = createMockEventBus();
            const pl = new PlaylistOperations(bus);
            const tracks = createTracks(3);

            pl.replace(tracks, 0);
            expect(bus.emit).toHaveBeenLastCalledWith('player:playlistReplace', expect.anything());

            pl.push(createTrack(4));
            expect(bus.emit).toHaveBeenLastCalledWith('player:playlistPush', expect.anything());

            pl.pushBatch([createTrack(5)]);
            expect(bus.emit).toHaveBeenLastCalledWith('player:playlistPush', expect.anything());

            pl.remove(0);
            expect(bus.emit).toHaveBeenLastCalledWith('player:playlistRemove', expect.anything());

            pl.clear();
            expect(bus.emit).toHaveBeenLastCalledWith('player:playlistClear', undefined);
        });

        it('无 eventBus 时所有操作均不报错', () => {
            const pl = new PlaylistOperations(); // 无 eventBus
            expect(() => {
                pl.replace(createTracks(3));
                pl.push(createTrack(4));
                pl.pushBatch(createTracks(2));
                pl.remove(0);
                pl.clear();
                pl.insert(createTrack(9), 0);
                pl.move(0, 2);
            }).not.toThrow();
        });
    });

    // --------------------------------------------------------
    // PlaylistManager 子类
    // --------------------------------------------------------
    describe('PlaylistManager 子类', () => {
        it('PlaylistManager 继承 PlaylistOperations 所有方法可用', async () => {
            const { PlaylistManager } = await import('../playlist/PlaylistOperations');
            const pm = new PlaylistManager();
            const tracks = createTracks(4);
            pm.replace(tracks, 1);
            expect(pm.length).toBe(4);
            expect(pm.currentIndex).toBe(1);
            expect(pm.current).toEqual(tracks[1]);

            pm.push(createTrack(5));
            expect(pm.length).toBe(5);

            pm.remove(0);
            expect(pm.length).toBe(4);

            pm.clear();
            expect(pm.isEmpty).toBe(true);
        });
    });
});
