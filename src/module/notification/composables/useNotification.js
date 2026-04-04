import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { NotificationCenter } from '../core/NotificationCenter.js';
import {
    notificationEventBus,
    NotificationEvents
} from '../events/NotificationEventBus.js';

let _centerInstance = null;

function getOrCreateCenter(userConfig) {
    if (!_centerInstance) {
        _centerInstance = NotificationCenter.create({ config: userConfig });
    }
    return _centerInstance;
}

export default function useNotification(options = {}) {
    const center = getOrCreateCenter(options.config);

    const toastList = ref([]);
    const activeDialog = ref(null);
    const activeSnackbar = ref(null);
    const popupStates = reactive({});

    function syncState() {
        try {
            const state = center.getState();
            toastList.value = state.toastList;
            activeDialog.value = state.activeDialog;
            activeSnackbar.value = state.activeSnackbar;
            Object.keys(popupStates).forEach(key => delete popupStates[key]);
            Object.assign(popupStates, state.popupStates);
        } catch (e) {
            console.warn('[useNotification] syncState error:', e);
        }
    }

    const eventHandlers = {};

    onMounted(() => {
        syncState();

        const updateHandler = () => syncState();
        const showHandler = () => syncState();
        const hideHandler = () => syncState();

        notificationEventBus.on(NotificationEvents.NOTIFICATION_UPDATE, updateHandler);
        notificationEventBus.on(NotificationEvents.NOTIFICATION_SHOW, showHandler);
        notificationEventBus.on(NotificationEvents.NOTIFICATION_HIDE, hideHandler);

        eventHandlers.update = updateHandler;
        eventHandlers.show = showHandler;
        eventHandlers.hide = hideHandler;
    });

    onBeforeUnmount(() => {
        if (eventHandlers.update) {
            notificationEventBus.off(NotificationEvents.NOTIFICATION_UPDATE, eventHandlers.update);
        }
        if (eventHandlers.show) {
            notificationEventBus.off(NotificationEvents.NOTIFICATION_SHOW, eventHandlers.show);
        }
        if (eventHandlers.hide) {
            notificationEventBus.off(NotificationEvents.NOTIFICATION_HIDE, eventHandlers.hide);
        }
    });

    function showToast(showOptions) {
        try {
            return center.showToast(showOptions);
        } catch (e) {
            console.error('[useNotification] showToast error:', e);
            return null;
        }
    }

    function showDialog(dialogOptions) {
        try {
            return center.showDialog(dialogOptions);
        } catch (e) {
            console.error('[useNotification] showDialog error:', e);
            return null;
        }
    }

    function showSnackbar(snackbarOptions) {
        try {
            return center.showSnackbar(snackbarOptions);
        } catch (e) {
            console.error('[useNotification] showSnackbar error:', e);
            return null;
        }
    }

    function dismissToast(id) {
        try {
            center.dismissToast(id);
        } catch (e) {
            console.error('[useNotification] dismissToast error:', e);
        }
    }

    function closeDialog(id) {
        try {
            center.closeDialog(id);
        } catch (e) {
            console.error('[useNotification] closeDialog error:', e);
        }
    }

    function dismissSnackbar(id) {
        try {
            center.dismissSnackbar(id);
        } catch (e) {
            console.error('[useNotification] dismissSnackbar error:', e);
        }
    }

    function registerMessage(message) {
        try {
            return center.registerMessage(message);
        } catch (e) {
            console.error('[useNotification] registerMessage error:', e);
            return undefined;
        }
    }

    function destroyMessage(timestamp) {
        try {
            center.destroyMessage(timestamp);
        } catch (e) {
            console.error('[useNotification] destroyMessage error:', e);
        }
    }

    function getAllMessages() {
        try {
            return center.getAllMessages();
        } catch (e) {
            console.error('[useNotification] getAllMessages error:', e);
            return [];
        }
    }

    return {
        state: {
            toastList,
            activeDialog,
            activeSnackbar,
            popupStates
        },
        methods: {
            showToast,
            showDialog,
            showSnackbar,
            dismissToast,
            closeDialog,
            dismissSnackbar
        },
        compat: {
            registerMessage,
            destoryMessage: destroyMessage,
            getAllMessages
        },
        _center: center
    };
}
