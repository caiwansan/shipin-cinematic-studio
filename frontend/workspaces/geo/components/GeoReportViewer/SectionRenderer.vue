<template>
  <div class="geo-section-renderer">
    <template v-if="component">
      <Component :is="component" :report="report" v-bind="dataProps" />
    </template>
    <div v-else class="geo-section-renderer__fallback">
      <p class="geo-section-renderer__fallback-type">未知 Section: {{ section.type }}</p>
      <pre class="geo-section-renderer__fallback-data">{{ jsonData }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent, shallowRef } from 'vue'
import type { Report, ReportSection } from '../types'
import { getSectionRenderer } from './registry/section-registry'

const props = defineProps<{
  report: Report
  section: ReportSection
}>()

const component = shallowRef<any>(null)
const loadError = ref(false)

const dataProps = computed(() => {
  return { data: props.section.data, report: props.report }
})

const jsonData = computed(() => {
  try {
    return JSON.stringify(props.section.data, null, 2)
  } catch {
    return String(props.section.data)
  }
})

onMounted(async () => {
  const config = getSectionRenderer(props.section.type)
  if (!config) {
    // Show fallback
    return
  }
  try {
    const mod = await config.component()
    component.value = mod.default
  } catch (err) {
    console.error(`[SectionRenderer] Failed to load renderer for "${props.section.type}":`, err)
    loadError.value = true
  }
})
</script>

<style scoped>
.geo-section-renderer__fallback {
  padding: 20px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
}
.geo-section-renderer__fallback-type {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 8px;
}
.geo-section-renderer__fallback-data {
  font-size: 12px;
  color: #9ca3af;
  overflow-x: auto;
  max-height: 200px;
  margin: 0;
}
</style>
