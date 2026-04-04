import { ref, computed, toRefs } from 'vue';
import useNotification from './useNotification.js';
import { DialogType } from '../core/NotificationTypes.js';
import {
    notificationEventBus,
    NotificationEvents
} from '../events/NotificationEventBus.js';

export default function useDialog(options = {}) {
    const notification = useNotification(options);
    const { state, methods } = notification;

    // 使用 toRefs 保持响应性
    const { activeDialog } = toRefs(state);

    const isLoading = ref(false);

    const dialogVisible = computed(() => {
        return activeDialog.value !== null && activeDialog.value.visible === true;
    });

    const currentDialog = computed(() => {
        return activeDialog.value;
    });

    function alert(alertOptions) {
        if (typeof alertOptions === 'string') {
            alertOptions = { content: alertOptions };
        }

        return new Promise((resolve) => {
            const id = methods.showDialog({
                type: DialogType.ALERT_DIALOG,
                title: alertOptions.title || '',
                content: alertOptions.content || '',
                level: alertOptions.level || 'info',
                confirmText: alertOptions.confirmText || '确定'
            });

            const cleanup = () => {
                notificationEventBus.off(NotificationEvents.DIALOG_CONFIRM, onConfirm);
            };

            const onConfirm = (data) => {
                if (data && data.id === id) {
                    cleanup();
                    resolve(true);
                }
            };

            notificationEventBus.on(NotificationEvents.DIALOG_CONFIRM, onConfirm);
        });
    }

    function confirm(confirmOptions) {
        if (typeof confirmOptions === 'string') {
            confirmOptions = { content: confirmOptions };
        }

        return new Promise((resolve) => {
            const id = methods.showDialog({
                type: DialogType.CONFIRM_DIALOG,
                title: confirmOptions.title || '',
                content: confirmOptions.content || '',
                danger: confirmOptions.danger || false,
                confirmText: confirmOptions.confirmText || '确认',
                cancelText: confirmOptions.cancelText || '取消'
            });

            let resolved = false;
            const cleanup = () => {
                resolved = true;
                notificationEventBus.off(NotificationEvents.DIALOG_CONFIRM, onConfirm);
                notificationEventBus.off(NotificationEvents.DIALOG_CANCEL, onCancel);
            };

            const onConfirm = (data) => {
                if (data && data.id === id && !resolved) {
                    cleanup();
                    resolve(true);
                }
            };

            const onCancel = (data) => {
                if (data && data.id === id && !resolved) {
                    cleanup();
                    resolve(false);
                }
            };

            notificationEventBus.on(NotificationEvents.DIALOG_CONFIRM, onConfirm);
            notificationEventBus.on(NotificationEvents.DIALOG_CANCEL, onCancel);
        });
    }

    function input(inputOptions) {
        return new Promise((resolve) => {
            const id = methods.showDialog({
                type: DialogType.INPUT_DIALOG,
                title: inputOptions.title || '',
                placeholder: inputOptions.placeholder || '',
                defaultValue: inputOptions.defaultValue || '',
                multiline: inputOptions.multiline || false,
                confirmText: inputOptions.confirmText || '确认',
                cancelText: inputOptions.cancelText || '取消'
            });

            let resolved = false;
            const cleanup = () => {
                resolved = true;
                notificationEventBus.off(NotificationEvents.DIALOG_CONFIRM, onConfirm);
                notificationEventBus.off(NotificationEvents.DIALOG_CANCEL, onCancel);
            };

            const onConfirm = (data) => {
                if (data && data.id === id && !resolved) {
                    cleanup();
                    resolve(data.value !== undefined ? data.value : true);
                }
            };

            const onCancel = (data) => {
                if (data && data.id === id && !resolved) {
                    cleanup();
                    resolve(null);
                }
            };

            notificationEventBus.on(NotificationEvents.DIALOG_CONFIRM, onConfirm);
            notificationEventBus.on(NotificationEvents.DIALOG_CANCEL, onCancel);
        });
    }

    function custom(customOptions) {
        return new Promise((resolve) => {
            const id = methods.showDialog({
                type: DialogType.CUSTOM_DIALOG,
                ...customOptions
            });

            let resolved = false;
            const cleanup = () => {
                resolved = true;
                notificationEventBus.off(NotificationEvents.DIALOG_CONFIRM, onConfirm);
                notificationEventBus.off(NotificationEvents.DIALOG_CANCEL, onCancel);
            };

            const onConfirm = (data) => {
                if (data && data.id === id && !resolved) {
                    cleanup();
                    resolve(data);
                }
            };

            const onCancel = (data) => {
                if (data && data.id === id && !resolved) {
                    cleanup();
                    resolve(null);
                }
            };

            notificationEventBus.on(NotificationEvents.DIALOG_CONFIRM, onConfirm);
            notificationEventBus.on(NotificationEvents.DIALOG_CANCEL, onCancel);
        });
    }

    function close() {
        try {
            methods.closeDialog();
        } catch (e) {
            console.error('[useDialog] close error:', e);
        }
    }

    return {
        dialogVisible,
        currentDialog,
        isLoading,
        alert,
        confirm,
        input,
        custom,
        close
    };
}
