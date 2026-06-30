<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-card">
    <div class="geo-card-header">
      <h3 class="geo-card-title">📊 品牌状态</h3>
    </div>
    <div class="geo-card-body">
      <div v-if="status" class="geo-info-grid">
        <div class="geo-info-item">
          <span class="geo-info-label">Provider 配置</span>
          <span class="geo-info-value" :class="status.provider.configured ? 'geo-text-ok' : 'geo-text-warn'">
            {{ status.provider.configured ? '已配置' : '未配置' }}
          </span>
        </div>
        <div class="geo-info-item">
          <span class="geo-info-label">扫描状态</span>
          <span class="geo-info-value">{{ status.scan.hasScanned ? status.scan.status : '未扫描' }}</span>
        </div>
        <div class="geo-info-item">
          <span class="geo-info-label">Knowledge 数量</span>
          <span class="geo-info-value">{{ status.knowledge.koCount }}</span>
        </div>
        <div class="geo-info-item">
          <span class="geo-info-label">关键词数量</span>
          <span class="geo-info-value">{{ status.knowledge.keywordCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  status: any
}>()
</script>

<style scoped>
.geo-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 16px; overflow: hidden; }
.geo-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-card-title { margin: 0; font-size: 15px; font-weight: 600; color: #e0e0e0; }
.geo-card-body { padding: 16px 20px; }
.geo-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.geo-info-item { }
.geo-info-label { display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
.geo-info-value { font-size: 14px; color: #e0e0e0; }
.geo-text-ok { color: #34d399; }
.geo-text-warn { color: #fbbf24; }
</style>
