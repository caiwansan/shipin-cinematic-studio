<!--
  MediaHealthRing — 健康度环形仪表（Sprint-MEDIA-UX-03）
  score=null → 无数据空态「等待AI员工部署」
  真实计算：今日任务完成率 + 错误惩罚（后端 overview 提供）
-->
<template>
  <div class="mhr">
    <svg viewBox="0 0 120 120" class="mhr-svg">
      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-bg-hover)" stroke-width="10" />
      <circle
        v-if="score !== null"
        cx="60" cy="60" r="50" fill="none"
        :stroke="ringColor" stroke-width="10" stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        transform="rotate(-90 60 60)"
      />
    </svg>
    <div class="mhr-center">
      <template v-if="score !== null">
        <div class="mhr-score" :style="{ color: ringColor }">{{ score }}<span class="mhr-pct">%</span></div>
        <div class="mhr-status">{{ statusText }}</div>
      </template>
      <template v-else>
        <div class="mhr-wait">⏳</div>
        <div class="mhr-status">等待数据</div>
      </template>
    </div>
    <div class="mhr-foot">{{ foot }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  score: number | null
  foot: string
}>()

const circumference = 2 * Math.PI * 50

const ringColor = computed(() => {
  if (props.score === null) return 'var(--color-text-disabled)'
  if (props.score >= 80) return 'var(--color-execution)'
  if (props.score >= 50) return 'var(--color-warning)'
  return 'var(--color-danger)'
})

const dashOffset = computed(() => {
  if (props.score === null) return circumference
  return circumference * (1 - (props.score as number) / 100)
})

const statusText = computed(() => {
  if (props.score === null) return '—'
  if (props.score >= 80) return '运营良好'
  if (props.score >= 50) return '需要关注'
  return '运营异常'
})
</script>

<style scoped>
.mhr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
}
.mhr-svg {
  width: 150px;
  height: 150px;
}
.mhr-center {
  position: relative;
  margin-top: -150px;
  height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.mhr-score {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.mhr-pct {
  font-size: 16px;
  font-weight: 700;
}
.mhr-status {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.mhr-wait {
  font-size: 26px;
}
.mhr-foot {
  font-size: 10px;
  color: var(--color-text-disabled);
  text-align: center;
  letter-spacing: 0.04em;
  max-width: 220px;
  line-height: 1.5;
}
</style>
