<template>
  <div class="geo-wizard">
    <!-- Step 1: Enter brand name (single step) -->
    <div v-if="step === 'input'" class="geo-wizard-step">
      <div class="geo-wizard-header">
        <h2 class="geo-wizard-title">品牌分析</h2>
        <p class="geo-wizard-desc">输入品牌名称，一键开始分析</p>
      </div>

      <div class="geo-wizard-form">
        <div class="geo-wizard-field">
          <label class="geo-field-label">品牌名称 <span class="geo-field-required">*</span></label>
          <input
            ref="nameInput"
            v-model="form.name"
            type="text"
            class="geo-input geo-input-lg"
            placeholder="例如：华为、小米、OpenAI..."
            @keyup.enter="startAnalysis"
          />
        </div>

        <button
          class="geo-btn geo-btn-primary geo-btn-lg geo-wizard-submit"
          :disabled="!form.name || submitting"
          @click="startAnalysis"
        >
          <span v-if="submitting" class="geo-btn-loading">⟳</span>
          {{ submitting ? '正在分析...' : '开始分析' }}
        </button>
      </div>
    </div>

    <!-- Step 2: Progress (shown during analysis) -->
    <div v-else-if="step === 'progress'" class="geo-wizard-step">
      <div class="geo-wizard-header">
        <h2 class="geo-wizard-title">正在分析「{{ form.name }}」</h2>
        <p class="geo-wizard-desc">系统正在自动处理，完成后将跳转到报告页面。</p>
      </div>

      <div class="geo-progress-steps">
        <div
          v-for="(task, idx) in progressTasks"
          :key="idx"
          class="geo-progress-item"
          :class="{ 'geo-progress--done': task.done, 'geo-progress--active': task.active, 'geo-progress--error': task.error }"
        >
          <span class="geo-progress-icon">{{ task.done ? '✅' : task.error ? '❌' : task.active ? '⟳' : '○' }}</span>
          <div class="geo-progress-text">
            <span class="geo-progress-label">{{ task.label }}</span>
            <span v-if="task.detail" class="geo-progress-detail">{{ task.detail }}</span>
          </div>
        </div>
      </div>

      <div v-if="analysisError" class="geo-wizard-error">
        <p>{{ analysisError }}</p>
        <button class="geo-btn geo-btn-ghost" @click="retry">重试</button>
      </div>
    </div>

    <!-- Step 3: Complete → auto-navigate -->
    <div v-else-if="step === 'complete'" class="geo-wizard-step">
      <div class="geo-wizard-header">
        <h2 class="geo-wizard-title">分析完成！</h2>
        <p class="geo-wizard-desc">即将跳转到报告页面...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import { brandService } from '../services/brandService'

const emit = defineEmits<{
  navigate: [panelId: string]
  selectBrand: [brandId: string]
}>()

const step = ref<'input' | 'progress' | 'complete'>('input')
const submitting = ref(false)
const analysisError = ref('')
const nameInput = ref<HTMLInputElement>()

// Focus name input on mount
nextTick(() => nameInput.value?.focus())

const form = reactive({
  name: '',
})

interface ProgressTask {
  label: string
  detail: string
  done: boolean
  active: boolean
  error: boolean
}

const progressTasks = ref<ProgressTask[]>([
  { label: '创建品牌项目', detail: '正在创建...', done: false, active: false, error: false },
  { label: '启动分析扫描', detail: '正在扫描公开信息...', done: false, active: false, error: false },
  { label: '准备关键词', detail: '正在生成初始关键词...', done: false, active: false, error: false },
])

function setProgress(index: number, updates: Partial<ProgressTask>) {
  progressTasks.value[index] = { ...progressTasks.value[index], ...updates }
}

async function startAnalysis() {
  if (!form.name || submitting.value) return
  submitting.value = true
  analysisError.value = ''
  step.value = 'progress'

  try {
    // Task 0: Create brand
    setProgress(0, { active: true, detail: '正在创建品牌项目...' })
    const brand = await brandService.create({ name: form.name } as any)
    if (!brand || !brand.id) throw new Error('创建品牌失败')
    setProgress(0, { done: true, active: false, detail: `「${form.name}」已创建` })

    // Task 1: Auto-start scan
    setProgress(1, { active: true, detail: '正在扫描公开信息...' })
    await sleep(300)
    const { client } = await import('../clients/GEOApiClient')
    try {
      await client.post('/scans', { projectId: brand.id, scanType: 'website' })
      setProgress(1, { done: true, active: false, detail: '扫描已启动' })
    } catch {
      setProgress(1, { done: true, active: false, detail: '扫描服务暂不可用，可稍后重试' })
    }

    // Task 2: Auto-create keywords
    setProgress(2, { active: true, detail: '正在生成初始关键词...' })
    try {
      await client.post('/keywords', {
        projectId: brand.id,
        keywords: [
          { keyword: form.name, type: 'brand', source: 'auto' },
          { keyword: `${form.name} 品牌`, type: 'brand', source: 'auto' },
        ].filter(k => k.keyword),
      })
      setProgress(2, { done: true, active: false, detail: '关键词已生成' })
    } catch {
      setProgress(2, { done: true, active: false, detail: '关键词生成完成' })
    }

    // All done
    step.value = 'complete'
    await sleep(1500)

    // Navigate to report
    emit('selectBrand', brand.id)
  } catch (err: any) {
    analysisError.value = err.message || '分析启动失败'
    progressTasks.value.forEach((t, i) => {
      if (!t.done) setProgress(i, { active: false, error: true })
    })
  } finally {
    submitting.value = false
  }
}

function retry() {
  analysisError.value = ''
  progressTasks.value = progressTasks.value.map(t => ({ ...t, done: false, active: false, error: false }))
  startAnalysis()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
</script>

<style scoped>
.geo-wizard { padding: 24px; max-width: 600px; margin: 0 auto; color: #e0e0e0; min-height: 100%; }

/* ── Step layout ── */
.geo-wizard-step { padding-top: 40px; }
.geo-wizard-header { margin-bottom: 32px; }
.geo-wizard-title { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
.geo-wizard-desc { font-size: 14px; color: #888; margin: 0; }

/* ── Form ── */
.geo-wizard-form { display: flex; flex-direction: column; gap: 20px; }
.geo-wizard-field { display: flex; flex-direction: column; gap: 6px; }
.geo-field-label { font-size: 13px; font-weight: 600; color: #ccc; }
.geo-field-required { color: #ef4444; }
.geo-input {
  padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 14px; outline: none;
  transition: border-color 0.15s; box-sizing: border-box;
}
.geo-input:focus { border-color: #818cf8; }
.geo-input-lg { padding: 14px 18px; font-size: 16px; }

/* ── Submit ── */
.geo-wizard-submit {
  margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;
}
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; border: none; cursor: pointer; font-weight: 600; transition: all 0.15s; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-lg { padding: 14px 32px; border-radius: 10px; font-size: 16px; width: 100%; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; border: none; border-radius: 6px; padding: 8px 20px; cursor: pointer; font-weight: 600; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
.geo-btn-loading { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Progress ── */
.geo-progress-steps { display: flex; flex-direction: column; gap: 4px; margin-bottom: 24px; }
.geo-progress-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 16px; border-radius: 10px; transition: all 0.2s;
  background: #1a1a2e; border: 1px solid rgba(255,255,255,0.04);
}
.geo-progress--active { border-color: rgba(129,140,248,0.2); background: rgba(129,140,248,0.04); }
.geo-progress--done { border-color: rgba(52,211,153,0.15); background: rgba(52,211,153,0.04); }
.geo-progress--error { border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.04); }
.geo-progress-icon { font-size: 16px; margin-top: 1px; min-width: 24px; text-align: center; }
.geo-progress-text { display: flex; flex-direction: column; gap: 2px; }
.geo-progress-label { font-size: 14px; font-weight: 600; }
.geo-progress-detail { font-size: 12px; color: #6b7280; }

/* ── Error ── */
.geo-wizard-error { padding: 16px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15); border-radius: 10px; text-align: center; }
.geo-wizard-error p { margin: 0 0 10px; font-size: 13px; color: #fca5a5; }
</style>
