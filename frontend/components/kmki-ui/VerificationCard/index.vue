<template>
  <div class="verification-card">
    <div class="verification-card__title">{{ title }}</div>
    <div class="verification-card__body">
      <ScoreComparison
        :before="beforeAdi"
        :after="afterAdi"
        :delta="deltaAdi"
      />
    </div>
    <div class="verification-card__rate">
      <span
        :class="[
          'verification-card__rate-value',
          improvementRate > 0 ? 'verification-card__rate-value--positive' : 'verification-card__rate-value--negative'
        ]"
      >
        {{ improvementRate > 0 ? '+' : '' }}{{ improvementRate }}%
      </span>
      <span class="verification-card__rate-label">改善率</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import ScoreComparison from '../ScoreComparison/index.vue'

defineProps<{
  title: string
  beforeAdi: number
  afterAdi: number
  deltaAdi: number
  improvementRate: number
}>()
</script>

<style scoped>
.verification-card {
  background: linear-gradient(135deg, #f0f9ff, #ecfdf5);
  border: 1px solid #d1d5db;
  border-radius: 12px;
  overflow: hidden;
}

.verification-card__title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  padding: 16px 24px 4px;
}

.verification-card__body {
  padding: 0;
}

.verification-card__rate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4px 24px 16px;
}

.verification-card__rate-value {
  font-size: 20px;
  font-weight: 700;
}

.verification-card__rate-value--positive {
  color: #059669;
}

.verification-card__rate-value--negative {
  color: #dc2626;
}

.verification-card__rate-label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}
</style>
