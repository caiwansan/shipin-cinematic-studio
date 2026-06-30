<template>
  <Teleport to="body">
    <Transition name="ds-dialog">
      <div
        v-if="open"
        class="ds-dialog__overlay"
        @click.self="close"
        @keydown.escape="close"
        role="dialog"
        :aria-modal="true"
        :aria-label="title || undefined"
        tabindex="-1"
      >
        <div
          ref="dialogRef"
          :class="['ds-dialog', `ds-dialog--${size}`, classOverride]"
          :style="styleOverride"
          :data-testid="dataTestId"
        >
          <div class="ds-dialog__header">
            <h2 v-if="title" class="ds-dialog__title">{{ title }}</h2>
            <button
              v-if="closable"
              class="ds-dialog__close"
              @click="close"
              aria-label="Close dialog"
              type="button"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div v-if="$slots.default" class="ds-dialog__body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="ds-dialog__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

type DialogSize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  size?: DialogSize
  closable?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  open: false,
  size: 'md',
  closable: true,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

function close() {
  emit('update:open', false)
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closable) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.ds-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  padding: var(--space-4, 16px);
}

.ds-dialog {
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface, #ffffff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--elevation-lg, 0 10px 15px rgba(0,0,0,0.1));
  max-height: 85vh;
  overflow-y: auto;
  width: 100%;
}

.ds-dialog--sm {
  max-width: 400px;
}

.ds-dialog--md {
  max-width: 560px;
}

.ds-dialog--lg {
  max-width: 720px;
}

.ds-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4, 16px) var(--space-5, 24px);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.ds-dialog__title {
  margin: 0;
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
}

.ds-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 20px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  border-radius: var(--radius-sm, 4px);
  transition: background-color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-dialog__close:hover {
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-text-primary, #111111);
}

.ds-dialog__body {
  padding: var(--space-4, 16px) var(--space-5, 24px);
  flex: 1;
  overflow-y: auto;
}

.ds-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-5, 24px);
  border-top: 1px solid var(--color-border, #e5e7eb);
}

/* Transition */
.ds-dialog-enter-active,
.ds-dialog-leave-active {
  transition: opacity var(--motion-normal-duration, 200ms) var(--motion-normal-easing, ease-out);
}

.ds-dialog-enter-from,
.ds-dialog-leave-to {
  opacity: 0;
}
</style>
