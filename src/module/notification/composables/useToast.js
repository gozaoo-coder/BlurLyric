import { computed } from 'vue';
import useNotification from './useNotification.js';
import { NotificationLevel } from '../core/NotificationTypes.js';

export default function useToast(options = {}) {
    const notification = useNotification(options);
    const { toastList, methods } = notification.state;

    const toasts = computed(() => {
        return toastList.value.filter(t => t.visible === true);
    });

    function success(message, duration) {
        try {
            return methods.showToast({
                message,
                level: NotificationLevel.SUCCESS,
                duration
            });
        } catch (e) {
            console.error('[useToast] success error:', e);
            return null;
        }
    }

    function error(message, duration) {
        try {
            return methods.showToast({
                message,
                level: NotificationLevel.ERROR,
                duration
            });
        } catch (e) {
            console.error('[useToast] error error:', e);
            return null;
        }
    }

    function warning(message, duration) {
        try {
            return methods.showToast({
                message,
                level: NotificationLevel.WARNING,
                duration
            });
        } catch (e) {
            console.error('[useToast] warning error:', e);
            return null;
        }
    }

    function info(message, duration) {
        try {
            return methods.showToast({
                message,
                level: NotificationLevel.INFO,
                duration
            });
        } catch (e) {
            console.error('[useToast] info error:', e);
            return null;
        }
    }

    function loading(message, duration) {
        try {
            return methods.showToast({
                message: message || '加载中...',
                level: NotificationLevel.INFO,
                duration: duration || 0
            });
        } catch (e) {
            console.error('[useToast] loading error:', e);
            return null;
        }
    }

    function dismiss(id) {
        try {
            methods.dismissToast(id);
        } catch (e) {
            console.error('[useToast] dismiss error:', e);
        }
    }

    function clear() {
        try {
            notification._center.clearAllToasts();
        } catch (e) {
            console.error('[useToast] clear error:', e);
        }
    }

    function dismissAll() {
        clear();
    }

    return {
        toasts,
        success,
        error,
        warning,
        info,
        loading,
        dismiss,
        clear,
        dismissAll
    };
}
