<template>
  <div :class="['hero-block', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <span v-if="meta" class="hero-block__meta">{{ meta }}</span>
    <h1 class="hero-block__title" :style="{ fontFamily: 'var(--font-family, Inter, -apple-system, sans-serif)' }">
      {{ title }}
    </h1>
    <p v-if="subtitle" class="hero-block__subtitle">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  meta?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.hero-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
  padding-bottom: var(--space-5, 24px);
}

.hero-block__meta {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-1, 4px);
}

.hero-block__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-1-size, 32px);
  line-height: var(--text-heading-1-line, 1.2);
  font-weight: var(--text-heading-1-weight, 600);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.hero-block__subtitle {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  line-height: var(--text-body-sm-line, 1.5);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
}
</style>
