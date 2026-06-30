<template>
  <div :class="['geo-evidence-card', { clickable: clickable }]" @click="clickable && $emit('click')">
    <div class="geo-evidence-card-header">
      <EvidenceScoreBadge :score="evidence.credibilityScore" />
      <span class="geo-evidence-method">{{ methodLabel }}</span>
      <span v-if="evidence.citations?.length" class="geo-evidence-citation-count">{{ evidence.citations.length }} 引用</span>
    </div>
    <p class="geo-evidence-preview">{{ truncatedContent }}</p>
    <div class="geo-evidence-footer">
      <span class="geo-evidence-source">{{ evidence.source }}</span>
      <span class="geo-evidence-time">{{ createdAt }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Evidence } from '~/studio-v2/types/geo'
import EvidenceScoreBadge from './EvidenceScoreBadge.vue'

const props = defineProps<{ evidence: Evidence; clickable?: boolean }>()
defineEmits<{ click: [] }>()

const ml: Record<string, string> = { manual:'人工', llm:'AI', crawler:'爬虫', api:'API', human_review:'审核' }
const methodLabel = computed(() => ml[props.evidence.verificationMethod] || props.evidence.verificationMethod)
const truncatedContent = computed(() => props.evidence.content.length > 120 ? props.evidence.content.slice(0, 120) + '...' : props.evidence.content)
const createdAt = computed(() => {
  try { return new Date(props.evidence.createdAt).toLocaleDateString('zh-CN', { month:'short', day:'numeric' }) } catch { return '' }
})
</script>

<style scoped>
.geo-evidence-card { background: var(--geo-bg-card); border: 1px solid var(--geo-border); border-radius: var(--geo-radius-lg); padding: 14px 16px; transition: border-color .15s; }
.clickable { cursor: pointer; }
.clickable:hover { border-color: var(--geo-accent); }
.geo-evidence-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.geo-evidence-method { font-size: 11px; color: var(--geo-text-secondary); background: var(--geo-bg-hover); padding: 1px 6px; border-radius: 4px; }
.geo-evidence-citation-count { margin-left: auto; font-size: 11px; color: var(--geo-info); }
.geo-evidence-preview { font-size: 13px; line-height: 1.5; color: var(--geo-text); margin: 0 0 8px; word-break: break-word; }
.geo-evidence-footer { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
.geo-evidence-source { color: var(--geo-text-secondary); }
.geo-evidence-time { color: var(--geo-text-dim); }
</style>
