<template>
  <div class="quota-dashboard">
    <h3>📊 Quota Dashboard</h3>
    <div class="qd-grid" v-if="quota">
      <div class="qd-item">
        <label>Daily Tokens</label>
        <div class="qd-bar"><div class="qd-fill" :style="{ width: pct(quota.dailyTokens, 'dailyTokens') + '%' }"></div></div>
        <span>{{ used('dailyTokens') }} / {{ quota.dailyTokens }}</span>
      </div>
      <div class="qd-item">
        <label>Image Credits</label>
        <div class="qd-bar"><div class="qd-fill qd-green" :style="{ width: pct(quota.imageCredits, 'imageCredits') + '%' }"></div></div>
        <span>{{ used('imageCredits') }} / {{ quota.imageCredits }}</span>
      </div>
      <div class="qd-item">
        <label>Video Minutes</label>
        <div class="qd-bar"><div class="qd-fill qd-purple" :style="{ width: pct(quota.videoMinutes, 'videoMinutes') + '%' }"></div></div>
        <span>{{ used('videoMinutes') }} / {{ quota.videoMinutes }}</span>
      </div>
      <div class="qd-item">
        <label>Workflow Runs</label>
        <div class="qd-bar"><div class="qd-fill qd-orange" :style="{ width: pct(quota.workflowRuns, 'workflowRuns') + '%' }"></div></div>
        <span>{{ used('workflowRuns') }} / {{ quota.workflowRuns }}</span>
      </div>
      <div class="qd-item">
        <label>Storage</label>
        <div class="qd-bar"><div class="qd-fill qd-red" :style="{ width: pct(quota.storage, 'storage') + '%' }"></div></div>
        <span>{{ used('storage') }} / {{ quota.storage }} MB</span>
      </div>
    </div>
    <p v-else class="qd-empty">No quota data available.</p>
  </div>
</template>

<script setup lang="ts">
import type { QuotaDTO, UsageRecordDTO } from '../types/index.js'

const props = defineProps<{
  quota?: QuotaDTO | null
  usage?: UsageRecordDTO[]
}>()

function getUsed(field: string): number {
  if (!props.usage) return 0
  const map: Record<string, string> = { dailyTokens: 'token', imageCredits: 'image', videoMinutes: 'video', workflowRuns: 'workflow', storage: 'storage' }
  const rt = map[field]
  return props.usage.filter(r => r.resourceType === rt).reduce((s, r) => s + r.amount, 0)
}

function used(field: string): number {
  return getUsed(field)
}

function pct(limit: number, field: string): number {
  if (!limit) return 0
  return Math.min(100, (getUsed(field) / limit) * 100)
}
</script>

<style scoped>
.quota-dashboard { padding: 16px; }
.qd-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
.qd-item label { display: block; font-size: 0.85em; color: #666; margin-bottom: 4px; }
.qd-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 4px; }
.qd-fill { height: 100%; background: #4fc3f7; border-radius: 4px; transition: width 0.3s; }
.qd-green { background: #81c784; }
.qd-purple { background: #ce93d8; }
.qd-orange { background: #ffb74d; }
.qd-red { background: #e57373; }
.qd-item span { font-size: 0.8em; color: #888; }
.qd-empty { color: #888; padding: 20px; text-align: center; }
</style>
