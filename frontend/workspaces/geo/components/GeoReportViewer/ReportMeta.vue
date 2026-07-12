<template>
  <div class="geo-report-meta">
    <NuxtLink
      v-if="backLink"
      :to="backLink"
      class="geo-report-meta__back"
    >← 返回</NuxtLink>
    <h1 class="geo-report-meta__title">{{ title }}</h1>
    <p class="geo-report-meta__subtitle">
      <span class="geo-report-meta__type">{{ reportTypeLabel }}</span>
      <span class="geo-report-meta__sep">·</span>
      <span class="geo-report-meta__time">{{ formattedTime }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  reportTypeLabel: string
  generatedAt: string
  backLink?: string
}>()

const formattedTime = computed(() => {
  try {
    const d = new Date(props.generatedAt)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return props.generatedAt
  }
})
</script>

<style scoped>
.geo-report-meta {
  margin-bottom: 4px;
}
.geo-report-meta__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #6b7280;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.geo-report-meta__back:hover {
  color: #374151;
  background: #f3f4f6;
}
.geo-report-meta__title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}
.geo-report-meta__subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}
.geo-report-meta__type {
  font-weight: 500;
  color: #4338ca;
  background: #eef2ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.geo-report-meta__sep {
  color: #d1d5db;
}
.geo-report-meta__time {
  font-size: 13px;
}
</style>
