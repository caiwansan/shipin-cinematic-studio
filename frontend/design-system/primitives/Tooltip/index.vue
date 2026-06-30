<template>
  <Teleport to="body">
    <Transition name="ds-tooltip">
      <div
        v-if="visible"
        :class="['ds-tooltip', `ds-tooltip--${position}`, classOverride]"
        :style="tooltipStyle"
        role="tooltip"
        :data-testid="dataTestId"
      >
        <slot>
          {{ content }}
        </slot>
        <div class="ds-tooltip__arrow" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

const props = withDefaults(defineProps<{
  content?: string
  position?: TooltipPosition
  disabled?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  position: 'top',
  disabled: false,
})

const visible = ref(false)
let triggerEl: HTMLElement | null = null

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const tooltipStyle = computed(() => {
  const base = styleOverride.value ? (typeof styleOverride.value === 'string' ? {} : { ...styleOverride.value }) : {}
  return base
})

function show() {
  if (!props.disabled) {
    visible.value = true
  }
}

function hide() {
  visible.value = false
}

onMounted(() => {
  triggerEl = (document.activeElement || document.querySelector('[data-tooltip-trigger]')) as HTMLElement | null
})

onUnmounted(() => {
  visible.value = false
})

defineExpose({ show, hide })
</script>

<style scoped>
.ds-tooltip {
  position: fixed;
  z-index: 2000;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-text-primary, #111111);
  color: var(--color-surface, #ffffff);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  max-width: 240px;
}

.ds-tooltip__arrow {
  position: absolute;
  width: 6px;
  height: 6px;
  background-color: var(--color-text-primary, #111111);
  transform: rotate(45deg);
}

.ds-tooltip--top .ds-tooltip__arrow {
  bottom: -3px;
  left: 50%;
  margin-left: -3px;
}

.ds-tooltip--bottom .ds-tooltip__arrow {
  top: -3px;
  left: 50%;
  margin-left: -3px;
}

.ds-tooltip--left .ds-tooltip__arrow {
  right: -3px;
  top: 50%;
  margin-top: -3px;
}

.ds-tooltip--right .ds-tooltip__arrow {
  left: -3px;
  top: 50%;
  margin-top: -3px;
}

/* Transition */
.ds-tooltip-enter-active,
.ds-tooltip-leave-active {
  transition: opacity var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-tooltip-enter-from,
.ds-tooltip-leave-to {
  opacity: 0;
}
</style>
