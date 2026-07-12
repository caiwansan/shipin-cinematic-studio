<template>
  <div class="geo-remaining-issues">
    <div v-if="items.length === 0" class="geo-remaining-issues__empty">
      暂无剩余问题
    </div>
    <div v-else class="geo-remaining-issues__list">
      <div
        v-for="issue in items"
        :key="issue.scenarioId"
        class="geo-remaining-issues__item"
      >
        <div class="geo-remaining-issues__info">
          <span class="geo-remaining-issues__name">{{ issue.scenarioName }}</span>
          <span class="geo-remaining-issues__gap">差距: {{ issue.gap }}</span>
        </div>
        <span
          class="geo-priority-badge"
          :style="priorityStyle(issue.priority)"
        >
          {{ priorityLabel(issue.priority) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RemainingIssue } from './types'
import { resolvePriority } from './registry/priority-registry'

defineProps<{
  items: RemainingIssue[]
}>()

function priorityStyle(priority: string): Record<string, string> {
  const config = resolvePriority(priority)
  if (!config) return {}
  return {
    backgroundColor: `var(${config.tokenBg})`,
    color: `var(${config.tokenText})`,
    borderColor: `var(${config.tokenBorder})`,
  }
}

function priorityLabel(priority: string): string {
  const config = resolvePriority(priority)
  return config?.label ?? priority
}
</script>

<style scoped>
.geo-remaining-issues__empty {
  color: #9ca3af;
  font-size: 14px;
  padding: 16px;
  text-align: center;
}

.geo-remaining-issues__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-remaining-issues__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.geo-remaining-issues__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-remaining-issues__name {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.geo-remaining-issues__gap {
  font-size: 12px;
  color: #6b7280;
}

.geo-priority-badge {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid;
}
</style>
