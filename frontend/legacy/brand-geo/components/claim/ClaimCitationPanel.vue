<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-claim-citation-panel">
    <div class="geo-panel-header">
      <h4 class="geo-panel-title">引用来源 ({{ citations.length }})</h4>
    </div>
    <div v-if="!citations.length" class="geo-panel-empty">暂无引用来源</div>
    <div v-else class="geo-panel-list">
      <div v-for="cit in citations" :key="cit.id" class="geo-cit-ref-item">
        <div class="geo-cit-ref-title">{{ cit.title || cit.sourceName }}</div>
        <div class="geo-cit-ref-meta">
          <a :href="cit.sourceUrl" target="_blank" class="geo-cit-ref-link">{{ cit.sourceUrl }}</a>
          <span v-if="cit.author" class="geo-cit-ref-author">{{ cit.author }}</span>
          <span v-if="cit.publisher" class="geo-cit-ref-publisher">{{ cit.publisher }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Citation } from '~/studio-v2/types/geo'

defineProps<{
  citations: Citation[]
}>()
</script>

<style scoped>
.geo-claim-citation-panel { margin-top: 12px; }
.geo-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.geo-panel-title { font-size: 14px; font-weight: 600; color: var(--geo-text); margin: 0; }
.geo-panel-empty { font-size: 13px; color: var(--geo-text-dim); padding: 16px; text-align: center; }
.geo-panel-list { display: flex; flex-direction: column; gap: 8px; }
.geo-cit-ref-item { padding: 10px 12px; background: var(--geo-bg-hover); border-radius: var(--geo-radius-md); }
.geo-cit-ref-title { font-size: 13px; font-weight: 600; color: var(--geo-text); margin-bottom: 4px; }
.geo-cit-ref-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; }
.geo-cit-ref-link { color: var(--geo-accent-light); text-decoration: none; word-break: break-all; }
.geo-cit-ref-link:hover { text-decoration: underline; }
.geo-cit-ref-author { color: var(--geo-text-secondary); }
.geo-cit-ref-publisher { color: var(--geo-text-dim); }
</style>
