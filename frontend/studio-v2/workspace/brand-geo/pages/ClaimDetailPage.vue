<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <button class="geo-btn geo-btn-ghost geo-btn-sm" @click="goBack">← 返回</button>
        <h2 class="geo-page-title">📋 声明详情</h2>
      </div>
    </div>
    <GeoLoadingState v-if="loading" />
    <GeoErrorState v-else-if="error" title="加载声明失败" :description="error" :retryable="true" @retry="fetchDetail" />
    <template v-else-if="claim">
      <div class="geo-card">
        <div class="geo-card-header"><h3 class="geo-card-title">声明内容</h3><span :class="['geo-status-badge', `geo-status--${claim.status}`]">{{ statusLabel }}</span></div>
        <div class="geo-card-body">
          <p class="geo-claim-full-text">{{ claim.text }}</p>
          <div class="geo-claim-metadata">
            <div class="geo-meta-item"><span class="geo-meta-label">类型</span><span :class="['geo-claim-type-badge', `geo-claim-type--${claim.claimType}`]">{{ typeLabel }}</span></div>
            <div class="geo-meta-item"><span class="geo-meta-label">置信度</span><span class="geo-meta-value">{{ Math.round(claim.confidence * 100) }}%</span></div>
            <div class="geo-meta-item" v-if="claim.entityId"><span class="geo-meta-label">关联实体</span><code class="geo-meta-code">{{ claim.entityId }}</code></div>
          </div>
        </div>
      </div>
      <div class="geo-card" v-if="claim.evidences?.length">
        <div class="geo-card-header"><h3 class="geo-card-title">关联证据 ({{ claim.evidences.length }})</h3></div>
        <div class="geo-card-body"><ClaimEvidencePanel :evidences="claim.evidences" @view-evidence="onViewEvidence" /></div>
      </div>
      <div class="geo-card" v-if="claim.metadata">
        <div class="geo-card-header"><h3 class="geo-card-title">推理元数据</h3></div>
        <div class="geo-card-body"><pre class="geo-metadata-json">{{ JSON.stringify(claim.metadata, null, 2) }}</pre></div>
      </div>
    </template>
    <GeoErrorState v-else title="声明未找到" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import GeoLoadingState from '~/studio-v2/workspace/brand-geo/components/GeoLoadingState.vue'
import GeoErrorState from '~/studio-v2/workspace/brand-geo/components/GeoErrorState.vue'
import ClaimEvidencePanel from '~/studio-v2/workspace/brand-geo/components/claim/ClaimEvidencePanel.vue'
import { geoClaimAdapter } from '~/studio-v2/workspace/brand-geo/adapters/geoClaimAdapter'
import type { Claim } from '~/studio-v2/types/geo/evidence'
import type { GeoPanelId } from '~/studio-v2/types/geo'

const loading = ref(false)
const error = ref<string | null>(null)
const claim = ref<Claim | null>(null)

function getClaimId(): string | null {
  try { return new URL(window.location.href).searchParams.get('claimId') } catch { return null }
}

async function fetchDetail() {
  const id = getClaimId()
  if (!id) { error.value = '缺少声明 ID'; return }
  loading.value = true; error.value = null
  try {
    claim.value = await geoClaimAdapter.get(id)
    if (!claim.value) error.value = '声明不存在'
  } catch (err: any) { error.value = err.message || '加载失败' }
  finally { loading.value = false }
}

const tl: Record<string, string> = { fact:'事实', primary:'主要', derived:'推导', opinion:'观点', hypothesis:'假设' }
const sl: Record<string, string> = { draft:'草稿', review:'审核中', approved:'已批准', rejected:'已拒绝', stale:'过期' }
const typeLabel = computed(() => tl[claim.value?.claimType || ''] || claim.value?.claimType)
const statusLabel = computed(() => sl[claim.value?.status || ''] || claim.value?.status)

function goBack() {
  try { window.location.href = '/workspace/geo?panel=claim' } catch {}
}

function onViewEvidence(id: string) {
  try { window.location.href = `/workspace/geo?panel=evidence-detail&evidenceId=${id}` } catch {}
}

onMounted(fetchDetail)
</script>

<style scoped>
.geo-page { padding: 24px; color: var(--geo-text); height: 100%; overflow-y: auto; }
.geo-claim-full-text { font-size: 14px; line-height: 1.7; color: var(--geo-text); margin: 0 0 16px; }
.geo-claim-metadata { display: flex; flex-wrap: wrap; gap: 16px; }
.geo-meta-item { display: flex; align-items: center; gap: 8px; }
.geo-meta-label { font-size: 12px; color: var(--geo-text-muted); }
.geo-meta-value { font-size: 14px; font-weight: 600; color: var(--geo-text); }
.geo-meta-code { font-size: 12px; font-family: var(--geo-font-mono); color: var(--geo-accent); background: var(--geo-bg-hover); padding: 2px 8px; border-radius: 4px; }
.geo-claim-type-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-claim-type--fact { background: rgba(52, 211, 153, 0.15); color: var(--geo-success); }
.geo-claim-type--primary { background: rgba(99, 102, 241, 0.15); color: var(--geo-accent); }
.geo-claim-type--derived { background: rgba(96, 165, 250, 0.15); color: var(--geo-info); }
.geo-claim-type--opinion { background: rgba(251, 191, 36, 0.15); color: var(--geo-warning); }
.geo-claim-type--hypothesis { background: rgba(239, 68, 68, 0.15); color: var(--geo-error); }
.geo-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-status--draft { background: rgba(148, 163, 184, 0.15); color: var(--geo-text-secondary); }
.geo-status--review { background: rgba(251, 191, 36, 0.15); color: var(--geo-warning); }
.geo-status--approved { background: rgba(52, 211, 153, 0.15); color: var(--geo-success); }
.geo-status--rejected { background: rgba(239, 68, 68, 0.15); color: var(--geo-error); }
.geo-status--stale { background: rgba(107, 114, 128, 0.15); color: var(--geo-text-dim); }
.geo-metadata-json { font-size: 12px; font-family: var(--geo-font-mono); color: var(--geo-text-secondary); background: var(--geo-bg); padding: 12px; border-radius: var(--geo-radius-md); margin: 0; white-space: pre-wrap; }
</style>
