<template>
  <div class="onboarding-page">
    <!-- Top Nav -->
    <div class="onboarding-top-nav">
      <button @click="goToHome" class="onb-nav-btn" title="返回昆仑镜首页">
        ← 返回首页
      </button>
      <div class="onb-brand">昆仑镜 · 企业认证</div>
    </div>

    <div class="onboarding-content">
      <!-- Progress Steps -->
      <div class="onb-steps">
        <div
          v-for="step in totalSteps"
          :key="step"
          class="onb-step"
          :class="{
            active: step === currentStep,
            done: step < currentStep,
          }"
        >
          <div class="onb-step-dot">{{ step < currentStep ? '✓' : step }}</div>
          <span class="onb-step-label">{{ stepLabels[step - 1] }}</span>
        </div>
      </div>

      <!-- Step 1: 企业信息 -->
      <div v-if="currentStep === 1" class="onb-card">
        <h2>创建企业身份</h2>
        <p class="onb-desc">填写企业基本信息，开启 AI 招聘能力</p>
        <div class="onb-form">
          <label class="onb-label">企业名称 <span class="onb-required">*</span></label>
          <input
            v-model="form.companyName"
            class="onb-input"
            placeholder="例：上海昆仑镜科技有限公司"
          />

          <label class="onb-label">所属行业 <span class="onb-required">*</span></label>
          <select v-model="form.industry" class="onb-input">
            <option value="">请选择行业</option>
            <option value="互联网/IT">互联网/IT</option>
            <option value="金融">金融</option>
            <option value="教育">教育</option>
            <option value="医疗">医疗</option>
            <option value="制造业">制造业</option>
            <option value="零售/电商">零售/电商</option>
            <option value="文化娱乐">文化娱乐</option>
            <option value="其他">其他</option>
          </select>

          <label class="onb-label">企业规模 <span class="onb-required">*</span></label>
          <select v-model="form.scale" class="onb-input">
            <option value="">请选择规模</option>
            <option value="1-10人">1-10人</option>
            <option value="11-50人">11-50人</option>
            <option value="51-200人">51-200人</option>
            <option value="201-500人">201-500人</option>
            <option value="500人以上">500人以上</option>
          </select>

          <label class="onb-label">企业网站</label>
          <input
            v-model="form.website"
            class="onb-input"
            placeholder="https://example.com（选填）"
          />

          <label class="onb-label">企业简介</label>
          <textarea
            v-model="form.description"
            class="onb-input onb-textarea"
            placeholder="简要描述企业业务和招聘需求（选填）"
            rows="3"
          />
        </div>
        <button
          @click="submitStep1"
          class="onb-btn-primary"
          :disabled="!isStep1Valid || submitting"
        >
          {{ submitting ? '提交中...' : '下一步' }}
        </button>
      </div>

      <!-- Step 2: 招聘需求 -->
      <div v-else-if="currentStep === 2" class="onb-card">
        <h2>招聘需求</h2>
        <p class="onb-desc">告诉我们您的招聘需求，AI 将为您定制方案</p>
        <div class="onb-form">
          <label class="onb-label">目标招聘岗位 <span class="onb-required">*</span></label>
          <div class="onb-tags">
            <span
              v-for="pos in commonPositions"
              :key="pos"
              class="onb-tag"
              :class="{ selected: form.targetPositions.includes(pos) }"
              @click="togglePosition(pos)"
            >
              {{ pos }}
            </span>
          </div>
          <input
            v-model="customPosition"
            class="onb-input onb-mt-12"
            placeholder="输入自定义岗位后按回车"
            @keydown.enter.prevent="addCustomPosition"
          />

          <label class="onb-label onb-mt-20">月招聘目标</label>
          <select v-model="form.monthlyHireTarget" class="onb-input">
            <option :value="3">1-5 人/月</option>
            <option :value="8">6-10 人/月</option>
            <option :value="15">11-20 人/月</option>
            <option :value="30">20人以上/月</option>
          </select>

          <label class="onb-label">预算范围</label>
          <select v-model="form.budgetRange" class="onb-input">
            <option value="">请选择预算</option>
            <option value="5k-10k">5k-10k/月</option>
            <option value="10k-20k">10k-20k/月</option>
            <option value="20k-50k">20k-50k/月</option>
            <option value="50k+">50k+/月</option>
          </select>
        </div>
        <div class="onb-btn-row">
          <button @click="currentStep = 1" class="onb-btn-secondary">上一步</button>
          <button
            @click="submitStep2"
            class="onb-btn-primary"
            :disabled="!isStep2Valid || submitting"
          >
            {{ submitting ? '提交中...' : '下一步' }}
          </button>
        </div>
      </div>

      <!-- Step 3: 完成 -->
      <div v-else-if="currentStep === 3" class="onb-card onb-complete">
        <div class="onb-complete-icon">🎉</div>
        <h2>企业身份已创建</h2>
        <p class="onb-desc">您的企业招聘中心已就绪，开始体验 AI 招聘</p>
        <div class="onb-complete-features">
          <div class="onb-cf">🤖 AI招聘经理 — 已就绪</div>
          <div class="onb-cf">📄 AI简历分析师 — 已就绪</div>
          <div class="onb-cf">🎤 AI面试官 — 已就绪</div>
        </div>
        <button @click="goToRecruitment" class="onb-btn-primary">
          进入招聘中心 →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getEnterpriseIdentity,
  createEnterpriseProfile,
  type EnterpriseIdentityStatus,
} from '~/studio-v2/api/job/enterprise-identity-api'

// ─── Navigation ───
function goToHome() {
  window.location.href = '/'
}

function goToRecruitment() {
  window.location.href = '/workspace/recruitment'
}

// ─── State ───
const identity = ref<EnterpriseIdentityStatus | null>(null)
const currentStep = ref(1)
const totalSteps = 3
const stepLabels = ['企业信息', '招聘需求', '完成']
const submitting = ref(false)

const form = ref({
  companyName: '',
  industry: '',
  scale: '',
  website: '',
  description: '',
  targetPositions: [] as string[],
  monthlyHireTarget: 5,
  budgetRange: '',
})

const customPosition = ref('')

const commonPositions = [
  '前端工程师', '后端工程师', '全栈工程师', '产品经理',
  'UI设计师', '数据分析师', '运营专员', '市场总监',
]

// ─── Validation ───
const isStep1Valid = computed(() => {
  return form.value.companyName.trim() && form.value.industry && form.value.scale
})

const isStep2Valid = computed(() => {
  return form.value.targetPositions.length > 0
})

// ─── Actions ───
function togglePosition(pos: string) {
  const idx = form.value.targetPositions.indexOf(pos)
  if (idx >= 0) {
    form.value.targetPositions.splice(idx, 1)
  } else {
    form.value.targetPositions.push(pos)
  }
}

function addCustomPosition() {
  const val = customPosition.value.trim()
  if (val && !form.value.targetPositions.includes(val)) {
    form.value.targetPositions.push(val)
  }
  customPosition.value = ''
}

async function submitStep1() {
  if (!isStep1Valid.value) return
  submitting.value = true
  try {
    // 使用 userId 作为 enterpriseId（单用户企业模式）
    const userId = identity.value?.user?.id || ''
    await createEnterpriseProfile({
      enterpriseId: userId,
      companyName: form.value.companyName,
      industry: form.value.industry,
      scale: form.value.scale,
      website: form.value.website || undefined,
      description: form.value.description || undefined,
    })
    currentStep.value = 2
  } catch (e: any) {
    alert('创建失败: ' + (e.message || '未知错误'))
  } finally {
    submitting.value = false
  }
}

async function submitStep2() {
  if (!isStep2Valid.value) return
  submitting.value = true
  try {
    // Step 2: 保存招聘需求 — 调用后端 API
    // TODO: 接入 /enterprise/onboarding/step2 API
    currentStep.value = 3
  } catch (e: any) {
    alert('保存失败: ' + (e.message || '未知错误'))
  } finally {
    submitting.value = false
  }
}

// ─── Init ───
onMounted(async () => {
  try {
    identity.value = await getEnterpriseIdentity()
    // 如果已有企业身份，直接跳转
    if (identity.value?.hasEnterprise) {
      goToRecruitment()
    }
  } catch (e) {
    // 未登录或无身份，留在 onboarding 页面
  }
})
</script>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  background: #0a0f1e;
  color: #e0e0e0;
}

/* ─── Top Nav ─── */
.onboarding-top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #0d1220;
  border-bottom: 1px solid #1a2240;
}

.onb-nav-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.onb-nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.onb-brand {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
}

/* ─── Content ─── */
.onboarding-content {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 24px;
}

/* ─── Steps ─── */
.onb-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 40px;
}

.onb-step {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.onb-step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  border: 2px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.onb-step.active .onb-step-dot {
  background: rgba(96, 165, 250, 0.15);
  border-color: #3b82f6;
  color: #60a5fa;
}

.onb-step.done .onb-step-dot {
  background: rgba(74, 222, 128, 0.15);
  border-color: #4ade80;
  color: #4ade80;
}

.onb-step-label {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
}

.onb-step.active .onb-step-label {
  color: #60a5fa;
  font-weight: 500;
}

.onb-step.done .onb-step-label {
  color: #4ade80;
}

.onb-step:not(:last-child)::after {
  content: '';
  flex: 1;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 12px;
}

.onb-step.done:not(:last-child)::after {
  background: #4ade80;
}

/* ─── Card ─── */
.onb-card {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 16px;
  padding: 36px;
}

.onb-card h2 {
  margin: 0 0 8px;
  font-size: 1.3rem;
  color: #fff;
}

.onb-desc {
  margin: 0 0 28px;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.45);
}

/* ─── Form ─── */
.onb-form {
  margin-bottom: 28px;
}

.onb-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
  margin-top: 16px;
}

.onb-label:first-child {
  margin-top: 0;
}

.onb-required {
  color: #ef4444;
}

.onb-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e0e0e0;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.onb-input:focus {
  border-color: #3b82f6;
}

.onb-input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.onb-textarea {
  resize: vertical;
  min-height: 80px;
}

select.onb-input {
  appearance: none;
  cursor: pointer;
}

/* ─── Tags ─── */
.onb-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.onb-tag {
  padding: 6px 14px;
  font-size: 0.82rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s;
}

.onb-tag:hover {
  background: rgba(255, 255, 255, 0.08);
}

.onb-tag.selected {
  background: rgba(96, 165, 250, 0.15);
  border-color: #3b82f6;
  color: #60a5fa;
}

.onb-mt-12 {
  margin-top: 12px;
}

.onb-mt-20 {
  margin-top: 20px;
}

/* ─── Buttons ─── */
.onb-btn-primary {
  padding: 12px 28px;
  font-size: 0.95rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s, opacity 0.15s;
}

.onb-btn-primary:hover:not(:disabled) {
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.35);
  transform: translateY(-1px);
}

.onb-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.onb-btn-secondary {
  padding: 12px 28px;
  font-size: 0.95rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.onb-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.onb-btn-row {
  display: flex;
  gap: 12px;
}

/* ─── Complete ─── */
.onb-complete {
  text-align: center;
}

.onb-complete-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.onb-complete-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 24px 0 32px;
  text-align: left;
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
}

.onb-cf {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}
</style>
