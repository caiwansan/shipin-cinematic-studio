<template>
  <div class="ae-page">
    <RecruitmentPageShell>
      <template #title>AI 招聘专员</template>
      <template #subtitle>Carol — 企业级 AI 招聘员工，全天候工作，从需求分析到候选人推荐全流程覆盖</template>

      <!-- Loading State -->
      <div v-if="loading" class="ae-loading">
        <div class="ae-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="ae-error">
        <div class="ae-error-icon">!</div>
        <p>{{ error }}</p>
        <button class="ae-btn-primary" @click="loadData">重试</button>
      </div>

      <!-- Not Logged In -->
      <div v-else-if="!isLoggedIn" class="ae-guest">
        <div class="ae-guest-card">
          <div class="ae-guest-icon">C</div>
          <h2>Carol AI 招聘专员</h2>
          <p>企业级 AI 招聘员工，自动完成招聘全流程</p>
          <button class="ae-btn-primary" @click="goToLogin">登录体验</button>
        </div>
      </div>

      <!-- Main Carol Product Page -->
      <template v-else>
        <!-- ═══ Carol Identity Hero ═══ -->
        <div class="ae-hero">
          <div class="ae-hero-identity">
            <div class="ae-hero-avatar">C</div>
            <div class="ae-hero-info">
              <h1 class="ae-hero-name">Carol</h1>
              <div class="ae-hero-role">AI 招聘专员</div>
              <div class="ae-hero-status" :class="{ 'ae-hero-status--active': agentActive }">
                <span class="ae-status-dot"></span>
                {{ agentActive ? '工作中' : '等待任务' }}
              </div>
            </div>
          </div>
          <div class="ae-hero-meta">
            <div class="ae-hero-plan" v-if="hasSubscription">
              <span class="ae-plan-badge">已开通</span>
            </div>
          </div>
        </div>

        <!-- ═══ Responsibilities ═══ -->
        <div class="ae-section">
          <h2 class="ae-section-title">工作职责</h2>
          <div class="ae-responsibilities">
            <div class="ae-responsibility">
              <div class="ae-r-icon">✓</div>
              <div class="ae-r-body">
                <strong>分析招聘需求</strong>
                <span>理解岗位描述，提取核心技能要求和筛选标准</span>
              </div>
            </div>
            <div class="ae-responsibility">
              <div class="ae-r-icon">✓</div>
              <div class="ae-r-body">
                <strong>生成岗位策略</strong>
                <span>基于招聘需求制定人才搜索策略和推荐渠道</span>
              </div>
            </div>
            <div class="ae-responsibility">
              <div class="ae-r-icon">✓</div>
              <div class="ae-r-body">
                <strong>筛选候选人</strong>
                <span>自动解析简历，基于匹配模型进行智能筛选排序</span>
              </div>
            </div>
            <div class="ae-responsibility">
              <div class="ae-r-icon">✓</div>
              <div class="ae-r-body">
                <strong>分析匹配度</strong>
                <span>多维度匹配分析，输出候选人匹配评估报告</span>
              </div>
            </div>
            <div class="ae-responsibility">
              <div class="ae-r-icon">✓</div>
              <div class="ae-r-body">
                <strong>辅助面试</strong>
                <span>生成定制化面试题，辅助面试评估与决策</span>
              </div>
            </div>
            <div class="ae-responsibility">
              <div class="ae-r-icon">✓</div>
              <div class="ae-r-body">
                <strong>输出招聘报告</strong>
                <span>汇总招聘数据，输出洞察与优化建议</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ Carol Today Stats ═══ -->
        <div class="ae-section">
          <h2 class="ae-section-title">Carol 今日完成</h2>
          <div class="ae-stats-grid">
            <div class="ae-stat-card">
              <span class="ae-stat-value">{{ stats.analyzedCandidates }}</span>
              <span class="ae-stat-label">分析候选人</span>
            </div>
            <div class="ae-stat-card">
              <span class="ae-stat-value">{{ stats.highMatchFound }}</span>
              <span class="ae-stat-label">发现高匹配人才</span>
            </div>
            <div class="ae-stat-card">
              <span class="ae-stat-value">{{ stats.suggestedInterviews }}</span>
              <span class="ae-stat-label">建议面试</span>
            </div>
            <div class="ae-stat-card">
              <span class="ae-stat-value">{{ stats.reportsGenerated }}</span>
              <span class="ae-stat-label">生成报告</span>
            </div>
          </div>
        </div>

        <!-- ═══ Carol Work Log (Phase 8C) ═══ -->
        <div class="ae-section" v-if="activities.length > 0">
          <h2 class="ae-section-title">工作动态</h2>
          <div class="ae-timeline">
            <div v-for="(act, idx) in activities" :key="idx" class="ae-timeline-item">
              <div class="ae-timeline-dot"></div>
              <div class="ae-timeline-content">
                <div class="ae-timeline-time">{{ act.time }}</div>
                <div class="ae-timeline-action">{{ act.action }}</div>
                <div class="ae-timeline-detail">{{ act.detail }}</div>
                <div v-if="act.result" class="ae-timeline-result">{{ act.result }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="ae-section" v-else>
          <h2 class="ae-section-title">工作动态</h2>
          <div class="ae-empty-timeline">
            <p>完成第一次招聘任务后，此处将展示 Carol 的工作记录</p>
          </div>
        </div>

        <!-- ═══ CTA: Hire / Enter ═══ -->
        <div class="ae-cta-section">
          <div class="ae-cta-card">
            <div class="ae-cta-info">
              <h3 v-if="!hasSubscription">雇佣 Carol，开启智能招聘</h3>
              <h3 v-else-if="!agentActive">Carol 已就绪，立即激活</h3>
              <h3 v-else>Carol 正在为您工作</h3>
              <p v-if="!hasSubscription">
                开通套餐即可激活 Carol，让 AI 招聘专员自动完成从需求分析到候选人筛选的全流程工作。
              </p>
              <p v-else-if="!agentActive">
                您的套餐已包含 Carol，激活后即可开始招聘任务。
              </p>
              <p v-else>
                前往招聘驾驶舱，分配岗位让 Carol 自动执行招聘任务。
              </p>
            </div>
            <button
              v-if="!hasSubscription"
              class="ae-btn-primary ae-btn--lg"
              @click="goToBilling"
            >
              雇佣 Carol
            </button>
            <button
              v-else-if="!agentActive"
              class="ae-btn-primary ae-btn--lg"
              @click="activateCarol"
              :disabled="activating"
            >
              {{ activating ? '激活中...' : '激活 Carol' }}
            </button>
            <button
              v-else
              class="ae-btn-primary ae-btn--lg"
              @click="goToWorkspace"
            >
              进入工作台
            </button>
          </div>
        </div>
      </template>
    </RecruitmentPageShell>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise-workspace' })
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

/* ─── State ─── */
const loading = ref(true)
const error = ref<string | null>(null)
const hasSubscription = ref(false)
const agentActive = ref(false)
const activating = ref(false)

const stats = ref({
  analyzedCandidates: 0,
  highMatchFound: 0,
  suggestedInterviews: 0,
  reportsGenerated: 0,
})

const activities = ref<Array<{
  time: string
  action: string
  detail: string
  result: string
}>>([])

const isLoggedIn = computed(() => {
  return !!authStore.token
})

function getAuthToken(): string {
  return authStore.token || localStorage.getItem('auth_token') || ''
}

/* ─── Data Loading ─── */
async function loadData() {
  loading.value = true
  error.value = null

  try {
    const token = getAuthToken()
    if (!token) {
      return
    }

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    // 1. Subscription status
    try {
      const subRes = await fetch('/api/enterprise/subscription/current', { headers })
      if (subRes.ok) {
        const subData = await subRes.json()
        hasSubscription.value = subData?.success && subData?.data?.hasSubscription
      }
    } catch { /* non-fatal */ }

    // 2. Agent profiles (find Carol)
    try {
      const profileRes = await fetch('/api/enterprise/agent-profiles', { headers })
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        const agents = profileData?.data || []
        const carol = agents.find((a: any) => {
          const name = (a.shortName || a.name || '').toLowerCase()
          return name.includes('carol') || name.includes('c')
        })
        if (carol) {
          agentActive.value = carol.status === 'active'
          stats.value = {
            analyzedCandidates: carol.analyzedCandidates || stats.value.analyzedCandidates,
            highMatchFound: carol.highMatchFound || carol.highMatchCandidates || stats.value.highMatchFound,
            suggestedInterviews: carol.interviewsEvaluated || carol.suggestedInterviews || stats.value.suggestedInterviews,
            reportsGenerated: carol.reportsGenerated || stats.value.reportsGenerated,
          }
        }
      }
    } catch { /* non-fatal */ }

    // 3. Report summary for Carol stats
    try {
      const reportRes = await fetch('/api/enterprise/reports/summary', { headers })
      if (reportRes.ok) {
        const reportData = await reportRes.json()
        if (reportData.success && reportData.report?.summary) {
          const summary = reportData.report.summary
          stats.value = {
            analyzedCandidates: summary.totalCandidates || 0,
            highMatchFound: summary.highMatch || 0,
            suggestedInterviews: summary.invitedCount || 0,
            reportsGenerated: 1,
          }
        }
      }
    } catch { /* non-fatal */ }

    // 4. Agent activity (Phase 8C — work log)
    try {
      const activityRes = await fetch('/api/enterprise/agent-activity?agentId=carol&days=7', { headers })
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        if (activityData?.activities) {
          activities.value = activityData.activities
        }
      }
    } catch { /* non-fatal */ }

    error.value = null
  } catch (e: any) {
    console.error('Failed to load Carol profile:', e)
    error.value = '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

/* ─── Actions ─── */
function goToBilling() {
  router.push('/workspace/enterprise/billing')
}

function goToWorkspace() {
  router.push('/workspace/enterprise/')
}

function goToLogin() {
  router.push('/login?redirect=' + encodeURIComponent('/workspace/enterprise/ai-employees'))
}

async function activateCarol() {
  activating.value = true
  try {
    const token = getAuthToken()
    if (!token) return
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // Find Carol's agent profile ID first
    const profileRes = await fetch('/api/enterprise/agent-profiles', { headers })
    if (profileRes.ok) {
      const profileData = await profileRes.json()
      const agents = profileData?.data || []
      const carol = agents.find((a: any) => {
        const name = (a.shortName || a.name || '').toLowerCase()
        return name.includes('carol') || name.includes('c')
      })

      if (carol) {
        const toggleRes = await fetch(`/api/enterprise/agent-profiles/${carol.id}/toggle`, {
          method: 'POST',
          headers,
        })
        if (toggleRes.ok) {
          agentActive.value = true
        }
      } else {
        // Carol doesn't exist yet — try to activate via runtime
        const activateRes = await fetch('/api/enterprise/agent-runtime/provision', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            agentType: 'talent_analyst',
            shortName: 'Carol',
            name: 'Carol AI 招聘专员',
          }),
        })
        if (activateRes.ok) {
          agentActive.value = true
        }
      }
    }
  } catch (e) {
    console.error('Failed to activate Carol:', e)
  } finally {
    activating.value = false
  }
}

onMounted(async () => {
  await authStore.restoreSession()
  loadData()
})
</script>

<style scoped>
/* ═══════════════════════════════════════
   ai-employees.vue — Carol AI 招聘专员产品页
   B2B SaaS 风格，类似 Linear/Notion 产品页
   ═══════════════════════════════════════ */

.ae-page {
  padding: 0;
  max-width: 900px;
  margin: 0 auto;
}

/* ─── Loading ─── */
.ae-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;
  color: var(--color-text-muted);
}

.ae-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border-primary);
  border-top-color: #818CF8;
  border-radius: 50%;
  animation: ae-spin 0.8s linear infinite;
}

@keyframes ae-spin {
  to { transform: rotate(360deg); }
}

/* ─── Error ─── */
.ae-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 20px;
  text-align: center;
}

.ae-error-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}

.ae-error p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* ─── Guest ─── */
.ae-guest {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}

.ae-guest-card {
  text-align: center;
  max-width: 420px;
}

.ae-guest-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F59E0B, #F97316);
  color: #fff;
  font-size: 32px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.ae-guest-card h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.ae-guest-card p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 24px;
}

/* ─── Section ─── */
.ae-section {
  margin-top: 32px;
}

.ae-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 16px;
}

/* ─── Hero ─── */
.ae-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 24px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
}

.ae-hero-identity {
  display: flex;
  align-items: center;
  gap: 20px;
}

.ae-hero-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F59E0B, #F97316);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ae-hero-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ae-hero-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.2;
}

.ae-hero-role {
  font-size: 14px;
  color: var(--color-text-muted);
}

.ae-hero-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.ae-hero-status--active {
  color: #4ADE80;
}

.ae-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.ae-hero-status--active .ae-status-dot {
  background: #4ADE80;
}

.ae-hero-plan {
  display: flex;
  align-items: center;
}

.ae-plan-badge {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(52, 211, 153, 0.1);
  color: #34D399;
}

/* ─── Responsibilities ─── */
.ae-responsibilities {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ae-responsibility {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
}

.ae-r-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.1);
  color: #10B981;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.ae-r-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ae-r-body strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.ae-r-body span {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* ─── Stats ─── */
.ae-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.ae-stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
}

.ae-stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #818CF8;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.ae-stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

/* ─── Timeline (Work Log) ─── */
.ae-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8px 0;
}

.ae-timeline-item {
  display: flex;
  gap: 14px;
  padding: 12px 16px;
  position: relative;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  margin-bottom: 8px;
}

.ae-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
  background: #F59E0B;
  border: 2px solid rgba(245, 158, 11, 0.3);
}

.ae-timeline-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ae-timeline-time {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
}

.ae-timeline-action {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.ae-timeline-detail {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.ae-timeline-result {
  font-size: 12px;
  color: #818CF8;
  margin-top: 2px;
  padding: 4px 8px;
  background: rgba(99, 102, 241, 0.06);
  border-radius: 4px;
  display: inline-block;
}

.ae-empty-timeline {
  padding: 40px;
  text-align: center;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
}

.ae-empty-timeline p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-muted);
  font-style: italic;
}

/* ─── CTA Section ─── */
.ae-cta-section {
  margin-top: 40px;
  margin-bottom: 40px;
}

.ae-cta-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 32px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.04), rgba(249, 115, 22, 0.04));
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 12px;
}

.ae-cta-info {
  flex: 1;
}

.ae-cta-info h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 6px;
}

.ae-cta-info p {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
  max-width: 450px;
}

/* ─── Buttons ─── */
.ae-btn-primary {
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 600;
  background: #6366F1;
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
  font-family: var(--font-family);
}

.ae-btn-primary:hover {
  background: #4F46E5;
}

.ae-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ae-btn--lg {
  padding: 12px 28px;
  font-size: 15px;
}

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .ae-responsibilities {
    grid-template-columns: 1fr;
  }

  .ae-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .ae-cta-card {
    flex-direction: column;
    text-align: center;
  }

  .ae-cta-info p {
    max-width: 100%;
  }

  .ae-hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}
</style>
