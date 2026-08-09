<template>
  <div class="ae-page">
    <RecruitmentPageShell>
      <template #title>AI 员工中心</template>
      <template #subtitle>您的企业 AI 员工团队，全天候自动执行招聘、运营、分析等任务</template>

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
          <div class="ae-guest-icon">🤖</div>
          <h2>AI 员工中心</h2>
          <p>企业级 AI 员工团队，自动完成招聘、运营、分析等全流程工作</p>
          <button class="ae-btn-primary" @click="goToLogin">登录体验</button>
        </div>
      </div>

      <!-- Dynamic AI Employee List -->
      <template v-else>
        <!-- ═══ Team Overview ═══ -->
        <div class="ae-hero">
          <div class="ae-hero-identity">
            <div class="ae-hero-avatar">🤖</div>
            <div class="ae-hero-info">
              <h1 class="ae-hero-name">AI 员工团队</h1>
              <div class="ae-hero-role">{{ agents.length }} 个 AI 员工 · 一键管理招聘全流程</div>
              <div class="ae-hero-status ae-hero-status--active">
                <span class="ae-status-dot"></span>
                {{ activeAgentCount }} 个工作中
              </div>
            </div>
          </div>
          <div class="ae-hero-meta">
            <div class="ae-hero-plan" v-if="hasSubscription">
              <span class="ae-plan-badge">已开通</span>
            </div>
          </div>
        </div>

        <!-- ═══ AI Employee Cards ═══ -->
        <div class="ae-section">
          <h2 class="ae-section-title">AI 员工列表</h2>
          <div class="ae-agent-grid">
            <div v-for="agent in agents" :key="agent.id" class="ae-agent-card">
              <div class="ae-agent-header">
                <div class="ae-agent-avatar" :style="{ background: getAgentColor(agent.agentType) }">
                  {{ agent.name.charAt(0) }}
                </div>
                <div class="ae-agent-info">
                  <h3 class="ae-agent-name">{{ agent.name }}</h3>
                  <div class="ae-agent-role">{{ agent.role }}</div>
                  <div class="ae-agent-status" :class="{ 'ae-agent-status--active': agent.status === 'active' }">
                    <span class="ae-status-dot"></span>
                    {{ agent.status === 'active' ? '工作中' : '已暂停' }}
                  </div>
                </div>
              </div>
              <p v-if="agent.goal" class="ae-agent-goal">{{ agent.goal }}</p>
              <div class="ae-agent-tags">
                <span v-for="cap in (agent.capabilities || []).slice(0, 4)" :key="cap" class="ae-agent-tag">
                  {{ cap }}
                </span>
              </div>
              <div class="ae-agent-stats">
                <div class="ae-agent-stat">
                  <span class="ae-agent-stat-value">{{ agent.todayCompleted || 0 }}</span>
                  <span class="ae-agent-stat-label">今日完成</span>
                </div>
                <div class="ae-agent-stat">
                  <span class="ae-agent-stat-value">{{ agent.totalTasks || 0 }}</span>
                  <span class="ae-agent-stat-label">总任务</span>
                </div>
                <div class="ae-agent-stat">
                  <span class="ae-agent-stat-value">{{ agent.todayProgress || 0 }}%</span>
                  <span class="ae-agent-stat-label">今日进度</span>
                </div>
              </div>
              <div class="ae-agent-actions">
                <button
                  class="ae-btn-primary ae-btn--sm"
                  @click="toggleAgent(agent)"
                  :disabled="toggling[agent.id]"
                >
                  {{ agent.status === 'active' ? '暂停' : '激活' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ Responsibilities (show if any agent has capabilities) ═══ -->
        <div class="ae-section" v-if="allCapabilities.length > 0">
          <h2 class="ae-section-title">团队能力</h2>
          <div class="ae-responsibilities">
            <div v-for="cap in allCapabilities.slice(0, 8)" :key="cap" class="ae-responsibility">
              <div class="ae-r-icon">✓</div>
              <div class="ae-r-body">
                <strong>{{ cap }}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ CTA ═══ -->
        <div class="ae-cta-section">
          <div class="ae-cta-card">
            <div class="ae-cta-info">
              <h3 v-if="!hasSubscription">开通套餐，激活 AI 员工</h3>
              <h3 v-else-if="agents.length === 0">创建您的第一个 AI 员工</h3>
              <h3 v-else>AI 员工正在为您工作</h3>
              <p v-if="!hasSubscription">
                开通套餐即可激活 AI 员工团队，让 AI 自动完成从招聘到运营的全流程工作。
              </p>
              <p v-else-if="agents.length === 0">
                您的套餐已包含 AI 员工，创建后即可开始自动执行任务。
              </p>
              <p v-else>
                前往招聘驾驶舱，分配岗位让您的 AI 员工团队自动执行任务。
              </p>
            </div>
            <button
              v-if="!hasSubscription"
              class="ae-btn-primary ae-btn--lg"
              @click="goToBilling"
            >
              开通套餐
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
const activating = ref(false)

interface Agent {
  id: string
  name: string
  role: string
  agentType: string
  goal?: string
  capabilities: string[]
  status: string
  todayProgress?: number
  todayCompleted?: number
  totalTasks?: number
}

const agents = ref<Agent[]>([])
const toggling = ref<Record<string, boolean>>({})

const isLoggedIn = computed(() => {
  return !!authStore.token
})

const activeAgentCount = computed(() => {
  return agents.value.filter(a => a.status === 'active').length
})

const allCapabilities = computed(() => {
  const caps = new Set<string>()
  for (const a of agents.value) {
    for (const c of (a.capabilities || [])) {
      caps.add(c)
    }
  }
  return Array.from(caps)
})

function getAuthToken(): string {
  return authStore.token || localStorage.getItem('auth_token') || ''
}

function parseJsonField(field: any): string[] {
  if (!field) return []
  if (Array.isArray(field)) return field
  try {
    const parsed = JSON.parse(field)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getAgentColor(agentType: string): string {
  const colors: Record<string, string> = {
    'recruiter': 'linear-gradient(135deg, #F59E0B, #F97316)',
    'interview': 'linear-gradient(135deg, #8B5CF6, #A855F7)',
    'talent_analyst': 'linear-gradient(135deg, #EC4899, #F43F5E)',
    'talent_agent': 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    'career_advisor': 'linear-gradient(135deg, #10B981, #059669)',
    'hotspot_analyst': 'linear-gradient(135deg, #F59E0B, #EAB308)',
    'content_creator': 'linear-gradient(135deg, #3B82F6, #2563EB)',
    'media_operator': 'linear-gradient(135deg, #EF4444, #DC2626)',
    'finance_analyst': 'linear-gradient(135deg, #14B8A6, #0D9488)',
    'legal_advisor': 'linear-gradient(135deg, #6B7280, #4B5563)',
    'shortdrama_director': 'linear-gradient(135deg, #F97316, #EA580C)',
  }
  return colors[agentType] || 'linear-gradient(135deg, #6366F1, #4F46E5)'
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

    // 2. Agent profiles (all agents for this org)
    try {
      const profileRes = await fetch('/api/enterprise/agent-profiles', { headers })
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        const rawAgents = profileData?.data || []
        agents.value = rawAgents.map((a: any) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          agentType: a.agentType || a.agent_type,
          goal: a.goal,
          capabilities: parseJsonField(a.capabilities),
          status: a.status || 'active',
          todayProgress: a.todayProgress || 0,
          todayCompleted: a.todayCompleted || 0,
          totalTasks: a.totalTasks || 0,
        }))
      }
    } catch { /* non-fatal */ }

    error.value = null
  } catch (e: any) {
    console.error('Failed to load agent profiles:', e)
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

async function toggleAgent(agent: Agent) {
  toggling.value[agent.id] = true
  try {
    const token = getAuthToken()
    if (!token) return
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    const toggleRes = await fetch(`/api/enterprise/agent-profiles/${agent.id}/toggle`, {
      method: 'POST',
      headers,
    })
    if (toggleRes.ok) {
      const data = await toggleRes.json()
      agent.status = data?.data?.status || agent.status
    }
  } catch (e) {
    console.error('Failed to toggle agent:', e)
  } finally {
    toggling.value[agent.id] = false
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

/* ─── Agent Grid ─── */
.ae-agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.ae-agent-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ae-agent-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.08);
}

.ae-agent-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ae-agent-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ae-agent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ae-agent-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ae-agent-role {
  font-size: 13px;
  color: var(--color-text-muted);
}

.ae-agent-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.ae-agent-status--active {
  color: #4ADE80;
}

.ae-agent-status .ae-status-dot {
  width: 6px;
  height: 6px;
}

.ae-agent-goal {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ae-agent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ae-agent-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.08);
  color: #818CF8;
  white-space: nowrap;
}

.ae-agent-stats {
  display: flex;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-primary);
}

.ae-agent-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.ae-agent-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #818CF8;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.ae-agent-stat-label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
}

.ae-agent-actions {
  display: flex;
  gap: 8px;
}

.ae-btn--sm {
  padding: 6px 14px;
  font-size: 13px;
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

  .ae-agent-grid {
    grid-template-columns: 1fr;
  }
}
</style>
