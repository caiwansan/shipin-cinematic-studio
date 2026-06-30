<template>
  <div class="geo-card">
    <div class="geo-card-header">
      <h3 class="geo-card-title">🔗 工作流导航</h3>
    </div>
    <div class="geo-card-body">
      <div class="geo-workflow-links">
        <button v-for="item in workflowItems" :key="item.id" class="geo-workflow-btn" @click="$emit('navigate', item.id)">
          <span class="geo-workflow-btn-icon">{{ item.icon }}</span>
          <span class="geo-workflow-btn-label">{{ item.label }}</span>
          <span class="geo-workflow-btn-arrow">→</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const workflowItems = [
  { id: 'evidence', icon: '📄', label: '证据管理' },
  { id: 'claim', icon: '📋', label: '声明管理' },
  { id: 'history', icon: '📜', label: '历史记录' },
  { id: 'report', icon: '📊', label: '报告中心' },
]

defineEmits<{
  navigate: [panelId: string]
}>()
</script>

<style scoped>
.geo-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 16px; overflow: hidden; }
.geo-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-card-title { margin: 0; font-size: 15px; font-weight: 600; color: #e0e0e0; }
.geo-card-body { padding: 16px 20px; }
.geo-workflow-links { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.geo-workflow-btn { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; cursor: pointer; transition: all 0.15s; color: #e0e0e0; text-align: left; width: 100%; }
.geo-workflow-btn:hover { border-color: #818cf8; background: rgba(99, 102, 241, 0.08); }
.geo-workflow-btn-icon { font-size: 18px; }
.geo-workflow-btn-label { font-size: 13px; font-weight: 600; flex: 1; }
.geo-workflow-btn-arrow { font-size: 14px; color: #6b7280; }
</style>
