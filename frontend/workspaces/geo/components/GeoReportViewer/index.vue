<template>
  <div class="geo-report-viewer">
    <!-- Loading -->
    <GeoPageSkeleton v-if="loading" card-count="4" layout="dashboard" />

    <!-- Error -->
    <GeoErrorState v-else-if="error" :message="error" @retry="$emit('retry')" />

    <!-- Data -->
    <template v-else-if="report">
      <!-- Slot: Header -->
      <slot name="header">
        <div class="geo-report-viewer__header">
          <ReportMeta
            :title="metaTitle"
            :report-type-label="report.meta.reportType"
            :generated-at="report.meta.generatedAt"
            :back-link="backLink"
          />
          <GeoReportExporter
            :report="report"
            @exported="$emit('exported', $event)"
            @copied="$emit('copied')"
          />
        </div>
      </slot>

      <!-- Slot: Summary -->
      <slot name="summary">
        <ReportSummary :report="report" />
      </slot>

      <!-- Slot: Metrics -->
      <slot name="metrics">
        <ReportMetrics v-if="metrics.length > 0" :metrics="metrics" />
      </slot>

      <!-- Slot: Sections -->
      <slot name="sections">
        <div class="geo-report-viewer__sections">
          <div
            v-for="section in resolvedSections"
            :key="section.type + (section.order || 100)"
            class="geo-report-viewer__section-group"
          >
            <ReportSection :section="section">
              <SectionRenderer :report="report" :section="section" />
            </ReportSection>
          </div>
        </div>
      </slot>

      <!-- Slot: Footer -->
      <slot name="footer">
        <div class="geo-report-viewer__footer">
          <p class="geo-report-viewer__footer-id">
            报告 ID: {{ report.meta.id }} · 版本: {{ report.meta.version }}
          </p>
        </div>
      </slot>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Report } from './types'
import { getDefaultSections, buildMetrics } from './registry/report-registry'
import ReportMeta from './ReportMeta.vue'
import ReportSummary from './ReportSummary.vue'
import ReportMetrics from './ReportMetrics.vue'
import ReportSection from './ReportSection.vue'
import SectionRenderer from './SectionRenderer.vue'
import GeoReportExporter from './GeoReportExporter.vue'
import GeoPageSkeleton from '../GeoPageSkeleton/index.vue'
import GeoErrorState from '../GeoErrorState/index.vue'

const props = defineProps<{
  report?: Report | null
  loading?: boolean
  error?: string | null
  /** Override default sections (if not provided, uses ReportRegistry) */
  sectionsOverride?: string[]
  /** Optional back link URL */
  backLink?: string
}>()

defineEmits<{
  retry: []
  exported: [format: string]
  copied: []
}>()

const metaTitle = computed(() => {
  if (!props.report) return '报告'
  return `${props.report.meta.projectName} — ${props.report.meta.reportType === 'brand-health' ? '品牌健康' : props.report.meta.reportType === 'discovery' ? '发现报告' : props.report.meta.reportType === 'verification' ? '验证报告' : props.report.meta.reportType === 'publishing' ? '发布报告' : '报告'}`
})

const resolvedSections = computed(() => {
  if (!props.report) return []
  const sectionTypes = props.sectionsOverride ?? getDefaultSections(props.report.meta.reportType)
  // Map: section type → section data from report.sections[]
  const sectionMap = new Map(props.report.sections.map(s => [s.type, s]))
  return sectionTypes
    .map(type => sectionMap.get(type))
    .filter(Boolean) as NonNullable<typeof props.report>['sections']
})

const metrics = computed(() => {
  if (!props.report) return []
  return buildMetrics(props.report)
})
</script>

<style scoped>
.geo-report-viewer {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.geo-report-viewer__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.geo-report-viewer__sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.geo-report-viewer__section-group {
  /* section rendered here */
}
.geo-report-viewer__footer {
  text-align: center;
  padding: 16px 0;
}
.geo-report-viewer__footer-id {
  font-size: 11px;
  color: #9ca3af;
  margin: 0;
}
</style>
