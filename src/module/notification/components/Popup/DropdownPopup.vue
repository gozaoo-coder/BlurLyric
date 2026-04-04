<template>
  <BasePopup
    ref="basePopupRef"
    :visible="visible"
    :trigger="trigger"
    :placement="placement"
    :offset="offset"
    :delay-show="delayShow"
    :delay-hide="delayHide"
    :z-index="zIndex"
    :animation="animation"
    :disabled="disabled"
    :arrow="arrow"
    :append-to-body="appendToBody"
    :boundary="boundary"
    @update:visible="onVisibleChange"
    @show="$emit('show')"
    @hide="$emit('hide')"
  >
    <slot />
    <template #content>
      <div
        ref="dropdownRef"
        class="dropdown-popup"
        :style="{ minWidth: dropdownMinWidth + 'px' }"
        @keydown="onKeydown"
      >
        <template v-if="options.length > 0">
          <div
            v-for="(option, index) in options"
            :key="option.value !== undefined ? option.value : index"
            class="dropdown-popup__item"
            :class="{
              'is-selected': isSelected(option),
              'is-disabled': option.disabled,
              'is-divided': option.divided,
              'is-active': activeIndex === index
            }"
            :data-index="index"
            @click.stop="handleSelect(option)"
            @mouseenter="activeIndex = index"
          >
            <span v-if="option.icon" class="dropdown-popup__icon" v-html="option.icon" />
            <span class="dropdown-popup__label">{{ option.label }}</span>
            <span v-if="isSelected(option)" class="dropdown-popup__check">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </template>
        <div v-else class="dropdown-popup__empty">
          <slot name="empty">暂无数据</slot>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import BasePopup from './BasePopup.vue'

defineOptions({
  name: 'DropdownPopup'
})

const props = defineProps({
  visible: { type: Boolean, default: undefined },
  options: { type: Array, default: () => [] },
  selected: { type: [String, Number, Boolean, Object], default: null },
  placement: { type: String, default: 'bottom-start' },
  trigger: { type: String, default: 'click' },
  offset: { type: Array, default: () => [0, 4] },
  delayShow: { type: Number, default: 100 },
  delayHide: { type: Number, default: 150 },
  zIndex: { type: Number, default: 4000 },
  animation: { type: String, default: 'scaleIn' },
  disabled: { type: Boolean, default: false },
  arrow: { type: Boolean, default: false },
  appendToBody: { type: Boolean, default: false },
  boundary: { type: [String, Object], default: 'scrollParent' },
  minWidth: { type: Number, default: 160 }
})

const emit = defineEmits(['update:visible', 'select', 'visible-change', 'show', 'hide'])

const basePopupRef = ref(null)
const dropdownRef = ref(null)
const activeIndex = ref(-1)
const triggerWidth = ref(0)

const dropdownMinWidth = computed(() => {
  return Math.max(props.minWidth, triggerWidth.value)
})

const isCurrentlyVisible = computed(() => {
  return props.visible !== undefined ? props.visible : false
})

function isSelected(option) {
  if (props.selected === undefined || props.selected === null) return false
  return option.value === props.selected
}

function handleSelect(option) {
  if (option.disabled) return
  emit('select', option)
  basePopupRef.value?.hide()
}

function onVisibleChange(val) {
  emit('update:visible', val)
  emit('visible-change', val)
  if (val) {
    activeIndex.value = -1
    nextTick(() => {
      updateTriggerWidth()
      scrollActiveIntoView()
    })
  }
}

function updateTriggerWidth() {
  const triggerEl = basePopupRef.value?.$el?.querySelector('.base-popup-trigger')
  if (triggerEl) {
    triggerWidth.value = triggerEl.getBoundingClientRect().width
  }
}

function onKeydown(e) {
  const enabledOptions = props.options.filter(o => !o.disabled)
  if (enabledOptions.length === 0) return

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      navigateDown(enabledOptions)
      break
    case 'ArrowUp':
      e.preventDefault()
      navigateUp(enabledOptions)
      break
    case 'Enter':
      e.preventDefault()
      selectActive(enabledOptions)
      break
    case 'Escape':
      e.preventDefault()
      basePopupRef.value?.hide()
      break
  }
}

function navigateDown(enabledOptions) {
  if (activeIndex.value >= props.options.length - 1) {
    activeIndex.value = props.options.findIndex(o => !o.disabled)
  } else {
    let next = activeIndex.value + 1
    while (next < props.options.length && props.options[next].disabled) {
      next++
    }
    if (next < props.options.length) activeIndex.value = next
  }
  scrollActiveIntoView()
}

function navigateUp(enabledOptions) {
  if (activeIndex.value <= 0) {
    let last = props.options.length - 1
    while (last >= 0 && props.options[last].disabled) last--
    activeIndex.value = last
  } else {
    let prev = activeIndex.value - 1
    while (prev >= 0 && props.options[prev].disabled) prev--
    if (prev >= 0) activeIndex.value = prev
  }
  scrollActiveIntoView()
}

function selectActive(enabledOptions) {
  if (activeIndex.value >= 0 && activeIndex.value < props.options.length) {
    const option = props.options[activeIndex.value]
    if (!option.disabled) handleSelect(option)
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    if (!dropdownRef.value || activeIndex.value < 0) return
    const items = dropdownRef.value.querySelectorAll('.dropdown-popup__item')
    const targetEl = items[activeIndex.value]
    if (targetEl) targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

watch(() => props.selected, () => {
  if (isCurrentlyVisible.value) {
    nextTick(scrollActiveIntoView)
  }
})

watch(() => props.visible, (val) => {
  if (val !== undefined && val) {
    activeIndex.value = -1
    nextTick(() => {
      updateTriggerWidth()
      scrollActiveIntoView()
    })
  }
}, { immediate: true })

defineExpose({ show: () => basePopupRef.value?.show(), hide: () => basePopupRef.value?.hide() })
</script>

<style scoped>
.dropdown-popup {
  padding: 4px 0;
  min-width: 160px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  max-height: 300px;
  overflow-y: auto;
  box-sizing: border-box;
}
.dropdown-popup__item {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #333;
  transition: background-color 0.15s ease;
  white-space: nowrap;
  user-select: none;
}
.dropdown-popup__item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}
.dropdown-popup__item.is-active {
  background-color: rgba(0, 0, 0, 0.06);
}
.dropdown-popup__item.is-selected {
  color: #1677ff;
  font-weight: 500;
}
.dropdown-popup__item.is-disabled {
  color: #ccc;
  cursor: not-allowed;
  pointer-events: none;
}
.dropdown-popup__item.is-divided {
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 4px;
  padding-bottom: 4px;
}
.dropdown-popup__icon {
  margin-right: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.dropdown-popup__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dropdown-popup__check {
  margin-left: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: #1677ff;
}
.dropdown-popup__empty {
  padding: 12px 16px;
  text-align: center;
  color: #999;
  font-size: 0.85rem;
}
</style>
