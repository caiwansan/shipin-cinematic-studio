<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">📋 事实</h2>
      </div>
      <div class="geo-claim-filters">
        <select v-model="groupBy" class="geo-select">
          <option value="type">按类型分组</option>
          <option value="status">按状态分组</option>
        </select>
      </div>
    </div>
    <GeoLoadingState v-if="loading" />
    <GeoErrorState v-else-if="error" title="加载声明失败" :description="error" :retryable="true" @retry="fetchClaims" />
    <div v-else-if="!claims.length" class="geo-page-empty">
      <div class="geo-empty-state-icon">📋</div>
      <div class="geo-empty-state-title">暂无事实数据</div>
      <div class="geo-empty-state-desc">分析完成后自动生成事实，请先创建并分析一个品牌</div>
      <button class="geo-btn geo-btn-primary" @click="goToWizard">开始分析</button>
    </div>
    <div v-else class="geo-claim-groups">
      <div v-for="(group, key) in groupedClaims" :key="key" class="geo-claim-group">
        <div class="geo-group-header">
          <h3 class="geo-group-title">{{ key }}</h3>
          <span class="geo-group-count">{{ group.length }} 条</span>
        </div>
        <div class="geo-group-list">
          <ClaimCard v-for="c in group" :key="c.id" :claim="c" :clickable="true" @click="onSelectClaim(c.id)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import GeoLoadingState from '~/studio-v2/workspace/brand-geo/components/GeoLoadingState.vue'
import GeoErrorState from '~/studio-v2/workspace/brand-geo/components/GeoErrorState.vue'
import GeoEmptyState from '~/studio-v2/workspace/brand-geo/components/GeoEmptyState.vue'
import ClaimCard from '~/studio-v2/workspace/brand-geo/components/claim/ClaimCard.vue'
import { geoClaimAdapter } from '~/studio-v2/workspace/brand-geo/adapters/geoClaimAdapter'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import type { Claim } from '~/studio-v2/types/geo/evidence'

const store = useBrandGeoStore()
const loading = ref(false)
const error = ref<string | null>(null)
const claims = ref<Claim[]>([])
const groupBy = ref<'type' | 'status'>('type')

async function fetchClaims() {
  const pid = store.selectedV2ProjectId
  if (!pid) { error.value = '请先选择一个项目'; return }
  loading.value = true
  error.value = null
  try {
    const result = await geoClaimAdapter.list({ projectId: pid })
    claims.value = result.items
  } catch (err: any) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const typeLabels: Record<string, string> = {
  fact: '事实', primary: '主要', derived: '推导', opinion: '观点', hypothesis: '假设',
}
const statusLabels: Record<string, string> = {
  draft: '草稿', review: '审核中', approved: '已批准', rejected: '已拒绝', stale: '过期',
}

const groupedClaims = computed(() => {
  const groups: Record<string, Claim[]> = {}
  for (const c of claims.value) {
    const key = groupBy.value === 'type'
      ? (typeLabels[c.claimType] || c.claimType)
      : (statusLabels[c.status] || c.status)
    if (!groups[key]) groups[key] = []
    groups[key].push(c)
  }
  return groups
})

function onSelectClaim(id: string) {
  try {
    window.location.href = `/workspace/geo?panel=claim-detail&claimId=${id}`
  } catch {}
}

function goToWizard() {
  const url = new URL(window.location.href)
  url.searchParams.set('panel', 'wizard')
  window.history.replaceState({}, '', url.toString())
  window.location.reload()
}

onMounted(fetchClaims)
</script>

<style scoped>
.geo-page { padding: 24px; color: var(--geo-text); height: 100%; overflow-y: auto; }
.geo-claim-filters { display: flex; gap: 8px; }
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
.geo-page-empty { padding: 60px 20px; text-align: center; }
.geo-empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.geo-empty-state-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #e0e0e0; }
.geo-empty-state-desc { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
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
.geo-claim-groups { display: flex; flex-direction: column; gap: 20px; }
.geo-claim-group { }
.geo-group-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.geo-group-title { font-size: 15px; font-weight: 600; color: var(--geo-text); margin: 0; }
.geo-group-count { font-size: 12px; color: var(--geo-text-dim); }
.geo-group-list { display: flex; flex-direction: column; gap: 8px; }
</style>
