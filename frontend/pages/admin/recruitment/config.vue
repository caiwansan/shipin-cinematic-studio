<!--
  Admin: 🧠 求职顾问 AI 配置
  位置：/admin/recruitment/config.vue
  职责：管理求职顾问（公共 AI Agent）的模型/Provider/API Key

  复用：
  - GET  /api/admin/global-config/business-type/career_advisor → 读取当前配置
  - PUT  /api/admin/global-config/business-type/career_advisor → 保存配置
  - GET  /api/public/global-models → 获取 Provider + Model 列表

  设计原则：
  - 不使用 UserModelConfigV2（那是用户 BYOK）
  - 不走环境变量（那是基础设施配置）
  - 存储到 route_config + ApiKey（平台运营配置）
  - 求职顾问 = 公共 AI Agent，不属于用户资产
-->
<template>
  <RecruitmentPageShell>
    <template #title>🧠 求职顾问 AI 配置</template>
    <template #subtitle>配置求职顾问（公共 AI 获客 Agent）使用的模型与 API Key</template>
    <template #actions>
      <button class="rec-btn" @click="testConnection" :disabled="testing">
        {{ testing ? '🔄 测试中...' : '🔗 测试连接' }}
      </button>
      <button class="rec-btn rec-btn-primary" @click="saveConfig" :disabled="saving">
        {{ saving ? '💾 保存中...' : '💾 保存配置' }}
      </button>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-spinner"></div>
      <span>加载配置中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rec-error">
      <span>⚠️ {{ error }}</span>
      <button class="rec-link" @click="loadConfig">重试</button>
    </div>

    <!-- Config Form -->
    <div v-else class="rec-config-form">
      <!-- 服务说明卡片 -->
      <div class="rec-info-card">
        <div class="rec-info-icon">🧠</div>
        <div class="rec-info-content">
          <h3>求职顾问 = 平台公共 AI 获客 Agent</h3>
          <ul>
            <li>✅ 所有登录用户可使用</li>
            <li>✅ 使用平台购买的大模型额度，不需要用户 Key</li>
            <li>✅ 管理员控制成本</li>
            <li>✅ 不创建 Hermes Instance，不属于用户资产</li>
            <li>🪞 镜心（私人 AI 职业伙伴）不受影响</li>
            <li>🏢 企业招聘 AI 员工不受影响</li>
          </ul>
        </div>
      </div>

      <!-- Provider 选择 -->
      <div class="rec-field">
        <label class="rec-field-label">AI 供应商</label>
        <p class="rec-field-desc">选择求职顾问对话使用的 AI 供应商</p>
        <select v-model="form.provider" class="rec-select" @change="onProviderChange">
          <option value="">-- 选择供应商 --</option>
          <option v-for="p in providers" :key="p.provider" :value="p.provider">
            {{ p.providerName }}
          </option>
        </select>
      </div>

      <!-- 模型选择 -->
      <div class="rec-field">
        <label class="rec-field-label">模型</label>
        <p class="rec-field-desc">选择用于求职顾问对话的语言模型</p>
        <select v-model="form.model" class="rec-select">
          <option value="">-- 选择模型 --</option>
          <option v-for="m in availableModels" :key="m.name" :value="m.name">
            {{ m.label }}
          </option>
        </select>
        <div v-if="!form.provider" class="rec-field-hint">请先选择供应商</div>
      </div>

      <!-- API Key -->
      <div class="rec-field">
        <label class="rec-field-label">API Key</label>
        <p class="rec-field-desc">该供应商的 API 访问密钥</p>
        <div class="rec-key-input">
          <input
            :type="showKey ? 'text' : 'password'"
            v-model="form.apiKey"
            :placeholder="hasApiKey ? '•••••••••••••••• 已配置密钥，输入新值替换' : '输入 API Key'"
            class="rec-input"
          />
          <button class="rec-key-toggle" @click="showKey = !showKey" :title="showKey ? '隐藏' : '显示'">
            {{ showKey ? '🙈' : '👁️' }}
          </button>
        </div>
        <div class="rec-field-hint">
          {{ hasApiKey ? '✅ 已配置 API Key（输入新值将覆盖）' : '密钥不会明文返回，仅保存时写入' }}
        </div>
      </div>

      <!-- 测试结果 -->
      <div v-if="testResult" class="rec-test-result" :class="testOk ? 'rec-test-ok' : 'rec-test-fail'">
        <span>{{ testOk ? '✅' : '❌' }}</span>
        <span>{{ testResult }}</span>
      </div>

      <!-- Save feedback -->
      <div v-if="saveMessage" class="rec-save-msg" :class="saveOk ? 'rec-save-ok' : 'rec-save-fail'">
        {{ saveMessage }}
      </div>
    </div>
  </RecruitmentPageShell>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted } from 'vue'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'

// ─── State ───
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const testing = ref(false)
const showKey = ref(false)
const hasApiKey = ref(false)

const providers = ref<any[]>([])
const form = ref({ provider: '', model: '', apiKey: '' })

const testResult = ref('')
const testOk = ref(false)
const saveMessage = ref('')
const saveOk = ref(false)

// ─── Computed ───
const availableModels = computed(() => {
  const prov = providers.value.find((p: any) => p.provider === form.value.provider)
  if (!prov?.models) return []
  // LLM 类型模型
  return prov.models
    .filter((m: any) => m.type === 'llm')
    .map((m: any) => ({ name: m.id, label: m.name || m.id }))
})

// ─── API Token ───
function getToken(): string {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

async function fetchApi(path: string, options?: RequestInit) {
  const token = getToken()
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options,
  })
  return res.json()
}

// ─── 加载配置 ───
async function loadConfig() {
  loading.value = true
  error.value = ''
  try {
    // 1. 获取 Provider + Model 列表
    const providersRes = await fetchApi('/api/public/global-models')
    if (providersRes.success && Array.isArray(providersRes.providers)) {
      providers.value = providersRes.providers
    } else {
      throw new Error('获取供应商列表失败')
    }

    // 2. 获取当前职业顾问配置
    const configRes = await fetchApi('/api/admin/global-config/business-type/career_advisor')
    if (configRes.success && configRes.config) {
      form.value.provider = configRes.config.provider || ''
      form.value.model = configRes.config.model || ''
      hasApiKey.value = configRes.config.hasApiKey || false
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ─── 保存配置 ───
async function saveConfig() {
  saving.value = true
  saveMessage.value = ''
  try {
    if (!form.value.provider) {
      saveMessage.value = '请选择 AI 供应商'
      saveOk.value = false
      return
    }

    const body: Record<string, string> = {
      provider: form.value.provider,
      model: form.value.model,
    }
    if (form.value.apiKey) {
      body.apiKey = form.value.apiKey
    }

    const res = await fetchApi('/api/admin/global-config/business-type/career_advisor', {
      method: 'PUT',
      body: JSON.stringify(body),
    })

    if (res.success) {
      saveMessage.value = '✅ 配置保存成功'
      saveOk.value = true
      hasApiKey.value = !!form.value.apiKey || hasApiKey.value
      form.value.apiKey = '' // 清除 Key 输入（已保存）
    } else {
      saveMessage.value = `❌ 保存失败: ${res.error || '未知错误'}`
      saveOk.value = false
    }
  } catch (e: any) {
    saveMessage.value = `❌ 保存失败: ${e.message}`
    saveOk.value = false
  } finally {
    saving.value = false
  }
}

// ─── 测试连接 ───
async function testConnection() {
  testing.value = true
  testResult.value = ''
  try {
    // 构造测试消息，通过求职顾问 API 验证连通性
    const res = await fetchApi('/api/job/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: '你好，请用一句话介绍你自己。',
        userId: 'admin_test',
      }),
    })

    if (res.reply) {
      testResult.value = `连接成功 ✅ 回复：${res.reply.slice(0, 60)}...`
      testOk.value = true
    } else if (res.error) {
      testResult.value = `连接失败：${res.error}`
      testOk.value = false
    } else {
      testResult.value = '连接正常（使用规则引擎 fallback）'
      testOk.value = true
    }
  } catch (e: any) {
    testResult.value = `连接异常：${e.message}`
    testOk.value = false
  } finally {
    testing.value = false
  }
}

// ─── Provider 切换 ───
function onProviderChange() {
  form.value.model = '' // 重置模型选择
}

// ─── 初始化 ───
onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.rec-config-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 680px;
}

.rec-info-card {
  display: flex;
  gap: 16px;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 12px;
  padding: 20px;
}

.rec-info-icon {
  font-size: 2rem;
  line-height: 1;
}

.rec-info-content h3 {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 8px 0;
}

.rec-info-content ul {
  margin: 0;
  padding: 0 0 0 18px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.8;
}

.rec-info-content li {
  list-style: none;
}

.rec-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rec-field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.rec-field-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.rec-field-hint {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
}

.rec-select {
  background: rgba(13, 19, 40, 0.8);
  border: 1px solid rgba(26, 34, 64, 0.8);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
  font-family: inherit;
}

.rec-select:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

.rec-input {
  flex: 1;
  background: rgba(13, 19, 40, 0.8);
  border: 1px solid rgba(26, 34, 64, 0.8);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.rec-input:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

.rec-key-input {
  display: flex;
  gap: 8px;
}

.rec-key-toggle {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.rec-key-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}

.rec-test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.8rem;
}

.rec-test-ok {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: rgba(34, 197, 94, 0.9);
}

.rec-test-fail {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: rgba(239, 68, 68, 0.9);
}

.rec-save-msg {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.8rem;
}

.rec-save-ok {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: rgba(34, 197, 94, 0.9);
}

.rec-save-fail {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: rgba(239, 68, 68, 0.9);
}

.rec-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
}

.rec-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: rgba(59, 130, 246, 0.6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rec-error {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: rgba(239, 68, 68, 0.9);
  font-size: 0.85rem;
}

.rec-link {
  background: none;
  border: none;
  color: rgba(59, 130, 246, 0.8);
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.8rem;
  font-family: inherit;
}

/* Reuse existing recruitment button styles */
.rec-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.rec-btn:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
}

.rec-btn-primary {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: rgba(59, 130, 246, 0.9);
}

.rec-btn-primary:hover {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.4);
}
</style>
