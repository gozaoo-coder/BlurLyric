import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerEventBus } from '../events/PlayerEventBus.js';

describe('PlayerEventBus', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = new PlayerEventBus();
    });

    // ==================== on() 方法测试 ====================
    describe('on()', () => {
        it('应该成功注册事件监听器', () => {
            const callback = vi.fn();
            eventBus.on('test', callback);

            eventBus.emit('test', 'data');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith('data');
        });

        it('应该支持链式调用', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            const result = eventBus
                .on('event1', callback1)
                .on('event2', callback2);

            // 验证返回的是同一个实例（链式调用）
            expect(result).toBe(eventBus);
        });

        it('应该允许同一事件注册多个监听器', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            eventBus.on('multi', callback1);
            eventBus.on('multi', callback2);
            eventBus.on('multi', callback3);

            eventBus.emit('multi', 'payload');

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback3).toHaveBeenCalledTimes(1);
        });

        it('多个监听器应按注册顺序执行', () => {
            const callOrder = [];
            const callback1 = () => callOrder.push(1);
            const callback2 = () => callOrder.push(2);
            const callback3 = () => callOrder.push(3);

            eventBus.on('order', callback1);
            eventBus.on('order', callback2);
            eventBus.on('order', callback3);

            eventBus.emit('order');

            expect(callOrder).toEqual([1, 2, 3]);
        });
    });

    // ==================== off() 方法测试 ====================
    describe('off()', () => {
        it('应该成功移除指定的回调函数', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            eventBus.on('remove', callback1);
            eventBus.on('remove', callback2);
            eventBus.off('remove', callback1);

            eventBus.emit('remove');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('应该支持链式调用', () => {
            const callback = vi.fn();

            const result = eventBus.off('nonexistent', callback);
            expect(result).toBe(eventBus);
        });

        it('移除不存在的回调不应报错', () => {
            const callback = vi.fn();
            const nonExistentCallback = vi.fn();

            eventBus.on('safe', callback);
            
            // 移除一个未注册的回调，不应抛出异常
            expect(() => {
                eventBus.off('safe', nonExistentCallback);
            }).not.toThrow();

            eventBus.emit('safe');
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('对不存在的事件调用 off 不应报错', () => {
            const callback = vi.fn();

            expect(() => {
                eventBus.off('nonexistent', callback);
            }).not.toThrow();
        });

        it('应该只移除匹配的回调，不影响其他相同事件的回调', () => {
            const callbacks = Array.from({ length: 5 }, () => vi.fn());

            callbacks.forEach(cb => eventBus.on('batch', cb));

            // 移除中间的回调
            eventBus.off('batch', callbacks[2]);

            eventBus.emit('batch');

            expect(callbacks[0]).toHaveBeenCalledTimes(1);
            expect(callbacks[1]).toHaveBeenCalledTimes(1);
            expect(callbacks[2]).not.toHaveBeenCalled(); // 被移除
            expect(callbacks[3]).toHaveBeenCalledTimes(1);
            expect(callbacks[4]).toHaveBeenCalledTimes(1);
        });

        it('应该能够移除重复注册的同一回调的所有实例', () => {
            const callback = vi.fn();

            eventBus.on('dup', callback);
            eventBus.on('dup', callback);
            eventBus.on('dup', callback);

            eventBus.off('dup', callback);
            eventBus.emit('dup');

            expect(callback).not.toHaveBeenCalled();
        });
    });

    // ==================== once() 方法测试 ====================
    describe('once()', () => {
        it('应该只触发一次后自动移除', () => {
            const callback = vi.fn();

            eventBus.once('once', callback);

            eventBus.emit('once', 'first');
            eventBus.emit('once', 'second');
            eventBus.emit('once', 'third');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith('first');
        });

        it('应该支持链式调用', () => {
            const callback = vi.fn();

            const result = eventBus.once('chainOnce', callback);
            expect(result).toBe(eventBus);
        });

        it('once 注册的监听器应该在第一次 emit 后被完全移除', () => {
            const callback = vi.fn();

            eventBus.once('autoRemove', callback);
            expect(eventBus.listenerCount('autoRemove')).toBe(1);

            eventBus.emit('autoRemove');
            expect(eventBus.listenerCount('autoRemove')).toBe(0);
        });

        it('应该正确传递参数给 once 回调', () => {
            const callback = vi.fn();

            eventBus.once('dataOnce', callback);
            eventBus.emit('dataOnce', { key: 'value' }, 123, 'extra');

            expect(callback).toHaveBeenCalledWith({ key: 'value' });
        });

        it('可以与 on() 混合使用', () => {
            const onceCallback = vi.fn();
            const onCallback = vi.fn();

            eventBus.once('mixed', onceCallback);
            eventBus.on('mixed', onCallback);

            eventBus.emit('mixed', 'call1');
            eventBus.emit('mixed', 'call2');

            expect(onceCallback).toHaveBeenCalledTimes(1); // 只触发一次
            expect(onCallback).toHaveBeenCalledTimes(2);   // 持续触发
        });

        it('多次 once 注册同一事件应该各自独立计数', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            eventBus.once('multipleOnce', callback1);
            eventBus.once('multipleOnce', callback2);

            eventBus.emit('multipleOnce');
            eventBus.emit('multipleOnce');

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });
    });

    // ==================== emit() 方法测试 ====================
    describe('emit()', () => {
        it('应该将数据传递给所有监听器', () => {
            const receivedData = [];
            const callback1 = (data) => receivedData.push(`cb1:${data}`);
            const callback2 = (data) => receivedData.push(`cb2:${data}`);

            eventBus.on('data', callback1);
            eventBus.on('data', callback2);

            eventBus.emit('data', 'hello');

            expect(receivedData).toEqual(['cb1:hello', 'cb2:hello']);
        });

        it('应该支持传递多种类型的数据', () => {
            const callback = vi.fn();

            eventBus.on('types', callback);

            // 测试字符串
            eventBus.emit('types', 'string data');
            expect(callback).toHaveBeenLastCalledWith('string data');

            // 测试数字
            eventBus.emit('types', 42);
            expect(callback).toHaveBeenLastCalledWith(42);

            // 测试对象
            const obj = { name: 'test', value: 123 };
            eventBus.emit('types', obj);
            expect(callback).toHaveBeenLastCalledWith(obj);

            // 测试数组
            eventBus.emit('types', [1, 2, 3]);
            expect(callback).toHaveBeenLastCalledWith([1, 2, 3]);

            // 测试 null
            eventBus.emit('types', null);
            expect(callback).toHaveBeenLastCalledWith(null);

            // 测试 undefined
            eventBus.emit('types', undefined);
            expect(callback).toHaveBeenLastCalledWith(undefined);
        });

        it('发射不存在的事件不应该报错', () => {
            expect(() => {
                eventBus.emit('nonexistentEvent', 'data');
            }).not.toThrow();
        });

        it('emit 时如果某个 handler 抛出错误不应影响其他 handler', () => {
            const callback1 = vi.fn();
            const errorCallback = () => {
                throw new Error('Intentional test error');
            };
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            // 使用 spy 来捕获 console.error
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            eventBus.on('errorIsolation', callback1);
            eventBus.on('errorIsolation', errorCallback);
            eventBus.on('errorIsolation', callback2);
            eventBus.on('errorIsolation', callback3);

            eventBus.emit('errorIsolation', 'testData');

            // 所有正常回调都应该被执行
            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith('testData');
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledWith('testData');
            expect(callback3).toHaveBeenCalledTimes(1);
            expect(callback3).toHaveBeenCalledWith('testData');

            // 验证错误被记录到 console.error
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('多个 handler 都抛错时都应该被隔离', () => {
            const goodCallback = vi.fn();
            const badCallback1 = () => { throw new Error('Error 1'); };
            const badCallback2 = () => { throw new Error('Error 2'); };

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            eventBus.on('multiError', goodCallback);
            eventBus.on('multiError', badCallback1);
            eventBus.on('multiError', badCallback2);

            eventBus.emit('multiError');

            expect(goodCallback).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledTimes(2); // 两个错误都被记录

            consoleSpy.mockRestore();
        });

        it('emit 应该在监听器的副本上执行，避免执行过程中修改的影响', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            eventBus.on('dynamic', callback1);
            eventBus.on('dynamic', () => {
                // 在回调中动态添加新监听器
                eventBus.on('dynamic', callback2);
            });

            eventBus.emit('dynamic');

            // callback2 应该不会被立即触发（因为是副本执行）
            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).not.toHaveBeenCalled();
        });
    });

    // ==================== clear() 方法测试 ====================
    describe('clear()', () => {
        it('应该清除指定事件的所有监听器', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const otherCallback = vi.fn();

            eventBus.on('clearMe', callback1);
            eventBus.on('clearMe', callback2);
            eventBus.on('keepMe', otherCallback);

            eventBus.clear('clearMe');

            eventBus.emit('clearMe');
            eventBus.emit('keepMe');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            expect(otherCallback).toHaveBeenCalledTimes(1);
        });

        it('不带参数时应该清除所有事件的监听器', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            eventBus.on('eventA', callback1);
            eventBus.on('eventB', callback2);
            eventBus.on('eventC', callback3);

            eventBus.clear();

            eventBus.emit('eventA');
            eventBus.emit('eventB');
            eventBus.emit('eventC');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            expect(callback3).not.toHaveBeenCalled();
        });

        it('清除不存在的事件不应该报错', () => {
            expect(() => {
                eventBus.clear('nonexistent');
            }).not.toThrow();
        });

        it('清除后可以重新注册监听器', () => {
            const callback = vi.fn();

            eventBus.on('rebind', callback);
            eventBus.clear('rebind');
            eventBus.on('rebind', callback);

            eventBus.emit('rebind');
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    // ==================== listenerCount() 方法测试 ====================
    describe('listenerCount()', () => {
        it('应该返回正确的事件监听器数量', () => {
            expect(eventBus.listenerCount('empty')).toBe(0);

            eventBus.on('count', vi.fn());
            expect(eventBus.listenerCount('count')).toBe(1);

            eventBus.on('count', vi.fn());
            expect(eventBus.listenerCount('count')).toBe(2);

            eventBus.on('count', vi.fn());
            expect(eventBus.listenerCount('count')).toBe(3);
        });

        it('对于不存在的事件应该返回 0', () => {
            expect(eventBus.listenerCount('nonexistent')).toBe(0);
        });

        it('off() 后数量应该减少', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            eventBus.on('decrement', callback1);
            eventBus.on('decrement', callback2);
            eventBus.on('decrement', callback3);

            expect(eventBus.listenerCount('decrement')).toBe(3);

            eventBus.off('decrement', callback2);
            expect(eventBus.listenerCount('decrement')).toBe(2);

            eventBus.off('decrement', callback1);
            expect(eventBus.listenerCount('decrement')).toBe(1);

            eventBus.off('decrement', callback3);
            expect(eventBus.listenerCount('decrement')).toBe(0);
        });

        it('once() 注册的监听器也应该计入总数', () => {
            eventBus.on('mixedCount', vi.fn());
            eventBus.once('mixedCount', vi.fn());
            eventBus.on('mixedCount', vi.fn());

            expect(eventBus.listenerCount('mixedCount')).toBe(3);
        });

        it('不同事件的监听器数量应该独立计算', () => {
            eventBus.on('eventX', vi.fn());
            eventBus.on('eventX', vi.fn());
            eventBus.on('eventY', vi.fn());

            expect(eventBus.listenerCount('eventX')).toBe(2);
            expect(eventBus.listenerCount('eventY')).toBe(1);
        });
    });

    // ==================== context 绑定测试 ====================
    describe('context 参数绑定', () => {
        it('on() 的 context 应该作为 this 传递给回调', () => {
            const context = { name: 'testContext', value: 42 };

            eventBus.on('contextTest', function(data) {
                expect(this).toBe(context);
                expect(this.name).toBe('testContext');
                expect(this.value).toBe(42);
                expect(data).toBe('payload');
            }, context);

            eventBus.emit('contextTest', 'payload');
        });

        it('once() 的 context 应该作为 this 传递给回调', () => {
            const context = { id: 'onceCtx' };

            eventBus.once('contextOnce', function(data) {
                expect(this).toBe(context);
                expect(this.id).toBe('onceCtx');
            }, context);

            eventBus.emit('contextOnce');
        });

        it('不传 context 时 this 应该是 null（源码默认值为 null）', () => {
            let capturedThis;

            eventBus.on('noContext', function() {
                capturedThis = this;
            });

            eventBus.emit('noContext');

            expect(capturedThis).toBeNull();
        });

        it('context 为 null 时回调中的 this 应该是 null', () => {
            let capturedThis;

            eventBus.on('nullContext', function() {
                capturedThis = this;
            }, null);

            eventBus.emit('nullContext');

            expect(capturedThis).toBeNull();
        });

        it('不同的监听器可以有不同的 context', () => {
            const ctx1 = { id: 1 };
            const ctx2 = { id: 2 };
            const results = [];

            eventBus.on('multiCtx', function() {
                results.push(this.id);
            }, ctx1);

            eventBus.on('multiCtx', function() {
                results.push(this.id);
            }, ctx2);

            eventBus.emit('multiCtx');

            expect(results).toContain(1);
            expect(results).toContain(2);
        });
    });

    // ==================== 边界情况和特殊场景 ====================
    describe('边界情况', () => {
        it('事件名可以是任意字符串', () => {
            const callback = vi.fn();

            // 特殊字符事件名
            eventBus.on('event:with:colons', callback);
            eventBus.emit('event:with:colons');
            expect(callback).toHaveBeenCalledTimes(1);

            // 带空格的事件名
            const callback2 = vi.fn();
            eventBus.on('event with spaces', callback2);
            eventBus.emit('event with spaces');
            expect(callback2).toHaveBeenCalledTimes(1);

            // Unicode 事件名
            const callback3 = vi.fn();
            eventBus.on('事件中文', callback3);
            eventBus.emit('事件中文');
            expect(callback3).toHaveBeenCalledTimes(1);
        });

        it('空字符串作为事件名应该正常工作', () => {
            const callback = vi.fn();

            eventBus.on('', callback);
            eventBus.emit('');

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('大量监听器的性能边界测试', () => {
            const callbacks = Array.from({ length: 1000 }, () => vi.fn());

            callbacks.forEach((cb, index) => {
                eventBus.on('bulk', cb);
            });

            expect(eventBus.listenerCount('bulk')).toBe(1000);

            eventBus.emit('bulk', 'bulkData');

            callbacks.forEach(cb => {
                expect(cb).toHaveBeenCalledTimes(1);
                expect(cb).toHaveBeenCalledWith('bulkData');
            });
        });

        it('在同一 emit 中移除自身不应影响其他监听器（emit 使用副本遍历）', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            eventBus.on('selfRemove', function() {
                eventBus.off('selfRemove', callback1);
            });

            eventBus.on('selfRemove', callback1);
            eventBus.on('selfRemove', callback2);

            eventBus.emit('selfRemove');

            // emit 使用 [...listeners] 副本遍历，callback1 已在副本中，仍会被调用
            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('快速连续注册和移除应该保持一致性', () => {
            const callbacks = Array.from({ length: 10 }, () => vi.fn());

            // 注册
            callbacks.forEach(cb => eventBus.on('rapid', cb));
            expect(eventBus.listenerCount('rapid')).toBe(10);

            // 移除偶数索引的回调
            callbacks.forEach((cb, index) => {
                if (index % 2 === 0) {
                    eventBus.off('rapid', cb);
                }
            });
            expect(eventBus.listenerCount('rapid')).toBe(5);

            eventBus.emit('rapid');

            // 奇数索引的回调应该被调用
            callbacks.forEach((cb, index) => {
                if (index % 2 === 0) {
                    expect(cb).not.toHaveBeenCalled();
                } else {
                    expect(cb).toHaveBeenCalledTimes(1);
                }
            });
        });

        it('回调函数接收 undefined 数据时应该正常工作', () => {
            const callback = vi.fn();

            eventBus.on('undefinedData', callback);
            eventBus.emit('undefinedData'); // 不传第二个参数

            expect(callback).toHaveBeenCalledWith(undefined);
        });

        it('多次 clear() 调用应该安全', () => {
            eventBus.on('a', vi.fn());
            eventBus.on('b', vi.fn());

            eventBus.clear();
            eventBus.clear(); // 第二次清除

            expect(eventBus.listenerCount('a')).toBe(0);
            expect(eventBus.listenerCount('b')).toBe(0);
        });
    });
});
