<template>
  <div :class="['explanation-panel', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 class="explanation-panel__title">{{ title }}</h3>
    <ul class="explanation-panel__list">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="explanation-panel__item"
        :class="`explanation-panel__item--${item.type}`"
        @mouseenter="handleMouseEnter(index)"
        @mouseleave="handleMouseLeave(index)"
      >
        <span class="explanation-panel__item-icon">
          <span v-if="item.type === 'positive'">+</span>
          <span v-else>−</span>
        </span>
        <div class="explanation-panel__item-content">
          <span class="explanation-panel__item-text">{{ item.text }}</span>
          <transition name="ds-fade">
            <p v-if="item.detail && hoveredIndex === index" class="explanation-panel__item-detail">
              {{ item.detail }}
            </p>
          </transition>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface ExplanationItem {
  text: string
  detail?: string
  type: 'positive' | 'negative'
}

const props = withDefaults(defineProps<{
  title?: string
  items: ExplanationItem[]
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: 'Why this score?',
  items: () => [],
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const hoveredIndex = ref<number | null>(null)

let hideTimer: ReturnType<typeof setTimeout> | null = null

function handleMouseEnter(index: number) {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  hoveredIndex.value = index
}

function handleMouseLeave(index: number) {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
  hideTimer = setTimeout(() => {
    if (hoveredIndex.value === index) {
      hoveredIndex.value = null
    }
  }, 300)
}
</script>

<style scoped>
.explanation-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.explanation-panel__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.explanation-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.explanation-panel__item {
  display: flex;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  cursor: default;
  transition: all var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.explanation-panel__item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.explanation-panel__item-icon {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  justify-content: center;
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 700;
  line-height: 1;
  padding-top: 4px;
}

.explanation-panel__item--positive .explanation-panel__item-icon {
  color: var(--color-success, #22c55e);
}

.explanation-panel__item--negative .explanation-panel__item-icon {
  color: var(--color-risk, #ef4444);
}

.explanation-panel__item-content {
  flex: 1;
  min-width: 0;
}

.explanation-panel__item-text {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.explanation-panel__item-detail {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: var(--space-1, 4px) 0 0;
  line-height: var(--text-body-sm-line, 1.5);
}

/* Fade transition */
.ds-fade-enter-active,
.ds-fade-leave-active {
  transition: opacity var(--motion-normal-duration, 200ms) var(--motion-normal-easing, ease-out);
}

.ds-fade-enter-from,
.ds-fade-leave-to {
  opacity: 0;
}
</style>
