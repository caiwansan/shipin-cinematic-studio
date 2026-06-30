<template>
  <Teleport to="body">
    <Transition name="ds-confirm-dialog">
      <div
        v-if="open"
        class="ds-confirm-dialog__overlay"
        @click.self="handleCancel"
        @keydown.escape="handleCancel"
        role="alertdialog"
        :aria-modal="true"
        :aria-label="title || 'Confirm action'"
        tabindex="-1"
      >
        <div
          ref="dialogRef"
          :class="['ds-confirm-dialog', classOverride]"
          :style="styleOverride"
          :data-testid="dataTestId"
        >
          <div :class="['ds-confirm-dialog__icon', `ds-confirm-dialog__icon--${variant}`]">
            <span v-if="variant === 'danger'">!</span>
            <span v-else-if="variant === 'warning'">⚠</span>
            <span v-else>?</span>
          </div>
          <h2 v-if="title" class="ds-confirm-dialog__title">{{ title }}</h2>
          <p v-if="message" class="ds-confirm-dialog__message">{{ message }}</p>
          <div v-if="$slots.default" class="ds-confirm-dialog__body">
            <slot />
          </div>
          <div class="ds-confirm-dialog__footer">
            <button
              class="ds-confirm-dialog__btn ds-confirm-dialog__btn--cancel"
              @click="handleCancel"
              :disabled="loading"
              type="button"
            >
              {{ cancelText }}
            </button>
            <button
              :class="['ds-confirm-dialog__btn', `ds-confirm-dialog__btn--${variant}`]"
              @click="handleConfirm"
              :disabled="loading"
              type="button"
            >
              <span v-if="loading" class="ds-confirm-dialog__spinner" />
              <span v-else>{{ confirmText }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

type ConfirmVariant = 'default' | 'danger' | 'warning'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  message?: string
  variant?: ConfirmVariant
  confirmText?: string
  cancelText?: string
  loading?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  open: false,
  variant: 'default',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  loading: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  if (!props.loading) {
    emit('cancel')
    emit('update:open', false)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleCancel()
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
.ds-confirm-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  padding: var(--space-4, 16px);
}

.ds-confirm-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background-color: var(--color-surface, #ffffff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--elevation-lg, 0 10px 15px rgba(0,0,0,0.1));
  padding: var(--space-6, 32px) var(--space-5, 24px) var(--space-4, 16px);
  max-width: 400px;
  width: 100%;
}

.ds-confirm-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full, 9999px);
  margin-bottom: var(--space-3, 12px);
  font-size: 24px;
  font-weight: 700;
}

.ds-confirm-dialog__icon--default {
  background-color: #eff6ff;
  color: var(--color-info, #3b82f6);
}

.ds-confirm-dialog__icon--danger {
  background-color: #fef2f2;
  color: var(--color-error, #ef4444);
}

.ds-confirm-dialog__icon--warning {
  background-color: #fefce8;
  color: var(--color-warning, #eab308);
}

.ds-confirm-dialog__title {
  margin: 0 0 var(--space-2, 8px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
}

.ds-confirm-dialog__message {
  margin: 0 0 var(--space-4, 16px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.5;
}

.ds-confirm-dialog__body {
  width: 100%;
  margin-bottom: var(--space-4, 16px);
}

.ds-confirm-dialog__footer {
  display: flex;
  gap: var(--space-2, 8px);
  width: 100%;
}

.ds-confirm-dialog__btn {
  flex: 1;
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
}

.ds-confirm-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ds-confirm-dialog__btn--cancel {
  background-color: var(--color-surface, #ffffff);
  color: var(--color-text-primary, #111111);
  border-color: var(--color-border, #e5e7eb);
}

.ds-confirm-dialog__btn--cancel:hover:not(:disabled) {
  background-color: var(--color-surface-dim, #f9fafb);
}

.ds-confirm-dialog__btn--default {
  background-color: var(--color-info, #3b82f6);
  color: #ffffff;
}

.ds-confirm-dialog__btn--default:hover:not(:disabled) {
  background-color: #2563eb;
}

.ds-confirm-dialog__btn--danger {
  background-color: var(--color-error, #ef4444);
  color: #ffffff;
}

.ds-confirm-dialog__btn--danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.ds-confirm-dialog__btn--warning {
  background-color: var(--color-caution, #f97316);
  color: #ffffff;
}

.ds-confirm-dialog__btn--warning:hover:not(:disabled) {
  background-color: #ea580c;
}

.ds-confirm-dialog__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #ffffff;
  border-radius: var(--radius-full, 9999px);
  animation: ds-confirm-spin 0.6s linear infinite;
}

@keyframes ds-confirm-spin {
  to { transform: rotate(360deg); }
}

/* Transition */
.ds-confirm-dialog-enter-active,
.ds-confirm-dialog-leave-active {
  transition: opacity var(--motion-normal-duration, 200ms) var(--motion-normal-easing, ease-out);
}

.ds-confirm-dialog-enter-from,
.ds-confirm-dialog-leave-to {
  opacity: 0;
}
</style>
