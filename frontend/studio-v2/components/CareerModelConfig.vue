<!--
  CareerModelConfig.vue — Career Agent BYOK 配置面板
  Sprint-06A: 用户配置个人 AI 模型 API Key

  位置：求职管家工作台
  功能：配置 UserModelConfigV2（DeepSeek / OpenAI / 通义 / 豆包）
  调用链：UserModelConfigV2 → resolveRuntimeConfig(userId) → executeViaGateway
-->
<template>
  <div class="career-model-config">
    <!-- 折叠触发条 -->
    <div class="cmc-trigger" @click="expanded = !expanded">
      <div class="cmc-trigger-left">
        <span class="cmc-icon">🤖</span>
        <span class="cmc-title">AI 职业助理</span>
        <span v-if="!hasConfig" class="cmc-badge cmc-badge-warn">未配置模型</span>
        <span v-else class="cmc-badge cmc-badge-ok">已配置</span>
      </div>
      <span class="cmc-arrow" :class="{ 'cmc-arrow-open': expanded }">▼</span>
    </div>

    <!-- 展开内容 -->
    <div v-if="expanded" class="cmc-body">
      <p class="cmc-desc">配置你的 AI 模型 API Key，Career Agent 将使用你的 Key 提供个性化职业服务</p>

      <!-- 已配置状态 -->
      <div v-if="hasConfig && !editing" class="cmc-configured">
        <div class="cmc-provider-row">
          <span class="cmc-provider-icon">{{ providerEmoji[config.provider] || '🔮' }}</span>
          <div class="cmc-provider-info">
            <span class="cmc-provider-name">{{ config.providerName }}</span>
            <span class="cmc-provider-model">{{ config.model }}</span>
          </div>
        </div>
        <div class="cmc-actions">
          <button class="cmc-btn cmc-btn-edit" @click="startEdit">✏️ 修改</button>
          <button class="cmc-btn cmc-btn-remove" @click="removeConfig">🗑️ 移除</button>
        </div>
      </div>

      <!-- 编辑/新增状态 -->
      <div v-else class="cmc-edit">
        <div class="cmc-field">
          <label class="cmc-label">供应商</label>
          <select v-model="form.provider" @change="onProviderChange" class="cmc-select">
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="volcengine">火山引擎（豆包）</option>
            <option value="aliyun">阿里百炼（通义）</option>
            <option value="qwen">通义千问</option>
            <option value="moonshot">Moonshot（Kimi）</option>
            <option value="zhipu">智谱（GLM）</option>
          </select>
        </div>
        <div class="cmc-field">
          <label class="cmc-label">模型名称</label>
          <input v-model="form.model" class="cmc-input" :placeholder="modelPlaceholder" />
        </div>
        <div class="cmc-field">
          <label class="cmc-label">API Key</label>
          <input v-model="form.apiKey" type="password" class="cmc-input" placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
        <div class="cmc-field">
          <label class="cmc-label">Base URL（可选）</label>
          <input v-model="form.baseUrl" class="cmc-input" placeholder="https://api.deepseek.com" />
        </div>
        <div class="cmc-field">
          <label class="cmc-label">最大 Token</label>
          <input v-model.number="form.maxTokens" type="number" class="cmc-input" placeholder="16384" />
        </div>
        <div class="cmc-actions">
          <button class="cmc-btn cmc-btn-save" @click="saveConfig" :disabled="saving">
            {{ saving ? '保存中...' : '💾 保存' }}
          </button>
          <button v-if="hasConfig" class="cmc-btn cmc-btn-cancel" @click="cancelEdit">取消</button>
        </div>
        <div v-if="msg" class="cmc-msg" :class="msgErr ? 'cmc-msg-err' : 'cmc-msg-ok'">{{ msg }}</div>
      </div>

      <!-- 提示 -->
      <div class="cmc-tip">
        💡 你的 API Key 将加密存储，仅用于你的个人 AI 职业助理
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, reactive, onMounted, computed } from 'vue'

const expanded = ref(false)
const hasConfig = ref(false)
const editing = ref(false)
const saving = ref(false)
const msg = ref('')
const msgErr = ref(false)

const config = ref({
  provider: 'deepseek',
  providerName: 'DeepSeek',
  model: '',
  baseUrl: '',
  maxTokens: 16384,
})

const form = reactive({
  provider: 'deepseek',
  model: '',
  apiKey: '',
  baseUrl: '',
  maxTokens: 16384,
})

const providerEmoji: Record<string, string> = {
  deepseek: '🐋',
  openai: '🟢',
  volcengine: '🔮',
  aliyun: '☁️',
  qwen: '🌐',
  moonshot: '🌙',
  zhipu: '🧠',
}

const modelPlaceholder = computed(() => {
  const map: Record<string, string> = {
    deepseek: 'deepseek-v4-flash',
    openai: 'gpt-4o',
    volcengine: 'doubao-seed-1-6',
    aliyun: 'qwen-plus',
    qwen: 'qwen-plus',
    moonshot: 'moonshot-v1-auto',
    zhipu: 'glm-4-flash',
  }
  return map[form.provider] || '输入模型名称'
})

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken() || ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/career/llm/config', { headers: getAuthHeaders() })
    const d = await res.json()
    if (d.success && d.config) {
      hasConfig.value = true
      config.value = d.config
      form.provider = d.config.provider
      form.model = d.config.model
      form.baseUrl = d.config.baseUrl || ''
      form.maxTokens = d.config.maxTokens || 16384
      form.apiKey = ''
    } else {
      hasConfig.value = false
    }
  } catch {
    hasConfig.value = false
  }
}

function startEdit() {
  editing.value = true
  form.apiKey = ''
}

function cancelEdit() {
  editing.value = false
  msg.value = ''
}

async function saveConfig() {
  if (!form.provider || !form.model || !form.apiKey) {
    msg.value = '请填写供应商、模型名称和 API Key'
    msgErr.value = true
    return
  }
  saving.value = true
  msg.value = ''
  try {
    const res = await fetch('/api/career/llm/config', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        provider: form.provider,
        model: form.model,
        apiKey: form.apiKey,
        baseUrl: form.baseUrl,
        maxTokens: form.maxTokens,
      }),
    })
    const d = await res.json()
    if (d.success) {
      msg.value = '✅ 配置已保存'
      msgErr.value = false
      editing.value = false
      await loadConfig()
    } else {
      msg.value = '❌ ' + (d.error || '保存失败')
      msgErr.value = true
    }
  } catch (e: any) {
    msg.value = '❌ ' + e.message
    msgErr.value = true
  }
  saving.value = false
  setTimeout(() => { msg.value = '' }, 3000)
}

async function removeConfig() {
  if (!confirm('确定移除 AI 模型配置？Career Agent 将无法使用。')) return
  try {
    const res = await fetch('/api/career/llm/config', {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const d = await res.json()
    if (d.success) {
      hasConfig.value = false
      editing.value = false
      form.apiKey = ''
    }
  } catch { /* ignore */ }
}

function onProviderChange() {
  // 自动填充 Base URL
  const urls: Record<string, string> = {
    deepseek: 'https://api.deepseek.com',
    openai: 'https://api.openai.com/v1',
    volcengine: 'https://open.volcengineapi.com',
    aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    moonshot: 'https://api.moonshot.cn/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  }
  if (!form.baseUrl) {
    form.baseUrl = urls[form.provider] || ''
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.career-model-config {
  background: linear-gradient(135deg, #0d1117 0%, #111827 100%);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  margin: 0 16px 12px;
  flex-shrink: 0;
}

.cmc-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  user-select: none;
}

.cmc-trigger:hover {
  background: rgba(255,255,255,0.02);
}

.cmc-trigger-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cmc-icon { font-size: 1.1rem; }

.cmc-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
}

.cmc-badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.cmc-badge-warn {
  background: rgba(245,158,11,0.1);
  color: #f59e0b;
}

.cmc-badge-ok {
  background: rgba(74,222,128,0.1);
  color: #4ade80;
}

.cmc-arrow {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.3);
  transition: transform 0.2s;
}

.cmc-arrow-open {
  transform: rotate(180deg);
}

.cmc-body {
  padding: 0 16px 12px;
}

.cmc-desc {
  margin: 0 0 10px;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.4);
}

.cmc-configured {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
}

.cmc-provider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cmc-provider-icon { font-size: 1.2rem; }

.cmc-provider-info {
  display: flex;
  flex-direction: column;
}

.cmc-provider-name {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.8);
}

.cmc-provider-model {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.4);
}

.cmc-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cmc-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cmc-label {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.5);
}

.cmc-select,
.cmc-input {
  padding: 6px 10px;
  font-size: 0.78rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: rgba(255,255,255,0.85);
  outline: none;
  transition: border-color 0.15s;
}

.cmc-select:focus,
.cmc-input:focus {
  border-color: rgba(201,168,108,0.4);
}

.cmc-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.cmc-btn {
  padding: 6px 14px;
  font-size: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.cmc-btn-save {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  font-weight: 600;
}

.cmc-btn-save:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(201,168,108,0.3);
}

.cmc-btn-edit {
  background: rgba(96,165,250,0.1);
  color: #60a5fa;
}

.cmc-btn-remove {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
}

.cmc-btn-cancel {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
}

.cmc-tip {
  margin-top: 10px;
  padding: 8px 10px;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.02);
  border-radius: 6px;
  border-left: 3px solid rgba(201,168,108,0.3);
}

.cmc-msg {
  font-size: 0.72rem;
  padding: 4px 0;
}

.cmc-msg-ok { color: #4ade80; }
.cmc-msg-err { color: #ef4444; }
</style>
