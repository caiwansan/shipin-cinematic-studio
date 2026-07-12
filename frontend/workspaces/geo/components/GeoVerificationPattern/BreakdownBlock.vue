<template>
  <div class="geo-breakdown-block">
    <div v-if="breakdowns.length === 0" class="geo-breakdown-block__empty">
      暂无改进数据
    </div>
    <template v-else>
      <div
        v-for="(section, idx) in breakdowns"
        :key="idx"
        class="geo-breakdown-block__section"
      >
        <h3 class="geo-breakdown-block__section-title">{{ section.label }}</h3>

        <!-- Waterfall -->
        <div v-if="section.type === 'waterfall'" class="geo-breakdown-block__waterfall">
          <div class="geo-breakdown-block__waterfall-row geo-breakdown-block__waterfall-row--baseline">
            <span class="geo-breakdown-block__waterfall-label">基线</span>
            <span class="geo-breakdown-block__waterfall-value">{{ getBaseline(section) }}</span>
          </div>
          <div
            v-for="(item, itemIdx) in getWaterfallItems(section)"
            :key="itemIdx"
            class="geo-breakdown-block__waterfall-row"
          >
            <span class="geo-breakdown-block__waterfall-label">{{ item.label }}</span>
            <div class="geo-breakdown-block__waterfall-arrow">
              <ImprovementBadge :contribution="item.contribution" />
            </div>
            <span class="geo-breakdown-block__waterfall-value">{{ cumulativeScore(section, itemIdx) }}</span>
          </div>
        </div>

        <!-- Fallback for other types -->
        <div v-else class="geo-breakdown-block__fallback">
          <span class="geo-breakdown-block__fallback-text">[{{ section.type }}] 类型渲染尚未实现</span>
          <pre class="geo-breakdown-block__fallback-raw">{{ JSON.stringify(section.data, null, 2) }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BreakdownSection } from './types'
import ImprovementBadge from '../../../../../components/kmki-ui/ImprovementBadge/index.vue'

const props = defineProps<{
  breakdowns: BreakdownSection[]
  baseline?: number
}>()

interface WaterfallItem {
  label: string
  contribution: number
  detail?: string
}

function getWaterfallItems(section: BreakdownSection): WaterfallItem[] {
  if (section.type !== 'waterfall') return []
  const data = section.data as any
  if (Array.isArray(data)) return data as WaterfallItem[]
  if (data?.items) return data.items as WaterfallItem[]
  return []
}

function getBaseline(section: BreakdownSection): number {
  if (props.baseline !== undefined) return props.baseline
  const data = section.data as any
  if (data?.baseline !== undefined) return data.baseline
  return 0
}

function cumulativeScore(section: BreakdownSection, idx: number): number {
  const items = getWaterfallItems(section)
  let score = getBaseline(section)
  for (let i = 0; i <= idx; i++) {
    score += items[i]?.contribution ?? 0
  }
  return score
}
</script>

<style scoped>
.geo-breakdown-block__empty {
  color: #9ca3af;
  font-size: 14px;
  padding: 16px;
  text-align: center;
}

.geo-breakdown-block__section {
  margin-bottom: 24px;
}

.geo-breakdown-block__section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px;
}

.geo-breakdown-block__waterfall {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 20px;
}

.geo-breakdown-block__waterfall-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.geo-breakdown-block__waterfall-row:last-child {
  border-bottom: none;
}

.geo-breakdown-block__waterfall-row--baseline {
  border-bottom: 2px solid #d1d5db;
  padding-bottom: 12px;
  margin-bottom: 4px;
}

.geo-breakdown-block__waterfall-label {
  flex: 1;
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.geo-breakdown-block__waterfall-arrow {
  display: flex;
  align-items: center;
}

.geo-breakdown-block__waterfall-value {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  min-width: 48px;
  text-align: right;
}

.geo-breakdown-block__fallback {
  padding: 16px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.geo-breakdown-block__fallback-text {
  font-size: 13px;
  color: #9ca3af;
  display: block;
  margin-bottom: 8px;
}

.geo-breakdown-block__fallback-raw {
  font-size: 11px;
  color: #6b7280;
  background-color: #f3f4f6;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0;
}
</style>
