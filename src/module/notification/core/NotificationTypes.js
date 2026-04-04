/**
 * 通知模块类型常量定义
 * 统一管理通知系统中使用的所有枚举类型和常量
 */

const NotificationType = {
    DIALOG: 'dialog',
    TOAST: 'toast',
    SNACKBAR: 'snackbar',
    POPUP: 'popup',
    ALERT: 'alert',
    CONFIRM: 'confirm',
    INPUT: 'input',
    CUSTOM: 'custom'
};

const NotificationLevel = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

const DialogType = {
    ALERT_DIALOG: 'alertDialog',
    CONFIRM_DIALOG: 'confirmDialog',
    INPUT_DIALOG: 'inputDialog',
    CUSTOM_DIALOG: 'customDialog'
};

const Position = {
    TOP: 'top',
    BOTTOM: 'bottom',
    TOP_LEFT: 'topLeft',
    TOP_RIGHT: 'topRight',
    BOTTOM_LEFT: 'bottomLeft',
    BOTTOM_RIGHT: 'bottomRight',
    CENTER: 'center'
};

const AnimationType = {
    FADE: 'fade',
    SLIDE: 'slide',
    SCALE: 'scale',
    BOUNCE: 'bounce',
    SPRING: 'spring'
};

export {
    NotificationType,
    NotificationLevel,
    DialogType,
    Position,
    AnimationType
};
