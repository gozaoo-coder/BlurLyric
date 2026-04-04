/**
 * 通知模块默认配置与配置合并工具
 * 提供各通知组件的默认配置及深合并能力（无外部依赖）
 */

function createDefaultConfig() {
    return {
        dialog: {
            duration: 300,
            maskClosable: true,
            showCloseButton: true,
            zIndex: 2000
        },
        toast: {
            duration: 3000,
            maxCount: 5,
            position: 'top',
            zIndex: 3000
        },
        snackbar: {
            duration: 5000,
            position: 'bottom',
            actionMaxChars: 20,
            zIndex: 3000
        },
        popup: {
            trigger: 'hover',
            delayShow: 150,
            delayHide: 100,
            zIndex: 4000
        },
        animation: {
            duration: 300,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
    };
}

function _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sourceVal = source[key];
        const targetVal = target[key];
        if (
            sourceVal &&
            typeof sourceVal === 'object' &&
            !Array.isArray(sourceVal) &&
            targetVal &&
            typeof targetVal === 'object' &&
            !Array.isArray(targetVal)
        ) {
            result[key] = _deepMerge(targetVal, sourceVal);
        } else {
            result[key] = sourceVal;
        }
    }
    return result;
}

function mergeConfig(userConfig = {}) {
    const defaults = createDefaultConfig();
    if (!userConfig || typeof userConfig !== 'object') return defaults;
    return _deepMerge(defaults, userConfig);
}

export { createDefaultConfig, mergeConfig };
