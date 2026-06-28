<template>
  <div class="governance-center">
    <header class="gc-header">
      <h1>🎛️ Governance Center</h1>
      <p class="gc-subtitle">Platform Control Plane — Tenant, Subscription, Quota & Audit</p>
    </header>

    <div v-if="store.loading" class="gc-loading">Loading governance data...</div>

    <template v-if="!store.loading">
      <!-- Tenant Status Card -->
      <div class="gc-grid">
        <div class="gc-card">
          <div class="gc-card-header">
            <h2>🏢 Tenant</h2>
            <span :class="['gc-badge', store.tenant?.status]">{{ store.tenant?.status }}</span>
          </div>
          <div class="gc-card-body">
            <div class="gc-info-row"><label>Name:</label><span>{{ store.tenant?.name || 'N/A' }}</span></div>
            <div class="gc-info-row"><label>Type:</label><span>{{ store.tenant?.type || 'N/A' }}</span></div>
            <div class="gc-info-row"><label>ID:</label><span class="gc-mono">{{ store.tenant?.id?.slice(0, 8) }}...</span></div>
          </div>
        </div>

        <!-- Subscription Card -->
        <div class="gc-card">
          <div class="gc-card-header">
            <h2>📋 Subscription</h2>
            <span :class="['gc-badge', store.activeSubscription?.status]">{{ store.activeSubscription?.status || 'none' }}</span>
          </div>
          <div class="gc-card-body">
            <div class="gc-info-row"><label>Plan:</label><span>{{ store.activeSubscription?.plan?.name || 'Free' }}</span></div>
            <div class="gc-info-row"><label>Since:</label><span>{{ formatDate(store.activeSubscription?.startDate) }}</span></div>
            <div class="gc-info-row"><label>Auto Renew:</label><span>{{ store.activeSubscription?.autoRenew ? '✅' : '❌' }}</span></div>
          </div>
        </div>

        <!-- Quota Summary Card -->
        <div class="gc-card">
          <div class="gc-card-header">
            <h2>📊 Quota Overview</h2>
          </div>
          <div class="gc-card-body">
            <div class="gc-metric">
              <label>Daily Tokens</label>
              <div class="gc-bar">
                <div class="gc-bar-fill" :style="{ width: (quotaPct('dailyTokens')) + '%' }"></div>
              </div>
              <span>{{ store.quota?.dailyTokens || 0 }}</span>
            </div>
            <div class="gc-metric">
              <label>Image Credits</label>
              <div class="gc-bar">
                <div class="gc-bar-fill gc-bar-green" :style="{ width: (quotaPct('imageCredits')) + '%' }"></div>
              </div>
              <span>{{ store.quota?.imageCredits || 0 }}</span>
            </div>
            <div class="gc-metric">
              <label>Video Minutes</label>
              <div class="gc-bar">
                <div class="gc-bar-fill gc-bar-purple" :style="{ width: (quotaPct('videoMinutes')) + '%' }"></div>
              </div>
              <span>{{ store.quota?.videoMinutes || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage Summary -->
      <div class="gc-section">
        <h2>📈 Usage Summary</h2>
        <div class="gc-stats" v-if="store.usageSummary">
          <div class="gc-stat"><label>Tokens</label><span>{{ store.usageSummary.totalTokens.toLocaleString() }}</span></div>
          <div class="gc-stat"><label>Images</label><span>{{ store.usageSummary.totalImages.toLocaleString() }}</span></div>
          <div class="gc-stat"><label>Video</label><span>{{ store.usageSummary.totalVideoMinutes.toFixed(1) }} min</span></div>
          <div class="gc-stat"><label>Audio</label><span>{{ store.usageSummary.totalAudioMinutes.toFixed(1) }} min</span></div>
          <div class="gc-stat"><label>Workflows</label><span>{{ store.usageSummary.totalWorkflowRuns }}</span></div>
          <div class="gc-stat"><label>Cost</label><span>${{ store.usageSummary.totalCost.toFixed(2) }}</span></div>
        </div>
      </div>

      <!-- Recent Audit Logs -->
      <div class="gc-section">
        <h2>📜 Recent Audit Logs</h2>
        <table class="gc-table" v-if="store.recentAudit?.length">
          <thead>
            <tr>
              <th>Action</th>
              <th>Resource</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in store.recentAudit.slice(0, 10)" :key="log.id">
              <td><code>{{ log.action }}</code></td>
              <td>{{ log.resource }} {{ log.resourceId ? `(${log.resourceId.slice(0,8)}...)` : '' }}</td>
              <td class="gc-mono">{{ formatDate(log.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="gc-empty">No audit logs available.</p>
      </div>
    </template>

    <p v-if="store.error" class="gc-error">⚠ {{ store.error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useGovernanceStore } from '../store/useGovernanceStore.js'

const store = useGovernanceStore()
const TENANT_ID = 'default' // Replace with actual tenant context

onMounted(async () => {
  await store.loadOverview(TENANT_ID)
  await store.loadUsageSummary(TENANT_ID)
})

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString()
}

function quotaPct(field: string): number {
  if (!store.quota) return 0
  const total = (store.quota as any)[field]
  const used = store.usageRecords.filter(r => {
    if (field === 'dailyTokens') return r.resourceType === 'token'
    if (field === 'imageCredits') return r.resourceType === 'image'
    if (field === 'videoMinutes') return r.resourceType === 'video'
    return false
  }).reduce((s, r) => s + r.amount, 0)
  if (!total) return 0
  return Math.min(100, (used / total) * 100)
}
</script>

<style scoped>
.governance-center { padding: 24px; max-width: 1200px; margin: 0 auto; }
.gc-header { margin-bottom: 24px; }
.gc-header h1 { margin: 0; font-size: 1.8em; }
.gc-subtitle { color: #888; margin-top: 4px; }
.gc-loading, .gc-empty { color: #888; padding: 40px; text-align: center; }
.gc-error { color: #e74c3c; padding: 12px; background: #fdecea; border-radius: 6px; margin-top: 16px; }
.gc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
.gc-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; }
.gc-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.gc-card-header h2 { margin: 0; font-size: 1.1em; }
.gc-card-body { font-size: 0.9em; }
.gc-info-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f5f5f5; }
.gc-info-row label { color: #666; }
.gc-badge { padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: 600; }
.gc-badge.active { background: #e8f5e9; color: #2e7d32; }
.gc-badge.inactive, .gc-badge.expired, .gc-badge.none { background: #f5f5f5; color: #999; }
.gc-mono { font-family: monospace; font-size: 0.9em; }
.gc-metric { margin-top: 8px; }
.gc-metric label { font-size: 0.85em; color: #666; }
.gc-bar { height: 6px; background: #e0e0e0; border-radius: 3px; margin: 4px 0; overflow: hidden; }
.gc-bar-fill { height: 100%; background: #4fc3f7; border-radius: 3px; transition: width 0.3s; }
.gc-bar-green { background: #81c784; }
.gc-bar-purple { background: #ce93d8; }
.gc-section { margin-bottom: 24px; }
.gc-section h2 { font-size: 1.2em; margin-bottom: 12px; }
.gc-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.gc-stat { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; text-align: center; }
.gc-stat label { display: block; font-size: 0.8em; color: #888; margin-bottom: 4px; }
.gc-stat span { font-size: 1.2em; font-weight: 600; }
.gc-table { width: 100%; border-collapse: collapse; }
.gc-table th, .gc-table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-size: 0.9em; }
.gc-table th { background: #f5f5f5; font-weight: 600; }
.gc-table code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; }
</style>
