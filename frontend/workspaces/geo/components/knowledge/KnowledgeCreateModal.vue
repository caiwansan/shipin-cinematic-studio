<!-- KnowledgeCreateModal.vue — 创建知识对象弹窗 -->
<template>
  <Dialog
    :open="open"
    title="创建知识"
    size="lg"
    @update:open="$emit('close')"
    @close="$emit('close')"
  >
    <div class="kcm-form">
      <!-- Mode Toggle -->
      <div class="kcm-mode-toggle">
        <button
          :class="['kcm-mode-btn', { 'kcm-mode-btn--active': mode === 'manual' }]"
          @click="mode = 'manual'"
        >手动填写</button>
        <button
          :class="['kcm-mode-btn', { 'kcm-mode-btn--active': mode === 'ai' }]"
          @click="mode = 'ai'"
        >🤖 AI 智能生成</button>
      </div>

      <!-- Manual Mode -->
      <template v-if="mode === 'manual'">
        <div class="kcm-field">
          <label class="kcm-label">主题 *</label>
          <input
            v-model="form.topic"
            class="kcm-input"
            placeholder="例如：品牌介绍、产品功能、公司历史"
          />
        </div>

        <div class="kcm-field">
          <label class="kcm-label">分类</label>
          <select v-model="form.category" class="kcm-input kcm-select">
            <option value="">通用</option>
            <option value="brand">品牌信息</option>
            <option value="product">产品介绍</option>
            <option value="technology">技术说明</option>
            <option value="company">公司信息</option>
            <option value="case">案例</option>
          </select>
        </div>

        <div class="kcm-field">
          <label class="kcm-label">内容 / 描述</label>
          <textarea
            v-model="form.content"
            class="kcm-input kcm-textarea"
            rows="4"
            placeholder="输入知识描述内容..."
          ></textarea>
        </div>

        <div class="kcm-field">
          <label class="kcm-label">来源 URL（可选）</label>
          <input
            v-model="form.sourceUrl"
            class="kcm-input"
            placeholder="https://..."
          />
        </div>
      </template>

      <!-- AI Mode -->
      <template v-if="mode === 'ai'">
        <div class="kcm-ai-banner">
          <div class="kcm-ai-icon">🤖</div>
          <div class="kcm-ai-text">
            <strong>AI 智能知识生成</strong>
            <p>输入品牌名称和一句话描述，AI 将自动生成标准化的知识对象（包含实体、声明、证据、引用），格式让所有主流 AI 模型都能准确理解和引用。</p>
          </div>
        </div>

        <div class="kcm-field">
          <label class="kcm-label">品牌名称 *</label>
          <input
            v-model="aiForm.brandName"
            class="kcm-input"
            placeholder="例如：昆仑镜AI系统"
          />
        </div>

        <div class="kcm-field">
          <label class="kcm-label">行业</label>
          <input
            v-model="aiForm.industry"
            class="kcm-input"
            placeholder="例如：AI、电商、教育..."
          />
        </div>

        <div class="kcm-field">
          <label class="kcm-label">输入描述 *</label>
          <textarea
            v-model="aiForm.userInput"
            class="kcm-input kcm-textarea"
            rows="4"
            placeholder="描述品牌、产品或需要生成知识的内容，例如：&#10;昆仑镜是一款AI短剧生成系统，基于大语言模型自研剧本引擎，帮助创作者从剧本到视频一键生成"
          ></textarea>
        </div>

        <!-- AI Result Preview -->
        <div v-if="aiResult" class="kcm-ai-result">
          <div class="kcm-ai-result-header">
            <span class="kcm-ai-result-badge">✅ 已生成</span>
            <span class="kcm-ai-result-count">{{ aiResult.claimCount }} 条声明 · {{ aiResult.entityCount }} 个实体</span>
          </div>
          <div class="kcm-ai-result-entities">
            <span v-for="e in aiResult.entities" :key="e.name" class="kcm-entity-tag">
              {{ e.name }}
              <span class="kcm-entity-type">{{ e.type }}</span>
            </span>
          </div>
        </div>
      </template>

      <div v-if="error" class="kcm-error">{{ error }}</div>
    </div>

    <template #footer>
      <button class="kcm-btn kcm-btn--cancel" @click="$emit('close')">取消</button>

      <template v-if="mode === 'ai'">
        <button
          class="kcm-btn kcm-btn--secondary"
          :disabled="generating || !aiForm.userInput || !aiForm.brandName"
          @click="handleAIGenerate"
        >
          {{ generating ? '🤖 生成中...' : '🤖 AI 生成' }}
        </button>
        <button
          v-if="aiResult"
          class="kcm-btn kcm-btn--primary"
          @click="handleSaveAIResult"
        >保存到知识库</button>
      </template>

      <button
        v-if="mode === 'manual'"
        class="kcm-btn kcm-btn--primary"
        :disabled="submitting || !form.topic"
        @click="handleManualSubmit"
      >
        {{ submitting ? '创建中...' : '创建' }}
      </button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAuthStore } from '~/stores/auth'
import Dialog from '~/design-system/primitives/Dialog/index.vue'

const props = defineProps<{
  open: boolean
  projectId: string
}>()

const emit = defineEmits<{
  close: []
  created: [id: string]
}>()

const mode = ref<'manual' | 'ai'>('manual')

// Manual form
const form = reactive({
  topic: '',
  category: '',
  content: '',
  sourceUrl: '',
})

// AI form
const aiForm = reactive({
  brandName: '',
  industry: '',
  userInput: '',
})

const submitting = ref(false)
const generating = ref(false)
const error = ref('')
const aiResult = ref<{
  id: string
  topic: string
  category: string
  claimCount: number
  entityCount: number
  entities: Array<{ name: string; type: string }>
} | null>(null)

async function handleManualSubmit() {
  if (!form.topic) return
  submitting.value = true
  error.value = ''

  try {
    const token = getToken()
    const body: any = { projectId: props.projectId, topic: form.topic }
    if (form.content) body.content = form.content
    if (form.sourceUrl) {
      body.citations = [{ id: `cite-${Date.now()}`, sourceUrl: form.sourceUrl, title: form.topic }]
    }

    const res = await fetch('/api/geo/knowledge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })

    const json = await res.json()
    if (!json.success) { error.value = json.error || '创建失败'; return }

    resetForm()
    emit('created', json.data.id)
    emit('close')
  } catch (err: any) {
    error.value = err.message || '网络错误'
  } finally {
    submitting.value = false
  }
}

async function handleAIGenerate() {
  if (!aiForm.userInput || !aiForm.brandName) return
  generating.value = true
  error.value = ''

  try {
    const token = getToken()
    const res = await fetch('/api/geo/knowledge/ai-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        projectId: props.projectId,
        brandName: aiForm.brandName,
        industry: aiForm.industry || '',
        userInput: aiForm.userInput,
      }),
    })

    const json = await res.json()
    if (!json.success) {
      error.value = json.error || 'AI 生成失败'
      return
    }

    aiResult.value = json.data
  } catch (err: any) {
    error.value = err.message || '网络错误'
  } finally {
    generating.value = false
  }
}

async function handleSaveAIResult() {
  if (!aiResult.value) return
  // The AI generation already saves to DB, just emit created
  emit('created', aiResult.value.id)
  resetForm()
  emit('close')
}

function resetForm() {
  form.topic = ''; form.category = ''; form.content = ''; form.sourceUrl = ''
  aiForm.brandName = ''; aiForm.industry = ''; aiForm.userInput = ''
  aiResult.value = null
  error.value = ''
}

function getToken(): string {
  // 优先使用 auth store（Pinia 内存 → token-cache → localStorage）
  try {
    const auth = useAuthStore()
    const token = auth.getToken()
    if (token) return token
  } catch {}
  // fallback: 直接读 localStorage
  try {
    const t = window.localStorage?.getItem('auth_token')
    if (t) return t
    const cache = window.localStorage?.getItem('token-cache')
    if (cache) {
      const parsed = JSON.parse(cache)
      if (parsed?.token) return parsed.token
    }
  } catch {}
  return ''
}
</script>

<style scoped>
.kcm-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Mode Toggle */
.kcm-mode-toggle {
  display: flex;
  gap: 8px;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 4px;
}

.kcm-mode-btn {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #6b7280;
  transition: all 0.15s;
}

.kcm-mode-btn--active {
  background: #fff;
  color: #111;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* AI Banner */
.kcm-ai-banner {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
}

.kcm-ai-icon {
  font-size: 24px;
  line-height: 1;
}

.kcm-ai-text {
  font-size: 13px;
  color: #1e40af;
  line-height: 1.5;
}

.kcm-ai-text strong {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
}

.kcm-ai-text p {
  margin: 0;
}

/* Fields */
.kcm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kcm-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.kcm-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #111;
  background: #fff;
  transition: border-color 0.15s;
}

.kcm-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

.kcm-select {
  appearance: auto;
}

.kcm-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}

/* AI Result */
.kcm-ai-result {
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
}

.kcm-ai-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.kcm-ai-result-badge {
  font-size: 12px;
  font-weight: 600;
  color: #059669;
}

.kcm-ai-result-count {
  font-size: 12px;
  color: #6b7280;
}

.kcm-ai-result-entities {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.kcm-entity-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  font-size: 12px;
  color: #374151;
}

.kcm-entity-type {
  font-size: 10px;
  color: #9ca3af;
  text-transform: uppercase;
}

/* Error */
.kcm-error {
  color: #ef4444;
  font-size: 13px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
}

/* Buttons */
.kcm-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;
}

.kcm-btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.kcm-btn--primary:hover:not(:disabled) {
  background: #2563eb;
}

.kcm-btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kcm-btn--secondary {
  background: #f0f9ff;
  color: #0369a1;
  border-color: #bae6fd;
}

.kcm-btn--secondary:hover:not(:disabled) {
  background: #e0f2fe;
}

.kcm-btn--cancel {
  background: #fff;
  color: #374151;
  border-color: #d1d5db;
}

.kcm-btn--cancel:hover {
  background: #f9fafb;
}
</style>
