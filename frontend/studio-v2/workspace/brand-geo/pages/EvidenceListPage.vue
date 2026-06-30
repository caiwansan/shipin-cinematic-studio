<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">📄 来源</h2>
        <p class="geo-page-subtitle">所有分析来源，按可信度排序</p>
      </div>
      <div class="geo-toolbar">
        <select v-model="filterMethod" class="geo-select" @change="fetchEvidence">
          <option value="">全部验证方式</option>
          <option value="manual">人工验证</option>
          <option value="llm">AI 验证</option>
          <option value="crawler">爬虫验证</option>
          <option value="api">API 验证</option>
          <option value="human_review">人工审核</option>
        </select>
      </div>
    </div>
    <div v-if="stats" class="geo-evidence-stats">
      <div class="geo-stat-chip">📊 平均可信度: <strong>{{ (stats.averageScore * 100).toFixed(0) }}%</strong></div>
      <div class="geo-stat-chip">📦 证据总数: <strong>{{ stats.totalCount }}</strong></div>
    </div>
    <GeoLoadingState v-if="loading" />
    <GeoErrorState v-else-if="error" title="加载证据失败" :description="error" :retryable="true" @retry="fetchEvidence" />
    <div v-else-if="!evidenceList.length" class="geo-page-empty">
      <div class="geo-empty-state-icon">📄</div>
      <div class="geo-empty-state-title">暂无来源数据</div>
      <div class="geo-empty-state-desc">分析过程中会自动收集来源，请先创建并分析一个品牌</div>
      <button class="geo-btn geo-btn-primary" @click="goToWizard">开始分析</button>
    </div>
    <div v-else class="geo-evidence-grid">
      <EvidenceCard v-for="item in evidenceList" :key="item.id" :evidence="item" :clickable="true" @click="onSelect(item.id)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import GeoLoadingState from '~/studio-v2/workspace/brand-geo/components/GeoLoadingState.vue'
import GeoErrorState from '~/studio-v2/workspace/brand-geo/components/GeoErrorState.vue'
import GeoEmptyState from '~/studio-v2/workspace/brand-geo/components/GeoEmptyState.vue'
import EvidenceCard from '~/studio-v2/workspace/brand-geo/components/evidence/EvidenceCard.vue'
import { geoEvidenceAdapter } from '~/studio-v2/workspace/brand-geo/adapters/geoEvidenceAdapter'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import type { Evidence } from '~/studio-v2/types/geo/evidence'
import type { GeoPanelId } from '~/studio-v2/types/geo'

const store = useBrandGeoStore()
const loading = ref(false)
const error = ref<string | null>(null)
const evidenceList = ref<Evidence[]>([])
const filterMethod = ref('')
const stats = ref<{ averageScore: number; totalCount: number } | null>(null)

async function fetchEvidence() {
  const pid = store.selectedV2ProjectId
  if (!pid) { error.value = '请先选择一个项目'; return }
  loading.value = true
  error.value = null
  try {
    const result = await geoEvidenceAdapter.list({ projectId: pid })
    let items = result.items
    if (filterMethod.value) {
      items = items.filter((e: Evidence) => e.verificationMethod === filterMethod.value)
    }
    evidenceList.value = items
    stats.value = await geoEvidenceAdapter.getProjectMetrics(pid)
  } catch (err: any) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function onSelect(id: string) {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('panel', 'evidence-detail')
    url.searchParams.set('evidenceId', id)
    window.history.replaceState({}, '', url.toString())
  } catch {}
}

function goToWizard() {
  const url = new URL(window.location.href)
  url.searchParams.set('panel', 'wizard')
  window.history.replaceState({}, '', url.toString())
  window.location.reload()
}

function onNavigate(panelId: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('panel', panelId)
  window.history.replaceState({}, '', url.toString())
}

onMounted(fetchEvidence)
</script>

<style scoped>
.geo-page { padding: 24px; height: 100%; overflow-y: auto; }
.geo-select {
  padding: 6px 12px;
  border-radius: var(--geo-radius-md);
  border: 1px solid var(--geo-border);
  background: var(--geo-bg-card);
  color: var(--geo-text);
  font-size: 12px;
  outline: none;
}
.geo-select:focus { border-color: var(--geo-accent); }
.geo-evidence-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
.geo-page-empty { padding: 60px 20px; text-align: center; }
.geo-empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.geo-empty-state-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #e0e0e0; }
.geo-empty-state-desc { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
.geo-evidence-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.geo-stat-chip {
  padding: 4px 12px;
  border-radius: var(--geo-radius-md);
  background: var(--geo-bg-card);
  border: 1px solid var(--geo-border);
  font-size: 12px;
  color: var(--geo-text-secondary);
}
.geo-stat-chip strong { color: var(--geo-text); }
</style>
