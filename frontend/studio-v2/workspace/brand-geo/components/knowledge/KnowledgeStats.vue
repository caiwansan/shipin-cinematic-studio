<template>
  <div class="geo-stats-row">
    <div class="geo-stat-card" style="border-left-color: #818cf8">
      <span class="geo-stat-icon">📚</span>
      <div class="geo-stat-body">
        <span class="geo-stat-number">{{ totalKos }}</span>
        <span class="geo-stat-label">知识内容</span>
      </div>
    </div>
    <div class="geo-stat-card" style="border-left-color: #34d399">
      <span class="geo-stat-icon">💡</span>
      <div class="geo-stat-body">
        <span class="geo-stat-number">{{ totalClaims }}</span>
        <span class="geo-stat-label">事实</span>
      </div>
    </div>
    <div class="geo-stat-card" style="border-left-color: #f59e0b">
      <span class="geo-stat-icon">📄</span>
      <div class="geo-stat-body">
        <span class="geo-stat-number">{{ totalEvidence }}</span>
        <span class="geo-stat-label">来源</span>
      </div>
    </div>
    <div class="geo-stat-card" style="border-left-color: #ec4899">
      <span class="geo-stat-icon">📝</span>
      <div class="geo-stat-body">
        <span class="geo-stat-number">{{ totalCitations }}</span>
        <span class="geo-stat-label">引用</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  totalKos: number
  totalClaims: number
  totalEvidence: number
  totalCitations: number
}>()
</script>

<style scoped>
.geo-stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.geo-stat-card { display: flex; align-items: center; gap: 12px; padding: 14px; background: #1a1a2e; border-radius: 8px; border-left: 3px solid; border-top: 1px solid rgba(255,255,255,0.04); border-right: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-stat-icon { font-size: 22px; }
.geo-stat-body { display: flex; flex-direction: column; }
.geo-stat-number { font-size: 20px; font-weight: 700; }
.geo-stat-label { font-size: 11px; color: #888; }
</style>
