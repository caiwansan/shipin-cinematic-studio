<template>
  <div class="geo-dashboard">
    <!-- Welcome Header -->
    <div class="geo-dashboard-welcome">
      <div class="geo-welcome-left">
        <h1 class="geo-welcome-title">品牌 GEO 工作台</h1>
        <p class="geo-welcome-subtitle">
          品牌搜索引擎优化 — 创建品牌、配置官网、管理关键词、生成知识图谱
        </p>
      </div>
      <div class="geo-welcome-right">
        <button class="geo-btn geo-btn-primary" @click="$emit('navigate', 'brands')">
          + 创建品牌
        </button>
      </div>
    </div>

    <!-- Provider Status Banner -->
    <div v-if="providerStatus !== null && !providerStatus" class="geo-provider-banner">
      <span class="geo-provider-banner-icon">⚠️</span>
      <span class="geo-provider-banner-text">
        尚未配置 AI Provider。请先前往
        <a class="geo-banner-link" @click="$emit('navigate', 'settings')">设置</a>
        配置你的 API Provider，才能调用 AI 生成知识图谱。
      </span>
    </div>

    <!-- Stats Cards -->
    <div class="geo-stats-row">
      <div class="geo-stat-card" style="border-left-color: #818cf8">
        <div class="geo-stat-icon-wrapper" style="background: rgba(129,140,248,0.12)">
          <span class="geo-stat-icon">🏢</span>
        </div>
        <div class="geo-stat-body">
          <span class="geo-stat-number">{{ stats.brandCount }}</span>
          <span class="geo-stat-label">品牌数量</span>
        </div>
      </div>
      <div class="geo-stat-card" style="border-left-color: #34d399">
        <div class="geo-stat-icon-wrapper" style="background: rgba(52,211,153,0.12)">
          <span class="geo-stat-icon">🔑</span>
        </div>
        <div class="geo-stat-body">
          <span class="geo-stat-number">{{ stats.keywordCount }}</span>
          <span class="geo-stat-label">关键词</span>
        </div>
      </div>
      <div class="geo-stat-card" style="border-left-color: #f59e0b">
        <div class="geo-stat-icon-wrapper" style="background: rgba(245,158,11,0.12)">
          <span class="geo-stat-icon">📚</span>
        </div>
        <div class="geo-stat-body">
          <span class="geo-stat-number">{{ stats.koCount }}</span>
          <span class="geo-stat-label">Knowledge</span>
        </div>
      </div>
      <div class="geo-stat-card" style="border-left-color: #ec4899">
        <div class="geo-stat-icon-wrapper" style="background: rgba(236,72,153,0.12)">
          <span class="geo-stat-icon">🔗</span>
        </div>
        <div class="geo-stat-body">
          <span class="geo-stat-number">{{ stats.entityCount }}</span>
          <span class="geo-stat-label">实体/关系</span>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="geo-dashboard-section">
      <h3 class="geo-section-title">🚀 快速入口</h3>
      <div class="geo-card-grid">
        <div class="geo-function-card" style="--card-accent: #818cf8" @click="$emit('navigate', 'brands')">
          <div class="geo-function-card-header">
            <span class="geo-function-card-icon">🏢</span>
            <h4 class="geo-function-card-title">品牌管理</h4>
          </div>
          <p class="geo-function-card-desc">创建和管理品牌项目，配置品牌基本信息</p>
        </div>
        <div class="geo-function-card" style="--card-accent: #34d399" @click="$emit('navigate', 'keywords')">
          <div class="geo-function-card-header">
            <span class="geo-function-card-icon">🔑</span>
            <h4 class="geo-function-card-title">关键词管理</h4>
          </div>
          <p class="geo-function-card-desc">管理品牌/AI/行业/长尾关键词，支持导入导出</p>
        </div>
        <div class="geo-function-card" style="--card-accent: #f59e0b" @click="$emit('navigate', 'knowledge')">
          <div class="geo-function-card-header">
            <span class="geo-function-card-icon">📚</span>
            <h4 class="geo-function-card-title">Knowledge</h4>
          </div>
          <p class="geo-function-card-desc">查看知识对象，管理 Evidence/Claim/Citation</p>
        </div>
        <div class="geo-function-card" style="--card-accent: #ec4899" @click="$emit('navigate', 'knowledge-graph')">
          <div class="geo-function-card-header">
            <span class="geo-function-card-icon">🔗</span>
            <h4 class="geo-function-card-title">知识图谱</h4>
          </div>
          <p class="geo-function-card-desc">可视化实体关系网络，探索品牌知识拓扑</p>
        </div>
        <div class="geo-function-card" style="--card-accent: #f97316" @click="$emit('navigate', 'settings')">
          <div class="geo-function-card-header">
            <span class="geo-function-card-icon">⚙️</span>
            <h4 class="geo-function-card-title">设置</h4>
          </div>
          <p class="geo-function-card-desc">配置 AI Provider / API Key / Model，测试连接</p>
        </div>
      </div>
    </div>

    <!-- Recent Scans -->
    <div class="geo-dashboard-section">
      <h3 class="geo-section-title">📋 最近扫描</h3>
      <div v-if="stats.recentScans && stats.recentScans.length > 0" class="geo-scan-list">
        <div v-for="scan in stats.recentScans" :key="scan.id" class="geo-scan-item">
          <span class="geo-scan-type">{{ scan.scanType }}</span>
          <span :class="['geo-scan-status', `geo-scan-status--${scan.status}`]">{{ scan.status }}</span>
          <span class="geo-scan-topic">{{ scan.topic || '-' }}</span>
          <span class="geo-scan-time">{{ formatTime(scan.createdAt) }}</span>
        </div>
      </div>
      <div v-else class="geo-empty-state">
        <p>暂无扫描记录，创建品牌后可进行扫描</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="geo-loading-overlay">
      <div class="geo-loading-spinner"></div>
      <span>加载中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineEmits<{
  navigate: [panelId: string]
}>()

const loading = ref(false)
const providerStatus = ref<boolean | null>(null)

interface DashboardStats {
  brandCount: number
  keywordCount: number
  koCount: number
  entityCount: number
  relationCount: number
  claimsCount: number
  recentScans: Array<{
    id: string
    projectId: string
    scanType: string
    status: string
    topic: string | null
    createdAt: string
  }>
}

const stats = ref<DashboardStats>({
  brandCount: 0,
  keywordCount: 0,
  koCount: 0,
  entityCount: 0,
  relationCount: 0,
  claimsCount: 0,
  recentScans: [],
})

function authHeaders(): Record<string, string> {
  try {
    const ls = window.localStorage
    for (const key of ['auth_token', 'accessToken', 'token']) {
      const val = ls.getItem(key)
      if (val) return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${val}` }
    }
  } catch { /* ignore */ }
  return { 'Content-Type': 'application/json' }
}

async function fetchDashboardStats() {
  loading.value = true
  try {
    const res = await fetch('/api/geo/dashboard/stats', { headers: authHeaders() })
    const json = await res.json()
    if (json.success) {
      stats.value = json.data
    }
  } catch (err) {
    console.error('Failed to fetch dashboard stats:', err)
  } finally {
    loading.value = false
  }
}

async function fetchProviderStatus() {
  try {
    const res = await fetch('/api/geo/dashboard/provider-status', { headers: authHeaders() })
    const json = await res.json()
    if (json.success) {
      providerStatus.value = json.data.configured
    }
  } catch { /* ignore */ }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

onMounted(() => {
  fetchDashboardStats()
  fetchProviderStatus()
})
</script>

<style scoped>
.geo-dashboard { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }

.geo-dashboard-welcome { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.geo-welcome-title { font-size: 24px; font-weight: 700; margin: 0 0 6px; background: linear-gradient(135deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.geo-welcome-subtitle { color: #888; font-size: 14px; margin: 0; }
.geo-welcome-right { display: flex; gap: 12px; align-items: center; }

.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

.geo-provider-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13px;
  color: #fbbf24;
}
.geo-provider-banner-icon { font-size: 18px; }
.geo-provider-banner-text { flex: 1; }
.geo-banner-link { color: #818cf8; cursor: pointer; text-decoration: underline; }
.geo-banner-link:hover { color: #a5b4fc; }

.geo-stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-bottom: 28px; }
.geo-stat-card { display: flex; align-items: center; gap: 14px; padding: 18px; background: #1a1a2e; border-radius: 10px; border-left: 3px solid; border-top: 1px solid rgba(255,255,255,0.04); border-right: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); transition: all 0.15s; }
.geo-stat-card:hover { background: #1e1e36; transform: translateY(-1px); }
.geo-stat-icon-wrapper { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.geo-stat-icon { font-size: 20px; }
.geo-stat-body { display: flex; flex-direction: column; }
.geo-stat-number { font-size: 22px; font-weight: 700; }
.geo-stat-label { font-size: 11px; color: #888; text-transform: uppercase; margin-top: 2px; letter-spacing: 0.5px; }

.geo-dashboard-section { margin-bottom: 28px; }
.geo-section-title { font-size: 16px; font-weight: 600; margin: 0 0 14px; color: #ccc; }
.geo-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.geo-function-card { padding: 18px; background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: all 0.15s; }
.geo-function-card:hover { border-color: var(--card-accent); background: #1e1e36; transform: translateY(-2px); }
.geo-function-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.geo-function-card-icon { font-size: 22px; }
.geo-function-card-title { font-size: 14px; font-weight: 600; margin: 0; }
.geo-function-card-desc { font-size: 12px; color: #888; margin: 0; line-height: 1.4; }

.geo-scan-list { display: flex; flex-direction: column; gap: 6px; }
.geo-scan-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #16162a; border-radius: 6px; font-size: 13px; border: 1px solid rgba(255,255,255,0.03); }
.geo-scan-type { color: #818cf8; font-weight: 600; min-width: 70px; text-transform: uppercase; font-size: 11px; }
.geo-scan-status { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; min-width: 70px; text-align: center; }
.geo-scan-status--completed { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.geo-scan-status--running { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.geo-scan-status--pending { background: rgba(156, 163, 175, 0.15); color: #9ca3af; }
.geo-scan-status--failed { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.geo-scan-topic { flex: 1; color: #aaa; }
.geo-scan-time { color: #6b7280; font-size: 11px; }

.geo-empty-state { padding: 40px; text-align: center; color: #666; font-size: 13px; background: #1a1a2e; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.06); }

.geo-loading-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; gap: 10px; z-index: 100; }
.geo-loading-spinner { width: 20px; height: 20px; border: 3px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
