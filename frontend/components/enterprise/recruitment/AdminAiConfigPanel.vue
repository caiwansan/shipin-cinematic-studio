<!--
  AdminAiConfigPanel — 求职顾问 AI 配置内嵌面板
  嵌入 /admin/recruitment/index.vue，不跳转新页面
-->
<template>
  <div class="ai-config-panel">
    <!-- 展开/折叠头 -->
    <div class="ai-config-header" @click="toggle" role="button" tabindex="0">
      <div class="ai-config-header-left">
        <span class="ai-config-icon">🧠</span>
        <span class="ai-config-title">求职顾问 AI 配置</span>
        <span class="ai-config-status" :class="configStatus">{{ configStatusText }}</span>
      </div>
      <div class="ai-config-header-right">
        <span class="ai-config-collapse">{{ expanded ? '收起' : '展开' }}</span>
        <svg :class="['ai-chevron', { rotated: expanded }]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>

    <!-- 配置表单（折叠/展开） -->
    <div v-if="expanded" class="ai-config-body">
      <!-- 状态消息 -->
      <div v-if="message.text" class="ai-msg" :class="message.type">{{ message.text }}</div>

      <!-- Provider -->
      <div class="ai-field">
        <label class="ai-label">AI 供应商</label>
        <select v-model="form.provider" class="ai-select" @change="onProviderChange">
          <option value="">-- 选择供应商 --</option>
          <option v-for="p in providers" :key="p.provider" :value="p.provider">{{ p.providerName }}</option>
        </select>
      </div>

      <!-- Model -->
      <div class="ai-field">
        <label class="ai-label">模型</label>
        <select v-model="form.model" class="ai-select">
          <option value="">-- 选择模型 --</option>
          <option v-for="m in availableModels" :key="m.name" :value="m.name">{{ m.label }}</option>
        </select>
        <p v-if="!form.provider" class="ai-hint">请先选择供应商</p>
      </div>

      <!-- API Key -->
      <div class="ai-field">
        <label class="ai-label">API Key</label>
        <div class="ai-key-row">
          <input :type="showKey ? 'text' : 'password'" v-model="form.apiKey"
            :placeholder="hasApiKey ? '•••••••• 已配置，输入新值替换' : '输入 API Key'"
            class="ai-input" />
          <button class="ai-eye-btn" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁️' }}</button>
        </div>
        <p class="ai-hint">{{ hasApiKey ? '✅ 已配置密钥' : '密钥不会明文返回，仅保存时写入' }}</p>
      </div>

      <!-- 操作按钮 -->
      <div class="ai-actions">
        <button class="ai-btn" @click="testConnection" :disabled="testing">{{ testing ? '🔄 测试中...' : '🔗 测试连接' }}</button>
        <button class="ai-btn ai-btn-primary" @click="saveConfig" :disabled="saving">{{ saving ? '💾 保存中...' : '💾 保存配置' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ─── State ───
const expanded = ref(false)
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const showKey = ref(false)
const hasApiKey = ref(false)
const providers = ref<any[]>([])
const form = ref({ provider: '', model: '', apiKey: '' })
const message = ref({ text: '', type: '' })

// ─── Computed ───
const availableModels = computed(() => {
  const p = providers.value.find((x: any) => x.provider === form.value.provider)
  if (!p?.models) return []
  return p.models.filter((m: any) => m.type === 'llm').map((m: any) => ({ name: m.id, label: m.name || m.id }))
})

const configStatus = computed(() => {
  if (!form.value.provider) return 'unset'
  if (!hasApiKey.value) return 'no-key'
  return 'ok'
})

const configStatusText = computed(() => {
  if (!form.value.provider) return '未配置'
  if (!hasApiKey.value) return '缺少 API Key'
  return '已就绪'
})

// ─── Helpers ───
function token() { try { return localStorage.getItem('auth_token') || '' } catch { return '' } }

async function api(path: string, opts?: RequestInit) {
  const t = token()
  return fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    ...opts,
  }).then(r => r.json())
}

function setMsg(text: string, type: 'ok' | 'err' | '' = '') { message.value = { text, type } }

function toggle() { expanded.value = !expanded.value }

// ─── Load config ───
async function loadConfig() {
  loading.value = true
  try {
    const res = await api('/api/public/global-models')
    if (res.success && Array.isArray(res.providers)) providers.value = res.providers

    const cfg = await api('/api/admin/global-config/business-type/career_advisor')
    if (cfg.success && cfg.config) {
      form.value.provider = cfg.config.provider || ''
      form.value.model = cfg.config.model || ''
      hasApiKey.value = cfg.config.hasApiKey || false
    }
  } catch { setMsg('加载配置失败', 'err') }
  finally { loading.value = false }
}

// ─── Save ───
async function saveConfig() {
  if (!form.value.provider) { setMsg('请选择 AI 供应商', 'err'); return }
  saving.value = true
  try {
    const body: Record<string, string> = { provider: form.value.provider, model: form.value.model }
    if (form.value.apiKey) body.apiKey = form.value.apiKey
    const res = await api('/api/admin/global-config/business-type/career_advisor', { method: 'PUT', body: JSON.stringify(body) })
    if (res.success) {
      setMsg('✅ 配置保存成功', 'ok')
      hasApiKey.value = !!form.value.apiKey || hasApiKey.value
      form.value.apiKey = ''
    } else {
      setMsg(`❌ 保存失败：${res.error || '未知错误'}`, 'err')
    }
  } catch (e: any) { setMsg(`❌ 保存失败：${e.message}`, 'err') }
  finally { saving.value = false }
}

// ─── Test ───
async function testConnection() {
  testing.value = true
  try {
    const res = await api('/api/job/chat', { method: 'POST', body: JSON.stringify({ message: '你好，请用一句话介绍你自己。', userId: 'admin_test' }) })
    if (res.reply) { setMsg(`✅ 连接成功：${res.reply.slice(0, 50)}...`, 'ok') }
    else if (res.error) { setMsg(`❌ 连接失败：${res.error}`, 'err') }
    else { setMsg('✅ 连接正常（规则 fallback）', 'ok') }
  } catch (e: any) { setMsg(`❌ 连接异常：${e.message}`, 'err') }
  finally { testing.value = false }
}

function onProviderChange() { form.value.model = '' }

onMounted(loadConfig)
</script>

<style scoped>
.ai-config-panel {
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
}

.ai-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}
.ai-config-header:hover { background: var(--color-bg-hover, #1A2240); }

.ai-config-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-config-icon { font-size: 1.2rem; line-height: 1; }

.ai-config-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
}

.ai-config-status {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 20px;
}
.ai-config-status.ok { background: rgba(34,197,94,0.12); color: #22C55E; }
.ai-config-status.unset { background: rgba(148,163,184,0.1); color: #64748B; }
.ai-config-status.no-key { background: rgba(245,158,11,0.12); color: #F59E0B; }

.ai-config-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted, #64748B);
  font-size: 0.75rem;
}

.ai-chevron { transition: transform 0.2s; }
.ai-chevron.rotated { transform: rotate(180deg); }

.ai-config-body {
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid var(--color-border-primary, #1E293B);
  padding-top: 16px;
}

.ai-msg {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
}
.ai-msg.ok { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); color: #22C55E; }
.ai-msg.err { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #EF4444; }

.ai-field { display: flex; flex-direction: column; gap: 6px; }
.ai-label { font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary, #94A3B8); }
.ai-hint { margin: 0; font-size: 0.7rem; color: var(--color-text-muted, #64748B); }

.ai-select {
  background: var(--color-bg-secondary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.8rem;
  color: var(--color-text-primary, #F1F5F9);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
  font-family: inherit;
}
.ai-select:focus { border-color: rgba(59,130,246,0.5); }

.ai-input {
  flex: 1;
  background: var(--color-bg-secondary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.8rem;
  color: var(--color-text-primary, #F1F5F9);
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
}
.ai-input:focus { border-color: rgba(59,130,246,0.5); }

.ai-key-row { display: flex; gap: 8px; }
.ai-eye-btn {
  background: var(--color-bg-secondary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 0.85rem;
  transition: background 0.15s;
}
.ai-eye-btn:hover { background: var(--color-bg-hover, #1A2240); }

.ai-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.ai-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border-primary, #1E293B);
  background: var(--color-bg-elevated, #111827);
  color: var(--color-text-secondary, #94A3B8);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.ai-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #1A2240);
  color: var(--color-text-primary, #F1F5F9);
}
.ai-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ai-btn-primary {
  background: rgba(59,130,246,0.15);
  border-color: rgba(59,130,246,0.3);
  color: #60A5FA;
}
.ai-btn-primary:hover:not(:disabled) {
  background: rgba(59,130,246,0.25);
  border-color: rgba(59,130,246,0.4);
}
</style>
