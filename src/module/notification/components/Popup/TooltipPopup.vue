<template>
  <BasePopup
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
    @update:visible="$emit('update:visible', $event)"
    @show="$emit('show')"
    @hide="$emit('hide')"
  >
    <slot />
    <template #content>
      <div
        class="tooltip-popup"
        :class="[`tooltip-popup--${theme}`]"
        :style="{ maxWidth: maxWidth + 'px' }"
      >
        <span class="tooltip-popup__text" v-html="html ? content : undefined" v-text="!html ? content : undefined" />
      </div>
    </template>
  </BasePopup>
</template>

<script setup>
import BasePopup from './BasePopup.vue'

defineOptions({
  name: 'TooltipPopup'
})

const props = defineProps({
  visible: { type: Boolean, default: undefined },
  content: { type: String, default: '' },
  html: { type: Boolean, default: false },
  maxWidth: { type: Number, default: 280 },
  theme: { type: String, default: 'dark' },
  placement: { type: String, default: 'top' },
  trigger: { type: String, default: 'hover' },
  offset: { type: Array, default: () => [0, 8] },
  delayShow: { type: Number, default: 150 },
  delayHide: { type: Number, default: 100 },
  zIndex: { type: Number, default: 4000 },
  animation: { type: String, default: 'scaleIn' },
  disabled: { type: Boolean, default: false },
  arrow: { type: Boolean, default: true },
  appendToBody: { type: Boolean, default: false },
  boundary: { type: [String, Object], default: 'scrollParent' }
})

const emit = defineEmits(['update:visible', 'show', 'hide'])
</script>

<style scoped>
.tooltip-popup {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  line-height: 1.5;
  word-break: break-word;
  text-align: center;
  box-sizing: border-box;
}
.tooltip-popup__text {
  display: block;
}

.tooltip-popup--dark {
  background: rgba(48, 48, 48, 0.95);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.tooltip-popup--light {
  background: #fff;
  color: #333;
  border: 1px solid #e8e8e8;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
</style>
