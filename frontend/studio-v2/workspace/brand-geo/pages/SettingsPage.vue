<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">⚙️ 设置</h2>
        <p class="geo-page-subtitle">Workspace 偏好配置</p>
      </div>
    </div>

    <div class="geo-settings-grid">
      <!-- AI Center Summary Card — 只读，来自平台 -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">🤖 AI Center</h3>
          <span v-if="aiSummary" class="geo-status-badge" :class="aiSummary.connected ? 'geo-status--active' : 'geo-status--draft'">
            {{ aiSummary.connected ? '已连接' : '未连接' }}
          </span>
        </div>
        <div class="geo-card-body">
          <!-- Loading -->
          <div v-if="loadingSummary" class="geo-card-loading">
            <span class="geo-loading-spinner geo-loading-spinner--sm"></span>
            <span>检测中...</span>
          </div>
          <!-- Summary Display -->
          <template v-else-if="aiSummary">
            <div class="geo-ai-summary-grid">
              <div class="geo-ai-summary-item">
                <span class="geo-ai-summary-label">AI 服务</span>
                <span class="geo-ai-summary-value">{{ aiSummary.provider || '-' }}</span>
              </div>
              <div class="geo-ai-summary-item">
                <span class="geo-ai-summary-label">默认模型</span>
                <span class="geo-ai-summary-value">{{ aiSummary.defaultModel || '-' }}</span>
              </div>
              <div class="geo-ai-summary-item">
                <span class="geo-ai-summary-label">Credential</span>
                <span class="geo-ai-summary-value">{{ aiSummary.credentialStatus || '-' }}</span>
              </div>
              <div class="geo-ai-summary-item">
                <span class="geo-ai-summary-label">Embedding</span>
                <span class="geo-ai-summary-value">{{ aiSummary.embeddingModel || '-' }}</span>
              </div>
              <div class="geo-ai-summary-item">
                <span class="geo-ai-summary-label">上次检测</span>
                <span class="geo-ai-summary-value">{{ aiSummary.lastCheck || '-' }}</span>
              </div>
              <div class="geo-ai-summary-item">
                <span class="geo-ai-summary-label">AI 服务数</span>
                <span class="geo-ai-summary-value">{{ aiSummary.providerCount ?? 0 }}</span>
              </div>
            </div>
          </template>
          <!-- Empty State -->
          <div v-else class="geo-ai-summary-empty">
            <p class="geo-empty-inline">无法获取 AI Center 状态</p>
          </div>
          <!-- Action -->
          <div class="geo-ai-summary-action">
            <button class="geo-btn geo-btn-primary" @click="goToAICenter">
              🚀 前往 AI Center
            </button>
            <button class="geo-btn geo-btn-secondary" @click="refreshSummary">
              刷新状态
            </button>
          </div>
          <p class="geo-ai-summary-hint">
            AI 服务、凭证、模型配置均在 AI Center 统一管理。
            Workspace 仅展示只读摘要。
          </p>
        </div>
      </div>

      <!-- Workspace Preferences -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">📋 Workspace 偏好</h3>
        </div>
        <div class="geo-card-body">
          <div class="geo-form-group">
            <label class="geo-form-label">默认语言</label>
            <select v-model="preferences.language" class="geo-input" @change="savePreferences">
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">默认输出格式</label>
            <select v-model="preferences.outputFormat" class="geo-input" @change="savePreferences">
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">默认模板</label>
            <select v-model="preferences.defaultTemplate" class="geo-input" @change="savePreferences">
              <option value="standard">标准报告</option>
              <option value="brief">简报模式</option>
              <option value="detailed">详细模式</option>
            </select>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-checkbox">
              <input type="checkbox" v-model="preferences.autoSave" @change="savePreferences" />
              <span>自动保存</span>
            </label>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">Knowledge 展示模式</label>
            <select v-model="preferences.knowledgeDisplay" class="geo-input" @change="savePreferences">
              <option value="compact">紧凑</option>
              <option value="detailed">详细</option>
              <option value="graph">图谱优先</option>
            </select>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">报告偏好</label>
            <select v-model="preferences.reportPreference" class="geo-input" @change="savePreferences">
              <option value="summary">摘要优先</option>
              <option value="full">完整报告</option>
              <option value="executive">管理层摘要</option>
            </select>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-checkbox">
              <input type="checkbox" v-model="preferences.historyEnabled" @change="savePreferences" />
              <span>启用历史记录</span>
            </label>
          </div>
        </div>
        <div class="geo-card-footer">
          <span v-if="saved" class="geo-save-indicator">✅ 已保存</span>
          <button class="geo-btn geo-btn-ghost" @click="resetPreferences">恢复默认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { client } from '../clients/GEOApiClient'

// ─── AI Center Summary (Read-only from Platform) ───

interface AISummary {
  connected: boolean
  provider: string
  defaultModel: string
  credentialStatus: string
  embeddingModel: string
  lastCheck: string
  providerCount: number
}

const loadingSummary = ref(true)
const aiSummary = ref<AISummary | null>(null)
const saved = ref(false)

async function fetchAISummary() {
  loadingSummary.value = true
  try {
    // Read-only summary from platform — GEO does NOT manage credentials
    const res = await client.get<{ configured: boolean; providers: any[]; providerCount: number; defaultModel?: string; embeddingModel?: string; lastCheck?: string }>('/dashboard/provider-status')
    if (res.success && res.data) {
      const d = res.data
      aiSummary.value = {
        connected: d.configured || false,
        provider: d.providers?.[0]?.name || d.providers?.[0] || '未配置',
        defaultModel: d.defaultModel || '—',
        credentialStatus: d.configured ? '✅ 已连接' : '⛔ 未配置',
        embeddingModel: d.embeddingModel || 'bge-m3',
        lastCheck: d.lastCheck ? new Date(d.lastCheck).toLocaleTimeString('zh-CN') : '—',
        providerCount: d.providerCount ?? 0,
      }
    }
  } catch {
    aiSummary.value = null
  } finally {
    loadingSummary.value = false
  }
}

function refreshSummary() {
  fetchAISummary()
}

function goToAICenter() {
  // AI Center — 跳转到用户设置页（功能即将上线）
  window.location.href = '/user/center'
}

// ─── Workspace Preferences (Local to GEO) ───

const preferences = reactive({
  language: 'zh',
  outputFormat: 'markdown',
  defaultTemplate: 'standard',
  autoSave: true,
  knowledgeDisplay: 'compact',
  reportPreference: 'summary',
  historyEnabled: true,
})

const PREFERENCES_KEY = 'geo-workspace-preferences'

function loadPreferences() {
  try {
    const saved = localStorage.getItem(PREFERENCES_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      Object.assign(preferences, parsed)
    }
  } catch { /* ignore */ }
}

function savePreferences() {
  saved.value = true
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...preferences }))
    setTimeout(() => { saved.value = false }, 2000)
  } catch { /* ignore */ }
}

function resetPreferences() {
  const defaults = {
    language: 'zh',
    outputFormat: 'markdown',
    defaultTemplate: 'standard',
    autoSave: true,
    knowledgeDisplay: 'compact',
    reportPreference: 'summary',
    historyEnabled: true,
  }
  Object.assign(preferences, defaults)
  savePreferences()
}

onMounted(() => {
  loadPreferences()
  fetchAISummary()
})
</script>

<style scoped>
.geo-page { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }

.geo-page-header { margin-bottom: 20px; }
.geo-page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.geo-page-subtitle { color: #888; font-size: 13px; margin: 0; }

.geo-settings-grid { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }

/* AI Center Summary Card */
.geo-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); overflow: hidden; }
.geo-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-card-title { margin: 0; font-size: 15px; font-weight: 600; }
.geo-card-body { padding: 16px 20px; }
.geo-card-footer { display: flex; align-items: center; justify-content: flex-end; padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.04); gap: 8px; }

.geo-card-loading { display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; }
.geo-loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
.geo-loading-spinner--sm { width: 12px; height: 12px; border-width: 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

.geo-ai-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.geo-ai-summary-item { display: flex; flex-direction: column; gap: 2px; }
.geo-ai-summary-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
.geo-ai-summary-value { font-size: 14px; color: #e2e8f0; font-weight: 500; }

.geo-ai-summary-empty { padding: 20px 0; text-align: center; }
.geo-empty-inline { color: #6b7280; font-size: 13px; margin: 0; }

.geo-ai-summary-action { display: flex; gap: 8px; margin-bottom: 8px; }
.geo-ai-summary-hint { font-size: 11px; color: #4b5563; margin: 8px 0 0; line-height: 1.4; }

/* Buttons */
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-secondary { background: rgba(255,255,255,0.06); color: #ccc; border: 1px solid rgba(255,255,255,0.08); }
.geo-btn-secondary:hover { background: rgba(255,255,255,0.1); }
.geo-btn-ghost { background: transparent; color: #94a3b8; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.04); color: #e2e8f0; }

/* Status Badge */
.geo-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-status--active { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-status--draft { background: rgba(156,163,175,0.15); color: #9ca3af; }

/* Form */
.geo-form-group { margin-bottom: 14px; }
.geo-form-label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; font-weight: 500; }
.geo-input { width: 100%; padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; box-sizing: border-box; }
.geo-input:focus { border-color: #818cf8; }
.geo-form-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #ccc; }
.geo-form-checkbox input[type="checkbox"] { width: 16px; height: 16px; accent-color: #818cf8; cursor: pointer; }

.geo-save-indicator { font-size: 12px; color: #34d399; }
</style>
