<template>
  <span
    :class="['ds-avatar', `ds-avatar--${size}`, classOverride]"
    :style="[styleOverride, avatarStyle]"
    :data-testid="dataTestId"
    :aria-label="alt"
    :role="src ? 'img' : undefined"
  >
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="ds-avatar__image"
      @error="imageError = true"
    />
    <span v-else-if="initials" class="ds-avatar__initials">{{ initials }}</span>
    <span v-else class="ds-avatar__placeholder" aria-hidden="true">
      <slot />
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(defineProps<{
  src?: string
  alt?: string
  initials?: string
  size?: AvatarSize
  backgroundColor?: string
  textColor?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  alt: '',
  size: 'md',
})

const imageError = ref(false)

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const avatarStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.backgroundColor && !props.src) {
    style.backgroundColor = props.backgroundColor
  }
  if (props.textColor && !props.src) {
    style.color = props.textColor
  }
  return style
})
</script>

<style scoped>
.ds-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-text-secondary, #6b7280);
  overflow: hidden;
  flex-shrink: 0;
  user-select: none;
}

.ds-avatar--sm {
  width: 24px;
  height: 24px;
  font-size: var(--text-caption-size, 12px);
}

.ds-avatar--md {
  width: 32px;
  height: 32px;
  font-size: var(--text-body-sm-size, 14px);
}

.ds-avatar--lg {
  width: 40px;
  height: 40px;
  font-size: var(--text-body-size, 16px);
}

.ds-avatar--xl {
  width: 56px;
  height: 56px;
  font-size: var(--text-heading-3-size, 20px);
}

.ds-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ds-avatar__initials {
  font-weight: 600;
  line-height: 1;
}

.ds-avatar__placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
