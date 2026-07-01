<template>
  <div class="score-comparison">
    <div class="score-comparison__before">
      <div class="score-comparison__label">优化前</div>
      <div class="score-comparison__value score-comparison__value--before">{{ before }}</div>
    </div>
    <div class="score-comparison__arrow" v-if="delta !== 0">
      <span class="score-comparison__arrow-icon">→</span>
      <span
        :class="[
          'score-comparison__delta',
          delta > 0 ? 'score-comparison__delta--positive' : 'score-comparison__delta--negative'
        ]"
      >
        {{ delta > 0 ? '+' : '' }}{{ delta }}
      </span>
    </div>
    <div class="score-comparison__after">
      <div class="score-comparison__label">优化后</div>
      <div class="score-comparison__value score-comparison__value--after">{{ after }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  before: number
  after: number
  delta: number
}>()
</script>

<style scoped>
.score-comparison {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 24px;
}

.score-comparison__before,
.score-comparison__after {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.score-comparison__label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.score-comparison__value {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}

.score-comparison__value--before {
  color: #6b7280;
}

.score-comparison__value--after {
  color: #059669;
}

.score-comparison__arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score-comparison__arrow-icon {
  font-size: 28px;
  color: #9ca3af;
}

.score-comparison__delta {
  font-size: 16px;
  font-weight: 600;
}

.score-comparison__delta--positive {
  color: #059669;
}

.score-comparison__delta--negative {
  color: #dc2626;
}
</style>
