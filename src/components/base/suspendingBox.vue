<template>
    <div ref="triggerRef" class="relativeBox">
        <slot name="placeholder"></slot>
    </div>
    <div ref="contentRef" style="display: none;">
        <slot name="suspendContent"></slot>
    </div>
</template>

<script>
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { ref, computed, onMounted, onUnmounted, watch, nextTick, getCurrentInstance } from 'vue';
import 'tippy.js/animations/scale-subtle.css';

export default {
    name: 'FloatingBox',
    props: {
        hoverOnly: {
            type: Boolean,
            default: false,
        },
        visibility: {
            type: Boolean,
            default: true,
        },
        theme: {
            type: String,
            default: 'black',
        },
        maxWidth: {
            type: String,
            default: 'fit-content',
        },
        direction: {
            type: String,
            default: 'right',
        },
    },
    setup(props) {
        const triggerRef = ref(null);
        const contentRef = ref(null);
        const tippyInstance = ref(null);

        const getPlacement = () => {
            const placementMap = {
                'top': 'top',
                'bottom': 'bottom',
                'left': 'left',
                'right': 'right',
            };
            return placementMap[props.direction] || 'right';
        };

        const createTippy = () => {
            if (!triggerRef.value || !contentRef.value) return;

            tippyInstance.value = tippy(triggerRef.value, {
                content: contentRef.value,
                trigger: props.hoverOnly ? 'mouseenter' : 'manual',
                placement: getPlacement(),
                animation: 'scale-subtle',
                interactive: true,
                appendTo: () => document.body,
                showOnCreate: !props.hoverOnly && props.visibility,
                offset: [0, 10],
                popperOptions: {
                    modifiers: [
                        {
                            name: 'computeStyles',
                            options: {
                                adaptive: false,
                            }
                        }
                    ]
                }
            });

            // 显示内容后，移除 display: none
            if (contentRef.value) {
                contentRef.value.style.display = '';
            }
        };

        const updateVisibility = () => {
            if (!tippyInstance.value) return;

            if (props.visibility) {
                tippyInstance.value.show();
            } else {
                tippyInstance.value.hide();
            }
        };

        const updateTheme = () => {
            if (!tippyInstance.value) return;

            const popper = tippyInstance.value.popper;
            const tooltip = popper.querySelector('.tippy-box');
            if (tooltip) {
                tooltip.className = `tippy-box theme-${props.theme}`;
            }
        };

        watch(() => props.visibility, () => {
            if (!props.hoverOnly) {
                updateVisibility();
            }
        });

        watch(() => props.theme, () => {
            updateTheme();
        });

        watch(() => props.hoverOnly, () => {
            if (tippyInstance.value) {
                tippyInstance.value.setProps({
                    trigger: props.hoverOnly ? 'mouseenter' : 'manual'
                });
            }
        });

        watch(() => props.direction, () => {
            if (tippyInstance.value) {
                tippyInstance.value.setProps({
                    placement: getPlacement()
                });
            }
        });

        onMounted(() => {
            nextTick(() => {
                createTippy();
            });
        });

        onUnmounted(() => {
            if (tippyInstance.value) {
                tippyInstance.value.destroy();
                tippyInstance.value = null;
            }
        });

        return {
            triggerRef,
            contentRef,
        };
    },
};
</script>

<style scoped>
.relativeBox {
    position: relative;
    width: fit-content;
    height: fit-content;
    display: inline-block;
}

/* 直接在 tippy-box 上应用原有样式 */
:deep(.tippy-box) {
    min-width: max-content !important;
    font-size: 0.8em !important;
    padding: .4em .7em;
    border-radius: 0.64em;
    box-shadow: var(--Shadow-value-normal);
    max-width: fit-content;
    border: none;
}

/* 主题样式 - 直接应用到 tippy-box */
:deep(.tippy-box.theme-light) {
    background-color: #fff;
    color: #333;
}

:deep(.tippy-box.theme-black) {
    background-color: #333;
    color: #fff;
}

/* 内容区域不需要额外样式 */
:deep(.tippy-content) {
    padding: 0;
}

/* 隐藏默认箭头 */
:deep(.tippy-arrow) {
    display: none !important;
}

/* scale-subtle 动画样式 */
:deep(.tippy-box[data-animation="scale-subtle"]) {
    transform-origin: center center;
}

:deep(.tippy-box[data-animation="scale-subtle"][data-placement^="right"]) {
    transform-origin: left center;
}

:deep(.tippy-box[data-animation="scale-subtle"][data-placement^="left"]) {
    transform-origin: right center;
}

:deep(.tippy-box[data-animation="scale-subtle"][data-placement^="top"]) {
    transform-origin: center bottom;
}

:deep(.tippy-box[data-animation="scale-subtle"][data-placement^="bottom"]) {
    transform-origin: center top;
}

:deep(.tippy-box[data-animation="scale-subtle"][data-state="hidden"]) {
    transform: scale(0.8);
    opacity: 0;
}
</style>
