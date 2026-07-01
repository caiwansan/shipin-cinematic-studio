<template>
  <div class="verification-timeline">
    <div class="verification-timeline__items">
      <div
        v-for="(item, idx) in items"
        :key="idx"
        class="verification-timeline__item"
      >
        <div class="verification-timeline__line">
          <div class="verification-timeline__dot" />
          <div v-if="idx < items.length - 1" class="verification-timeline__connector" />
        </div>
        <div class="verification-timeline__content">
          <div class="verification-timeline__header">
            <span v-if="idx === 0" class="verification-timeline__start-label">Baseline</span>
            <span class="verification-timeline__label">{{ item.label }}</span>
            <ImprovementBadge :contribution="item.contribution" />
          </div>
          <div class="verification-timeline__detail">{{ item.detail }}</div>
          <div class="verification-timeline__cumulative">
            Cumulative: <strong>{{ cumulativeScore(idx) }}</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ImprovementBadge from '../ImprovementBadge/index.vue'

const props = defineProps<{
  baseline: number
  items: Array<{
    label: string
    contribution: number
    detail: string
  }>
}>()

function cumulativeScore(idx: number): number {
  let score = props.baseline
  for (let i = 0; i <= idx; i++) {
    score += props.items[i].contribution
  }
  return score
}
</script>

<style scoped>
.verification-timeline {
  padding: 8px 0;
}

.verification-timeline__items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.verification-timeline__item {
  display: flex;
  gap: 16px;
  min-height: 72px;
}

.verification-timeline__line {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.verification-timeline__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #3b82f6;
  border: 2px solid #bfdbfe;
  flex-shrink: 0;
  margin-top: 4px;
}

.verification-timeline__connector {
  width: 2px;
  flex: 1;
  background-color: #d1d5db;
  min-height: 24px;
}

.verification-timeline__content {
  flex: 1;
  padding-bottom: 20px;
}

.verification-timeline__header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.verification-timeline__start-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.verification-timeline__label {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.verification-timeline__detail {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
  line-height: 1.4;
}

.verification-timeline__cumulative {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}
</style>
