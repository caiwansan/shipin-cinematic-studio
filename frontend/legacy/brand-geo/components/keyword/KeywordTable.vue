<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-table-container">
    <div v-if="loading" class="geo-table-loading">
      <div class="geo-loading-spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="!projectSelected" class="geo-table-empty">
      <p>请先选择品牌项目，关键词将在此处显示</p>
    </div>
    <table v-else-if="keywords.length > 0" class="geo-table">
      <thead>
        <tr>
          <th>关键词</th>
          <th>类型</th>
          <th>来源</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="kw in keywords" :key="kw.id">
          <td class="geo-cell-keyword">{{ kw.keyword }}</td>
          <td><span :class="['geo-type-badge', `geo-type--${kw.type}`]">{{ typeLabel(kw.type) }}</span></td>
          <td class="geo-cell-source">{{ kw.source || '-' }}</td>
          <td class="geo-cell-date">{{ formatDate(kw.createdAt) }}</td>
          <td class="geo-cell-actions">
            <button class="geo-btn-sm geo-btn-danger" @click="$emit('delete', kw)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="geo-table-empty">
      <p>暂无关键词，点击「新增关键词」或「导入」</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  keywords: any[]
  loading: boolean
  projectSelected: boolean
}>()

defineEmits<{
  delete: [kw: any]
}>()

function typeLabel(type: string): string {
  switch (type) { case 'brand': return '品牌'; case 'ai': return 'AI'; case 'industry': return '行业'; case 'long_tail': return '长尾'; default: return type }
}

function formatDate(iso: string): string {
  try { const d = new Date(iso); return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }
  catch { return iso }
}
</script>

<style scoped>
.geo-table-container { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); overflow: hidden; }
.geo-table { width: 100%; border-collapse: collapse; }
.geo-table th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.geo-table tr:last-child td { border-bottom: none; }
.geo-table tr:hover td { background: rgba(255,255,255,0.02); }
.geo-cell-keyword { font-weight: 600; color: #e0e0e0; }
.geo-cell-source { color: #6b7280; }
.geo-cell-date { color: #6b7280; font-size: 12px; }
.geo-cell-actions { display: flex; gap: 6px; }
.geo-type-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-type--brand { background: rgba(129,140,248,0.15); color: #818cf8; }
.geo-type--ai { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-type--industry { background: rgba(245,158,11,0.15); color: #fbbf24; }
.geo-type--long_tail { background: rgba(236,72,153,0.15); color: #ec4899; }
.geo-table-loading { padding: 40px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; color: #6b7280; }
.geo-loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.geo-table-empty { padding: 60px 20px; text-align: center; color: #666; font-size: 14px; }
.geo-btn-sm { padding: 4px 10px; border-radius: 4px; font-size: 12px; background: rgba(255,255,255,0.06); color: #aaa; cursor: pointer; border: none; }
.geo-btn-sm:hover { background: rgba(255,255,255,0.1); }
.geo-btn-sm.geo-btn-danger { background: rgba(239,68,68,0.15); color: #fca5a5; }
.geo-btn-sm.geo-btn-danger:hover { background: rgba(239,68,68,0.25); }
</style>
