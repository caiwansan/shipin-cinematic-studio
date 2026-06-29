<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <button class="geo-btn geo-btn-ghost geo-btn-sm" @click="$emit('back')">← 返回</button>
        <h2 class="geo-page-title">📋 品牌详情</h2>
      </div>
    </div>

    <div v-if="loading" class="geo-loading-centered">
      <div class="geo-loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <template v-else-if="brand">
      <!-- Brand Info Card -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">{{ brand.name }}</h3>
          <span :class="['geo-status-badge', `geo-status--${brand.status}`]">{{ brand.status }}</span>
        </div>
        <div class="geo-card-body">
          <div class="geo-info-grid">
            <div class="geo-info-item">
              <span class="geo-info-label">行业</span>
              <span class="geo-info-value">{{ brand.industry || '-' }}</span>
            </div>
            <div class="geo-info-item">
              <span class="geo-info-label">语言</span>
              <span class="geo-info-value">{{ brand.language || 'zh' }}</span>
            </div>
            <div class="geo-info-item">
              <span class="geo-info-label">官网</span>
              <span class="geo-info-value">{{ brandSetting?.website || '-' }}</span>
            </div>
            <div class="geo-info-item">
              <span class="geo-info-label">地区</span>
              <span class="geo-info-value">{{ brandSetting?.region || '-' }}</span>
            </div>
            <div class="geo-info-item" v-if="brandSetting?.description">
              <span class="geo-info-label">描述</span>
              <span class="geo-info-value">{{ brandSetting.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Website Management Card -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">🌐 官网管理</h3>
          <button class="geo-btn geo-btn-primary geo-btn-sm" @click="startScan" :disabled="scanning">
            {{ scanning ? '扫描中...' : '扫描官网' }}
          </button>
        </div>
        <div class="geo-card-body">
          <div class="geo-website-form">
            <input
              v-model="websiteUrl"
              class="geo-input"
              placeholder="https://example.com"
              @keyup.enter="saveWebsite"
            />
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

      <!-- Keywords Card -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">🔑 关键词 ({{ keywords.length }})</h3>
          <button class="geo-btn geo-btn-primary geo-btn-sm" @click="$emit('navigate', 'keywords')">管理关键词</button>
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

      <!-- Brand Status -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">📊 品牌状态</h3>
        </div>
        <div class="geo-card-body">
          <div v-if="brandStatus" class="geo-info-grid">
            <div class="geo-info-item">
              <span class="geo-info-label">Provider 配置</span>
              <span class="geo-info-value" :class="brandStatus.provider.configured ? 'geo-text-ok' : 'geo-text-warn'">
                {{ brandStatus.provider.configured ? '已配置' : '未配置' }}
              </span>
            </div>
            <div class="geo-info-item">
              <span class="geo-info-label">扫描状态</span>
              <span class="geo-info-value">{{ brandStatus.scan.hasScanned ? brandStatus.scan.status : '未扫描' }}</span>
            </div>
            <div class="geo-info-item">
              <span class="geo-info-label">Knowledge 数量</span>
              <span class="geo-info-value">{{ brandStatus.knowledge.koCount }}</span>
            </div>
            <div class="geo-info-item">
              <span class="geo-info-label">关键词数量</span>
              <span class="geo-info-value">{{ brandStatus.knowledge.keywordCount }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="geo-loading-centered">
      <p>品牌未找到</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const props = defineProps<{
  brandId: string
}>()

const emit = defineEmits<{
  back: []
  navigate: [panelId: string]
}>()

const loading = ref(false)
const scanning = ref(false)
const brand = ref<any>(null)
const brandSetting = ref<any>(null)
const keywords = ref<any[]>([])
const scanHistory = ref<any[]>([])
const brandStatus = ref<any>(null)
const websiteUrl = ref('')

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

async function fetchBrandDetail() {
  if (!props.brandId) return
  loading.value = true
  try {
    const res = await fetch(`/api/geo/brands/${props.brandId}`, { headers: authHeaders() })
    const json = await res.json()
    if (json.success) brand.value = json.data

    const settingsRes = await fetch(`/api/geo/brands/${props.brandId}/settings`, { headers: authHeaders() })
    const settingsJson = await settingsRes.json()
    if (settingsJson.success) {
      brandSetting.value = settingsJson.data
      websiteUrl.value = settingsJson.data.website || ''
    }

    const kwRes = await fetch(`/api/geo/keywords?projectId=${props.brandId}`, { headers: authHeaders() })
    const kwJson = await kwRes.json()
    if (kwJson.success) keywords.value = kwJson.data

    const scanRes = await fetch(`/api/geo/scans?projectId=${props.brandId}`, { headers: authHeaders() })
    const scanJson = await scanRes.json()
    if (scanJson.success) scanHistory.value = scanJson.data

    const statusRes = await fetch(`/api/geo/brands/${props.brandId}/status`, { headers: authHeaders() })
    const statusJson = await statusRes.json()
    if (statusJson.success) brandStatus.value = statusJson.data
  } catch (err) {
    console.error('Failed to fetch brand detail:', err)
  } finally {
    loading.value = false
  }
}

async function saveWebsite() {
  if (!websiteUrl.value) return
  try {
    await fetch(`/api/geo/brands/${props.brandId}/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ website: websiteUrl.value }),
    })
  } catch (err) {
    console.error('Failed to save website:', err)
  }
}

async function startScan() {
  scanning.value = true
  try {
    await fetch('/api/geo/scans', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ projectId: props.brandId, scanType: 'website' }),
    })
    // Refresh scan history
    const scanRes = await fetch(`/api/geo/scans?projectId=${props.brandId}`, { headers: authHeaders() })
    const scanJson = await scanRes.json()
    if (scanJson.success) scanHistory.value = scanJson.data
  } catch (err) {
    console.error('Failed to start scan:', err)
  } finally {
    scanning.value = false
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

onMounted(() => {
  if (props.brandId) {
    fetchBrandDetail()
  }
})
</script>

<style scoped>
.geo-page { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }

.geo-page-header { margin-bottom: 20px; }
.geo-page-header-left { display: flex; align-items: center; gap: 12px; }
.geo-page-title { font-size: 20px; font-weight: 700; margin: 0; }

.geo-btn { border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; padding: 8px 16px; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
.geo-btn-sm { padding: 6px 14px; font-size: 12px; }

.geo-loading-centered { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 60px; color: #6b7280; }
.geo-loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.geo-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 16px; overflow: hidden; }
.geo-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-card-title { margin: 0; font-size: 15px; font-weight: 600; }
.geo-card-body { padding: 16px 20px; }

.geo-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-status--active { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-status--draft { background: rgba(156,163,175,0.15); color: #9ca3af; }

.geo-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.geo-info-item { }
.geo-info-label { display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
.geo-info-value { font-size: 14px; color: #e0e0e0; }
.geo-text-ok { color: #34d399; }
.geo-text-warn { color: #fbbf24; }

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

.geo-keyword-list { display: flex; flex-wrap: wrap; gap: 6px; }
.geo-keyword-tag { padding: 4px 10px; background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.15); border-radius: 16px; font-size: 12px; display: flex; align-items: center; gap: 6px; }
.geo-keyword-type { font-size: 10px; color: #818cf8; background: rgba(129,140,248,0.15); padding: 1px 5px; border-radius: 6px; }
.geo-keyword-more { font-size: 12px; color: #6b7280; padding: 4px 8px; }
.geo-empty-inline { color: #6b7280; font-size: 13px; padding: 8px 0; }
</style>
