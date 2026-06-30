<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-card">
    <div class="geo-card-header">
      <h3 class="geo-card-title">🌐 官网管理</h3>
      <button class="geo-btn geo-btn-primary geo-btn-sm" @click="startScan" :disabled="scanning">
        {{ scanning ? '扫描中...' : '扫描官网' }}
      </button>
    </div>
    <div class="geo-card-body">
      <div class="geo-website-form">
        <input v-model="localUrl" class="geo-input" placeholder="https://example.com" @keyup.enter="saveWebsite" />
        <button class="geo-btn geo-btn-primary geo-btn-sm" @click="saveWebsite">保存</button>
      </div>
      <div v-if="scanHistory.length > 0" class="geo-scan-history">
        <h4 class="geo-subsection-title">扫描记录</h4>
        <div v-for="scan in scanHistory" :key="scan.id" class="geo-scan-item">
          <span class="geo-scan-type">{{ scan.scanType }}</span>
          <span :class="['geo-scan-status', `geo-scan-status--${scan.status}`]">{{ scan.status }}</span>
          <span class="geo-scan-time">{{ formatTime(scan.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  websiteUrl: string
  scanning: boolean
  scanHistory: any[]
}>()

const emit = defineEmits<{
  saveUrl: [url: string]
  startScan: []
}>()

const localUrl = ref(props.websiteUrl)
watch(() => props.websiteUrl, (v) => { localUrl.value = v })

function saveWebsite() {
  if (localUrl.value) emit('saveUrl', localUrl.value)
}

function startScan() {
  emit('startScan')
}

function formatTime(iso: string): string {
  try { const d = new Date(iso); return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
</script>

<style scoped>
.geo-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 16px; overflow: hidden; }
.geo-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-card-title { margin: 0; font-size: 15px; font-weight: 600; color: #e0e0e0; }
.geo-card-body { padding: 16px 20px; }
.geo-btn { border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; padding: 8px 16px; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-sm { padding: 6px 14px; font-size: 12px; }
.geo-website-form { display: flex; gap: 8px; margin-bottom: 16px; }
.geo-input { flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; }
.geo-input:focus { border-color: #818cf8; }
.geo-subsection-title { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: #aaa; }
.geo-scan-history { margin-top: 12px; }
.geo-scan-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 12px; margin-bottom: 4px; }
.geo-scan-type { color: #818cf8; font-weight: 600; min-width: 70px; text-transform: uppercase; font-size: 11px; }
.geo-scan-status { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; min-width: 70px; text-align: center; }
.geo-scan-status--completed { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.geo-scan-status--running { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.geo-scan-status--pending { background: rgba(156, 163, 175, 0.15); color: #9ca3af; }
.geo-scan-status--failed { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.geo-scan-time { margin-left: auto; color: #6b7280; font-size: 11px; }
</style>
