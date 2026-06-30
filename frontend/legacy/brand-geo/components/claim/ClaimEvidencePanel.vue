<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-claim-evidence-panel">
    <div class="geo-panel-header">
      <h4 class="geo-panel-title">关联证据 ({{ evidences.length }})</h4>
    </div>
    <div v-if="!evidences.length" class="geo-panel-empty">暂无关联证据</div>
    <div v-else class="geo-panel-list">
      <EvidenceCard
        v-for="ev in evidences"
        :key="ev.id"
        :evidence="ev"
        :clickable="true"
        @click="$emit('view-evidence', ev.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Evidence } from '~/studio-v2/types/geo'
import EvidenceCard from '~/legacy/brand-geo/components/evidence/EvidenceCard.vue'

defineProps<{
  evidences: Evidence[]
}>()

defineEmits<{
  'view-evidence': [id: string]
}>()
</script>

<style scoped>
.geo-claim-evidence-panel { margin-top: 12px; }
.geo-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.geo-panel-title { font-size: 14px; font-weight: 600; color: var(--geo-text); margin: 0; }
.geo-panel-empty { font-size: 13px; color: var(--geo-text-dim); padding: 16px; text-align: center; }
.geo-panel-list { display: flex; flex-direction: column; gap: 8px; }
</style>
