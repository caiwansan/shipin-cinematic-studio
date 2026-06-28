<template>
  <Teleport to="body">
    <div class="fre-wizard-overlay" v-if="visible" @click.self="handleSkip">
      <div class="fre-wizard-card">
        <!-- 进度条 -->
        <div class="fre-wizard-progress">
          <div class="fre-progress-track">
            <div
              class="fre-progress-fill"
              :style="{ width: progressPercent + '%' }"
            />
          </div>
          <span class="fre-progress-label">{{ currentStep + 1 }} / {{ totalSteps }}</span>
        </div>

        <!-- Step 内容 -->
        <transition name="fre-slide" mode="out-in">
          <!-- Step 1: Welcome -->
          <div v-if="currentStep === 0" key="welcome" class="fre-step">
            <div class="fre-step-icon">🚀</div>
            <h2 class="fre-step-title">欢迎使用昆仑镜</h2>
            <p class="fre-step-desc">
              要开始使用 AI 创作，你只需要配置一个 AI Provider。
              昆仑镜本身不提供 API Key，你需要使用自己的 Provider 账户。
            </p>
            <div class="fre-step-features">
              <div class="fre-feature-item">🤖 AI 编剧</div>
              <div class="fre-feature-item">🎨 图片生成</div>
              <div class="fre-feature-item">🎬 视频创作</div>
              <div class="fre-feature-item">🔊 语音合成</div>
            </div>
            <p class="fre-step-hint">整个过程只需 2 分钟，<strong>立即开始</strong>。</p>
            <button class="fre-btn fre-btn-primary" @click="nextStep">
              开始配置 →
            </button>
            <button class="fre-btn fre-btn-ghost" @click="handleSkip">
              稍后再说
            </button>
          </div>

          <!-- Step 2: Choose Provider -->
          <div v-if="currentStep === 1" key="choose" class="fre-step">
            <h2 class="fre-step-title">选择你的 Provider</h2>
            <p class="fre-step-desc">选择一个 AI 服务商开始使用。所有 Provider 均从平台注册表动态加载。</p>

            <div v-if="loading.providers" class="fre-loading">加载 Provider 列表...</div>

            <div v-else class="fre-provider-grid">
              <div
                v-for="p in providerList"
                :key="p.id"
                class="fre-provider-card"
                :class="{ selected: selectedProvider?.id === p.id }"
                @click="selectProvider(p)"
              >
                <div class="fre-provider-icon">{{ getProviderEmoji(p.id) }}</div>
                <div class="fre-provider-name">{{ p.name }}</div>
                <div class="fre-provider-caps">
                  {{ p.models?.length || 0 }} 模型 · {{ formatCapabilities(p) }}
                </div>
                <div v-if="p.id === 'volcengine'" class="fre-provider-badge">推荐</div>
              </div>
            </div>

            <div class="fre-step-actions">
              <button class="fre-btn fre-btn-secondary" @click="prevStep">← 上一步</button>
              <button
                class="fre-btn fre-btn-primary"
                :disabled="!selectedProvider"
                @click="nextStep"
              >
                下一步 →
              </button>
            </div>
          </div>

          <!-- Step 3: Configure -->
          <div v-if="currentStep === 2" key="configure" class="fre-step">
            <h2 class="fre-step-title">配置 {{ selectedProvider?.name }}</h2>
            <p class="fre-step-desc">填写 API Key，即可开始使用。</p>

            <div class="fre-config-form">
              <label class="fre-field">
                <span class="fre-field-label">API Key <em>*必填</em></span>
                <div class="fre-field-input-row">
                  <input
                    v-model="form.apiKey"
                    :type="showKey ? 'text' : 'password'"
                    class="fre-input"
                    placeholder="sk-..."
                    @input="formError = ''"
                  />
                  <button class="fre-btn-icon" @click="showKey = !showKey">
                    {{ showKey ? '🙈' : '👁️' }}
                  </button>
                </div>
                <a
                  v-if="selectedProvider?.docsUrl"
                  :href="selectedProvider.docsUrl"
                  target="_blank"
                  class="fre-field-help"
                >
                  🔗 如何获取 API Key？
                </a>
              </label>

              <!-- 高级设置（折叠） -->
              <div class="fre-advanced-toggle" @click="showAdvanced = !showAdvanced">
                {{ showAdvanced ? '收起高级设置 ▲' : '展开高级设置 ▼' }}
              </div>

              <div v-if="showAdvanced" class="fre-advanced-section">
                <label class="fre-field">
                  <span class="fre-field-label">Base URL（可选）</span>
                  <input
                    v-model="form.baseURL"
                    class="fre-input"
                    :placeholder="selectedProvider?.baseURL || 'https://...'"
                  />
                </label>

                <label class="fre-field">
                  <span class="fre-field-label">默认模型（可选）</span>
                  <select v-model="form.model" class="fre-input fre-select">
                    <option value="">自动选择</option>
                    <option
                      v-for="m in selectedProvider?.models || []"
                      :key="m.id"
                      :value="m.id"
                    >
                      {{ m.id }}{{ m.defaultForCapability ? ' (默认)' : '' }}
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <div class="fre-step-actions">
              <button class="fre-btn fre-btn-secondary" @click="prevStep">← 上一步</button>
              <button
                class="fre-btn fre-btn-primary"
                :disabled="!form.apiKey.trim() || loading.verify"
                @click="handleVerify"
              >
                {{ loading.verify ? '验证中...' : '验证连接' }}
              </button>
            </div>
          </div>

          <!-- Step 4: Verify Result -->
          <div v-if="currentStep === 3" key="verify" class="fre-step">
            <h2 class="fre-step-title">连接验证</h2>

            <div v-if="verifyResult === null" class="fre-loading">正在验证...</div>

            <div v-else class="fre-verify-result">
              <!-- 成功 -->
              <div v-if="verifyResult?.success" class="fre-verify-success">
                <div class="fre-verify-icon">✅</div>
                <h3>已连接</h3>
                <div class="fre-verify-stats">
                  <div class="fre-stat-item">
                    <span class="fre-stat-label">延迟</span>
                    <span class="fre-stat-value">{{ verifyResult.latency }}ms</span>
                  </div>
                  <div class="fre-stat-item">
                    <span class="fre-stat-label">能力</span>
                    <span class="fre-stat-value">{{ (verifyResult.capabilities || []).join(', ') }}</span>
                  </div>
                  <div class="fre-stat-item">
                    <span class="fre-stat-label">默认模型</span>
                    <span class="fre-stat-value">{{ verifyResult.defaultModel || '自动' }}</span>
                  </div>
                  <div v-if="verifyResult.availableModels?.length" class="fre-stat-item">
                    <span class="fre-stat-label">可用模型</span>
                    <span class="fre-stat-value fre-stat-models">{{ verifyResult.availableModels.slice(0, 5).join(', ') }}{{ verifyResult.availableModels.length > 5 ? '...' : '' }}</span>
                  </div>
                </div>
              </div>

              <!-- 失败 -->
              <div v-else class="fre-verify-fail">
                <div class="fre-verify-icon">❌</div>
                <h3>连接失败</h3>
                <p class="fre-error-message">{{ friendlyError(verifyResult) }}</p>
                <div class="fre-error-detail">
                  <code>{{ verifyResult?.errorCode }}</code>
                </div>
              </div>
            </div>

            <div class="fre-step-actions">
              <button v-if="!verifyResult?.success" class="fre-btn fre-btn-secondary" @click="goToStep(2)">
                ← 返回修改
              </button>
              <button v-if="verifyResult?.success" class="fre-btn fre-btn-primary" @click="handleConnect">
                {{ loading.save ? '保存中...' : '保存配置 →' }}
              </button>
            </div>
          </div>

          <!-- Step 5: Save & First Success -->
          <div v-if="currentStep === 4" key="save" class="fre-step">
            <div v-if="saveError" class="fre-save-error">
              <h3>保存失败</h3>
              <p>{{ saveError }}</p>
              <button class="fre-btn fre-btn-secondary" @click="prevStep">← 重试</button>
            </div>

            <div v-else-if="saveSuccess && !firstGenerationComplete" class="fre-step">
              <div class="fre-step-icon">🎉</div>
              <h2 class="fre-step-title">配置成功！</h2>
              <p class="fre-step-desc">现在试试第一次 AI 调用吧。点击下方按钮，AI 会立即回复一条消息。</p>
              <div class="fre-first-gen-area">
                <button
                  class="fre-btn fre-btn-primary fre-btn-large"
                  :disabled="loading.firstGen"
                  @click="handleFirstGeneration"
                >
                  {{ loading.firstGen ? '正在生成...' : '🚀 发送第一条消息' }}
                </button>
                <p class="fre-first-gen-hint">AI 将用一句话介绍杭州，检验连接是否真正可用。</p>
              </div>

              <div v-if="firstGenerationResult" class="fre-first-gen-result">
                <div class="fre-gen-label">AI 回复：</div>
                <div class="fre-gen-content">{{ firstGenerationResult }}</div>
              </div>
            </div>

            <div v-else class="fre-step fre-success-complete">
              <div class="fre-step-icon">🌟</div>
              <h2 class="fre-step-title">全部完成！</h2>

              <div class="fre-completion-score">
                <div class="fre-score-check">✅ Provider 已连接</div>
                <div class="fre-score-check">✅ 配置已保存</div>
                <div class="fre-score-check">✅ 首次 AI 调用成功</div>
              </div>

              <p class="fre-step-desc">你现在可以在昆仑镜中使用所有 AI 功能了。</p>

              <button class="fre-btn fre-btn-primary fre-btn-large" @click="handleComplete">
                进入工作台 →
              </button>
            </div>
          </div>
        </transition>

        <!-- 底部跳过 -->
        <div v-if="currentStep < 4" class="fre-wizard-footer">
          <span class="fre-footer-link" @click="handleSkip">跳过配置</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ProviderMetadata, VerifyResponse } from '~/utils/provider-api'
import { listProviders, verifyProvider, connectProvider, sendFreEvent } from '~/utils/provider-api'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  complete: []
  skip: []
}>()

// 内部状态
const currentStep = ref(0)
const totalSteps = 5 // Welcome(0) → Choose(1) → Configure(2) → Verify(3) → Save&FirstGen(4)
const showKey = ref(false)
const showAdvanced = ref(false)
const providerList = ref<ProviderMetadata[]>([])
const selectedProvider = ref<ProviderMetadata | null>(null)
const verifyResult = ref<VerifyResponse | null>(null)
const saveSuccess = ref(false)
const saveError = ref('')
const firstGenerationComplete = ref(false)
const firstGenerationResult = ref('')
const loading = ref({ providers: false, verify: false, save: false, firstGen: false })
const formError = ref('')
const form = ref({ apiKey: '', baseURL: '', model: '' })

const progressPercent = computed(() => {
  if (firstGenerationComplete.value && saveSuccess.value) return 100
  return ((currentStep.value + 1) / totalSteps) * 100
})

function getProviderEmoji(id: string): string {
  const map: Record<string, string> = {
    deepseek: '🧠',
    volcengine: '🌋',
    aliyun: '☁️',
    siliconflow: '💧',
    openai: '🤖',
  }
  return map[id] || '🔌'
}

function formatCapabilities(p: ProviderMetadata): string {
  const caps = new Set<string>()
  p.models?.forEach(m => m.capabilities?.forEach(c => caps.add(c)))
  const labels: Record<string, string> = { llm: '对话', image: '图片', video: '视频', tts: '语音', music: '音乐' }
  return [...caps].map(c => labels[c] || c).join(' · ')
}

function friendlyError(r: VerifyResponse | null): string {
  if (!r) return '未知错误'
  const map: Record<string, string> = {
    MISSING_PROVIDER: '未选择 AI 服务商',
    MISSING_API_KEY: '请填写 API Key',
    UNKNOWN_PROVIDER: '不支持的 AI 服务商',
    TIMEOUT: '连接超时，请检查网络或 baseURL 是否正确',
    VERIFY_FAILED: '验证失败，请检查 API Key 是否正确',
  }
  return map[r.errorCode || ''] || r.errorMessage || '连接失败，请检查配置'
}

function selectProvider(p: ProviderMetadata) {
  selectedProvider.value = p
  form.value.baseURL = p.baseURL || ''
  form.value.model = ''
  form.value.apiKey = ''
  verifyResult.value = null
}

function nextStep() {
  if (currentStep.value < totalSteps - 1) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function goToStep(step: number) {
  currentStep.value = step
}

async function handleVerify() {
  if (!form.value.apiKey.trim()) {
    formError.value = '请填写 API Key'
    return
  }
  if (!selectedProvider.value) return

  loading.value.verify = true
  verifyResult.value = null
  try {
    const result = await verifyProvider({
      provider: selectedProvider.value.id,
      apiKey: form.value.apiKey,
      baseURL: form.value.baseURL || undefined,
      model: form.value.model || undefined,
    })
    verifyResult.value = result
    sendFreEvent('verification_result', selectedProvider.value.id, { success: result.success })
    currentStep.value = 3 // 跳转到验证结果页
  } catch (err: any) {
    verifyResult.value = {
      success: false,
      latency: 0,
      provider: selectedProvider.value.id,
      availableModels: [],
      capabilities: [],
      defaultModel: '',
      errorCode: 'VERIFY_FAILED',
      errorMessage: err.message,
    }
  } finally {
    loading.value.verify = false
  }
}

async function handleConnect() {
  if (!selectedProvider.value || !verifyResult.value?.success) return

  loading.value.save = true
  try {
    const result = await connectProvider({
      provider: selectedProvider.value.id,
      apiKey: form.value.apiKey,
      model: form.value.model || undefined,
      baseURL: form.value.baseURL || undefined,
      taskType: (verifyResult.value.capabilities || [])[0] || undefined,
    })
    saveSuccess.value = true
    sendFreEvent('configuration_saved', selectedProvider.value.id)
    currentStep.value = 4
  } catch (err: any) {
    saveError.value = err.message
  } finally {
    loading.value.save = false
  }
}

async function handleFirstGeneration() {
  loading.value.firstGen = true
  try {
    // 触发一次最小的 AI 调用
    const res = await fetch('/api/tasks/ai-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
      body: JSON.stringify({
        taskType: 'llm',
        prompt: '用一句话介绍杭州，不超过20个字',
        model: verifyResult.value?.defaultModel || undefined,
        config: { temperature: 0.7, maxTokens: 50 },
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || data.message || `HTTP ${res.status}`)
    }

    const data = await res.json()
    firstGenerationResult.value = data.content || data.result || data.text || '调用成功，但未收到回复内容'

    firstGenerationComplete.value = true
    sendFreEvent('first_ai_success', selectedProvider.value?.id)
  } catch (err: any) {
    firstGenerationResult.value = `调用失败：${err.message}`
    // 即使失败也不阻塞完成流程，用户可稍后重试
    firstGenerationComplete.value = true
  } finally {
    loading.value.firstGen = false
  }
}

function handleComplete() {
  sendFreEvent('wizard_completed', selectedProvider.value?.id)
  emit('complete')
}

function handleSkip() {
  sendFreEvent('wizard_skipped')
  emit('skip')
}

onMounted(async () => {
  loading.value.providers = true
  try {
    providerList.value = await listProviders()
    sendFreEvent('wizard_started')
  } catch (err: any) {
    console.error('Failed to load providers:', err)
  } finally {
    loading.value.providers = false
  }
})
</script>

<style scoped>
/* 覆盖层 */
.fre-wizard-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fre-wizard-card {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 560px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  padding: 32px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  color: #e0e0e0;
}

/* 进度条 */
.fre-wizard-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.fre-progress-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.fre-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  border-radius: 2px;
  transition: width 0.4s ease;
}

.fre-progress-label {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

/* Step */
.fre-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-height: 300px;
}

.fre-step-icon {
  font-size: 48px;
  line-height: 1;
}

.fre-step-title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  text-align: center;
}

.fre-step-desc {
  font-size: 14px;
  color: #aaa;
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

.fre-step-features {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.fre-feature-item {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
}

.fre-step-hint {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.fre-step-hint strong {
  color: #a5b4fc;
}

/* Provider Grid */
.fre-provider-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
}

.fre-provider-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.fre-provider-card:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

.fre-provider-card.selected {
  background: rgba(99, 102, 241, 0.15);
  border-color: #6366f1;
  box-shadow: 0 0 0 1px #6366f1;
}

.fre-provider-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.fre-provider-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.fre-provider-caps {
  font-size: 11px;
  color: #888;
}

.fre-provider-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #6366f1;
  color: #fff;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
}

/* 表单 */
.fre-config-form {
  width: 100%;
  max-width: 400px;
}

.fre-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.fre-field-label {
  font-size: 13px;
  color: #ccc;
}

.fre-field-label em {
  color: #f87171;
  font-style: normal;
  font-size: 11px;
}

.fre-field-input-row {
  display: flex;
  gap: 8px;
}

.fre-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 14px;
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.fre-input:focus {
  border-color: #6366f1;
}

.fre-select {
  cursor: pointer;
}

.fre-select option {
  background: #1a1a2e;
  color: #e0e0e0;
}

.fre-btn-icon {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 16px;
}

.fre-field-help {
  font-size: 12px;
  color: #6366f1;
  text-decoration: none;
}

.fre-field-help:hover {
  text-decoration: underline;
}

/* 高级设置 */
.fre-advanced-toggle {
  font-size: 12px;
  color: #888;
  cursor: pointer;
  text-align: center;
  padding: 8px;
  user-select: none;
}

.fre-advanced-toggle:hover {
  color: #a5b4fc;
}

.fre-advanced-section {
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 12px;
}

/* 验证结果 */
.fre-loading {
  color: #888;
  font-size: 14px;
  padding: 24px;
}

.fre-verify-result {
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.fre-verify-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.fre-verify-success h3,
.fre-verify-fail h3 {
  color: #fff;
  font-size: 18px;
  margin: 0 0 16px;
}

.fre-verify-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 16px;
}

.fre-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fre-stat-label {
  color: #888;
  font-size: 13px;
}

.fre-stat-value {
  color: #e0e0e0;
  font-size: 13px;
  font-weight: 500;
}

.fre-stat-models {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fre-verify-fail .fre-verify-icon {
  font-size: 48px;
}

.fre-error-message {
  color: #f87171;
  font-size: 14px;
  margin: 8px 0;
}

.fre-error-detail {
  margin-top: 8px;
}

.fre-error-detail code {
  font-size: 11px;
  color: #666;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
}

/* 首次生成 */
.fre-first-gen-area {
  width: 100%;
  text-align: center;
}

.fre-first-gen-hint {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.fre-first-gen-result {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 16px;
  text-align: left;
}

.fre-gen-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.fre-gen-content {
  font-size: 14px;
  color: #e0e0e0;
  line-height: 1.6;
}

/* 完成页面 */
.fre-completion-score {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.fre-score-check {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  color: #4ade80;
}

.fre-save-error {
  text-align: center;
}

.fre-save-error h3 {
  color: #f87171;
}

.fre-save-error p {
  color: #aaa;
  font-size: 14px;
}

/* Buttons */
.fre-step-actions {
  display: flex;
  gap: 12px;
  width: 100%;
  justify-content: center;
  margin-top: 8px;
}

.fre-btn {
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.fre-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.fre-btn-primary {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
}

.fre-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.fre-btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: #ccc;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.fre-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.fre-btn-ghost {
  background: transparent;
  color: #888;
}

.fre-btn-ghost:hover {
  color: #ccc;
}

.fre-btn-large {
  padding: 14px 32px;
  font-size: 16px;
}

.fre-success-complete .fre-btn-large {
  margin-top: 8px;
}

/* 底部 */
.fre-wizard-footer {
  text-align: center;
  margin-top: 20px;
}

.fre-footer-link {
  font-size: 12px;
  color: #666;
  cursor: pointer;
}

.fre-footer-link:hover {
  color: #888;
}

/* 动画 */
.fre-slide-enter-active,
.fre-slide-leave-active {
  transition: all 0.25s ease;
}

.fre-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fre-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
