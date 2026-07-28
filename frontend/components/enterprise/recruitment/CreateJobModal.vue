<!--
  CreateJobModal — UX 磨光版本
  流程: 填写信息 → AI生成JD → 预览 → 发布
-->
<template>
  <Teleport to="body">
    <Transition name="cjm-fade">
      <div v-if="visible" class="cjm-overlay" @click.self="close">
        <Transition name="cjm-scale" appear>
          <div class="cjm-modal">
            <div class="cjm-header">
              <h2 class="cjm-title">📝 创建岗位</h2>
              <button class="cjm-close" @click="close" aria-label="关闭">✕</button>
            </div>

            <!-- Step 1: 填写 -->
            <div v-if="step === 'input'" class="cjm-body">
              <div class="cjm-field">
                <label class="cjm-label">
                  职位名称 <span class="cjm-required">*</span>
                </label>
                <input
                  v-model="form.title"
                  class="cjm-input"
                  placeholder="例如：高级算法工程师"
                  maxlength="100"
                  @keyup.enter="form.title.trim() && generateJD()"
                />
              </div>
              <div class="cjm-field">
                <label class="cjm-label">职位描述</label>
                <textarea
                  v-model="form.description"
                  class="cjm-input cjm-textarea"
                  placeholder="描述岗位职责和要求，AI 将基于此生成完整 JD"
                  rows="3"
                ></textarea>
              </div>
              <div class="cjm-field">
                <label class="cjm-label">部门</label>
                <input
                  v-model="form.department"
                  class="cjm-input"
                  placeholder="例如：技术部、产品部"
                />
              </div>

              <Transition name="cjm-slide">
                <div v-if="error" class="cjm-error">{{ error }}</div>
              </Transition>

              <div class="cjm-actions">
                <button class="cjm-btn cjm-btn--cancel" @click="close">取消</button>
                <button
                  class="cjm-btn cjm-btn--primary"
                  :disabled="generating || !form.title.trim()"
                  @click="generateJD"
                >
                  <span v-if="generating" class="cjm-btn-loader"></span>
                  {{ generating ? 'AI 正在生成 JD...' : '🤖 AI 生成 JD' }}
                </button>
              </div>
            </div>

            <!-- Step 2: 预览 -->
            <div v-if="step === 'preview'" class="cjm-body">
              <div class="cjm-preview">
                <div class="cjm-preview-head">
                  <span class="cjm-preview-emoji">📄</span>
                  <div>
                    <h3 class="cjm-preview-title">{{ form.title }}</h3>
                    <span v-if="form.department" class="cjm-preview-dept">{{ form.department }}</span>
                  </div>
                </div>
                <div class="cjm-preview-body">
                  <pre class="cjm-preview-text">{{ generatedJD || '（AI 正在生成 JD，请稍后或手动编辑）' }}</pre>
                </div>
              </div>

              <Transition name="cjm-slide">
                <div v-if="error" class="cjm-error">{{ error }}</div>
              </Transition>

              <div class="cjm-actions">
                <button class="cjm-btn cjm-btn--cancel" @click="step = 'input'">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="vertical-align:-1px;margin-right:2px"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  返回修改
                </button>
                <button
                  class="cjm-btn cjm-btn--primary"
                  :disabled="publishing"
                  @click="publishJob"
                >
                  <span v-if="publishing" class="cjm-btn-loader"></span>
                  {{ publishing ? '发布中...' : '✅ 确认发布' }}
                </button>
              </div>
            </div>

            <!-- Success -->
            <div v-if="step === 'success'" class="cjm-body cjm-body--center">
              <div class="cjm-success-visual">
                <div class="cjm-success-orb">
                  <span>🎉</span>
                </div>
              </div>
              <h3 class="cjm-success-title">岗位已发布</h3>
              <p class="cjm-success-desc">
                「{{ form.title }}」已发布成功，AI 招聘团队将自动开始匹配人才
              </p>
              <div class="cjm-success-hint">
                <span>💡 你可以在招聘工作台查看候选人推荐进度</span>
              </div>
              <button class="cjm-btn cjm-btn--primary" @click="close" style="margin-top:8px">
                返回工作台
              </button>
            </div>

            <!-- Loading -->
            <Transition name="cjm-fade">
              <div v-if="generating || publishing" class="cjm-loading-overlay">
                <div class="cjm-loading">
                  <div class="cjm-loading-pulse">
                    <span class="cjm-loading-dot"></span>
                    <span class="cjm-loading-dot"></span>
                    <span class="cjm-loading-dot"></span>
                  </div>
                  <span>{{ generating ? 'AI 正在分析岗位信息，生成职位描述...' : '正在发布岗位...' }}</span>
                </div>
              </div>
            </Transition>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { getAuthToken } from '~/utils/auth/token'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'created'): void }>()

type Step = 'input' | 'preview' | 'success'
const step = ref<Step>('input')
const form = reactive({ title: '', description: '', department: '' })
const generatedJD = ref('')
const generating = ref(false)
const publishing = ref(false)
const error = ref('')

function getHeaders(): Record<string, string> {
  const token = getAuthToken() || ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function generateJD() {
  if (!form.title.trim()) return
  generating.value = true
  error.value = ''
  try {
    const res = await fetch('/api/enterprise/jobs/generate', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        department: form.department.trim() || undefined,
      }),
    })
    if (!res.ok) throw new Error(`JD 生成失败 (${res.status})`)
    const json = await res.json()
    generatedJD.value = json.data?.jd || json.data?.content || json.content || ''
    step.value = 'preview'
  } catch (e: any) {
    error.value = e.message || '生成 JD 失败'
    step.value = 'preview'
  } finally {
    generating.value = false
  }
}

async function publishJob() {
  publishing.value = true
  error.value = ''
  try {
    const res = await fetch('/api/enterprise/postings', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title: form.title.trim(),
        description: generatedJD.value || form.description.trim(),
        department: form.department.trim() || undefined,
      }),
    })
    if (!res.ok) throw new Error(`发布失败 (${res.status})`)
    step.value = 'success'
  } catch (e: any) {
    error.value = e.message || '发布失败'
  } finally {
    publishing.value = false
  }
}

function close() {
  if (generating.value || publishing.value) return
  step.value = 'input'
  form.title = ''
  form.description = ''
  form.department = ''
  generatedJD.value = ''
  error.value = ''
  emit('close')
  if (step.value === 'success') emit('created')
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════
   Overlay & Modal
   ═══════════════════════════════════════════════════ */
.cjm-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.cjm-modal {
  background: #fff;
  border-radius: 14px;
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.18);
  position: relative;
  overflow: hidden;
}

.cjm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 24px 0;
}

.cjm-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #1a1a1a;
}

.cjm-close {
  width: 30px; height: 30px;
  border: none;
  background: #f3f4f6;
  border-radius: 50%;
  font-size: 13px;
  cursor: pointer;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}
.cjm-close:hover { background: #e5e7eb; }

/* ═══════════════════════════════════════════════════
   Form
   ═══════════════════════════════════════════════════ */
.cjm-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cjm-body--center {
  align-items: center;
  text-align: center;
  gap: 10px;
}

.cjm-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cjm-label {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
}

.cjm-required { color: #ef4444; }

.cjm-input {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
  background: #fff;
}
.cjm-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
}

.cjm-textarea {
  resize: vertical;
  min-height: 72px;
  font-family: inherit;
  line-height: 1.5;
}

.cjm-error {
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 12px;
  color: #dc2626;
}

/* ═══════════════════════════════════════════════════
   Actions & Buttons
   ═══════════════════════════════════════════════════ */
.cjm-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 4px;
}

.cjm-btn {
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.12s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cjm-btn--primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
}
.cjm-btn--primary:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(37,99,235,0.3);
  transform: translateY(-1px);
}
.cjm-btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cjm-btn--cancel {
  background: #f3f4f6;
  color: #6b7280;
}
.cjm-btn--cancel:hover { background: #e5e7eb; }

.cjm-btn-loader {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: cjm-spin 0.7s linear infinite;
}

@keyframes cjm-spin { to { transform: rotate(360deg); } }

/* ═══════════════════════════════════════════════════
   Preview
   ═══════════════════════════════════════════════════ */
.cjm-preview {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
}

.cjm-preview-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.cjm-preview-emoji { font-size: 1.3rem; }

.cjm-preview-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1a1a1a;
}

.cjm-preview-dept {
  font-size: 11px;
  color: #6b7280;
}

.cjm-preview-body {
  max-height: 280px;
  overflow-y: auto;
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
}

.cjm-preview-text {
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  white-space: pre-wrap;
  font-family: inherit;
  margin: 0;
}

/* ═══════════════════════════════════════════════════
   Success
   ═══════════════════════════════════════════════════ */
.cjm-success-visual {
  margin-bottom: 4px;
}

.cjm-success-orb {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, rgba(34,197,94,0.12), rgba(34,197,94,0.04));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin: 0 auto;
}

.cjm-success-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #1a1a1a;
}

.cjm-success-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  max-width: 360px;
  line-height: 1.5;
}

.cjm-success-hint {
  font-size: 12px;
  color: #9ca3af;
  background: #f9fafb;
  padding: 8px 14px;
  border-radius: 8px;
  margin-top: 4px;
}

/* ═══════════════════════════════════════════════════
   Loading Overlay
   ═══════════════════════════════════════════════════ */
.cjm-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.cjm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #6b7280;
}

.cjm-loading-pulse {
  display: flex;
  gap: 6px;
}

.cjm-loading-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #2563eb;
  animation: cjm-dot 1.4s ease-in-out infinite both;
}
.cjm-loading-dot:nth-child(1) { animation-delay: -0.32s; }
.cjm-loading-dot:nth-child(2) { animation-delay: -0.16s; }
.cjm-loading-dot:nth-child(3) { animation-delay: 0s; }

@keyframes cjm-dot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}

/* ═══════════════════════════════════════════════════
   Transitions
   ═══════════════════════════════════════════════════ */
.cjm-fade-enter-active,
.cjm-fade-leave-active { transition: opacity 0.2s ease; }
.cjm-fade-enter-from,
.cjm-fade-leave-to { opacity: 0; }

.cjm-scale-enter-active { transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), opacity 0.15s ease; }
.cjm-scale-leave-active { transition: transform 0.12s ease, opacity 0.1s ease; }
.cjm-scale-enter-from { transform: scale(0.96); opacity: 0; }
.cjm-scale-leave-to { transform: scale(0.96); opacity: 0; }

.cjm-slide-enter-active,
.cjm-slide-leave-active { transition: all 0.15s ease; }
.cjm-slide-enter-from,
.cjm-slide-leave-to { opacity: 0; transform: translateY(-4px); }

/* ═══════════════════════════════════════════════════
   Mobile
   ═══════════════════════════════════════════════════ */
@media (max-width: 520px) {
  .cjm-modal {
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>
