<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-source-table">
    <div class="geo-source-row">
      <span class="geo-source-label">来源</span>
      <span class="geo-source-value">{{ evidence.source || '-' }}</span>
    </div>
    <div class="geo-source-row">
      <span class="geo-source-label">验证</span>
      <span class="geo-source-value">{{ methodLabel }}</span>
    </div>
    <div class="geo-source-row">
      <span class="geo-source-label">可信度</span>
      <span class="geo-source-value"><EvidenceScoreBadge :score="evidence.credibilityScore" /></span>
    </div>
    <div class="geo-source-row">
      <span class="geo-source-label">创建时间</span>
      <span class="geo-source-value">{{ createdAt }}</span>
    </div>
    <div class="geo-source-row" v-if="evidence.claimId">
      <span class="geo-source-label">关联声明</span>
      <span class="geo-source-value geo-source-claim">{{ evidence.claimId }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Evidence } from '~/studio-v2/types/geo'
import EvidenceScoreBadge from './EvidenceScoreBadge.vue'

const props = defineProps<{ evidence: Evidence }>()

const ml: Record<string, string> = { manual:'人工验证', llm:'AI 验证', crawler:'爬虫验证', api:'API 验证', human_review:'人工审核' }
const methodLabel = computed(() => ml[props.evidence.verificationMethod] || props.evidence.verificationMethod)
const createdAt = computed(() => {
  try { return new Date(props.evidence.createdAt).toLocaleDateString('zh-CN', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) }
  catch { return props.evidence.createdAt }
})
</script>

<style scoped>
.geo-source-table { display: flex; flex-direction: column; gap: 8px; }
.geo-source-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--geo-border); }
.geo-source-row:last-child { border-bottom: none; }
.geo-source-label { min-width: 80px; font-size: 12px; color: var(--geo-text-muted); text-transform: uppercase; letter-spacing: .3px; }
.geo-source-value { font-size: 13px; color: var(--geo-text); }
.geo-source-claim { font-family: var(--geo-font-mono); font-size: 12px; color: var(--geo-accent); }
</style>
