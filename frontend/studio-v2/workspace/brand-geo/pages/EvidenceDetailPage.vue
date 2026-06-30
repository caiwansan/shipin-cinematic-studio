<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <button class="geo-btn geo-btn-ghost geo-btn-sm" @click="goBack">← 返回</button>
        <h2 class="geo-page-title">🔍 证据详情</h2>
      </div>
    </div>
    <GeoLoadingState v-if="loading" />
    <GeoErrorState v-else-if="error" title="加载证据失败" :description="error" :retryable="true" @retry="fetchDetail" />
    <template v-else-if="evidence">
      <div class="geo-card">
        <div class="geo-card-header"><h3 class="geo-card-title">证据内容</h3><EvidenceScoreBadge :score="evidence.credibilityScore" /></div>
        <div class="geo-card-body"><p class="geo-evidence-content">{{ evidence.content }}</p></div>
      </div>
      <div class="geo-card">
        <div class="geo-card-header"><h3 class="geo-card-title">来源信息</h3></div>
        <div class="geo-card-body"><EvidenceSourceTable :evidence="evidence" /></div>
      </div>
      <div class="geo-card" v-if="evidence.claimId">
        <div class="geo-card-header"><h3 class="geo-card-title">关联声明</h3><button class="geo-btn geo-btn-ghost geo-btn-sm" @click="goToClaim">查看声明 →</button></div>
        <div class="geo-card-body"><div class="geo-linked-claim"><span class="geo-linked-label">ID:</span><code class="geo-linked-id">{{ evidence.claimId }}</code></div></div>
      </div>
      <div class="geo-card" v-if="evidence.citations?.length">
        <div class="geo-card-header"><h3 class="geo-card-title">引用来源 ({{ evidence.citations.length }})</h3></div>
        <div class="geo-card-body">
          <div v-for="cit in evidence.citations" :key="cit.id" class="geo-cite-item">
            <div class="geo-cite-title">{{ cit.title || cit.sourceName }}</div>
            <div class="geo-cite-meta"><span class="geo-cite-source">{{ cit.sourceUrl }}</span><span class="geo-cite-date">{{ formatDate(cit.publishedAt) }}</span></div>
          </div>
        </div>
      </div>
    </template>
    <GeoErrorState v-else title="证据未找到" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import GeoLoadingState from '~/studio-v2/workspace/brand-geo/components/GeoLoadingState.vue'
import GeoErrorState from '~/studio-v2/workspace/brand-geo/components/GeoErrorState.vue'
import EvidenceScoreBadge from '~/studio-v2/workspace/brand-geo/components/evidence/EvidenceScoreBadge.vue'
import EvidenceSourceTable from '~/studio-v2/workspace/brand-geo/components/evidence/EvidenceSourceTable.vue'
import { geoEvidenceAdapter } from '~/studio-v2/workspace/brand-geo/adapters/geoEvidenceAdapter'
import type { Evidence } from '~/studio-v2/types/geo/evidence'

const loading = ref(false)
const error = ref<string | null>(null)
const evidence = ref<Evidence | null>(null)

function getEvidenceId(): string | null {
  try { return new URL(window.location.href).searchParams.get('evidenceId') } catch { return null }
}

async function fetchDetail() {
  const id = getEvidenceId()
  if (!id) { error.value = '缺少证据 ID'; return }
  loading.value = true; error.value = null
  try {
    evidence.value = await geoEvidenceAdapter.get(id)
    if (!evidence.value) error.value = '证据不存在'
  } catch (err: any) { error.value = err.message || '加载失败' }
  finally { loading.value = false }
}

function goBack() {
  try { window.location.href = '/workspace/geo?panel=evidence' } catch {}
}

function goToClaim() {
  if (!evidence.value?.claimId) return
  try { window.location.href = `/workspace/geo?panel=claim-detail&claimId=${evidence.value.claimId}` } catch {}
}

function formatDate(iso: string) { try { return new Date(iso).toLocaleDateString('zh-CN') } catch { return iso } }

onMounted(fetchDetail)
</script>

<style scoped>
.geo-page { padding: 24px; color: var(--geo-text); height: 100%; overflow-y: auto; }
.geo-evidence-content { font-size: 14px; line-height: 1.7; color: var(--geo-text); margin: 0; white-space: pre-wrap; }
.geo-linked-claim { display: flex; align-items: center; gap: 8px; }
.geo-linked-label { font-size: 13px; color: var(--geo-text-secondary); }
.geo-linked-id { font-size: 12px; font-family: var(--geo-font-mono); color: var(--geo-accent); background: var(--geo-bg-hover); padding: 2px 8px; border-radius: 4px; }
.geo-cite-item { padding: 10px 0; border-bottom: 1px solid var(--geo-border); }
.geo-cite-item:last-child { border-bottom: none; }
.geo-cite-title { font-size: 13px; font-weight: 600; color: var(--geo-text); margin-bottom: 4px; }
.geo-cite-meta { display: flex; gap: 10px; font-size: 11px; }
.geo-cite-source { color: var(--geo-text-secondary); word-break: break-all; }
.geo-cite-date { color: var(--geo-text-dim); }
</style>
