export { NotificationCenter } from './core/NotificationCenter.js';
export { createNotificationCenter } from './core/NotificationCenter.js';

export { NotificationType, NotificationLevel, DialogType, Position, AnimationType } from './core/NotificationTypes.js';

export { createDefaultConfig, mergeConfig } from './core/NotificationConfig.js';

export { NotificationEvents, NotificationCenterEventBus, notificationEventBus } from './events/NotificationEventBus.js';

export { AnimationPresets, getAnimation, createAnimation, runAnimation } from './animations/NotificationAnimations.js';

export { default as BaseDialog } from './components/Dialog/BaseDialog.vue';
export { default as AlertDialog } from './components/Dialog/AlertDialog.vue';
export { default as ConfirmDialog } from './components/Dialog/ConfirmDialog.vue';
export { default as InputDialog } from './components/Dialog/InputDialog.vue';
export { default as CustomDialog } from './components/Dialog/CustomDialog.vue';

export { default as ToastContainer } from './components/Toast/ToastContainer.vue';
export { default as ToastItem } from './components/Toast/ToastItem.vue';

export { default as SnackbarContainer } from './components/Snackbar/SnackbarContainer.vue';
export { default as SnackbarItem } from './components/Snackbar/SnackbarItem.vue';

export { default as BasePopup } from './components/Popup/BasePopup.vue';
export { default as TooltipPopup } from './components/Popup/TooltipPopup.vue';
export { default as DropdownPopup } from './components/Popup/DropdownPopup.vue';

export { default as useNotification } from './composables/useNotification.js';
export { default as useDialog } from './composables/useDialog.js';
export { default as useToast } from './composables/useToast.js';

export function createNotificationSystem(options = {}) {
    const center = NotificationCenter.create(options.config);

    return {
        center,
        get messageList() { return center.getAllMessages(); },
        regMessage: (msg) => center.registerMessage(msg),
        destoryMessage: (ts) => center.destroyMessage(ts),
        getAllMessages: () => center.getAllMessages(),
        showToast: (opts) => center.showToast(opts),
        showDialog: (opts) => center.showDialog(opts),
        showSnackbar: (opts) => center.showSnackbar(opts),
        getState: () => center.getState(),
        destroy: () => center.destroy()
    };
}
