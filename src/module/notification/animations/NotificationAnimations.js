/**
 * NotificationAnimations - 通知模块动画管理器
 */

export const AnimationPresets = {
    fadeIn: {
        properties: { opacity: [0, 1] },
        duration: 250,
        easing: 'easeOutQuad'
    },
    fadeOut: {
        properties: { opacity: [1, 0] },
        duration: 200,
        easing: 'easeInQuad'
    },
    slideInUp: {
        properties: { translateY: ['100%', '0%'], opacity: [0, 1] },
        duration: 350,
        easing: 'easeOutCubic'
    },
    slideInDown: {
        properties: { translateY: ['-100%', '0%'], opacity: [0, 1] },
        duration: 350,
        easing: 'easeOutCubic'
    },
    slideInLeft: {
        properties: { translateX: ['-100%', '0%'], opacity: [0, 1] },
        duration: 350,
        easing: 'easeOutCubic'
    },
    slideInRight: {
        properties: { translateX: ['100%', '0%'], opacity: [0, 1] },
        duration: 350,
        easing: 'easeOutCubic'
    },
    scaleIn: {
        properties: { scale: [0.9, 1], opacity: [0, 1] },
        duration: 300,
        easing: 'easeOutBack'
    },
    scaleOut: {
        properties: { scale: [1, 0.9], opacity: [1, 0] },
        duration: 250,
        easing: 'easeInBack'
    },
    springIn: {
        properties: { scale: [0.8, 1], opacity: [0, 1] },
        duration: 600,
        easing: 'spring(1, 80, 10, 0)'
    },
    bounceIn: {
        properties: { translateY: ['-50%', '0%'], scale: [0.5, 1], opacity: [0, 1] },
        duration: 500,
        easing: 'easeOutElastic(1, .5)'
    }
};

export function getAnimation(name) {
    if (!AnimationPresets[name]) {
        console.warn(`[NotificationAnimations] Preset "${name}" not found`);
        return null;
    }
    return JSON.parse(JSON.stringify(AnimationPresets[name]));
}

export function createAnimation(config) {
    if (!config || typeof config !== 'object') throw new Error('[NotificationAnimations] Invalid config');
    if (!config.properties || typeof config.properties !== 'object') throw new Error('[NotificationAnimations] "properties" required');

    return {
        properties: { ...config.properties },
        duration: config.duration ?? 300,
        easing: config.easing ?? 'easeOutQuad',
        delay: config.delay ?? 0,
        loop: config.loop ?? 0,
        direction: config.direction ?? 'normal'
    };
}

export function runAnimation(element, animationConfig, onComplete) {
    if (!element || !(element instanceof Element)) {
        console.error('[NotificationAnimations] Invalid element');
        return null;
    }

    let config = animationConfig;
    if (typeof animationConfig === 'string') {
        config = getAnimation(animationConfig);
        if (!config) return null;
    }

    if (typeof window !== 'undefined' && window.anime) {
        return _runWithAnimeJs(element, config, onComplete);
    }
    if (element.animate) {
        return _runWithWAAPI(element, config, onComplete);
    }
    return _runWithCssTransition(element, config, onComplete);
}

function _runWithAnimeJs(element, config, onComplete) {
    const instance = window.anime({
        targets: element,
        ..._convertForAnime(config.properties),
        duration: config.duration,
        easing: config.easing,
        delay: config.delay ?? 0,
        loop: config.loop ?? 0,
        direction: config.direction ?? 'normal',
        complete: onComplete
    });
    return {
        play: () => instance.play(),
        pause: () => instance.pause(),
        reverse: () => instance.reverse(),
        finish: () => instance.finish(),
        restart: () => instance.restart()
    };
}

function _runWithWAAPI(element, config, onComplete) {
    const keyframes = _toKeyframes(config.properties);
    let animation;
    try {
        animation = element.animate(keyframes, {
            duration: config.duration,
            easing: config.easing,
            delay: config.delay ?? 0,
            fill: 'forwards'
        });
    } catch (e) {
        console.warn('[NotificationAnimations] WAAPI fallback:', e.message);
        const final = Array.isArray(keyframes) ? keyframes[keyframes.length - 1] : keyframes;
        Object.entries(final).forEach(([k, v]) => { element.style[_camelToKebab(k)] = v; });
        animation = { play() {}, pause() {}, reverse() {}, finish() {}, cancel() {} };
    }
    if (onComplete) animation.onfinish = onComplete;
    return {
        play: () => animation.play(),
        pause: () => animation.pause(),
        reverse: () => animation.reverse(),
        finish: () => animation.finish(),
        cancel: () => animation.cancel()
    };
}

function _runWithCssTransition(element, config, onComplete) {
    const props = config.properties;
    const init = {};
    const target = {};
    for (const [k, v] of Object.entries(props)) {
        const cssK = _camelToKebab(k);
        if (Array.isArray(v) && v.length === 2) {
            init[cssK] = v[0];
            target[cssK] = v[1];
        } else {
            target[cssK] = v;
        }
    }
    Object.assign(element.style, init);
    void element.offsetHeight;
    const transitionStr = Object.keys(target).join(', ');
    element.style.transition = `${transitionStr} ${config.duration}ms ${config.easing}`;
    requestAnimationFrame(() => Object.assign(element.style, target));

    const onEnd = (e) => {
        if (Object.keys(target).includes(_kebabToCamel(e.propertyName))) {
            element.removeEventListener('transitionend', onEnd);
            element.style.transition = '';
            if (onComplete) onComplete();
        }
    };
    element.addEventListener('transitionend', onEnd);
    setTimeout(() => {
        element.removeEventListener('transitionend', onEnd);
        element.style.transition = '';
    }, config.duration + 100);

    return {
        play() {},
        pause() {},
        finish() { Object.assign(element.style, target); element.style.transition = ''; },
        cancel() { element.removeEventListener('transitionend', onEnd); element.style.transition = ''; Object.assign(element.style, init); }
    };
}

function _convertForAnime(properties) {
    const r = {};
    for (const [k, v] of Object.entries(properties)) r[k] = v;
    return r;
}

function _toKeyframes(properties) {
    const from = {};
    const to = {};
    for (const [k, v] of Object.entries(properties)) {
        if (Array.isArray(v) && v.length === 2) { from[k] = v[0]; to[k] = v[1]; }
        else to[k] = v;
    }
    return Object.keys(from).length > 0 ? [from, to] : [to];
}

function _camelToKebab(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
function _kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
