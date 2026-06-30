<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-ko-list">
    <div v-for="ko in knowledgeObjects" :key="ko.id" class="geo-ko-card" @click="$emit('select', ko)">
      <div class="geo-ko-card-header">
        <span class="geo-ko-topic">{{ ko.topic || '未命名' }}</span>
        <span :class="['geo-status-badge', `geo-ko-status--${ko.status}`]">{{ ko.status }}</span>
      </div>
      <div class="geo-ko-card-body">
        <div class="geo-ko-metrics">
          <span class="geo-ko-metric">
            <span class="geo-metric-value">{{ ko.entities?.length || 0 }}</span>
            <span class="geo-metric-label">实体</span>
          </span>
          <span class="geo-ko-metric">
            <span class="geo-metric-value">{{ ko.claims?.length || 0 }}</span>
            <span class="geo-metric-label">Claim</span>
          </span>
          <span class="geo-ko-metric">
            <span class="geo-metric-value">{{ ko.evidence?.length || 0 }}</span>
            <span class="geo-metric-label">Evidence</span>
          </span>
          <span class="geo-ko-metric">
            <span class="geo-metric-value">{{ ko.citations?.length || 0 }}</span>
            <span class="geo-metric-label">Citation</span>
          </span>
        </div>
        <div class="geo-ko-confidence" v-if="ko.confidence">
          <span class="geo-metric-label">置信度</span>
          <span class="geo-metric-value">{{ (ko.confidence * 100).toFixed(0) }}%</span>
        </div>
      </div>
      <div class="geo-ko-card-footer">
        <span class="geo-ko-date">{{ formatTime(ko.createdAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  knowledgeObjects: any[]
}>()

defineEmits<{
  select: [ko: any]
}>()

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}
</script>

<style scoped>
.geo-ko-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.geo-ko-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); padding: 16px; cursor: pointer; transition: all 0.15s; }
.geo-ko-card:hover { border-color: #818cf8; background: #1e1e36; transform: translateY(-1px); }
.geo-ko-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.geo-ko-topic { font-weight: 600; font-size: 14px; }
.geo-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-ko-status--DISCOVERED { background: rgba(129,140,248,0.15); color: #818cf8; }
.geo-ko-status--PROCESSED { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-ko-status--FAILED { background: rgba(239,68,68,0.15); color: #ef4444; }
.geo-ko-card-body { margin-bottom: 12px; }
.geo-ko-metrics { display: flex; gap: 16px; margin-bottom: 8px; }
.geo-ko-metric { display: flex; flex-direction: column; }
.geo-metric-value { font-size: 14px; font-weight: 700; }
.geo-metric-label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
.geo-ko-confidence { display: flex; gap: 6px; align-items: center; font-size: 12px; }
.geo-ko-card-footer { border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px; }
.geo-ko-date { font-size: 11px; color: #6b7280; }
</style>
