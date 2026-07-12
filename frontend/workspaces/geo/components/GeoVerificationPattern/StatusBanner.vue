<template>
  <div
    v-if="visible"
    class="geo-status-banner"
    :class="`geo-status-banner--${variant}`"
    :style="bannerStyle"
    role="alert"
  >
    <div class="geo-status-banner__content">
      <span class="geo-status-banner__icon">{{ theme?.icon }}</span>
      <div class="geo-status-banner__text">
        <p v-if="title" class="geo-status-banner__title">{{ title }}</p>
        <p v-if="message" class="geo-status-banner__message">{{ message }}</p>
        <slot />
      </div>
    </div>
    <div class="geo-status-banner__actions">
      <slot name="actions">
        <button
          v-if="action"
          class="geo-status-banner__action-btn"
          @click="action.onClick"
        >{{ action.label }}</button>
      </slot>
      <button
        v-if="dismissible"
        class="geo-status-banner__dismiss"
        @click="dismiss"
        aria-label="关闭"
      >✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { resolveStatusVariant } from './registry/status-registry'
import type { StatusVariant } from './registry/status-registry'

const props = defineProps<{
  variant: StatusVariant | string
  title?: string
  message?: string
  dismissible?: boolean
  action?: { label: string; onClick: () => void }
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const _visible = ref(true)
const visible = computed(() => _visible.value)

const theme = computed(() => resolveStatusVariant(props.variant))

const bannerStyle = computed(() => {
  const t = theme.value
  if (!t) return {}
  return {
    backgroundColor: `var(${t.tokenBg})`,
    borderColor: `var(${t.tokenBorder})`,
    color: `var(${t.tokenText})`,
  }
})

function dismiss() {
  _visible.value = false
  emit('dismiss')
}
</script>

<style scoped>
.geo-status-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid;
  font-size: 14px;
  transition: all 200ms ease;
}

.geo-status-banner__content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
}

.geo-status-banner__icon {
  font-size: 18px;
  line-height: 1.4;
  flex-shrink: 0;
}

.geo-status-banner__text {
  flex: 1;
}

.geo-status-banner__title {
  font-weight: 600;
  margin: 0;
  line-height: 1.4;
}

.geo-status-banner__message {
  margin: 2px 0 0;
  opacity: 0.85;
  line-height: 1.4;
}

.geo-status-banner__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.geo-status-banner__action-btn {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid currentColor;
  background: transparent;
  white-space: nowrap;
  opacity: 0.9;
}

.geo-status-banner__action-btn:hover {
  opacity: 1;
}

.geo-status-banner__dismiss {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.6;
  padding: 2px 4px;
  line-height: 1;
}

.geo-status-banner__dismiss:hover {
  opacity: 1;
}
</style>
