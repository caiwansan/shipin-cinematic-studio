<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-card">
    <div class="geo-card-header">
      <h3 class="geo-card-title">🔑 关键词 ({{ keywords.length }})</h3>
      <button class="geo-btn geo-btn-primary geo-btn-sm" @click="manageKeywords">管理关键词</button>
    </div>
    <div class="geo-card-body">
      <div v-if="keywords.length > 0" class="geo-keyword-list">
        <span v-for="kw in keywords.slice(0, 20)" :key="kw.id" class="geo-keyword-tag">
          {{ kw.keyword }}
          <span class="geo-keyword-type">{{ kw.type }}</span>
        </span>
        <span v-if="keywords.length > 20" class="geo-keyword-more">+{{ keywords.length - 20 }} 更多</span>
      </div>
      <div v-else class="geo-empty-inline">暂无关键词</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  keywords: any[]
}>()

const emit = defineEmits<{
  manage: []
}>()

function manageKeywords() {
  emit('manage')
}
</script>

<style scoped>
.geo-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 16px; overflow: hidden; }
.geo-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-card-title { margin: 0; font-size: 15px; font-weight: 600; color: #e0e0e0; }
.geo-card-body { padding: 16px 20px; }
.geo-btn { border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; padding: 8px 16px; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-sm { padding: 6px 14px; font-size: 12px; }
.geo-keyword-list { display: flex; flex-wrap: wrap; gap: 6px; }
.geo-keyword-tag { padding: 4px 10px; background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.15); border-radius: 16px; font-size: 12px; display: flex; align-items: center; gap: 6px; color: #e0e0e0; }
.geo-keyword-type { font-size: 10px; color: #818cf8; background: rgba(129,140,248,0.15); padding: 1px 5px; border-radius: 6px; }
.geo-keyword-more { font-size: 12px; color: #6b7280; padding: 4px 8px; }
.geo-empty-inline { color: #6b7280; font-size: 13px; padding: 8px 0; }
</style>
