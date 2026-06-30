<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">📜 历史</h2>
      </div>
    </div>
    <div class="geo-history-toolbar">
      <HistoryFilter :active-filter="filter" @filter-change="onFilterChange" />
    </div>
    <GeoLoadingState v-if="loading" />
    <GeoErrorState v-else-if="error" title="加载历史失败" :description="error" :retryable="true" @retry="fetchHistory" />
    <div v-else-if="!filteredEvents.length" class="geo-page-empty">
      <div class="geo-empty-state-icon">📜</div>
      <div class="geo-empty-state-title">暂无历史记录</div>
      <div class="geo-empty-state-desc">开始分析第一个品牌后将显示历史记录</div>
      <button class="geo-btn geo-btn-primary" @click="goToWizard">开始分析</button>
    </div>
    <HistoryTimeline v-else :events="filteredEvents" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import GeoLoadingState from '~/studio-v2/workspace/brand-geo/components/GeoLoadingState.vue'
import GeoErrorState from '~/studio-v2/workspace/brand-geo/components/GeoErrorState.vue'
import GeoEmptyState from '~/studio-v2/workspace/brand-geo/components/GeoEmptyState.vue'
import HistoryFilter from '~/studio-v2/workspace/brand-geo/components/history/HistoryFilter.vue'
import HistoryTimeline from '~/studio-v2/workspace/brand-geo/components/history/HistoryTimeline.vue'
import { geoHistoryAdapter } from '~/studio-v2/workspace/brand-geo/adapters/geoHistoryAdapter'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import type { HistoryEvent } from '~/studio-v2/types/geo/evidence'

const store = useBrandGeoStore()
const loading = ref(false)
const error = ref<string | null>(null)
const events = ref<HistoryEvent[]>([])
const filter = ref('')

async function fetchHistory() {
  const pid = store.selectedV2ProjectId
  if (!pid) { error.value = '请先选择一个项目'; return }
  loading.value = true
  error.value = null
  try {
    const result = await geoHistoryAdapter.list({ projectId: pid })
    events.value = result.items
  } catch (err: any) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const filteredEvents = computed(() => {
  if (!filter.value) return events.value
  return events.value.filter(e => e.type === filter.value)
})

function onFilterChange(value: string) {
  filter.value = value
}

function goToWizard() {
  const url = new URL(window.location.href)
  url.searchParams.set('panel', 'wizard')
  window.history.replaceState({}, '', url.toString())
  window.location.reload()
}

onMounted(fetchHistory)
</script>

<style scoped>
.geo-page { padding: 24px; color: var(--geo-text); height: 100%; overflow-y: auto; }
.geo-history-toolbar { margin-bottom: 20px; }
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
.geo-page-empty { padding: 60px 20px; text-align: center; }
.geo-empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.geo-empty-state-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #e0e0e0; }
.geo-empty-state-desc { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
</style>
