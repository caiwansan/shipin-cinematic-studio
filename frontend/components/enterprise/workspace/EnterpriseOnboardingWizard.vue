<!-- EnterpriseOnboardingWizard — 企业初始化向导 -->
<!-- Step 1-6: 创建企业 → 配置信息 → 选择AI员工 → 连接渠道 → 配置模型 → 启动 -->
<template>
  <Teleport to="body">
    <div v-if="visible" class="onboarding-overlay">
      <div class="onboarding-modal">
        <!-- Header -->
        <div class="wizard-header">
          <h2 class="wizard-title">🚀 启动您的 AI 数字部门</h2>
          <p class="wizard-subtitle">完成以下步骤，让 AI 为您的企业工作</p>
          <div class="step-indicator">
            <div
              v-for="step in steps"
              :key="step.id"
              class="step-dot"
              :class="{ active: step.id === currentStep, done: step.id < currentStep }"
            >
              <span v-if="step.id < currentStep && activationStatus?.steps?.[step.key]">✓</span>
              <span v-else>{{ step.id }}</span>
            </div>
          </div>
          <p v-if="activationStatus" class="activation-hint">
            已完成 {{ activationStatus.completedCount }}/{{ activationStatus.totalSteps }} 步骤
          </p>
        </div>

        <!-- Step Content -->
        <div class="wizard-body">
          <!-- Step 1: Enterprise Info -->
          <div v-if="currentStep === 1" class="step-content">
            <h3>企业基本信息</h3>
            <div class="form-grid">
              <div class="form-group">
                <label>企业名称 *</label>
                <input v-model="profile.name" placeholder="例如: 昆仑镜科技有限公司" />
              </div>
              <div class="form-group">
                <label>所在行业 *</label>
                <select v-model="profile.industry">
                  <option value="">请选择</option>
                  <option value="saas">SaaS / 软件开发</option>
                  <option value="ecommerce">电商 / 零售</option>
                  <option value="education">教育 / 培训</option>
                  <option value="finance">金融 / 保险</option>
                  <option value="healthcare">医疗健康</option>
                  <option value="manufacturing">制造业</option>
                  <option value="media">媒体 / 内容</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div class="form-group full-width">
                <label>主营业务简介</label>
                <textarea v-model="profile.businessSummary" placeholder="一句话描述您公司的主要业务..." rows="3" />
              </div>
              <div class="form-group full-width">
                <label>目标客户描述</label>
                <textarea v-model="profile.targetCustomer" placeholder="您的目标客户群体是谁？" rows="2" />
              </div>
              <div class="form-group">
                <label>企业官网</label>
                <input v-model="profile.website" placeholder="https://..." type="url" />
              </div>
              <div class="form-group">
                <label>所在地</label>
                <input v-model="profile.location" placeholder="例如: 上海" />
              </div>
            </div>
          </div>

          <!-- Step 2: AI Provider -->
          <div v-if="currentStep === 2" class="step-content">
            <h3>🧠 连接你的 AI 模型</h3>
            <p class="step-desc">
              昆仑镜不托管你的模型费用，你使用自己的 API Key。<br />
              支持 DeepSeek、OpenAI、Claude、通义、智谱、Kimi 等主流模型。
            </p>
            <div class="provider-grid">
              <div
                v-for="provider in supportedProviders"
                :key="provider.id"
                class="provider-card"
                :class="{ selected: selectedProvider === provider.id }"
                @click="selectedProvider = provider.id"
              >
                <span class="provider-name">{{ provider.name }}</span>
                <span class="provider-models">{{ provider.models?.slice(0, 2).join(', ') || '多模型支持' }}</span>
              </div>
            </div>
            <div v-if="selectedProvider" class="api-key-form">
              <div class="form-group">
                <label>API Key（仅存储于你的企业账户，加密保存）</label>
                <input v-model="apiKey" type="password" :placeholder="`输入 ${selectedProvider} API Key`" />
              </div>
              <div class="form-group">
                <label>选择模型</label>
                <select v-model="selectedModel">
                  <option v-for="m in selectedProviderModels" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
              <button class="btn-test" :disabled="!apiKey" @click="testConnection">🔗 测试连接</button>
              <span v-if="testResult" :class="testResult.success ? 'test-ok' : 'test-fail'">
                {{ testResult.success ? '✅ 连接成功' : '❌ ' + testResult.message }}
              </span>
            </div>
          </div>

          <!-- Step 3: AI Employee -->
          <div v-if="currentStep === 3" class="step-content">
            <h3>选择 AI 员工</h3>
            <p class="step-desc">选择您需要的数字员工类型（可多选）</p>
            <div class="employee-grid">
              <div
                v-for="emp in availableEmployees"
                :key="emp.id"
                class="employee-card"
                :class="{ selected: selectedEmployees.includes(emp.id) }"
                @click="toggleEmployee(emp.id)"
              >
                <span class="emp-icon">{{ emp.icon }}</span>
                <span class="emp-name">{{ emp.name }}</span>
                <span class="emp-desc">{{ emp.description }}</span>
              </div>
            </div>
          </div>

          <!-- Step 4: Channel -->
          <div v-if="currentStep === 4" class="step-content">
            <h3>连接渠道</h3>
            <p class="step-desc">选择您要连接的客户渠道</p>
            <div class="channel-grid">
              <div
                v-for="ch in availableChannels"
                :key="ch.id"
                class="channel-card"
                :class="{ selected: selectedChannels.includes(ch.id) }"
                @click="toggleChannel(ch.id)"
              >
                <span class="ch-icon">{{ ch.icon }}</span>
                <span class="ch-name">{{ ch.name }}</span>
              </div>
            </div>
          </div>

          <!-- Step 5: Summary -->
          <div v-if="currentStep === 5" class="step-content">
            <h3>✅ 完成初始化</h3>
            <div class="summary-list">
              <div class="summary-item">
                <span class="summary-label">企业:</span>
                <span class="summary-value">{{ profile.name || '未命名企业' }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">AI 模型:</span>
                <span class="summary-value">{{ selectedProvider ? `${selectedProvider} (${selectedModel})` : '未配置' }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">AI 员工:</span>
                <span class="summary-value">{{ selectedEmployees.length || 0 }} 个</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">渠道:</span>
                <span class="summary-value">{{ selectedChannels.length || 0 }} 个</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="wizard-footer">
          <button class="btn-prev" :disabled="currentStep === 1" @click="prevStep">← 上一步</button>
          <span class="step-counter">{{ currentStep }} / {{ steps.length }}</span>
          <button v-if="currentStep < 5" class="btn-next" @click="nextStep">下一步 →</button>
          <button v-else class="btn-finish" @click="handleComplete">🎉 启动数字部门</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps<{ visible: boolean; organizationId: string }>()
const emit = defineEmits<{ complete: [] }>()

const currentStep = ref(1)
const steps = [
  { id: 1, key: 'profile', title: '企业身份' },
  { id: 2, key: 'model', title: 'AI 大脑' },
  { id: 3, key: 'agent', title: 'AI 员工' },
  { id: 4, key: 'channel', title: '工作渠道' },
  { id: 5, key: 'done', title: '完成' },
]

// 激活状态（从 API 获取）
const activationStatus = ref<any>(null)
const loading = ref(false)
const testResult = ref<{ success: boolean; message?: string } | null>(null)

// Step 1: Profile
const profile = ref({
  name: '',
  industry: '',
  businessSummary: '',
  targetCustomer: '',
  website: '',
  location: '',
})

// Step 2: AI Provider
const selectedProvider = ref('')
const selectedModel = ref('')
const apiKey = ref('')
const supportedProviders = ref<any[]>([])

// Step 3: Employees
const selectedEmployees = ref<string[]>([])
const availableEmployees = [
  { id: 'sales', icon: '💰', name: '销售 AI', description: '客户分析、销售跟进、商机提醒' },
  { id: 'marketing', icon: '📢', name: '营销 AI', description: '内容创作、渠道投放、增长分析' },
  { id: 'support', icon: '🎧', name: '客服 AI', description: '客户问答、工单处理、售后跟进' },
  { id: 'analyst', icon: '📊', name: '分析 AI', description: '数据洞察、经营分析、趋势预测' },
]

// Step 4: Channels
const selectedChannels = ref<string[]>([])
const availableChannels = ref<any[]>([])

const selectedProviderModels = computed(() => {
  const p = supportedProviders.value.find(p => p.id === selectedProvider.value)
  return p?.models || []
})

// 根据激活状态跳到第一个未完成步骤
watch(() => props.visible, (v) => {
  if (v && activationStatus.value) {
    const s = activationStatus.value.steps
    if (!s.profile) currentStep.value = 1
    else if (!s.model) currentStep.value = 2
    else if (!s.agent) currentStep.value = 3
    else if (!s.channel) currentStep.value = 4
    else currentStep.value = 5
  }
})

function toggleEmployee(id: string) {
  const idx = selectedEmployees.value.indexOf(id)
  if (idx >= 0) selectedEmployees.value.splice(idx, 1)
  else selectedEmployees.value.push(id)
}

function toggleChannel(id: string) {
  const idx = selectedChannels.value.indexOf(id)
  if (idx >= 0) selectedChannels.value.splice(idx, 1)
  else selectedChannels.value.push(id)
}

async function nextStep() {
  if (currentStep.value < 5) currentStep.value++
}

function prevStep() {
  if (currentStep.value > 1) currentStep.value--
}

async function handleComplete() {
  loading.value = true
  try {
    // Step 1: 保存企业信息
    if (profile.value.name) {
      await fetch('/api/enterprise/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile.value),
      }).catch(() => {})
    }

    // Step 2: 保存 AI Provider
    if (selectedProvider.value && apiKey.value) {
      await fetch('/api/enterprise-foundation/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.value,
          apiKey: apiKey.value,
          model: selectedModel.value,
        }),
      }).catch(() => {})
    }

    // 通知完成
    emit('complete')
  } catch (e) {
    console.error('[Onboarding] Complete error:', e)
  } finally {
    loading.value = false
  }
}

async function loadActivationStatus() {
  try {
    const res = await fetch('/api/enterprise/agent-identity/activation/status')
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) {
        activationStatus.value = data.data
      }
    }
  } catch (e) {
    console.warn('[Onboarding] Load activation failed:', e)
  }
}

async function testConnection() {
  testResult.value = null
  try {
    const res = await fetch('/api/enterprise-foundation/ai-providers/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: selectedProvider.value,
        apiKey: apiKey.value,
        model: selectedModel.value,
      }),
    })
    const data = await res.json()
    testResult.value = { success: data.code === 0, message: data.message }
  } catch (e: any) {
    testResult.value = { success: false, message: e.message || '连接失败' }
  }
}

onMounted(async () => {
  // 加载激活状态
  await loadActivationStatus()

  // 加载支持的模型提供商
  try {
    const res = await fetch('/api/enterprise-foundation/ai-providers/supported')
    if (res.ok) {
      const data = await res.json()
      supportedProviders.value = data.data || []
    }
  } catch (e) {
    supportedProviders.value = [
      { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
      { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'] },
      { id: 'claude', name: 'Claude', models: ['claude-3-5-sonnet', 'claude-3-haiku'] },
    ]
  }

  // 加载可用渠道
  try {
    const res = await fetch('/api/enterprise/agent-identity/providers')
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) {
        availableChannels.value = data.data.map((p: any) => ({
          id: p.name,
          icon: p.icon,
          name: p.displayName,
        }))
      }
    }
  } catch (e) {
    availableChannels.value = [
      { id: 'wechat_work', icon: '💼', name: '企业微信' },
      { id: 'douyin', icon: '🎵', name: '抖音' },
      { id: 'xiaohongshu', icon: '📕', name: '小红书' },
    ]
  }
})
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.onboarding-modal {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  width: 90%;
  max-width: 680px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wizard-header {
  padding: var(--space-xl);
  border-bottom: 1px solid var(--color-border-primary);
  text-align: center;
}

.wizard-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  margin-bottom: var(--space-xs);
}

.wizard-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.step-indicator {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  transition: all 0.2s;
}

.step-dot.active {
  background: var(--color-intelligence);
  color: #000;
}

.step-dot.done {
  background: var(--color-execution);
  color: #000;
}

.wizard-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl);
}

.step-content h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.step-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-lg);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-group.full-width { grid-column: 1 / -1; }

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: var(--color-intelligence);
}

.form-group textarea { resize: vertical; }

.provider-grid,
.employee-grid,
.channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.provider-card,
.employee-card,
.channel-card {
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  text-align: center;
}

.provider-card:hover,
.employee-card:hover,
.channel-card:hover {
  border-color: var(--color-border-secondary);
}

.provider-card.selected,
.employee-card.selected,
.channel-card.selected {
  border-color: var(--color-intelligence);
  background: var(--color-intelligence-glow);
}

.provider-name,
.ch-name { font-size: var(--font-size-sm); font-weight: 600; }
.provider-models { font-size: var(--font-size-xs); color: var(--color-text-muted); }

.emp-icon,
.ch-icon { font-size: 24px; }
.emp-name { font-size: var(--font-size-sm); font-weight: 600; }
.emp-desc { font-size: var(--font-size-xs); color: var(--color-text-muted); }

.api-key-form {
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  display: grid;
  gap: var(--space-md);
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}

.summary-label { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.summary-value { font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text-secondary); }

.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-xl);
  border-top: 1px solid var(--color-border-primary);
}

.step-counter {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.test-ok { font-size: var(--font-size-xs); color: var(--color-execution); }
.test-fail { font-size: var(--font-size-xs); color: #ef4444; }

.activation-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-sm);
}

.btn-prev,
.btn-next,
.btn-finish {
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.2s;
}

.btn-prev {
  background: transparent;
  border-color: var(--color-border-primary);
  color: var(--color-text-muted);
}

.btn-prev:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.btn-prev:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-next {
  background: var(--color-intelligence);
  border-color: var(--color-intelligence);
  color: #000;
}

.btn-next:hover {
  opacity: 0.85;
}

.btn-finish {
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-execution));
  border: none;
  color: #000;
  font-weight: 600;
  padding: var(--space-md) var(--space-xl);
}

.btn-finish:hover {
  opacity: 0.85;
  transform: scale(1.02);
}
</style>
