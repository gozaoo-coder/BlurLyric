<template>
  <div class="snackbar-container" :class="containerClass">
    <Transition name="snackbar-fade" mode="out-in">
      <SnackbarItem
        v-if="item"
        :key="item.id"
        :data="item"
        @action="handleAction"
        @dismiss="handleDismiss"
      />
    </Transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SnackbarItem from './SnackbarItem.vue'

defineOptions({ name: 'SnackbarContainer' })

const props = defineProps({
  item: {
    type: Object,
    default: null
  },
  position: {
    type: String,
    default: 'BOTTOM'
  }
})

const emit = defineEmits(['action', 'dismiss'])

const containerClass = computed(() => {
  const pos = (props.position || 'BOTTOM').toUpperCase()
  if (pos === 'TOP') return 'position-top-center'
  return 'position-bottom-center'
})

function handleAction(payload) {
  emit('action', payload)
}

function handleDismiss(id) {
  emit('dismiss', id)
}
</script>

<style scoped>
.snackbar-container {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  padding: 12px;
  pointer-events: none;
}

.position-bottom-center {
  bottom: 0;
}

.position-top-center {
  top: 0;
}

.snackbar-fade-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.snackbar-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.snackbar-fade-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
}
.snackbar-fade-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
