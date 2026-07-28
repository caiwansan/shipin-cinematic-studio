<!--
  AiModelSettings.vue — 统一 AI 模型设置组件
  Sprint-07A.2-AI-03: 统一个人模型设置中心

  功能：管理所有能力的 LLM 配置（hdz/career/ppt/music/novel）
  数据：UserModelConfigV2.capabilityLlmConfigs (JSONB)
  API：/api/capability/llm/config/:capability
-->
<template>
  <div class="ai-model-settings">
    <div class="ams-header">
      <h2 class="ams-title">🤖 AI 模型设置</h2>
      <p class="ams-desc">为你的各项 AI 能力配置独立的模型 API Key</p>
    </div>

    <!-- 能力列表 -->
    <div class="ams-capabilities">
      <div
        v-for="cap in capabilities"
        :key="cap.key"
        class="ams-cap-card"
        :class="{ 'ams-cap-active': activeCap === cap.key }"
      >
        <!-- 能力头部 -->
        <div class="ams-cap-header" @click="toggleCap(cap.key)">
          <div class="ams-cap-left">
            <span class="ams-cap-icon">{{ cap.icon }}</span>
            <div>
              <span class="ams-cap-label">{{ cap.label }}</span>
              <span class="ams-cap-desc">{{ cap.desc }}</span>
            </div>
          </div>
          <div class="ams-cap-right">
            <span v-if="getCapConfig(cap.key)?.hasApiKey" class="ams-badge ams-badge-ok">已配置</span>
            <span v-else class="ams-badge ams-badge-warn">未配置</span>
            <span class="ams-arrow" :class="{ 'ams-arrow-open': activeCap === cap.key }">▼</span>
          </div>
        </div>

        <!-- 能力配置展开区 -->
        <div v-if="activeCap === cap.key" class="ams-cap-body">
          <!-- 已配置状态 -->
          <div v-if="getCapConfig(cap.key)?.hasApiKey && !editing[cap.key]" class="ams-configured">
            <div class="ams-provider-row">
              <span class="ams-provider-icon">{{ providerEmoji[getCapConfig(cap.key)?.provider] || '🔮' }}</span>
              <div class="ams-provider-info">
                <span class="ams-provider-name">{{ getCapConfig(cap.key)?.providerName }}</span>
                <span class="ams-provider-model">{{ getCapConfig(cap.key)?.model }}</span>
              </div>
            </div>
            <div class="ams-actions">
              <button class="ams-btn ams-btn-edit" @click="startEdit(cap.key)">✏️ 修改</button>
              <button class="ams-btn ams-btn-remove" @click="removeConfig(cap.key)">🗑️ 移除</button>
            </div>
          </div>

          <!-- 编辑/新增状态 -->
          <div v-else class="ams-edit">
            <div class="ams-field">
              <label class="ams-label">供应商</label>
              <select v-model="forms[cap.key].provider" @change="onProviderChange(cap.key)" class="ams-select">
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="volcengine">火山引擎（豆包）</option>
                <option value="aliyun">阿里百炼（通义）</option>
                <option value="qwen">通义千问</option>
                <option value="moonshot">Moonshot（Kimi）</option>
                <option value="zhipu">智谱（GLM）</option>
              </select>
            </div>
            <div class="ams-field">
              <label class="ams-label">模型名称</label>
              <input v-model="forms[cap.key].model" class="ams-input" :placeholder="modelPlaceholder(cap.key)" />
            </div>
            <div class="ams-field">
              <label class="ams-label">API Key</label>
              <input v-model="forms[cap.key].apiKey" type="password" class="ams-input" placeholder="sk-xxxxxxxxxxxxxxxx" />
            </div>
            <div class="ams-field">
              <label class="ams-label">Base URL（可选）</label>
              <input v-model="forms[cap.key].baseUrl" class="ams-input" placeholder="https://api.deepseek.com" />
            </div>
            <div class="ams-actions">
              <button class="ams-btn ams-btn-save" @click="saveConfig(cap.key)" :disabled="saving[cap.key]">
                {{ saving[cap.key] ? '保存中...' : '💾 保存' }}
              </button>
              <button v-if="editing[cap.key]" class="ams-btn ams-btn-cancel" @click="cancelEdit(cap.key)">取消</button>
            </div>
            <div v-if="msg[cap.key]" class="ams-msg" :class="msgErr[cap.key] ? 'ams-msg-err' : 'ams-msg-ok'">{{ msg[cap.key] }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="ams-tip">
      💡 每个能力独立配置 API Key，互不干扰。Key 将加密存储在昆仑镜服务器。
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, reactive, onMounted } from 'vue'

const capabilities = [
  { key: 'hdz', icon: '🎬', label: '短剧创作', desc: 'AI短剧策划、剧本、分镜' },
  { key: 'career_agent', icon: '🎯', label: '职业助理', desc: 'AI职业助理、简历优化、岗位推荐' },
  { key: 'ppt', icon: '📊', label: 'PPT制作', desc: 'AI演示文稿、商业汇报' },
  { key: 'music', icon: '🎵', label: '音乐创作', desc: 'AI音乐创作、作曲编曲' },
  { key: 'novel', icon: '📖', label: '小说创作', desc: 'AI小说生成、世界观' },
]

const activeCap = ref('career')
const allConfigs = ref<Record<string, any>>({})
const editing = reactive<Record<string, boolean>>({})
const saving = reactive<Record<string, boolean>>({})
const msg = reactive<Record<string, string>>({})
const msgErr = reactive<Record<string, boolean>>({})

const forms = reactive<Record<string, any>>({})

// 初始化 forms
for (const cap of capabilities) {
  editing[cap.key] = false
  saving[cap.key] = false
  msg[cap.key] = ''
  msgErr[cap.key] = false
  forms[cap.key] = {
    provider: 'deepseek',
    model: '',
    apiKey: '',
    baseUrl: '',
  }
}

const providerEmoji: Record<string, string> = {
  deepseek: '🐋',
  openai: '🟢',
  volcengine: '🔮',
  aliyun: '☁️',
  qwen: '🌐',
  moonshot: '🌙',
  zhipu: '🧠',
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken() || ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function getCapConfig(capKey: string) {
  return allConfigs.value[capKey] || null
}

function modelPlaceholder(capKey: string): string {
  const provider = forms[capKey]?.provider || 'deepseek'
  const map: Record<string, string> = {
    deepseek: 'deepseek-v4-flash',
    openai: 'gpt-4o',
    volcengine: 'doubao-seed-1-6',
    aliyun: 'qwen-plus',
    qwen: 'qwen-plus',
    moonshot: 'moonshot-v1-auto',
    zhipu: 'glm-4-flash',
  }
  return map[provider] || '输入模型名称'
}

function toggleCap(capKey: string) {
  activeCap.value = activeCap.value === capKey ? '' : capKey
}

function startEdit(capKey: string) {
  editing[capKey] = true
  const config = getCapConfig(capKey)
  if (config) {
    forms[capKey].provider = config.provider
    forms[capKey].model = config.model
    forms[capKey].baseUrl = config.baseUrl || ''
    forms[capKey].apiKey = ''
  }
}

function cancelEdit(capKey: string) {
  editing[capKey] = false
  msg[capKey] = ''
}

async function loadAllConfigs() {
  try {
    const res = await fetch('/api/capability/llm/config', { headers: getAuthHeaders() })
    const d = await res.json()
    if (d.success && d.configs) {
      allConfigs.value = d.configs
      // 初始化未编辑状态
      for (const cap of capabilities) {
        const cfg = d.configs[cap.key]
        if (cfg && !editing[cap.key]) {
          forms[cap.key].provider = cfg.provider
          forms[cap.key].model = cfg.model
          forms[cap.key].baseUrl = cfg.baseUrl || ''
        }
      }
    }
  } catch {
    /* ignore */
  }
}

function onProviderChange(capKey: string) {
  const urls: Record<string, string> = {
    deepseek: 'https://api.deepseek.com',
    openai: 'https://api.openai.com/v1',
    volcengine: 'https://open.volcengineapi.com',
    aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    moonshot: 'https://api.moonshot.cn/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  }
  if (!forms[capKey].baseUrl) {
    forms[capKey].baseUrl = urls[forms[capKey].provider] || ''
  }
}

async function saveConfig(capKey: string) {
  if (!forms[capKey].provider || !forms[capKey].model || !forms[capKey].apiKey) {
    msg[capKey] = '请填写供应商、模型名称和 API Key'
    msgErr[capKey] = true
    return
  }
  saving[capKey] = true
  msg[capKey] = ''
  try {
    const res = await fetch(`/api/capability/llm/config/${capKey}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        provider: forms[capKey].provider,
        model: forms[capKey].model,
        apiKey: forms[capKey].apiKey,
        baseUrl: forms[capKey].baseUrl,
      }),
    })
    const d = await res.json()
    if (d.success) {
      msg[capKey] = '✅ 配置已保存'
      msgErr[capKey] = false
      editing[capKey] = false
      await loadAllConfigs()
    } else {
      msg[capKey] = '❌ ' + (d.error || '保存失败')
      msgErr[capKey] = true
    }
  } catch (e: any) {
    msg[capKey] = '❌ ' + e.message
    msgErr[capKey] = true
  }
  saving[capKey] = false
  setTimeout(() => { msg[capKey] = '' }, 3000)
}

async function removeConfig(capKey: string) {
  if (!confirm('确定移除该能力的 AI 模型配置？')) return
  try {
    const res = await fetch(`/api/capability/llm/config/${capKey}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const d = await res.json()
    if (d.success) {
      editing[capKey] = false
      forms[capKey].apiKey = ''
      await loadAllConfigs()
    }
  } catch { /* ignore */ }
}

onMounted(() => {
  loadAllConfigs()
})
</script>

<style scoped>
.ai-model-settings {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
}

.ams-header {
  margin-bottom: 24px;
}

.ams-title {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 4px;
}

.ams-desc {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  margin: 0;
}

.ams-capabilities {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ams-cap-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.ams-cap-card:hover {
  border-color: rgba(255,255,255,0.15);
}

.ams-cap-active {
  border-color: rgba(99, 102, 241, 0.4);
}

.ams-cap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  user-select: none;
}

.ams-cap-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ams-cap-icon {
  font-size: 24px;
}

.ams-cap-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.ams-cap-desc {
  display: block;
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 2px;
}

.ams-cap-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ams-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.ams-badge-ok {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.ams-badge-warn {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.ams-arrow {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  transition: transform 0.2s;
}

.ams-arrow-open {
  transform: rotate(180deg);
}

.ams-cap-body {
  padding: 0 20px 20px;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 16px;
}

.ams-configured {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ams-provider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ams-provider-icon {
  font-size: 20px;
}

.ams-provider-info {
  display: flex;
  flex-direction: column;
}

.ams-provider-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.ams-provider-model {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
}

.ams-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ams-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ams-label {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  font-weight: 500;
}

.ams-select,
.ams-input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #fff;
  outline: none;
  transition: border-color 0.2s;
}

.ams-select:focus,
.ams-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
}

.ams-select option {
  background: #1a1a2e;
  color: #fff;
}

.ams-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.ams-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.ams-btn-save {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.ams-btn-save:hover {
  background: rgba(99, 102, 241, 0.3);
}

.ams-btn-edit {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.1);
}

.ams-btn-edit:hover {
  background: rgba(255,255,255,0.1);
}

.ams-btn-remove {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.ams-btn-remove:hover {
  background: rgba(239, 68, 68, 0.2);
}

.ams-btn-cancel {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5);
  border: 1px solid rgba(255,255,255,0.1);
}

.ams-btn-cancel:hover {
  background: rgba(255,255,255,0.1);
}

.ams-msg {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
}

.ams-msg-ok {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.ams-msg-err {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.ams-tip {
  margin-top: 20px;
  padding: 12px 16px;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 8px;
  font-size: 12px;
  color: rgba(255,255,255,0.5);
}
</style>
