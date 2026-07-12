<template>
  <div class="geo-dimension-changes">
    <div class="geo-dimension-changes__grid">
      <div
        v-for="dim in dimensionList"
        :key="dim.key"
        class="geo-dimension-changes__card"
      >
        <div class="geo-dimension-changes__header">
          <span class="geo-dimension-changes__name">{{ dim.label }}</span>
        </div>
        <div class="geo-dimension-changes__bars">
          <div class="geo-dimension-changes__bar-row">
            <span class="geo-dimension-changes__bar-label">优化前</span>
            <div class="geo-dimension-changes__bar-track">
              <div
                class="geo-dimension-changes__bar-fill geo-dimension-changes__bar-fill--before"
                :style="{ width: dim.before + '%' }"
              />
            </div>
            <span class="geo-dimension-changes__bar-value">{{ dim.before }}</span>
          </div>
          <div class="geo-dimension-changes__bar-row">
            <span class="geo-dimension-changes__bar-label">优化后</span>
            <div class="geo-dimension-changes__bar-track">
              <div
                class="geo-dimension-changes__bar-fill geo-dimension-changes__bar-fill--after"
                :style="{ width: dim.after + '%' }"
              />
            </div>
            <span class="geo-dimension-changes__bar-value">{{ dim.after }}</span>
          </div>
        </div>
        <div class="geo-dimension-changes__delta">
          <span
            :class="[
              'geo-dimension-changes__delta-value',
              dim.delta > 0 ? 'geo-dimension-changes__delta--pos' : 'geo-dimension-changes__delta--neg'
            ]"
          >
            {{ dim.delta > 0 ? '+' : '' }}{{ dim.delta }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface DimensionData {
  before: number
  after: number
  delta: number
}

const props = defineProps<{
  coverage: DimensionData
  share: DimensionData
  position: DimensionData
}>()

const dimensionList = computed(() => [
  { key: 'coverage', label: 'Coverage', ...props.coverage },
  { key: 'share', label: 'Share', ...props.share },
  { key: 'position', label: 'Position', ...props.position },
])
</script>

<style scoped>
.geo-dimension-changes__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .geo-dimension-changes__grid {
    grid-template-columns: 1fr;
  }
}

.geo-dimension-changes__card {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
}

.geo-dimension-changes__header {
  margin-bottom: 12px;
}

.geo-dimension-changes__name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.geo-dimension-changes__bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-dimension-changes__bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.geo-dimension-changes__bar-label {
  font-size: 12px;
  color: #6b7280;
  width: 44px;
  flex-shrink: 0;
}

.geo-dimension-changes__bar-track {
  flex: 1;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.geo-dimension-changes__bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease-out;
}

.geo-dimension-changes__bar-fill--before {
  background-color: #9ca3af;
}

.geo-dimension-changes__bar-fill--after {
  background-color: #059669;
}

.geo-dimension-changes__bar-value {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  width: 28px;
  text-align: right;
}

.geo-dimension-changes__delta {
  margin-top: 8px;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
}

.geo-dimension-changes__delta--pos {
  color: #059669;
}

.geo-dimension-changes__delta--neg {
  color: #dc2626;
}
</style>
