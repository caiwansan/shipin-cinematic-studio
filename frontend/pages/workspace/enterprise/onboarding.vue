<template>
  <div class="onboarding-container">
    <!-- 背景 -->
    <div class="ob-bg">
      <div class="ob-bg-gradient"></div>
    </div>

    <!-- 顶部品牌 -->
    <header class="ob-header">
      <div class="ob-brand">
        <span class="ob-logo">昆仑镜</span>
        <span class="ob-tagline">AI 招聘部门</span>
      </div>
      <div class="ob-header-actions">
        <button class="ob-btn ob-btn-ghost" @click="goToWorkspace" style="margin-right:12px">← 返回工作台</button>
        <div class="ob-progress-info">
          <span v-if="!isCompleted">第 {{ currentStep }} / {{ totalSteps }} 步</span>
          <span v-else>✅ 配置完成</span>
      </div>
      </div>
    </header>

    <!-- 进度条 -->
    <div class="ob-progress-bar">
      <div class="ob-progress-fill" :style="{ width: progressPercent + '%' }"></div>
      <div class="ob-steps">
        <div
          v-for="step in steps"
          :key="step.num"
          class="ob-step"
          :class="{
            active: currentStep === step.num,
            done: stepCompleted(step.num),
          }"
        >
          <div class="ob-step-dot">{{ stepDone(step.num) ? '✓' : step.num }}</div>
          <div class="ob-step-label">{{ step.label }}</div>
        </div>
      </div>
    </div>

    <!-- 内容区 -->
    <main class="ob-content">
      <!-- 加载中 -->
      <div v-if="loading" class="ob-loading">
        <div class="ob-spinner"></div>
        <span>正在加载...</span>
      </div>

      <!-- Step 1: 企业档案 -->
      <div v-else-if="currentStep === 1" class="ob-step-content">
        <div class="ob-step-header">
          <h2>🏢 让我们认识一下您的企业</h2>
          <p>这些信息帮助 AI 招聘经理了解您的公司，制定更精准的招聘策略</p>
        </div>

        <div class="ob-form">
          <div class="ob-form-group">
            <label>公司名称 <span class="ob-required">*</span></label>
            <input
              v-model="step1.companyName"
              placeholder="例如：深圳昆仑镜科技有限公司"
              class="ob-input"
            />
          </div>

          <div class="ob-form-row">
            <div class="ob-form-group">
              <label>所属行业 <span class="ob-required">*</span></label>
              <select v-model="step1.industry" class="ob-select">
                <option value="">请选择行业</option>
                <option value="互联网/AI">互联网 / AI</option>
                <option value="金融科技">金融科技</option>
                <option value="企业服务">企业服务</option>
                <option value="电子商务">电子商务</option>
                <option value="游戏/娱乐">游戏 / 娱乐</option>
                <option value="教育">教育</option>
                <option value="医疗健康">医疗健康</option>
                <option value="智能制造">智能制造</option>
                <option value="新能源">新能源</option>
                <option value="其他">其他</option>
              </select>
            </div>

            <div class="ob-form-group">
              <label>企业规模 <span class="ob-required">*</span></label>
              <select v-model="step1.scale" class="ob-select">
                <option value="">请选择规模</option>
                <option value="1-50人">1-50人</option>
                <option value="51-200人">51-200人</option>
                <option value="201-500人">201-500人</option>
                <option value="501-2000人">501-2000人</option>
                <option value="2000人以上">2000人以上</option>
              </select>
            </div>
          </div>

          <div class="ob-form-group">
            <label>公司网站</label>
            <input
              v-model="step1.website"
              placeholder="https://example.com（可选）"
              class="ob-input"
            />
          </div>

          <div class="ob-form-group">
            <label>公司简介</label>
            <textarea
              v-model="step1.description"
              placeholder="一句话介绍您的公司（可选）"
              rows="3"
              class="ob-textarea"
            ></textarea>
          </div>
        </div>

        <div class="ob-step-actions">
          <button
            class="ob-btn ob-btn-primary"
            @click="handleStep1"
            :disabled="!canStep1 || saving"
          >
            {{ saving ? '保存中...' : '下一步：招聘需求 →' }}
          </button>
        </div>
      </div>

      <!-- Step 2: 招聘需求 -->
      <div v-else-if="currentStep === 2" class="ob-step-content">
        <div class="ob-step-header">
          <h2>🎯 您目前正在招聘什么岗位？</h2>
          <p>选择您正在招聘的岗位类型，AI 会据此定制招聘策略</p>
        </div>

        <div class="ob-form">
          <div class="ob-form-group">
            <label>招聘岗位（可多选）<span class="ob-required">*</span></label>
            <div class="ob-checkbox-group">
              <label
                v-for="pos in positionOptions"
                :key="pos.value"
                class="ob-checkbox"
                :class="{ checked: step2.targetPositions.includes(pos.value) }"
              >
                <input
                  type="checkbox"
                  :value="pos.value"
                  v-model="step2.targetPositions"
                  class="ob-checkbox-input"
                />
                <span class="ob-checkbox-label">{{ pos.label }}</span>
              </label>
            </div>
          </div>

          <div class="ob-form-row">
            <div class="ob-form-group">
              <label>本月招聘目标人数</label>
              <select v-model="step2.monthlyHireTarget" class="ob-select">
                <option :value="1">1人</option>
                <option :value="3">2-3人</option>
                <option :value="5">3-5人</option>
                <option :value="10">5-10人</option>
                <option :value="20">10人以上</option>
              </select>
            </div>

            <div class="ob-form-group">
              <label>最急迫的岗位</label>
              <input
                v-model="step2.urgentPosition"
                placeholder="例如：AI应用工程师"
                class="ob-input"
              />
            </div>
          </div>

          <div class="ob-form-group">
            <label>招聘预算范围（月薪）</label>
            <div class="ob-radio-group">
              <label
                v-for="budget in budgetOptions"
                :key="budget.value"
                class="ob-radio"
                :class="{ checked: step2.budgetRange === budget.value }"
              >
                <input
                  type="radio"
                  :value="budget.value"
                  v-model="step2.budgetRange"
                  class="ob-radio-input"
                />
                <span>{{ budget.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="ob-step-actions">
          <button class="ob-btn ob-btn-ghost" @click="currentStep = 1">← 返回</button>
          <button
            class="ob-btn ob-btn-primary"
            @click="handleStep2"
            :disabled="!canStep2 || saving"
          >
            {{ saving ? '保存中...' : '下一步：创建AI部门 →' }}
          </button>
        </div>
      </div>

      <!-- Step 3: AI 员工创建 -->
      <div v-else-if="currentStep === 3" class="ob-step-content">
        <div class="ob-step-header">
          <h2>🤖 创建您的 AI 招聘部门</h2>
          <p>我们将为您配置 4 个 AI 员工，组建一个完整的招聘团队</p>
        </div>

        <div class="ob-agents-preview">
          <div
            v-for="agent in agentWorkforce"
            :key="agent.agentType"
            class="ob-agent-card"
            :class="agent.status"
          >
            <div class="ob-agent-icon">{{ agent.icon }}</div>
            <div class="ob-agent-info">
              <h4>{{ agent.displayName }}</h4>
              <p>{{ agent.description }}</p>
            </div>
            <div class="ob-agent-status">
              <span v-if="agent.status === 'active'" class="ob-badge ob-badge-success">已激活</span>
              <span v-else-if="agent.status === 'trial'" class="ob-badge ob-badge-trial">14天试用</span>
              <span v-else class="ob-badge ob-badge-disabled">未激活</span>
            </div>
          </div>
        </div>

        <div class="ob-plan-note">
          <span class="ob-icon-info">ℹ️</span>
          <span><strong>Starter 套餐：</strong>默认激活 3 个 AI 员工，猎聘顾问可试用 7 天。升级 Professional 解锁全部功能。</span>
        </div>

        <div class="ob-step-actions">
          <button class="ob-btn ob-btn-ghost" @click="currentStep = 2">← 返回</button>
          <button
            class="ob-btn ob-btn-primary"
            @click="handleStep3"
            :disabled="saving"
          >
            {{ saving ? '创建中...' : '下一步：选择套餐 →' }}
          </button>
        </div>
      </div>

      <!-- Step 4: 选择套餐 -->
      <div v-else-if="currentStep === 4" class="ob-step-content">
        <div class="ob-step-header">
          <h2>💳 选择适合您的套餐</h2>
          <p>所有套餐均提供 <strong>14 天免费试用</strong>，无需绑定支付方式</p>
        </div>

        <div class="ob-plans">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="ob-plan-card"
            :class="{
              selected: step4.selectedPlan === plan.id,
              recommended: plan.id === 'starter',
            }"
            @click="step4.selectedPlan = plan.id"
          >
            <div v-if="plan.id === 'starter'" class="ob-plan-badge">推荐</div>
            <div v-if="plan.id === 'professional'" class="ob-plan-badge ob-plan-badge-popular">最受欢迎</div>

            <h3 class="ob-plan-name">{{ plan.name }}</h3>
            <div class="ob-plan-price">
              <span class="ob-plan-currency">¥</span>
              <span class="ob-plan-amount">{{ plan.price }}</span>
              <span class="ob-plan-period">/月</span>
            </div>
            <div class="ob-plan-trial">14天免费试用</div>

            <ul class="ob-plan-features">
              <li v-for="feature in plan.features" :key="feature">
                <span class="ob-feature-check">✓</span>
                {{ feature }}
              </li>
            </ul>
          </div>
        </div>

        <div class="ob-step-actions">
          <button class="ob-btn ob-btn-ghost" @click="currentStep = 3">← 返回</button>
          <button
            class="ob-btn ob-btn-primary"
            @click="handleStep4"
            :disabled="!step4.selectedPlan || saving"
          >
            {{ saving ? '确认中...' : '下一步：进入工作台 →' }}
          </button>
        </div>
      </div>

      <!-- Step 5: 完成 -->
      <div v-else-if="currentStep === 5" class="ob-step-content ob-completed">
        <div class="ob-celebration">
          <div class="ob-celebration-icon">🎉</div>
          <h2>恭喜！您的 AI 招聘部门已就绪</h2>
          <p>您的 AI 员工已经准备开始工作</p>
        </div>

        <div class="ob-summary">
          <div class="ob-summary-item">
            <span class="ob-summary-num">{{ activeAgentCount }}</span>
            <span class="ob-summary-label">AI 员工就位</span>
          </div>
          <div class="ob-summary-item">
            <span class="ob-summary-num">{{ step2.targetPositions.length }}</span>
            <span class="ob-summary-label">招聘岗位</span>
          </div>
          <div class="ob-summary-item">
            <span class="ob-summary-num">{{ step2.monthlyHireTarget }}</span>
            <span class="ob-summary-label">月招聘目标</span>
          </div>
        </div>

        <div class="ob-step-actions">
          <button
            class="ob-btn ob-btn-primary ob-btn-lg"
            @click="handleComplete"
            :disabled="saving"
          >
            {{ saving ? '准备中...' : '🚀 进入 AI 招聘工作台' }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted } from 'vue'
import { useEnterpriseContext } from '~/composables/useEnterpriseContext'

// ─── 统一企业上下文 ───
const ctx = useEnterpriseContext()

// ─── 类型定义 ───

interface Step1Data {
  companyName: string
  industry: string
  scale: string
  website: string
  description: string
}

interface Step2Data {
  targetPositions: string[]
  monthlyHireTarget: number
  urgentPosition: string
  budgetRange: string
}

interface Step4Data {
  selectedPlan: string
}

interface AgentWorkforce {
  agentType: string
  displayName: string
  description: string
  icon: string
  status: 'active' | 'trial' | 'disabled'
}

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  interval: string
  features: string[]
}

// ─── 状态 ───

const loading = ref(true)
const saving = ref(false)
const currentStep = ref(1)
const totalSteps = 5
const enterpriseId = ref('')
const workspaceId = ref('')

const step1 = ref<Step1Data>({
  companyName: '',
  industry: '',
  scale: '',
  website: '',
  description: '',
})

const step2 = ref<Step2Data>({
  targetPositions: [],
  monthlyHireTarget: 5,
  urgentPosition: '',
  budgetRange: '',
})

const step4 = ref<Step4Data>({
  selectedPlan: 'starter',
})

const agentWorkforce = ref<AgentWorkforce[]>([])
const plans = ref<Plan[]>([])

// 步骤定义
const steps = [
  { num: 1, label: '企业档案', key: 'stepCompanyDone' },
  { num: 2, label: '招聘需求', key: 'stepNeedsDone' },
  { num: 3, label: 'AI部门', key: 'stepAgentDone' },
  { num: 4, label: '选择套餐', key: 'stepPlanDone' },
  { num: 5, label: '完成', key: 'stepDashboardDone' },
]

// 岗位选项
const positionOptions = [
  { value: '前端工程师', label: '💻 前端工程师' },
  { value: '后端工程师', label: '⚙️ 后端工程师' },
  { value: '全栈工程师', label: '🔧 全栈工程师' },
  { value: 'AI工程师', label: '🤖 AI工程师' },
  { value: 'AI应用工程师', label: '🧠 AI应用工程师' },
  { value: '产品经理', label: '📱 产品经理' },
  { value: 'UI/UX设计师', label: '🎨 UI/UX设计师' },
  { value: '数据分析师', label: '📊 数据分析师' },
  { value: '运营', label: '📈 运营' },
  { value: '销售', label: '💼 销售' },
  { value: 'HR', label: '👥 HR' },
  { value: '财务', label: '💰 财务' },
]

// 预算选项
const budgetOptions = [
  { value: '10-15K', label: '10-15K' },
  { value: '15-25K', label: '15-25K' },
  { value: '25-40K', label: '25-40K' },
  { value: '40-60K', label: '40-60K' },
  { value: '60K+', label: '60K+' },
]

// ─── 计算属性 ───

const progressPercent = computed(() => {
  return Math.round(((currentStep.value - 1) / (totalSteps - 1)) * 100)
})

const canStep1 = computed(() => {
  return step1.value.companyName.trim() && step1.value.industry && step1.value.scale
})

const canStep2 = computed(() => {
  return step2.value.targetPositions.length > 0
})

const activeAgentCount = computed(() => {
  return agentWorkforce.value.filter(a => a.status === 'active' || a.status === 'trial').length
})

function stepDone(num: number): boolean {
  return num < currentStep.value
}

function stepCompleted(num: number): boolean {
  return num <= currentStep.value
}

function goToWorkspace() {
  window.location.href = '/workspace/enterprise'
}

// ─── 方法 ───

async function loadOnboardingState() {
  loading.value = true
  enterpriseId.value = ctx.getEnterpriseId()

  // 加载套餐列表（无论是否有 enterpriseId 都需要）
  try {
    const plansRes = await fetch('/api/enterprise/plans')
    if (plansRes.ok) {
      const plansData = await plansRes.json()
      plans.value = plansData.plans || []
    }
  } catch (e) {
    console.error('加载套餐列表失败', e)
  }

  // mode=new-workspace: 强制从头创建，跳过已有 enterpriseId 的状态加载
  const urlParams = new URLSearchParams(window.location.search)
  const isNewWorkspace = urlParams.get('mode') === 'new-workspace'

  // Guard: if no enterpriseId or force new workspace, skip onboarding state API call
  if (!enterpriseId.value || isNewWorkspace) {
    loading.value = false
    return
  }

  try {
    // 加载 Onboarding 状态
    const stateRes = await fetch(`/api/enterprise/onboarding/v2/status?enterpriseId=${enterpriseId.value}`)
    if (stateRes.ok) {
      const stateData = await stateRes.json()
      if (stateData.state) {
        currentStep.value = stateData.state.currentStep || 1
        if (stateData.state.workspaceId) workspaceId.value = stateData.state.workspaceId
        if (stateData.state.completed) {
          // 已完成，跳转到招聘工作台
          window.location.href = '/workspace/enterprise'
          return
        }
      }
    }
  } catch (e) {
    console.error('加载Onboarding状态失败', e)
  } finally {
    loading.value = false
  }
}

async function handleStep1() {
  saving.value = true
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/onboarding/step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enterpriseId: enterpriseId.value || undefined,
        ...step1.value,
      }),
    })
    const data = await res.json()
    if (data.success) {
      // 保存返回的 enterpriseId 和 workspaceId
      if (data.enterpriseId) {
        enterpriseId.value = data.enterpriseId
        ctx.setEnterprise(data.enterpriseId)
      }
      if (data.workspace?.id) {
        workspaceId.value = data.workspace.id
        ctx.setWorkspace(data.workspace.id)
      }
      currentStep.value = 2
    } else {
      alert(data.error || '保存失败')
    }
  } catch (e: any) {
    alert('网络错误：' + e.message)
  } finally {
    saving.value = false
  }
}

async function handleStep2() {
  if (!enterpriseId.value) return
  saving.value = true
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/onboarding/step2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enterpriseId: enterpriseId.value,
        workspaceId: workspaceId.value,
        ...step2.value,
      }),
    })
    const data = await res.json()
    if (data.success) {
      currentStep.value = 3
      await loadAgentPreview()
    } else {
      alert(data.error || '保存失败')
    }
  } catch (e: any) {
    alert('网络错误：' + e.message)
  } finally {
    saving.value = false
  }
}

async function loadAgentPreview() {
  // 本地预览，不调用 API
  agentWorkforce.value = [
    {
      agentType: 'career_advisor',
      displayName: '🤖 AI招聘经理',
      description: '负责招聘策略、JD生成、招聘计划制定',
      icon: '🤖',
      status: 'active',
    },
    {
      agentType: 'resume_analyzer',
      displayName: '📄 AI简历分析师',
      description: '简历自动解析、候选人评分、技能匹配',
      icon: '📄',
      status: 'active',
    },
    {
      agentType: 'interview_agent',
      displayName: '🎤 AI面试官',
      description: 'AI生成面试方案、问题生成、面试评价',
      icon: '🎤',
      status: 'active',
    },
    {
      agentType: 'talent_hunter',
      displayName: '🔍 AI猎聘顾问',
      description: '主动发现人才、人才库搜索、候选人关系维护',
      icon: '🔍',
      status: 'trial',
    },
  ]
}

async function handleStep3() {
  if (!enterpriseId.value) return
  saving.value = true
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/onboarding/step3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enterpriseId: enterpriseId.value,
        workspaceId: workspaceId.value,
        plan: step4.value.selectedPlan,
      }),
    })
    const data = await res.json()
    if (data.success) {
      // 更新预览状态
      if (data.workforce) {
        for (const agent of agentWorkforce.value) {
          const saved = data.workforce.find((w: any) => w.agentType === agent.agentType)
          if (saved) agent.status = saved.status
        }
      }
      currentStep.value = 4
    } else {
      alert(data.error || '创建失败')
    }
  } catch (e: any) {
    alert('网络错误：' + e.message)
  } finally {
    saving.value = false
  }
}

async function handleStep4() {
  if (!enterpriseId.value) return
  saving.value = true
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/onboarding/step4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enterpriseId: enterpriseId.value,
        workspaceId: workspaceId.value,
        plan: step4.value.selectedPlan,
      }),
    })
    const data = await res.json()
    if (data.success) {
      currentStep.value = 5
    } else {
      alert(data.error || '选择套餐失败')
    }
  } catch (e: any) {
    alert('网络错误：' + e.message)
  } finally {
    saving.value = false
  }
}

async function handleComplete() {
  saving.value = true
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enterpriseId: enterpriseId.value,
      }),
    })
    const data = await res.json()
    if (data.success) {
      // P0-1-B: 通过统一 Context 写入身份，禁止直接操作 localStorage
      ctx.setEnterprise(enterpriseId.value)
      if (workspaceId.value) {
        ctx.setWorkspace(workspaceId.value)
      }
      window.location.href = '/workspace/enterprise'
    } else {
      alert(data.error || '完成失败')
    }
  } catch (e: any) {
    alert('网络错误：' + e.message)
  } finally {
    saving.value = false
  }
}

// ─── 生命周期 ───

onMounted(() => {
  loadOnboardingState()
})
</script>

<style scoped>
.ob-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: linear-gradient(135deg, #0b0f14 0%, #141b24 50%, #1a1f2e 100%);
}

.ob-bg-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(201, 168, 108, 0.08) 0%, transparent 60%);
}

.ob-header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
}

.ob-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ob-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ob-logo {
  font-size: 1.3rem;
  font-weight: 700;
  color: rgba(201, 168, 108, 0.9);
  letter-spacing: 2px;
}

.ob-tagline {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 1px;
}

.ob-progress-info {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
}

/* 进度条 */
.ob-progress-bar {
  position: relative;
  z-index: 1;
  padding: 0 40px;
  margin-bottom: 20px;
}

.ob-progress-fill {
  height: 3px;
  background: linear-gradient(90deg, rgba(201, 168, 108, 0.6), rgba(201, 168, 108, 0.3));
  border-radius: 2px;
  transition: width 0.5s ease;
  margin-bottom: 12px;
}

.ob-steps {
  display: flex;
  justify-content: space-between;
}

.ob-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.ob-step-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 2px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.3s;
}

.ob-step.active .ob-step-dot {
  border-color: rgba(201, 168, 108, 0.6);
  background: rgba(201, 168, 108, 0.15);
  color: rgba(201, 168, 108, 0.9);
}

.ob-step.done .ob-step-dot {
  border-color: rgba(74, 222, 128, 0.4);
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.ob-step-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
}

.ob-step.active .ob-step-label {
  color: rgba(201, 168, 108, 0.8);
}

.ob-step.done .ob-step-label {
  color: rgba(74, 222, 128, 0.6);
}

/* 内容区 */
.ob-content {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 40px 40px;
}

.ob-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 0;
  color: rgba(255, 255, 255, 0.5);
}

.ob-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: rgba(201, 168, 108, 0.6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Step 内容 */
.ob-step-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.ob-step-header {
  text-align: center;
  margin-bottom: 30px;
}

.ob-step-header h2 {
  margin: 0 0 8px;
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

.ob-step-header p {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
}

/* 表单 */
.ob-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ob-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ob-form-group label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.ob-required {
  color: rgba(239, 68, 68, 0.8);
  margin-left: 2px;
}

.ob-input,
.ob-select,
.ob-textarea {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s;
}

.ob-input:focus,
.ob-select:focus,
.ob-textarea:focus {
  border-color: rgba(201, 168, 108, 0.4);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 3px rgba(201, 168, 108, 0.1);
}

.ob-input::placeholder,
.ob-textarea::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.ob-select option {
  background: #1a1f2e;
  color: rgba(255, 255, 255, 0.9);
}

.ob-textarea {
  resize: vertical;
  min-height: 80px;
}

.ob-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* Checkbox & Radio */
.ob-checkbox-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.ob-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.ob-checkbox:hover {
  border-color: rgba(201, 168, 108, 0.3);
  background: rgba(201, 168, 108, 0.05);
}

.ob-checkbox.checked {
  border-color: rgba(201, 168, 108, 0.5);
  background: rgba(201, 168, 108, 0.1);
}

.ob-checkbox-input {
  display: none;
}

.ob-checkbox-label {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.7);
}

.ob-checkbox.checked .ob-checkbox-label {
  color: rgba(201, 168, 108, 0.9);
}

.ob-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ob-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.15s;
}

.ob-radio:hover {
  border-color: rgba(201, 168, 108, 0.3);
}

.ob-radio.checked {
  border-color: rgba(201, 168, 108, 0.5);
  background: rgba(201, 168, 108, 0.1);
  color: rgba(201, 168, 108, 0.9);
}

.ob-radio-input {
  display: none;
}

/* AI 员工预览 */
.ob-agents-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.ob-agent-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: all 0.2s;
}

.ob-agent-card.trial {
  border-color: rgba(255, 193, 7, 0.2);
  background: rgba(255, 193, 7, 0.03);
}

.ob-agent-card.active {
  border-color: rgba(74, 222, 128, 0.2);
}

.ob-agent-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.ob-agent-info {
  flex: 1;
}

.ob-agent-info h4 {
  margin: 0 0 3px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
}

.ob-agent-info p {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.ob-badge {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;
}

.ob-badge-success {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.ob-badge-trial {
  background: rgba(255, 193, 7, 0.15);
  color: rgba(255, 193, 7, 0.9);
}

.ob-badge-disabled {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.3);
}

.ob-plan-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 10px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 20px;
}

.ob-icon-info {
  flex-shrink: 0;
}

/* 套餐卡片 */
.ob-plans {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.ob-plan-card {
  position: relative;
  padding: 24px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.ob-plan-card:hover {
  border-color: rgba(201, 168, 108, 0.3);
  background: rgba(255, 255, 255, 0.05);
}

.ob-plan-card.selected {
  border-color: rgba(201, 168, 108, 0.5);
  background: rgba(201, 168, 108, 0.08);
  box-shadow: 0 0 20px rgba(201, 168, 108, 0.1);
}

.ob-plan-badge {
  position: absolute;
  top: -8px;
  right: 12px;
  padding: 2px 10px;
  background: rgba(201, 168, 108, 0.8);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  border-radius: 8px;
  letter-spacing: 0.5px;
}

.ob-plan-badge-popular {
  background: rgba(74, 222, 128, 0.8);
}

.ob-plan-name {
  margin: 0 0 8px;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.9);
}

.ob-plan-price {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-bottom: 4px;
}

.ob-plan-currency {
  font-size: 1rem;
  color: rgba(201, 168, 108, 0.8);
}

.ob-plan-amount {
  font-size: 2rem;
  font-weight: 700;
  color: rgba(201, 168, 108, 0.9);
}

.ob-plan-period {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

.ob-plan-trial {
  font-size: 0.72rem;
  color: rgba(74, 222, 128, 0.7);
  margin-bottom: 14px;
}

.ob-plan-features {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ob-plan-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.ob-feature-check {
  color: rgba(74, 222, 128, 0.7);
  font-weight: 700;
}

/* 完成页 */
.ob-completed {
  text-align: center;
}

.ob-celebration {
  margin-bottom: 30px;
}

.ob-celebration-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  animation: bounce 0.6s ease;
}

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.ob-celebration h2 {
  margin: 0 0 8px;
  font-size: 1.4rem;
  color: rgba(255, 255, 255, 0.95);
}

.ob-celebration p {
  margin: 0;
  color: rgba(255, 255, 255, 0.4);
}

.ob-summary {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.ob-summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ob-summary-num {
  font-size: 1.8rem;
  font-weight: 700;
  color: rgba(201, 168, 108, 0.9);
}

.ob-summary-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

/* 按钮 */
.ob-step-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.ob-btn {
  padding: 12px 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
}

.ob-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.ob-btn-primary {
  background: rgba(201, 168, 108, 0.2);
  border-color: rgba(201, 168, 108, 0.4);
  color: rgba(201, 168, 108, 0.9);
  font-weight: 600;
}

.ob-btn-primary:hover {
  background: rgba(201, 168, 108, 0.3);
}

.ob-btn-ghost {
  background: transparent;
}

.ob-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
}

.ob-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ob-btn-lg {
  padding: 14px 40px;
  font-size: 1rem;
}
</style>
