<template>
  <div class="geo-report-section">
    <h2 class="geo-report-section__title">{{ section.title }}</h2>
    <p v-if="section.description" class="geo-report-section__desc">{{ section.description }}</p>
    <div class="geo-report-section__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportSection } from '../types'

defineProps<{
  section: ReportSection
}>()
</script>

<style scoped>
.geo-report-section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
}
.geo-report-section__title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}
.geo-report-section__desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px;
}
.geo-report-section__content {
  /* child renders here */
}
</style>
