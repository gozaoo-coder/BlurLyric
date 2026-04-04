/**
 * NotificationCenter - 通知系统核心状态管理中心
 *
 * 纯 JavaScript 类，作为通知系统的单一数据源，管理 Dialog、Toast、Snackbar、Popup 的生命周期。
 * 参考 MusicPlayer.js 架构模式，使用私有字段、工厂方法创建实例。
 *
 * 设计原则：
 * - 高内聚：所有通知状态集中管理
 * - 低耦合：通过事件总线与 UI 层解耦
 * - 不依赖任何 UI 框架，仅负责状态管理与事件分发
 */

import { mergeConfig } from './NotificationConfig';
import {
    NotificationType,
    NotificationLevel,
    DialogType,
    Position
} from './NotificationTypes';
import {
    notificationEventBus,
    NotificationEvents
} from '../events/NotificationEventBus';

// ==================== 内部常量 ====================

/** ID 随机数位数 */
const ID_RANDOM_DIGITS = 4;

/** 默认 Toast 最大数量 */
const DEFAULT_TOAST_MAX_COUNT = 5;

/** 默认 Toast 持续时间（毫秒） */
const DEFAULT_TOAST_DURATION = 3000;

/** 默认 Snackbar 持续时间（毫秒） */
const DEFAULT_SNACKBAR_DURATION = 5000;

/** 默认消息自动消失时间（毫秒），兼容旧 API */
const DEFAULT_MESSAGE_LEAST_TIME = 7000;

/** 默认消息隐藏后延迟清理时间（毫秒） */
const MESSAGE_HIDE_CLEANUP_DELAY = 260;

// ==================== 主类定义 ====================

class NotificationCenter {
    // ---- 私有字段 ----

    /** @type {NotificationCenterEventBus} 事件总线实例 */
    #eventBus;

    /** @type {Object} 合并后的配置对象 */
    #config;

    /** @type {Array<Object>} 对话框队列 */
    #dialogQueue = [];

    /** @type {Object|null} 当前活动的对话框 */
    #activeDialog = null;

    /** @type {Array<Object>} 当前显示的 Toast 列表 */
    #toastList = [];

    /** @type {Map<number, ReturnType<typeof setTimeout>>} Toast 自动消失定时器映射 */
    #toastTimers = new Map();

    /** @type {Array<Object>} Snackbar 队列 */
    #snackbarQueue = [];

    /** @type {Object|null} 当前活动的 Snackbar */
    #activeSnackbar = null;

    /** @type {ReturnType<typeof setTimeout>} Snackbar 自动消失定时器 */
    #snackbarTimer = null;

    /** @type {Map<string, Object>} Popup 状态注册表 */
    #popupStates = new Map();

    /** @type {Array<Object>} 兼容旧 API 的消息列表 */
    #messageList = [];

    /** @type {Array<ReturnType<typeof setTimeout>>} 兼容旧 API 的定时器列表 */
    #legacyTimers = [];

    /** @type {number} ID 计数器 / 自增种子 */
    #idCounter = 0;

    /** @type {boolean} 是否已销毁 */
    #isDestroyed = false;

    // ==================== 构造与初始化 ====================

    /**
     * 构造函数（建议通过 static create() 工厂方法调用）
     * @param {Object} options 初始化选项
     * @param {Object} [options.config] 用户自定义配置
     * @param {NotificationCenterEventBus} [options.eventBus] 自定义事件总线（默认使用全局单例）
     */
    constructor(options = {}) {
        this.#eventBus = options.eventBus || notificationEventBus;
        this.#config = mergeConfig(options.config);
        this.#idCounter = Date.now();
    }

    /**
     * 工厂方法：创建 NotificationCenter 实例
     * 与 MusicPlayer.create() 保持一致的 API 风格
     *
     * @param {Object} [options={}] 创建选项
     * @param {Object} [options.config] 用户自定义配置
     * @param {NotificationCenterEventBus} [options.eventBus] 自定义事件总线
     * @returns {NotificationCenter} 实例
     */
    static create(options = {}) {
        const center = new NotificationCenter(options);
        return center;
    }

    /**
     * 初始化 / 重新初始化配置
     * 将用户配置与默认配置深度合并
     *
     * @param {Object} userConfig 用户配置项
     * @returns {this} 支持链式调用
     */
    init(userConfig) {
        this.#assertNotDestroyed();
        this.#config = mergeConfig(userConfig);
        this.#emit(NotificationEvents.NOTIFICATION_UPDATE, { config: this.#config });
        return this;
    }

    /**
     * 销毁实例，清理所有资源
     * 清空队列、取消定时器、清除事件监听
     */
    destroy() {
        if (this.#isDestroyed) return;
        this.#isDestroyed = true;

        // 清理所有 Toast 定时器
        for (const timerId of this.#toastTimers.values()) {
            clearTimeout(timerId);
        }
        this.#toastTimers.clear();

        // 清理 Snackbar 定时器
        if (this.#snackbarTimer) {
            clearTimeout(this.#snackbarTimer);
            this.#snackbarTimer = null;
        }

        // 清空所有内部状态
        this.#dialogQueue = [];
        this.#activeDialog = null;
        this.#toastList = [];
        this.#snackbarQueue = [];
        this.#activeSnackbar = null;
        this.#popupStates.clear();
        this.#messageList = [];

        // 清理兼容旧 API 的定时器
        for (const timer of this.#legacyTimers) {
            clearTimeout(timer);
        }
        this.#legacyTimers = [];

        // 清除事件总线上本实例相关的监听器
        this.#eventBus.clear();
    }

    // ==================== 公开访问器 ====================

    /** 获取当前合并后的配置（只读副本） */
    get config() {
        return { ...this.#config };
    }

    /** 获取事件总线引用 */
    get eventBus() {
        return this.#eventBus;
    }

    /** 获取是否已销毁 */
    get isDestroyed() {
        return this.#isDestroyed;
    }

    // ==================== ID 生成 ====================

    /**
     * 生成唯一通知 ID
     * 格式：{type}_{timestamp}_{4位随机数}
     *
     * @param {string} type 通知类型前缀（dialog / toast / snackbar / popup / msg）
     * @returns {string} 唯一 ID
     */
    generateId(type = 'notif') {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * Math.pow(10, ID_RANDOM_DIGITS))
            .toString()
            .padStart(ID_RANDOM_DIGITS, '0');
        return `${type}_${timestamp}_${random}`;
    }

    // ==================== Dialog 操作 ====================

    /**
     * 显示对话框
     * 同一时间只允许一个 activeDialog；新 dialog 根据配置决定排队或替换
     *
     * @param {Object} options 对话框选项
     * @param {string} [options.type='alertDialog'] 对话框类型 (alertDialog | confirmDialog | inputDialog | customDialog)
     * @param {string} [options.title] 标题
     * @param {string} [options.content] 内容
     * @param {Function} [options.onConfirm] 确认回调
     * @param {Function} [options.onCancel] 取消回调
     * @param {boolean} [options.maskClosable] 点击遮罩是否关闭
     * @param {boolean} [options.showCloseButton] 显示关闭按钮
     * @param {string} [options.confirmText] 确认按钮文字
     * @param {string} [options.cancelText] 取消按钮文字
     * @returns {string} 对话框 ID
     */
    showDialog(options = {}) {
        this.#assertNotDestroyed();

        const dialogConfig = this.#config.dialog || {};
        const id = this.generateId('dialog');

        const dialogData = {
            id,
            type: options.type || DialogType.ALERT_DIALOG,
            title: options.title ?? '',
            content: options.content ?? '',
            onConfirm: typeof options.onConfirm === 'function' ? options.onConfirm : null,
            onCancel: typeof options.onCancel === 'function' ? options.onCancel : null,
            maskClosable: options.maskClosable ?? dialogConfig.maskClosable,
            showCloseButton: options.showCloseButton ?? dialogConfig.showCloseButton,
            confirmText: options.confirmText || '确认',
            cancelText: options.cancelText || '取消',
            zIndex: dialogConfig.zIndex || 2000,
            visible: true,
            createdAt: Date.now()
        };

        // 如果已有活动对话框，排队等待
        if (this.#activeDialog) {
            this.#dialogQueue.push(dialogData);
        } else {
            this.#activateDialog(dialogData);
        }

        return id;
    }

    /**
     * 关闭对话框
     * 如果有关闭当前活动对话框，则自动从队列中激活下一个
     *
     * @param {string} [id] 对话框 ID，不传则关闭当前活动对话框
     */
    closeDialog(id) {
        this.#assertNotDestroyed();

        const targetId = id || this.#activeDialog?.id;
        if (!targetId) return;

        // 关闭的是当前活动对话框
        if (this.#activeDialog && this.#activeDialog.id === targetId) {
            this.#activeDialog.visible = false;
            this.#emit(NotificationEvents.NOTIFICATION_HIDE, {
                type: NotificationType.DIALOG,
                id: targetId
            });

            this.#activeDialog = null;

            // 从队列中取出下一个激活
            this.#activateNextDialog();
            return;
        }

        // 从队列中移除
        const queueIndex = this.#dialogQueue.findIndex(d => d.id === targetId);
        if (queueIndex !== -1) {
            this.#dialogQueue.splice(queueIndex, 1);
        }
    }

    /**
     * 获取当前活动的对话框
     * @returns {Object|null} 活动对话框数据（浅拷贝）
     */
    getActiveDialog() {
        if (!this.#activeDialog) return null;
        return { ...this.#activeDialog };
    }

    /**
     * 更新对话框内容
     *
     * @param {string} id 对话框 ID
     * @param {Object} updates 要更新的字段
     * @returns {boolean} 是否更新成功
     */
    updateDialog(id, updates) {
        this.#assertNotDestroyed();

        let target = this.#activeDialog;
        if (!target || target.id !== id) {
            target = this.#dialogQueue.find(d => d.id === id);
        }
        if (!target) return false;

        Object.assign(target, updates);

        this.#emit(NotificationEvents.NOTIFICATION_UPDATE, {
            type: NotificationType.DIALOG,
            id,
            data: target
        });
        return true;
    }

    // ==================== Toast 操作 ====================

    /**
     * 显示 Toast 消息
     * - 超过 maxCount 时自动移除最早的
     * - 支持重复消息合并（相同 content 增加 repeatTimes）
     * - 每个 toast 可设置独立 duration，到时自动 dismiss
     *
     * @param {Object} options Toast 选项
     * @param {string} options.message 消息内容
     * @param {string} [options.level='info'] 消息级别 (info | success | warning | error)
     * @param {number} [options.duration] 持续时间（毫秒），不传则使用全局配置
     * @param {string} [options.position] 显示位置
     * @returns {string} Toast ID
     */
    showToast(options = {}) {
        this.#assertNotDestroyed();

        const toastConfig = this.#config.toast || {};
        const maxCount = toastConfig.maxCount || DEFAULT_TOAST_MAX_COUNT;
        const defaultDuration = toastConfig.duration || DEFAULT_TOAST_DURATION;
        const message = String(options.message ?? '');
        const duration = options.duration ?? defaultDuration;

        // 重复消息检测与合并
        const existingIndex = this.#toastList.findIndex(
            t => t.message === message && t.visible
        );

        if (existingIndex !== -1) {
            // 合并：增加 repeatTimes 并重置计时器
            const existing = this.#toastList[existingIndex];
            existing.repeatTimes = (existing.repeatTimes || 1) + 1;

            // 重置该 toast 的自动消失定时器
            this.#resetToastTimer(existing.id, duration);

            this.#emit(NotificationEvents.NOTIFICATION_UPDATE, {
                type: NotificationType.TOAST,
                id: existing.id,
                data: existing
            });

            return existing.id;
        }

        // 超过最大数量限制时，移除最早的 toast
        while (this.#toastList.length >= maxCount) {
            this.#dismissOldestToast();
        }

        const id = this.generateId('toast');
        const toastData = {
            id,
            message,
            level: options.level || NotificationLevel.INFO,
            duration,
            position: options.position || toastConfig.position || Position.TOP,
            zIndex: toastConfig.zIndex || 3000,
            visible: true,
            repeatTimes: 1,
            createdAt: Date.now()
        };

        this.#toastList.push(toastData);

        // 设置自动消失定时器
        this.#resetToastTimer(id, duration);

        this.#emit(NotificationEvents.NOTIFICATION_SHOW, {
            type: NotificationType.TOAST,
            data: toastData
        });

        return id;
    }

    /**
     * 移除指定 Toast
     *
     * @param {string} id Toast ID
     */
    dismissToast(id) {
        this.#assertNotDestroyed();
        this.#removeToastById(id);
    }

    /**
     * 清空所有 Toast
     */
    clearAllToasts() {
        this.#assertNotDestroyed();

        // 清除所有定时器
        for (const timerId of this.#toastTimers.values()) {
            clearTimeout(timerId);
        }
        this.#toastTimers.clear();

        // 逐个移除并触发事件
        const idsToRemove = this.#toastList.map(t => t.id);
        this.#toastList = [];

        for (const id of idsToRemove) {
            this.#emit(NotificationEvents.TOAST_DISMISS, { id });
        }
    }

    /**
     * 获取当前 Toast 列表
     * @returns {Array<Object>} Toast 数据列表（浅拷贝数组）
     */
    getToastList() {
        return this.#toastList.map(t => ({ ...t }));
    }

    // ==================== Snackbar 操作 ====================

    /**
     * 显示 Snackbar
     * 同一时间只有一个 activeSnackbar
     *
     * @param {Object} options Snackbar 选项
     * @param {string} options.message 消息内容
     * @param {string} [options.actionText] 操作按钮文字
     * @param {Function} [options.onAction] 操作按钮回调
     * @param {number} [options.duration] 持续时间（毫秒）
     * @returns {string} Snackbar ID
     */
    showSnackbar(options = {}) {
        this.#assertNotDestroyed();

        const snackbarConfig = this.#config.snackbar || {};
        const defaultDuration = snackbarConfig.duration || DEFAULT_SNACKBAR_DURATION;
        const duration = options.duration ?? defaultDuration;

        const id = this.generateId('snack');
        const snackbarData = {
            id,
            message: String(options.message ?? ''),
            actionText: options.actionText || '',
            onAction: typeof options.onAction === 'function' ? options.onAction : null,
            duration,
            position: snackbarConfig.position || Position.BOTTOM,
            zIndex: snackbarConfig.zIndex || 3000,
            visible: true,
            createdAt: Date.now()
        };

        // 如果已有活动中的 snackbar，先将其入队
        if (this.#activeSnackbar) {
            this.#snackbarQueue.push(snackbarData);
        } else {
            this.#activateSnackbar(snackbarData, duration);
        }

        return id;
    }

    /**
     * 关闭 Snackbar
     * 关闭当前活动的 snackbar 后，自动从队列中激活下一个
     *
     * @param {string} id Snackbar ID
     */
    dismissSnackbar(id) {
        this.#assertNotDestroyed();
        const targetId = id || this.#activeSnackbar?.id;
        if (!targetId) return;

        // 关闭当前活动的 snackbar
        if (this.#activeSnackbar && this.#activeSnackbar.id === targetId) {
            this.#dismissActiveSnackbar();
            return;
        }

        // 从队列中移除
        const queueIndex = this.#snackbarQueue.findIndex(s => s.id === targetId);
        if (queueIndex !== -1) {
            this.#snackbarQueue.splice(queueIndex, 1);
        }
    }

    /**
     * 获取当前活动的 Snackbar
     * @returns {Object|null} 活动 Snackbar 数据（浅拷贝）
     */
    getActiveSnackbar() {
        if (!this.#activeSnackbar) return null;
        return { ...this.#activeSnackbar };
    }

    // ==================== Popup 操作 ====================

    /**
     * 注册一个 Popup 组件的状态
     *
     * @param {string} id Popup 唯一标识
     * @param {Object} options Popup 配置
     * @param {string} [options.trigger='hover'] 触发方式 (hover | click | manual)
     * @param {number} [options.delayShow=150] 显示延迟（毫秒）
     * @param {number} [options.delayHide=100] 隐藏延迟（毫秒）
     * @returns {this} 支持链式调用
     */
    registerPopup(id, options = {}) {
        this.#assertNotDestroyed();

        const popupConfig = this.#config.popup || {};
        const popupState = {
            id,
            visible: false,
            trigger: options.trigger || popupConfig.trigger || 'hover',
            delayShow: options.delayShow ?? popupConfig.delayShow ?? 150,
            delayHide: options.delayHide ?? popupConfig.delayHide ?? 100,
            zIndex: popupConfig.zIndex || 4000,
            registeredAt: Date.now(),
            ...options
        };

        this.#popupStates.set(id, popupState);

        this.#emit(NotificationEvents.NOTIFICATION_SHOW, {
            type: NotificationType.POPUP,
            id,
            data: popupState
        });

        return this;
    }

    /**
     * 切换 Popup 显隐状态
     *
     * @param {string} id Popup 唯一标识
     * @returns {boolean} 切换后的可见状态
     */
    togglePopup(id) {
        this.#assertNotDestroyed();

        const state = this.#popupStates.get(id);
        if (!state) {
            console.warn(`[NotificationCenter] togglePopup(): 未注册的 popup id="${id}"`);
            return false;
        }

        state.visible = !state.visible;

        this.#emit(NotificationEvents.POPUP_TOGGLE, { id, visible: state.visible });
        return state.visible;
    }

    /**
     * 显示指定 Popup
     *
     * @param {string} id Popup 唯一标识
     * @returns {boolean} 操作是否成功
     */
    showPopup(id) {
        this.#assertNotDestroyed();

        const state = this.#popupStates.get(id);
        if (!state) {
            console.warn(`[NotificationCenter] showPopup(): 未注册的 popup id="${id}"`);
            return false;
        }

        if (!state.visible) {
            state.visible = true;
            this.#emit(NotificationEvents.POPUP_TOGGLE, { id, visible: true });
        }
        return true;
    }

    /**
     * 隐藏指定 Popup
     *
     * @param {string} id Popup 唯一标识
     * @returns {boolean} 操作是否成功
     */
    hidePopup(id) {
        this.#assertNotDestroyed();

        const state = this.#popupStates.get(id);
        if (!state) {
            console.warn(`[NotificationCenter] hidePopup(): 未注册的 popup id="${id}"`);
            return false;
        }

        if (state.visible) {
            state.visible = false;
            this.#emit(NotificationEvents.POPUP_TOGGLE, { id, visible: false });
        }
        return true;
    }

    /**
     * 注销（移除）指定 Popup
     *
     * @param {string} id Popup 唯一标识
     * @returns {boolean} 是否注销成功
     */
    unregisterPopup(id) {
        this.#assertNotDestroyed();

        const existed = this.#popupStates.delete(id);
        if (existed) {
            this.#emit(NotificationEvents.NOTIFICATION_HIDE, {
                type: NotificationType.POPUP,
                id
            });
        }
        return existed;
    }

    // ==================== 兼容旧 API（regMessage / destoryMessage）====================

    /**
     * 注册消息 —— 兼容 App.vue 中现有的 regMessage 接口
     *
     * 支持的消息格式：
     * { type: 'Alert'|'Message'|'LongMessage', content: string, state?: string, leastTime?: number }
     *
     * 返回值包含 destoryMessage 方法引用（保持原拼写以兼容现有调用方）
     *
     * @param {Object} message 消息对象
     * @param {string} message.type 消息类型
     * @param {string} message.content 消息内容
     * @param {string} [message.state] 状态标识
     * @param {number} [message.leastTime] 最小显示时间（毫秒）
     * @returns {Object|number} 返回值保持与原 regMessage 一致：
     *   - LongMessage: 返回 { destoryMessage: Function }
     *   - Alert / Message: 返回 undefined
     *   - 其他类型: 返回 messageList 索引
     */
    registerMessage(message) {
        this.#assertNotDestroyed();

        if (!message || typeof message !== 'object') {
            console.warn('[NotificationCenter] registerMessage(): 无效的消息参数');
            return undefined;
        }

        const timestamp = Date.now();
        const normalizedMessage = {
            type: message.type || 'Message',
            content: String(message.content ?? ''),
            state: message.state || undefined,
            leastTime: message.leastTime ?? undefined,
            timestamp,
            repeatTimes: 1
        };

        const messageType = normalizedMessage.type;

        // --- LongMessage 类型：支持重复合并 ---
        if (messageType === 'LongMessage') {
            const existingIndex = this.#messageList.findIndex(
                m => m.type === 'LongMessage' && m.content === normalizedMessage.content
            );

            if (existingIndex !== -1) {
                // 已存在相同内容的 LongMessage，增加 repeatTimes
                this.#messageList[existingIndex].repeatTimes++;
                const existingTimestamp = this.#messageList[existingIndex].timestamp;

                return {
                    destoryMessage: () => {
                        this.#destroyLegacyMessage(existingIndex, existingTimestamp);
                    }
                };
            }

            // 新建 LongMessage
            normalizedMessage.state = 'display';
            this.#messageList.push(normalizedMessage);
            const currentIndex = this.#messageList.length - 1;

            this.#emit(NotificationEvents.NOTIFICATION_SHOW, {
                type: NotificationType.ALERT,
                data: normalizedMessage
            });

            return {
                destoryMessage: () => {
                    this.#destroyLegacyMessage(currentIndex, timestamp);
                }
            };
        }

        // --- Alert / Message 类型：直接添加 ---
        this.#messageList.push(normalizedMessage);

        this.#emit(NotificationEvents.NOTIFICATION_SHOW, {
            type: NotificationType.ALERT,
            data: normalizedMessage
        });

        // Message 和 Alert 不返回特殊结构
        if (messageType === 'Alert' || messageType === 'Message') {
            return undefined;
        }

        // --- 其他类型：设置自动消失定时器，返回索引 ---
        const dismissDelay = normalizedMessage.leastTime || DEFAULT_MESSAGE_LEAST_TIME;
        const timer = setTimeout(() => {
            this.destroyMessage(timestamp);
        }, dismissDelay);
        this.#legacyTimers.push(timer);

        return this.#messageList.length - 1;
    }

    /**
     * 销毁消息 —— 兼容旧 API 的 destroyMessage 接口
     * 通过时间戳定位消息并执行清理逻辑
     *
     * @param {number} timestamp 消息的时间戳
     */
    destroyMessage(timestamp) {
        this.#assertNotDestroyed();

        const index = this.#messageList.findIndex(m => m.timestamp === timestamp);
        if (index === -1) return;

        const message = this.#messageList[index];
        if (message.repeatTimes > 1) {
            message.repeatTimes--;
            return;
        }

        // 标记隐藏
        message.state = 'hidden';
        this.#emit(NotificationEvents.NOTIFICATION_HIDE, {
            type: NotificationType.ALERT,
            timestamp
        });

        // 延迟从列表中彻底移除（与原逻辑一致）
        const ts = timestamp;
        setTimeout(() => {
            const idx = this.#messageList.findIndex(m => m.timestamp === ts);
            if (idx !== -1 && this.#messageList[idx].repeatTimes <= 1) {
                this.#messageList.splice(idx, 1);
            }
        }, MESSAGE_HIDE_CLEANUP_DELAY);
    }

    /**
     * 获取所有消息 —— 兼容旧 API
     * @returns {Array<Object>} 消息列表的浅拷贝
     */
    getAllMessages() {
        return this.#messageList.map(m => ({ ...m }));
    }

    // ==================== 状态快照 ====================

    /**
     * 获取完整状态快照（供调试或外部读取）
     * @returns {Object} 当前全部状态的不可变快照
     */
    getState() {
        return {
            activeDialog: this.#activeDialog ? { ...this.#activeDialog } : null,
            dialogQueue: this.#dialogQueue.map(d => ({ ...d })),
            toastList: this.#toastList.map(t => ({ ...t })),
            activeSnackbar: this.#activeSnackbar ? { ...this.#activeSnackbar } : null,
            snackbarQueue: this.#snackbarQueue.map(s => ({ ...s })),
            popupStates: Object.fromEntries(
                Array.from(this.#popupStates.entries()).map(([k, v]) => [k, { ...v }])
            ),
            messageList: this.#messageList.map(m => ({ ...m })),
            config: { ...this.#config },
            isDestroyed: this.#isDestroyed
        };
    }

    // ==================== 内部私有方法 ====================

    /**
     * 断言实例未被销毁
     * @private
     */
    #assertNotDestroyed() {
        if (this.#isDestroyed) {
            throw new Error('[NotificationCenter] 实例已销毁，不允许操作');
        }
    }

    /**
     * 发出事件到事件总线
     * @private
     * @param {string} event 事件名称
     * @param {*} data 事件数据
     */
    #emit(event, data) {
        try {
            this.#eventBus.emit(event, data);
        } catch (error) {
            console.error(`[NotificationCenter] 事件发送失败 [${event}]:`, error);
        }
    }

    // ---- Dialog 内部方法 ----

    /**
     * 激活一个对话框为当前活动对话框
     * @private
     * @param {Object} dialogData 对话框数据
     */
    #activateDialog(dialogData) {
        this.#activeDialog = dialogData;
        this.#emit(NotificationEvents.NOTIFICATION_SHOW, {
            type: NotificationType.DIALOG,
            data: dialogData
        });
    }

    /**
     * 从队列中取出并激活下一个对话框
     * @private
     */
    #activateNextDialog() {
        if (this.#dialogQueue.length > 0) {
            const next = this.#dialogQueue.shift();
            this.#activateDialog(next);
        }
    }

    // ---- Toast 内部方法 ----

    /**
     * 重置指定 Toast 的自动消失定时器
     * @private
     * @param {string} id Toast ID
     * @param {number} duration 持续时间（毫秒）
     */
    #resetToastTimer(id, duration) {
        // 先清除已有的定时器
        const existingTimer = this.#toastTimers.get(id);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // duration <= 0 表示不自动消失
        if (!duration || duration <= 0) return;

        const timer = setTimeout(() => {
            this.#removeToastById(id);
        }, duration);

        this.#toastTimers.set(id, timer);
    }

    /**
     * 按 ID 移除单个 Toast
     * @private
     * @param {string} id Toast ID
     */
    #removeToastById(id) {
        const index = this.#toastList.findIndex(t => t.id === id);
        if (index === -1) return;

        // 清除对应定时器
        const timer = this.#toastTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.#toastTimers.delete(id);
        }

        // 从列表移除
        this.#toastList.splice(index, 1);

        this.#emit(NotificationEvents.TOAST_DISMISS, { id });
    }

    /**
     * 移除最早加入的 Toast（超出 maxCount 时调用）
     * @private
     */
    #dismissOldestToast() {
        if (this.#toastList.length === 0) return;
        const oldest = this.#toastList[0];
        this.#removeToastById(oldest.id);
    }

    // ---- Snackbar 内部方法 ----

    /**
     * 激活一个 Snackbar 为当前活动 Snackbar
     * @private
     * @param {Object} snackbarData Snackbar 数据
     * @param {number} duration 自动消失时长
     */
    #activateSnackbar(snackbarData, duration) {
        this.#activeSnackbar = snackbarData;

        // 清除旧的定时器
        if (this.#snackbarTimer) {
            clearTimeout(this.#snackbarTimer);
        }

        // 设置新的自动消失定时器
        if (duration && duration > 0) {
            this.#snackbarTimer = setTimeout(() => {
                this.#dismissActiveSnackbar();
            }, duration);
        }

        this.#emit(NotificationEvents.NOTIFICATION_SHOW, {
            type: NotificationType.SNACKBAR,
            data: snackbarData
        });
    }

    /**
     * 关闭当前活动的 Snackbar 并激活队列中的下一个
     * @private
     */
    #dismissActiveSnackbar() {
        if (!this.#activeSnackbar) return;

        const dismissedId = this.#activeSnackbar.id;
        this.#activeSnackbar.visible = false;

        this.#emit(NotificationEvents.NOTIFICATION_HIDE, {
            type: NotificationType.SNACKBAR,
            id: dismissedId
        });

        this.#activeSnackbar = null;

        // 清除定时器
        if (this.#snackbarTimer) {
            clearTimeout(this.#snackbarTimer);
            this.#snackbarTimer = null;
        }

        // 激活队列中的下一个
        if (this.#snackbarQueue.length > 0) {
            const next = this.#snackbarQueue.shift();
            this.#activateSnackbar(next, next.duration);
        }
    }

    // ---- 旧 API 兼容内部方法 ----

    /**
     * 销毁旧格式的消息（用于 destoryMessage 回调内部逻辑）
     * 保持与原 App.vue 完全一致的行为：
     * - repeatTimes > 1 时仅递减
     * - 否则标记 hidden 并延迟清理
     *
     * @private
     * @param {number} index 消息在列表中的索引
     * @param {number} timestamp 消息的时间戳
     */
    #destroyLegacyMessage(index, timestamp) {
        if (index < 0 || index >= this.#messageList.length) return;

        const msg = this.#messageList[index];
        if (msg.repeatTimes > 1) {
            msg.repeatTimes--;
            return;
        }

        msg.state = 'hidden';
        this.#emit(NotificationEvents.NOTIFICATION_HIDE, {
            type: NotificationType.ALERT,
            timestamp
        });

        // 延迟从列表中移除（与原逻辑一致的 260ms 延迟）
        const ts = timestamp;
        setTimeout(() => {
            const idx = this.#messageList.findIndex(m => m.timestamp === ts);
            if (idx !== -1 && this.#messageList[idx].repeatTimes <= 1) {
                this.#messageList.splice(idx, 1);
            }
        }, MESSAGE_HIDE_CLEANUP_DELAY);
    }
}

// ==================== 导出 ====================

export { NotificationCenter };

/**
 * 工厂函数：创建 NotificationCenter 实例
 * 便捷导出，与 index.js 的 createNotificationCenter 导出对应
 *
 * @param {Object} [options={}] 创建选项
 * @returns {NotificationCenter} 实例
 */
export const createNotificationCenter = (options = {}) => NotificationCenter.create(options);
