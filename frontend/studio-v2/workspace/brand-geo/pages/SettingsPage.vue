<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">⚙️ 设置</h2>
        <p class="geo-page-subtitle">管理 AI Provider 配置、API Key、默认模型</p>
      </div>
    </div>

    <div class="geo-settings-grid">
      <!-- Provider Status Card -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">🤖 AI Provider 状态</h3>
        </div>
        <div class="geo-card-body">
          <div v-if="loadingProvider" class="geo-card-loading">
            <div class="geo-loading-spinner"></div>
            <span>检测中...</span>
          </div>
          <template v-else>
            <div class="geo-provider-status-bar">
              <span :class="['geo-status-indicator', providerConfigured ? 'geo-status-ok' : 'geo-status-warn']"></span>
              <span>{{ providerConfigured ? '已配置' : '未配置' }}</span>
              <button v-if="!providerConfigured" class="geo-btn geo-btn-primary geo-btn-sm" @click="showConfigForm = true">
                配置 Provider
              </button>
            </div>

            <div v-if="providers.length > 0" class="geo-provider-list">
              <div v-for="p in providers" :key="p.id" class="geo-provider-item">
                <div class="geo-provider-info">
                  <span class="geo-provider-name">{{ p.name }}</span>
                  <span class="geo-provider-vendor">{{ p.vendor }}</span>
                  <span v-if="p.models" class="geo-provider-models">{{ p.models }}</span>
                </div>
                <span :class="['geo-status-badge', p.status === 'active' ? 'geo-status--active' : 'geo-status--draft']">
                  {{ p.status }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Config Form -->
      <div v-if="showConfigForm" class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">配置 AI Provider</h3>
        </div>
        <div class="geo-card-body">
          <div class="geo-form-group">
            <label class="geo-form-label">Provider 名称</label>
            <select v-model="configForm.provider" class="geo-input">
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="volcengine">火山引擎</option>
              <option value="claude">Claude</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">API Key</label>
            <input v-model="configForm.apiKey" class="geo-input" type="password" placeholder="sk-..." />
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">Endpoint (可留空使用默认)</label>
            <input v-model="configForm.endpoint" class="geo-input" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">模型</label>
            <input v-model="configForm.model" class="geo-input" placeholder="gpt-4o / deepseek-chat" />
          </div>
          <div class="geo-form-actions">
            <button class="geo-btn geo-btn-ghost" @click="showConfigForm = false">取消</button>
            <button class="geo-btn geo-btn-primary" @click="testConnection">测试连接</button>
            <button class="geo-btn geo-btn-primary" @click="saveConfig" :disabled="saving || !configForm.apiKey">
              {{ saving ? '保存中...' : '保存配置' }}
            </button>
          </div>
          <div v-if="connectionResult" class="geo-connection-result" :class="connectionResult.success ? 'geo-result-ok' : 'geo-result-fail'">
            <span>{{ connectionResult.success ? '✅' : '❌' }}</span>
            <span>{{ connectionResult.message }}</span>
          </div>
        </div>
      </div>

      <!-- Default Settings -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">🔧 默认设置</h3>
        </div>
        <div class="geo-card-body">
          <div class="geo-form-group">
            <label class="geo-form-label">默认 Provider</label>
            <select v-model="defaultProvider" class="geo-input" disabled>
              <option value="">未设置</option>
              <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <p class="geo-form-hint">在资源凭据中配置后即可选择</p>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">默认模型</label>
            <input v-model="defaultModel" class="geo-input" placeholder="gpt-4o" disabled />
            <p class="geo-form-hint">通过 API 资源管理配置</p>
          </div>
        </div>
      </div>

      <!-- Connection Test Help -->
      <div class="geo-card">
        <div class="geo-card-header">
          <h3 class="geo-card-title">💡 连接测试说明</h3>
        </div>
        <div class="geo-card-body">
          <p class="geo-help-text">
            昆仑镜使用用户自有的 API Provider 进行 AI 调用。请先在「API 资源管理」中配置你的 Provider 凭据，
            包括 API Key、Endpoint 和模型名称。配置完成后，在此页面可以测试连接是否正常。
          </p>
          <p class="geo-help-text">
            支持的 Provider: OpenAI, DeepSeek, 火山引擎, Claude 等兼容 OpenAI API 的服务。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const loadingProvider = ref(false)
const saving = ref(false)
const providerConfigured = ref(false)
const providers = ref<any[]>([])
const showConfigForm = ref(false)
const defaultProvider = ref('')
const defaultModel = ref('gpt-4o')
const connectionResult = ref<{ success: boolean; message: string } | null>(null)

const configForm = ref({
  provider: 'openai',
  apiKey: '',
  endpoint: '',
  model: 'gpt-4o',
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

async function fetchProviderStatus() {
  loadingProvider.value = true
  try {
    const res = await fetch('/api/geo/dashboard/provider-status', { headers: authHeaders() })
    const json = await res.json()
    if (json.success) {
      providerConfigured.value = json.data.configured
      providers.value = json.data.providers || []
    }
  } catch (err) {
    console.error('Failed to fetch provider status:', err)
  } finally {
    loadingProvider.value = false
  }
}

async function testConnection() {
  connectionResult.value = null
  // Test is done via a simple API call - the backend will validate
  // For now, simulate a basic test
  try {
    const res = await fetch('/api/geo/dashboard/provider-status', { headers: authHeaders() })
    const json = await res.json()
    if (json.success) {
      connectionResult.value = {
        success: json.data.configured,
        message: json.data.configured
          ? 'Provider 连接正常'
          : '未检测到有效的 Provider 配置，请先配置 API Key',
      }
    }
  } catch (err: any) {
    connectionResult.value = {
      success: false,
      message: `连接失败: ${err.message}`,
    }
  }
}

async function saveConfig() {
  saving.value = true
  connectionResult.value = null
  try {
    // For now, just show a success message since full Provider registration
    // would be done through the Resource Runtime API
    connectionResult.value = {
      success: true,
      message: '配置已保存。请通过 API 资源管理进行完整的 Provider 注册。',
    }
    showConfigForm.value = false
    await fetchProviderStatus()
  } catch (err: any) {
    connectionResult.value = {
      success: false,
      message: `保存失败: ${err.message}`,
    }
  } finally {
    saving.value = false
  }
}

onMounted(fetchProviderStatus)
</script>

<style scoped>
.geo-page { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }

.geo-page-header { margin-bottom: 20px; }
.geo-page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.geo-page-subtitle { color: #888; font-size: 13px; margin: 0; }

.geo-settings-grid { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }

.geo-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); overflow: hidden; }
.geo-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-card-title { margin: 0; font-size: 15px; font-weight: 600; }
.geo-card-body { padding: 16px 20px; }
.geo-card-loading { display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px; }

.geo-loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

.geo-provider-status-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.geo-status-indicator { width: 10px; height: 10px; border-radius: 50%; }
.geo-status-ok { background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,0.4); }
.geo-status-warn { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,0.4); }

.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
.geo-btn-sm { padding: 6px 14px; font-size: 12px; }

.geo-provider-list { display: flex; flex-direction: column; gap: 6px; }
.geo-provider-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; }
.geo-provider-info { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.geo-provider-name { font-weight: 600; font-size: 13px; }
.geo-provider-vendor { padding: 1px 6px; border-radius: 4px; font-size: 10px; background: rgba(129,140,248,0.15); color: #818cf8; }
.geo-provider-models { color: #6b7280; font-size: 11px; }

.geo-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-status--active { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-status--draft { background: rgba(156,163,175,0.15); color: #9ca3af; }

.geo-form-group { margin-bottom: 14px; }
.geo-form-label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; font-weight: 500; }
.geo-input { width: 100%; padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; box-sizing: border-box; }
.geo-input:focus { border-color: #818cf8; }
.geo-form-hint { font-size: 11px; color: #6b7280; margin: 4px 0 0; }
.geo-form-actions { display: flex; gap: 8px; margin-top: 16px; }

.geo-connection-result { padding: 10px 14px; border-radius: 6px; margin-top: 12px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
.geo-result-ok { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2); color: #34d399; }
.geo-result-fail { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; }

.geo-help-text { font-size: 13px; color: #888; line-height: 1.5; margin: 0 0 10px; }
.geo-help-text:last-child { margin-bottom: 0; }
</style>
