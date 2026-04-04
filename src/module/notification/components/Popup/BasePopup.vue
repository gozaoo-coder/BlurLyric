<template>
  <div ref="wrapperRef" class="base-popup-wrapper" :class="{ 'is-disabled': disabled }">
    <div
      ref="triggerRef"
      class="base-popup-trigger"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @click="onClick"
      @focusin="onFocus"
      @focusout="onBlur"
    >
      <slot />
    </div>

    <Teleport to="body" :disabled="!appendToBody">
      <Transition
        :name="transitionName"
        @before-enter="onBeforeEnter"
        @after-enter="onAfterEnter"
        @before-leave="onBeforeLeave"
        @after-leave="onAfterLeave"
      >
        <div
          v-show="isActive"
          ref="popupRef"
          v-click-outside="handleClickOutside"
          class="base-popup"
          :class="[`base-popup--${placement}`, { 'base-popup--with-arrow': arrow }]"
          :style="popupStyle"
          role="tooltip"
          @mouseenter="onPopupMouseEnter"
          @mouseleave="onPopupMouseLeave"
        >
          <slot name="content" />
          <span v-if="arrow" class="base-popup__arrow" :style="arrowStyle" />
          <slot name="arrow" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getAnimation, runAnimation } from '../../animations/NotificationAnimations.js'
import { notificationEventBus, NotificationEvents } from '../../events/NotificationEventBus.js'

const props = defineProps({
  visible: { type: Boolean, default: undefined },
  trigger: { type: String, default: 'hover' },
  placement: { type: String, default: 'bottom' },
  offset: { type: Array, default: () => [0, 8] },
  delayShow: { type: Number, default: 150 },
  delayHide: { type: Number, default: 100 },
  zIndex: { type: Number, default: 4000 },
  animation: { type: String, default: 'scaleIn' },
  disabled: { type: Boolean, default: false },
  arrow: { type: Boolean, default: false },
  appendToBody: { type: Boolean, default: false },
  boundary: { type: [String, Object], default: 'scrollParent' }
})

const emit = defineEmits(['update:visible', 'show', 'hide'])

const wrapperRef = ref(null)
const triggerRef = ref(null)
const popupRef = ref(null)
const isActive = ref(false)
const isControlled = computed(() => props.visible !== undefined)
const internalVisible = ref(false)

let showTimer = null
let hideTimer = null
let animationInstance = null
let resizeObserver = null

const currentVisible = computed(() => isControlled.value ? props.visible : internalVisible.value)

const popupStyle = computed(() => ({
  position: props.appendToBody ? 'fixed' : 'absolute',
  zIndex: props.zIndex,
  pointerEvents: currentVisible.value ? 'auto' : 'none'
}))

const transitionName = computed(() => `popup-${props.animation}`)

const arrowStyle = ref({})

function show() {
  if (props.disabled) return
  clearTimeout(hideTimer)
  hideTimer = null

  showTimer = setTimeout(() => {
    internalVisible.value = true
    emit('update:visible', true)
    emit('show')
    notificationEventBus.emit(NotificationEvents.POPUP_TOGGLE, { visible: true })
  }, props.delayShow)
}

function hide() {
  clearTimeout(showTimer)
  showTimer = null

  hideTimer = setTimeout(() => {
    internalVisible.value = false
    emit('update:visible', false)
    emit('hide')
    notificationEventBus.emit(NotificationEvents.POPUP_TOGGLE, { visible: false })
  }, props.delayHide)
}

function toggle() {
  if (currentVisible.value) hide()
  else show()
}

function onMouseEnter() {
  if (props.trigger !== 'hover' || props.disabled) return
  show()
}

function onMouseLeave() {
  if (props.trigger !== 'hover') return
  hide()
}

function onClick(e) {
  if (props.disabled) return
  if (props.trigger === 'click') {
    toggle()
  }
}

function onFocus() {
  if (props.trigger !== 'focus' || props.disabled) return
  show()
}

function onBlur(e) {
  if (props.trigger !== 'focus') return
  const relatedTarget = e.relatedTarget
  if (popupRef.value && popupRef.value.contains(relatedTarget)) return
  hide()
}

function onPopupMouseEnter() {
  if (props.trigger === 'hover') clearTimeout(hideTimer)
}

function onPopupMouseLeave() {
  if (props.trigger === 'hover') hide()
}

function handleClickOutside() {
  if (props.trigger === 'click' && currentVisible.value) {
    hide()
  }
}

function handleEscKey(e) {
  if (e.key === 'Escape' && currentVisible.value) {
    hide()
  }
}

function calculatePosition() {
  if (!triggerRef.value || !popupRef.value || !currentVisible.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const popupRect = popupRef.value.getBoundingClientRect()
  const popupSize = { width: popupRect.width, height: popupRect.height }

  const positions = {
    top: {
      x: triggerRect.left + triggerRect.width / 2 - popupSize.width / 2 + props.offset[0],
      y: triggerRect.top - popupSize.height - props.offset[1]
    },
    bottom: {
      x: triggerRect.left + triggerRect.width / 2 - popupSize.width / 2 + props.offset[0],
      y: triggerRect.bottom + props.offset[1]
    },
    left: {
      x: triggerRect.left - popupSize.width - props.offset[1],
      y: triggerRect.top + triggerRect.height / 2 - popupSize.height / 2 + props.offset[0]
    },
    right: {
      x: triggerRect.right + props.offset[1],
      y: triggerRect.top + triggerRect.height / 2 - popupSize.height / 2 + props.offset[0]
    },
    'top-start': {
      x: triggerRect.left + props.offset[0],
      y: triggerRect.top - popupSize.height - props.offset[1]
    },
    'top-end': {
      x: triggerRect.right - popupSize.width + props.offset[0],
      y: triggerRect.top - popupSize.height - props.offset[1]
    },
    'bottom-start': {
      x: triggerRect.left + props.offset[0],
      y: triggerRect.bottom + props.offset[1]
    },
    'bottom-end': {
      x: triggerRect.right - popupSize.width + props.offset[0],
      y: triggerRect.bottom + props.offset[1]
    }
  }

  let pos = positions[props.placement] || positions.bottom
  const viewWidth = window.innerWidth
  const viewHeight = window.innerHeight
  const padding = 8

  if (pos.x + popupSize.width > viewWidth - padding) {
    pos.x = viewWidth - popupSize.width - padding
  }
  if (pos.x < padding) pos.x = padding
  if (pos.y + popupSize.height > viewHeight - padding) {
    pos.y = triggerRect.top - popupSize.height - props.offset[1]
  }
  if (pos.y < padding) {
    pos.y = triggerRect.bottom + props.offset[1]
  }

  popupRef.value.style.left = `${pos.x}px`
  popupRef.value.style.top = `${pos.y}px`

  updateArrowPosition(triggerRect, popupSize, pos)
}

function updateArrowPosition(triggerRect, popupSize, pos) {
  if (!props.arrow) return

  const arrowSize = 8
  let ax = 0
  let ay = 0

  const basePlacement = props.placement.split('-')[0]

  if (basePlacement === 'top' || basePlacement === 'bottom') {
    ax = triggerRect.left + triggerRect.width / 2 - pos.x - arrowSize / 2
    ay = basePlacement === 'top' ? popupSize.height - 1 : -arrowSize + 1
  } else {
    ax = basePlacement === 'left' ? popupSize.width - 1 : -arrowSize + 1
    ay = triggerRect.top + triggerRect.height / 2 - pos.y - arrowSize / 2
  }

  arrowStyle.value = {
    left: `${ax}px`,
    top: `${ay}px`
  }
}

function onBeforeEnter(el) {
  const animConfig = getAnimation(props.animation)
  if (animConfig) {
    const initProps = {}
    for (const [k, v] of Object.entries(animConfig.properties)) {
      if (Array.isArray(v)) initProps[k] = v[0]
    }
    Object.assign(el.style, _toCssProps(initProps))
  }
}

function onAfterEnter(el) {
  el.style.opacity = ''
  el.style.transform = ''
  el.style.transition = ''
}

function onBeforeLeave(el) {
  const animConfig = getAnimation(props.animation.replace('In', 'Out')) || getAnimation('scaleOut')
  if (animConfig) {
    animationInstance = runAnimation(el, animConfig)
  }
}

function onAfterLeave(el) {
  if (animationInstance) {
    animationInstance.cancel()
    animationInstance = null
  }
}

function _toCssProps(props) {
  const css = {}
  for (const [k, v] of Object.entries(props)) {
    const kebab = k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    css[kebab] = typeof v === 'number' ? String(v) : v
  }
  return css
}

watch(currentVisible, (val) => {
  isActive.value = val
  if (val) {
    nextTick(() => {
      calculatePosition()
    })
  }
})

watch(() => [props.placement, props.offset], () => {
  if (currentVisible.value) {
    nextTick(calculatePosition)
  }
})

watch(() => props.visible, (val) => {
  if (isControlled.value) {
    internalVisible.value = val
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscKey)
  window.addEventListener('resize', calculatePosition)
  window.addEventListener('scroll', calculatePosition, true)

  resizeObserver = new ResizeObserver(() => {
    if (currentVisible.value) calculatePosition()
  })
  if (wrapperRef.value) {
    resizeObserver.observe(wrapperRef.value)
  }
})

onBeforeUnmount(() => {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  document.removeEventListener('keydown', handleEscKey)
  window.removeEventListener('resize', calculatePosition)
  window.removeEventListener('scroll', calculatePosition, true)
  if (resizeObserver) resizeObserver.disconnect()
  if (animationInstance) animationInstance.cancel()
})

defineExpose({ show, hide, toggle })
</script>

<script>
export default {
  name: 'BasePopup',
  directives: {
    clickOutside: {
      mounted(el, binding) {
      el._clickOutsideHandler = (e) => {
        if (!(el === e.target || el.contains(e.target))) {
          binding.value(e)
        }
      }
      document.addEventListener('click', el._clickOutsideHandler)
      },
      unmounted(el) {
      document.removeEventListener('click', el._clickOutsideHandler)
      delete el._clickOutsideHandler
      }
    }
  }
}
</script>

<style scoped>
.base-popup-wrapper {
  display: inline-block;
  position: relative;
}
.base-popup-wrapper.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.base-popup-trigger {
  display: inline-block;
  cursor: pointer;
}
.base-popup {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  padding: 8px 12px;
  min-width: 0;
  min-height: 0;
}
.base-popup__arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}
.base-popup--top .base-popup__arrow,
.base-popup--top-start .base-popup__arrow,
.base-popup--top-end .base-popup__arrow {
  bottom: -8px;
  border-width: 8px 8px 0 8px;
  border-color: #fff transparent transparent transparent;
}
.base-popup--bottom .base-popup__arrow,
.base-popup--bottom-start .base-popup__arrow,
.base-popup--bottom-end .base-popup__arrow {
  top: -8px;
  border-width: 0 8px 8px 8px;
  border-color: transparent transparent #fff transparent;
}
.base-popup--left .base-popup__arrow {
  right: -8px;
  border-width: 8px 0 8px 8px;
  border-color: transparent transparent transparent #fff;
}
.base-popup--right .base-popup__arrow {
  left: -8px;
  border-width: 8px 8px 8px 0;
  border-color: transparent #fff transparent transparent;
}

.popup-scaleIn-enter-active,
.popup-fadeIn-enter-active,
.popup-slideInDown-enter-active,
.popup-slideInUp-enter-active,
.popup-slideInLeft-enter-active,
.popup-slideInRight-enter-active {
  transition: all 0.25s ease-out;
}
.popup-scaleIn-leave-active,
.popup-fadeIn-leave-active,
.popup-slideInDown-leave-active,
.popup-slideInUp-leave-active,
.popup-slideInLeft-leave-active,
.popup-slideInRight-leave-active {
  transition: all 0.2s ease-in;
}

.popup-scaleIn-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.popup-scaleIn-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
.popup-fadeIn-enter-from,
.popup-fadeIn-leave-to {
  opacity: 0;
}
.popup-slideInDown-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.popup-slideInDown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
.popup-slideInUp-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.popup-slideInUp-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
.popup-slideInLeft-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}
.popup-slideInLeft-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
.popup-slideInRight-enter-from {
  opacity: 0;
  transform: translateX(10px);
}
.popup-slideInRight-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
