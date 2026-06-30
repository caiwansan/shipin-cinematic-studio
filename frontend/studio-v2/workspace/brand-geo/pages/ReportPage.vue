<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">📊 报告</h2>
        <p class="geo-page-subtitle">选择品牌后一键生成报告</p>
      </div>
    </div>
    <div class="geo-report-actions">
      <button v-for="t in reportTypes" :key="t.type" class="geo-btn" :class="selectedType === t.type ? 'geo-btn-primary' : 'geo-btn-secondary'" @click="onGenerate(t.type)">{{ t.label }}</button>
    </div>
    <GeoLoadingState v-if="loading" />
    <GeoErrorState v-else-if="error" title="生成报告失败" :description="error" :retryable="true" @retry="fetchReportTypes" />
    <div v-else-if="selectedReport" class="geo-report-container geo-fade-in">
      <div class="geo-card">
        <div class="geo-card-header"><h3 class="geo-card-title">{{ selectedReport.title }}</h3><button class="geo-btn geo-btn-ghost geo-btn-sm" @click="showExport = true">📤 导出</button></div>
        <div class="geo-card-body"><div class="geo-report-summary">{{ selectedReport.summary }}</div><ReportViewer :report="selectedReport" /></div>
      </div>
    </div>
    <div v-else class="geo-empty-state">
      <div class="geo-empty-state-icon">📊</div>
      <div class="geo-empty-state-title">选择品牌后一键生成报告</div>
      <div class="geo-empty-state-desc">报告基于品牌分析数据自动生成</div>
      <div class="geo-empty-state-actions">
        <button class="geo-btn geo-btn-primary" @click="goToWizard">开始分析品牌</button>
      </div>
    </div>
    <ReportExportDialog :visible="showExport" :report-title="selectedReport?.title" :report="selectedReport" @close="showExport = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import GeoLoadingState from '~/studio-v2/workspace/brand-geo/components/GeoLoadingState.vue'
import GeoErrorState from '~/studio-v2/workspace/brand-geo/components/GeoErrorState.vue'
import ReportViewer from '~/studio-v2/workspace/brand-geo/components/report/ReportViewer.vue'
import ReportExportDialog from '~/studio-v2/workspace/brand-geo/components/report/ReportExportDialog.vue'
import { geoReportAdapter } from '~/studio-v2/workspace/brand-geo/adapters/geoReportAdapter'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import type { Report } from '~/studio-v2/types/geo/evidence'

const store = useBrandGeoStore()
const loading = ref(false)
const error = ref<string | null>(null)
const reportTypes = ref<{ type: string; label: string }[]>([])
const selectedType = ref('')
const selectedReport = ref<Report | null>(null)
const showExport = ref(false)

function getProjectId(): string | null {
  const pid = store.selectedV2ProjectId
  if (!pid || typeof pid !== 'string') return null
  return pid
}

async function fetchReportTypes() {
  const pid = getProjectId()
  if (!pid) return
  try {
    const types = await geoReportAdapter.listTypes(pid)
    reportTypes.value = types.length ? types : [
      { type: 'brand', label: '品牌报告' },
      { type: 'knowledge', label: '知识内容报告' },
      { type: 'evidence', label: '来源报告' },
      { type: 'executive', label: '执行摘要' },
    ]
  } catch { /* use defaults */ }
}

async function onGenerate(type: string) {
  const pid = getProjectId()
  if (!pid) { error.value = '请先选择一个项目'; return }
  selectedType.value = type
  loading.value = true
  error.value = null
  try {
    const report = await geoReportAdapter.generate(pid, type)
    if (report) {
      selectedReport.value = report
    } else {
      error.value = '报告生成失败'
    }
  } catch (err: any) {
    error.value = err.message || '生成失败'
  } finally {
    loading.value = false
  }
}

function goToWizard() {
  const url = new URL(window.location.href)
  url.searchParams.set('panel', 'wizard')
  window.history.replaceState({}, '', url.toString())
  window.location.reload()
}

onMounted(fetchReportTypes)
</script>

<style scoped>
.geo-page { padding: 24px; height: 100%; overflow-y: auto; }
.geo-report-actions { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.geo-btn { border-radius: var(--geo-radius-md); border: none; cursor: pointer; font-size: 13px; font-weight: 600; padding: 8px 16px; }
.geo-btn-primary { background: var(--geo-accent); color: #fff; }
.geo-btn-primary:hover { opacity: .9; }
.geo-btn-secondary { background: var(--geo-bg-card); color: var(--geo-text-secondary); border: 1px solid var(--geo-border); }
.geo-btn-secondary:hover { background: var(--geo-bg-hover); }
.geo-btn-sm { padding: 6px 12px; font-size: 12px; }
.geo-report-container { animation: fadeIn .2s ease-out; }
.geo-report-summary { font-size: 13px; color: var(--geo-text-secondary); margin-bottom: 16px; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.geo-empty-state-actions { margin-top: 16px; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
</style>
