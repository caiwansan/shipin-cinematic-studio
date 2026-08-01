<!-- UX-04: 企业招聘驾驶舱首页（Product Reality v2）
     首页 = 驾驶舱, 不是功能入口集合
     打开 5s 内: 企业 → AI团队 → 进度 → 下一步 -->
<template>
  <div class="rec-home">

    <!-- ─── Loading ─── -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-loading-spinner"></div>
      <div class="rec-loading-text">
        <p>正在加载招聘数据...</p>
        <span>AI 招聘团队正在为您准备今日信息</span>
      </div>
    </div>

    <!-- ─── Visitor Preview (未登录) ─── -->
    <div v-else-if="visitor" class="rec-visitor">
      <div class="rec-visitor-banner">
        <div class="rec-visitor-banner-content">
          <h2>企业招聘指挥中心</h2>
          <p>3 个 AI 员工 · 一键管理招聘全流程</p>
        </div>
        <button class="rec-btn-primary" @click="navigateTo('/login?redirect=' + encodeURIComponent('/workspace/enterprise'))">
          登录体验
        </button>
      </div>
      <div class="rec-visitor-features">
        <div v-for="f in visitorFeatures" :key="f.title" class="rec-vf-card">
          <strong>{{ f.title }}</strong>
          <span>{{ f.desc }}</span>
        </div>
      </div>
      <div class="rec-section">
        <h3 class="rec-sec-title">AI 招聘团队</h3>
        <div class="rec-agent-grid">
          <div v-for="a in PREVIEW_AGENTS" :key="a.name" class="rec-agent rec-agent--locked">
            <div class="rec-agent-avatar">{{ a.name.charAt(0) }}</div>
            <div class="rec-agent-info">
              <div class="rec-agent-name">{{ a.name }}</div>
              <div class="rec-agent-role">{{ a.role }}</div>
            </div>
            <div class="rec-agent-locked-icon">锁定</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── 无企业 ─── -->
    <div v-else-if="hasNoEnterprise" class="rec-empty rec-empty--centered">
      <h2>欢迎使用 AI 招聘中心</h2>
      <p>创建企业后，AI 招聘团队将自动为您工作</p>
      <button class="rec-btn-primary rec-btn--lg" @click="navigateTo('/workspace/enterprise/onboarding')">
        立即创建企业
      </button>
    </div>

    <!-- ─── 已登录：驾驶舱 ─── -->
    <template v-else>

      <!-- ═══ 1. 驾驶舱 Header ═══ -->
      <div class="rec-header">
        <div class="rec-header-left">
          <h1 class="rec-header-title">{{ enterpriseName || '招聘驾驶舱' }}</h1>
          <span class="rec-header-org">{{ displayOrgInfo }}</span>
        </div>
        <div class="rec-header-right">
          <div v-if="hasSubscription" class="rec-header-sub">
            <span class="rec-plan-badge" :class="'rec-plan-' + planTier">{{ planLabel }}</span>
            <span class="rec-plan-count">{{ agentData.length }} / {{ maxEmployees }} 名员工</span>
          </div>
          <button v-else class="rec-btn-outline rec-btn--sm" @click="navigateTo('/workspace/enterprise/billing')">
            升级套餐
          </button>
        </div>
      </div>

      <!-- ═══ 1b. Carol AI 招聘专员状态条 ═══ -->
      <div class="rec-carol-bar" v-if="hasSubscription && isDataLoaded">
        <div class="rec-carol-bar-identity">
          <div class="rec-carol-avatar">C</div>
          <div class="rec-carol-info">
            <span class="rec-carol-name">Carol</span>
            <span class="rec-carol-role">AI 招聘专员</span>
          </div>
          <span class="rec-carol-status" :class="{ 'rec-carol-status--active': carolStatus === 'active' }">
            <span class="rec-carol-dot"></span>
            {{ carolStatus === 'active' ? '工作中' : '等待任务' }}
          </span>
        </div>
        <div class="rec-carol-bar-stats">
          <div class="rec-carol-stat">
            <span class="rec-carol-stat-val">{{ carolStats.todayTasks }}</span>
            <span class="rec-carol-stat-lbl">今日任务</span>
          </div>
          <div class="rec-carol-stat">
            <span class="rec-carol-stat-val">{{ carolStats.analyzedCandidates }}</span>
            <span class="rec-carol-stat-lbl">分析简历</span>
          </div>
          <div class="rec-carol-stat">
            <span class="rec-carol-stat-val">{{ carolStats.highMatch }}</span>
            <span class="rec-carol-stat-lbl">推荐人才</span>
          </div>
          <div class="rec-carol-stat">
            <span class="rec-carol-stat-val">{{ carolStats.reportsGenerated }}</span>
            <span class="rec-carol-stat-lbl">报告</span>
          </div>
        </div>
        <button class="rec-btn-ghost" @click="navigateTo('/workspace/enterprise/ai-employees')">
          查看详情 →
        </button>
      </div>

      <!-- ═══ 1c. AI 大脑建议条（AI-CENTER-02B：规则+评分权重推荐，不自动切换）═══ -->
      <div class="rec-ai-suggest" v-if="hasSubscription && recLoaded && recList.length">
        <div class="rec-ai-suggest-main">
          <span class="rec-ai-suggest-badge">🧠 AI建议</span>
          <div class="rec-ai-suggest-block">
            <span class="rec-ai-suggest-lbl">当前AI配置</span>
            <strong class="rec-ai-suggest-val">{{ currentModelName }}</strong>
          </div>
          <span class="rec-ai-suggest-arrow">→</span>
          <div class="rec-ai-suggest-block">
            <span class="rec-ai-suggest-lbl">🔥 最适合招聘分析</span>
            <strong class="rec-ai-suggest-val rec-ai-suggest-val--reco">{{ recList[0]?.name }}</strong>
            <span class="rec-ai-suggest-score">{{ recList[0]?.score }}分</span>
          </div>
        </div>
        <div class="rec-ai-suggest-reasons">
          <span v-for="r in (recList[0]?.reasons || []).slice(0, 3)" :key="r" class="rec-ai-suggest-reason">{{ r }}</span>
        </div>
        <button class="rec-btn-outline rec-btn--sm" @click="navigateTo('/workspace/enterprise/model-settings')">切换模型</button>
      </div>

      <!-- ═══ 2. 招聘概览 (4 key metrics) ═══ -->
      <section class="rec-section">
        <h2 class="rec-sec-title">招聘概览</h2>
        <div v-if="!isDataLoaded" class="rec-metrics-grid">
          <div v-for="n in 4" :key="n" class="rec-metric-card rec-metric--skeleton">
            <div class="rec-skel-block" style="height:32px;width:60px;"></div>
          </div>
        </div>
        <div v-else class="rec-metrics-grid">
          <RecruitmentStatCard :value="overviewStats.positions" label="在招岗位" color="--color-decision" />
          <RecruitmentStatCard :value="overviewStats.candidates" label="候选人" color="--color-execution" />
          <RecruitmentStatCard :value="overviewStats.interviews" label="面试" color="--color-warning" />
          <RecruitmentStatCard :value="overviewStats.offers" label="Offer" color="--color-info" />
        </div>
      </section>

      <!-- ═══ 3. 今日招聘任务 — AI Employee Activity Feed ═══ -->
      <section class="rec-section" v-if="hasSubscription && isDataLoaded && !isEmpty">
        <h2 class="rec-sec-title">今日招聘任务</h2>
        <div class="rec-activity-feed">
          <div class="rec-activity-item" v-for="(a, idx) in agentActivityData" :key="idx">
            <div class="rec-activity-avatar" :class="'rec-activity-avatar--' + a.initial">{{ a.initial }}</div>
            <div class="rec-activity-body">
              <span class="rec-activity-name">{{ a.name }}</span>
              <span class="rec-activity-action">{{ a.action }}</span>
              <span v-if="a.taskType" class="rec-activity-tag">{{ a.taskLabel }}</span>
              <span v-else-if="a.status" class="rec-activity-tag rec-activity-tag--status">{{ a.status }}</span>
            </div>
            <span v-if="a.status" class="rec-activity-status">{{ a.status }}</span>
          </div>
          <div v-if="agentActivityData.length === 0 && !agentsLoading" class="rec-activity-empty">
            <span>AI 团队已就绪，正在等待您的第一个招聘指令</span>
          </div>
        </div>
      </section>

      <!-- ═══ 4. 招聘健康度 — Recruitment Health Score ═══ -->
      <section class="rec-section" v-if="hasSubscription && isDataLoaded">
        <h2 class="rec-sec-title">招聘健康度</h2>
        <div class="rec-health-grid">
          <div class="rec-health-bar-group">
            <div class="rec-health-bar-header">
              <span class="rec-health-bar-label">岗位推进</span>
              <span class="rec-health-bar-pct">{{ healthScores.jobPipeline }}%</span>
            </div>
            <div class="rec-health-bar-track">
              <div class="rec-health-bar-fill rec-hf-pipeline" :style="{ width: healthScores.jobPipeline + '%' }"></div>
            </div>
            <span class="rec-health-bar-desc">{{ healthScores.jobPipeline > 0 ? '草稿→招聘→面试推进中' : '完成第一次招聘后生成' }}</span>
          </div>

          <div class="rec-health-bar-group">
            <div class="rec-health-bar-header">
              <span class="rec-health-bar-label">人才供给</span>
              <span class="rec-health-bar-pct">{{ healthScores.talentSupply }}%</span>
            </div>
            <div class="rec-health-bar-track">
              <div class="rec-health-bar-fill rec-hf-talent" :style="{ width: healthScores.talentSupply + '%' }"></div>
            </div>
            <span class="rec-health-bar-desc">{{ healthScores.talentSupply > 0 ? '候选人储备与需求匹配度' : '完成第一次招聘后生成' }}</span>
          </div>

          <div class="rec-health-bar-group">
            <div class="rec-health-bar-header">
              <span class="rec-health-bar-label">面试效率</span>
              <span class="rec-health-bar-pct">{{ healthScores.interviewEfficiency }}%</span>
            </div>
            <div class="rec-health-bar-track">
              <div class="rec-health-bar-fill rec-hf-interview" :style="{ width: healthScores.interviewEfficiency + '%' }"></div>
            </div>
            <span class="rec-health-bar-desc">{{ healthScores.interviewEfficiency > 0 ? '面试完成率与推进效率' : '完成第一次招聘后生成' }}</span>
          </div>
        </div>
      </section>

      <!-- ═══ [Original Section 6 moved here] 下一步行动 ═══ -->
      <section class="rec-section">
        <h2 class="rec-sec-title">下一步行动</h2>

        <!-- Empty: 新企业引导 -->
        <div v-if="isEmpty" class="rec-welcome">
          <div class="rec-welcome-text">
            <h3>欢迎开始 AI 招聘</h3>
            <p>你的 AI 招聘团队已经准备好了。</p>
          </div>
          <div class="rec-welcome-steps">
            <div class="rec-ws-step">
              <span class="rec-ws-num">1</span>
              <div class="rec-ws-body">
                <strong>创建一个招聘岗位</strong>
                <span>填写职位信息，AI 自动优化 JD</span>
              </div>
            </div>
            <div class="rec-ws-step">
              <span class="rec-ws-num">—</span>
              <div class="rec-ws-body">
                <span class="rec-ws-auto">Alice 会自动帮你：</span>
              </div>
            </div>
            <div class="rec-ws-sub">
              <span>优化 JD</span>
              <span>制定筛选标准</span>
              <span>搜索人才</span>
            </div>
          </div>
          <button class="rec-btn-primary rec-btn--lg" @click="navigateTo('/workspace/enterprise/jobs')">
            创建岗位
          </button>
        </div>

        <!-- Has data: real actions -->
        <div v-else-if="nextActions.length > 0" class="rec-next-grid">
          <button v-for="(action, i) in nextActions" :key="i" class="rec-next-btn" @click="action.onClick">
            <span class="rec-next-title">{{ action.label }}</span>
            <span class="rec-next-badge" v-if="action.count > 0">{{ action.count }}</span>
            <span class="rec-next-arrow">→</span>
          </button>
        </div>
      </section>

      <!-- ═══ 招聘报告 ═══ -->
      <section class="rec-section" v-if="hasSubscription">
        <h2 class="rec-sec-title">招聘总结报告</h2>
        <div class="rec-report">
          <div v-if="reportLoading" class="rec-report-loading">
            <div class="rec-loading-spinner"></div>
            <span>正在生成报告...</span>
          </div>
          <div v-else-if="reportData" class="rec-report-content">
            <!-- Summary Stats -->
            <div class="rec-report-stats">
              <div class="rec-report-stat">
                <span class="rec-report-stat-val">{{ reportData.summary.totalJobs }}</span>
                <span class="rec-report-stat-lbl">岗位</span>
              </div>
              <div class="rec-report-stat">
                <span class="rec-report-stat-val">{{ reportData.summary.totalCandidates }}</span>
                <span class="rec-report-stat-lbl">候选人</span>
              </div>
              <div class="rec-report-stat">
                <span class="rec-report-stat-val">{{ reportData.summary.totalInterviews }}</span>
                <span class="rec-report-stat-lbl">面试</span>
              </div>
              <div class="rec-report-stat">
                <span class="rec-report-stat-val">{{ reportData.summary.invitedCount }}</span>
                <span class="rec-report-stat-lbl">面试邀请</span>
              </div>
              <div class="rec-report-stat">
                <span class="rec-report-stat-val">{{ reportData.summary.hiredCount }}</span>
                <span class="rec-report-stat-lbl">录用</span>
              </div>
            </div>

            <!-- Match Distribution -->
            <div class="rec-report-section">
              <span class="rec-report-sec-title">AI 匹配分布</span>
              <div class="rec-report-dist">
                <div class="rec-report-dist-item">
                  <span class="rec-report-dist-label">高匹配 (80+)</span>
                  <span class="rec-report-dist-val rec-report-dist-high">{{ reportData.summary.highMatch }}</span>
                </div>
                <div class="rec-report-dist-item">
                  <span class="rec-report-dist-label">中等 (60-79)</span>
                  <span class="rec-report-dist-val rec-report-dist-mid">{{ reportData.summary.mediumMatch }}</span>
                </div>
                <div class="rec-report-dist-item">
                  <span class="rec-report-dist-label">低匹配 (&lt;60)</span>
                  <span class="rec-report-dist-val rec-report-dist-low">{{ reportData.summary.lowMatch }}</span>
                </div>
              </div>
            </div>

            <!-- Insights -->
            <div class="rec-report-section" v-if="reportData.insights?.length">
              <span class="rec-report-sec-title">招聘洞察</span>
              <ul class="rec-report-insights">
                <li v-for="(insight, idx) in reportData.insights" :key="idx" class="rec-report-insight-item">{{ insight }}</li>
              </ul>
            </div>

            <!-- Job Distribution -->
            <div class="rec-report-section" v-if="reportData.jobDistribution?.length">
              <span class="rec-report-sec-title">岗位候选人分布</span>
              <div class="rec-report-jobs">
                <div v-for="job in reportData.jobDistribution" :key="job.jobTitle" class="rec-report-job">
                  <span class="rec-report-job-title">{{ job.jobTitle }}</span>
                  <span class="rec-report-job-count">{{ job.candidateCount }} 人</span>
                </div>
              </div>
            </div>

            <button class="rec-btn-ghost" @click="refreshReport">刷新报告</button>
          </div>
          <div v-else class="rec-report-empty">
            <p>点击生成招聘总结报告</p>
            <button class="rec-btn-primary rec-btn--sm" @click="generateReport" :disabled="reportLoading">
              生成报告
            </button>
          </div>
        </div>
      </section>

      <!-- ═══ 4.5 P0: AI 模型配置引导（KMKI BYOK）═══ -->
      <section v-if="hasSubscription && modelCheckDone && !modelConfigured" class="rec-section">
        <div class="rec-model-banner">
          <div class="rec-model-banner-icon">🔑</div>
          <div class="rec-model-banner-content">
            <h3 class="rec-model-banner-title">欢迎使用 AI 招聘团队</h3>
            <p class="rec-model-banner-text">
              您的 AI 员工需要连接您的大模型账号才能开始工作。<br/>
              请配置：① DeepSeek　② OpenAI　③ 火山引擎　④ 其他兼容模型<br/>
              配置完成后，<b>Alice 招聘顾问 · Bob 面试专家 · Carol 人才分析师</b> 即可开始工作。
            </p>
            <p class="rec-model-banner-hint">
              <span class="rec-model-banner-dot"></span>
              企业提供算力（BYOK），昆仑镜不托管您的 API Key，Key 加密存储仅归企业所有。
            </p>
          </div>
          <button class="rec-btn-primary" @click="navigateTo('/workspace/enterprise/model-settings')">
            立即配置 AI 模型
          </button>
        </div>
      </section>

      <!-- ═══ 5. AI 招聘团队 ═══ -->
      <section class="rec-section">
        <h2 class="rec-sec-title">我的 AI 招聘团队</h2>

        <!-- 已订阅 + 员工就绪 -->
        <div v-if="hasSubscription && agentData.length > 0" class="rec-agent-grid">
          <div v-for="agent in agentData" :key="agent.id" class="rec-agent">
            <div class="rec-agent-head">
              <div class="rec-agent-avatar">{{ agent.name.charAt(0) }}</div>
              <div class="rec-agent-meta">
                <span class="rec-agent-name">{{ agent.name }}</span>
                <span class="rec-agent-role">{{ getRoleLabel(agent.type) }}</span>
              </div>
              <span class="rec-agent-badge rec-agent-badge--online">工作中</span>
            </div>
            <div class="rec-agent-body">
              <div class="rec-agent-stat-row">
                <div class="rec-agent-stat">
                  <span class="rec-agent-stat-lbl">完成任务</span>
                  <span class="rec-agent-stat-val">{{ agent.totalTasks || 0 }}</span>
                </div>
                <div class="rec-agent-stat">
                  <span class="rec-agent-stat-lbl">模型</span>
                  <span class="rec-agent-stat-val">{{ agent.modelName || 'DeepSeek' }}</span>
                </div>
              </div>
              <div class="rec-agent-task" v-if="agent.recentTask">
                <span class="rec-agent-task-lbl">当前任务</span>
                <span class="rec-agent-task-text">{{ agent.recentTask }}</span>
              </div>
              <div class="rec-agent-footer">
                <button class="rec-btn-ghost" @click="navigateTo('/workspace/enterprise/AgentCapabilityCenter')">查看能力</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 已订阅 + 加载中 -->
        <div v-else-if="agentsLoading" class="rec-agent-grid">
          <div v-for="n in 3" :key="n" class="rec-agent rec-agent--skeleton">
            <div class="rec-skel-rect" style="width:36px;height:36px;border-radius:8px;"></div>
            <div class="rec-skel-rect" style="width:120px;height:14px;"></div>
            <div class="rec-skel-rect" style="width:80px;height:12px;"></div>
          </div>
        </div>

        <!-- 已订阅 + 无员工 -->
        <div v-else-if="hasSubscription && agentData.length === 0 && !agentsLoading" class="rec-agent-empty">
          <p>AI 员工正在准备中...</p>
          <button class="rec-btn-outline" @click="loadAgents()">刷新</button>
        </div>

        <!-- 未订阅：锁定预览 -->
        <div v-else class="rec-agent-grid">
          <div v-for="a in PREVIEW_AGENTS" :key="a.name" class="rec-agent rec-agent--locked">
            <div class="rec-agent-avatar">{{ a.name.charAt(0) }}</div>
            <div class="rec-agent-info">
              <div class="rec-agent-name">{{ a.name }}</div>
              <div class="rec-agent-role">{{ a.role }}</div>
            </div>
            <div class="rec-agent-locked-icon">试用</div>
          </div>
          <div class="rec-agent-upgrade">
            <p>订阅套餐后激活全部 AI 员工能力</p>
            <button class="rec-btn-primary" @click="navigateTo('/workspace/enterprise/billing')">升级套餐</button>
          </div>
        </div>
      </section>

    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise-workspace' })

import { getAuthToken } from '~/utils/auth/token'
import { useAuthStore } from '~/stores/auth'
import { resolvePlanInfo, getPlanLabel, getMaxEmployees } from '~/composables/enterprise/useEnterprisePlan'

/* ── Preview agents ── */
const PREVIEW_AGENTS = [
  { name: '招聘顾问 Alice', role: '招聘经理' },
  { name: '面试专家 Bob',   role: '面试官' },
  { name: '人才分析师 Carol', role: '人才分析师' },
]

const visitorFeatures = [
  { title: '职位管理', desc: 'AI 自动生成 JD，一键发布' },
  { title: '人才匹配', desc: 'AI 简历解析 + 智能推荐' },
  { title: 'AI 面试', desc: '自动生成面试问题 + 评分' },
  { title: '数据驾驶舱', desc: '全链路招聘数据实时追踪' },
]

/* ── Types ── */
interface EnterpriseHomeDTO {
  hasEnterprise?: boolean
  enterpriseName?: string
  message?: string
  todayMetrics: {
    conversations: number; interviews: number; campaigns: number
    newResumes: number; offers: number; hires: number
    pendingCandidates?: number; pendingJobs?: number; pendingResumes?: number
  }
  funnel: Array<{ label: string; value: number }>
  needsAttention: Array<{ label: string; count: number }>
  activityFeed: Array<{ time: string; text: string; type: string }>
  departmentHealth: { status: string; message: string; activeCount: number; pausedCount: number }
}

interface AgentBrief {
  id: string
  name: string
  type: string
  status: string
  totalTasks?: number
  recentTask?: string
}

interface SubscriptionDTO {
  planName?: string
  planTier?: string
  price?: number
  billingCycle?: string
  maxEmployees?: number
  status?: string
  expiresAt?: string
  hasSubscription?: boolean
}

/* ── Router / Auth ── */
const router = useRouter()
const auth = useAuthStore()

/* ── State ── */
const loading = ref(true)
const visitor = ref(false)
const isDataLoaded = ref(false)
const agentsLoading = ref(false)
const subLoading = ref(false)

const data = ref<EnterpriseHomeDTO | null>(null)
const agentData = ref<AgentBrief[]>([])
const subscriptionInfo = ref<SubscriptionDTO | null>(null)

/* ── P0: AI 模型配置引导（KMKI BYOK：首次使用需企业配置自己的模型 Key）── */
const modelConfigured = ref(false)

/* ── AI-CENTER-02B：AI 大脑建议条 ── */
const recLoaded = ref(false)
const recList = ref<Array<{ provider: string; name: string; score: number; reasons: string[] }>>([])
const currentModelName = ref('未配置')
const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek', openai: 'ChatGPT', anthropic: 'Claude', google: 'Gemini',
  zhipu: '智谱GLM', volcengine: '火山方舟', aliyun: '阿里百炼', moonshot: 'Kimi',
  tencent: '腾讯混元', baidu: '文心一言', iflytek: '讯飞星火', meituan: '美团龙猫',
}
async function loadAiSuggest() {
  try {
    const token = getAuthToken()
    if (!token) return
    // 1) 当前企业模型配置（BYOK）
    const mcRes = await fetch('/api/enterprise/model-config', { headers: { Authorization: `Bearer ${token}` } })
    if (mcRes.ok) {
      const settings: any[] = (await mcRes.json())?.data?.settings || []
      const active = settings.find((s: any) => s.hasCredential && s.healthStatus === 'ok')
      if (active) currentModelName.value = `${PROVIDER_NAMES[active.provider] || active.provider} · ${active.model}`
    }
    // 2) 招聘场景推荐（规则+权重，公开接口）
    const recRes = await fetch('/api/ai/recommendations?workspace=job').catch(() => null)
    if (recRes?.ok) {
      recList.value = (await recRes.json())?.data?.recommendations || []
    }
  } catch { /* non-fatal */ }
  recLoaded.value = true
}
const modelCheckDone = ref(false)

/* ── Report State ── */
const reportData = ref<any>(null)
const reportLoading = ref(false)

/* ── Carol State ── */
const carolStatus = ref('inactive')
const carolStats = ref({
  todayTasks: 0,
  analyzedCandidates: 0,
  highMatch: 0,
  reportsGenerated: 0,
})

/* ── Computed ── */
const hasNoEnterprise = computed(() => data.value?.hasEnterprise === false)
const hasSubscription = computed(() => {
  if (!subscriptionInfo.value) return false
  // billing.ts API 返回 hasSubscription 字段，优先使用
  if (subscriptionInfo.value.hasSubscription === false) return false
  // old API 或无 hasSubscription 字段时，检查是否有有效的订阅数据
  return !!(subscriptionInfo.value.status || subscriptionInfo.value.planName || subscriptionInfo.value.planTier)
})
const maxEmployees = computed(() => subscriptionInfo.value?.maxEmployees || 0)
const enterpriseName = computed(() => data.value?.enterpriseName || '')

const planTier = computed(() => {
  return resolvePlanInfo(subscriptionInfo.value).tier
})

const planLabel = computed(() => {
  return getPlanLabel(subscriptionInfo.value)
})

const displayOrgInfo = computed(() => {
  const parts: string[] = []
  if (enterpriseName.value) parts.push(enterpriseName.value)
  if (hasSubscription.value) {
    const maxEmp = getMaxEmployees(subscriptionInfo.value)
    parts.push(`${planLabel.value}`)
    parts.push(`${agentData.value.length}/${maxEmp} 名员工`)
  }
  return parts.join(' · ') || '企业招聘中心'
})

/** 所有 funnel 全零 + 核心指标为零 → 空状态 */
const isEmpty = computed(() => {
  if (!data.value || hasNoEnterprise.value) return false
  const m = data.value.todayMetrics
  const f = data.value.funnel
  return f.every(s => s.value === 0) && m.conversations === 0 && m.interviews === 0 && m.campaigns === 0
})

/* ── 招聘概览 (4 key stats from funnel) ── */
const healthScores = computed(() => {
  const f = data.value?.funnel || []
  const getF = (label: string) => {
    const s = f.find(x => x.label === label)
    return s ? s.value : 0
  }
  const totalJobs = getF('职位')
  const candidates = getF('收到简历')
  const interviews = getF('面试')
  const offers = getF('Offer')

  const jobPipeline = totalJobs > 0 ? Math.min(100, Math.round((getF('面试') / Math.max(totalJobs, 1)) * 100)) : 0
  const talentSupply = totalJobs > 0 ? Math.min(100, Math.round((candidates / Math.max(totalJobs, 10)) * 100)) : 0
  const interviewEfficiency = candidates > 0 ? Math.min(100, Math.round((interviews / Math.max(candidates, 1)) * 100)) : 0

  return { jobPipeline, talentSupply, interviewEfficiency }
})

const overviewStats = computed(() => {
  const f = data.value?.funnel || []
  const getVal = (label: string) => {
    const s = f.find(x => x.label === label)
    return s ? s.value : 0
  }
  return {
    positions: getVal('职位'),
    candidates: getVal('收到简历'),
    interviews: getVal('面试'),
    offers: getVal('Offer'),
  }
})

/* ── 下一步行动 ── */
interface NextAction {
  label: string
  count: number
  onClick: () => void
}

const nextActions = computed<NextAction[]>(() => {
  if (!data.value || isEmpty.value) return []
  const m = data.value.todayMetrics
  const actions: NextAction[] = []

  if ((m.pendingJobs || 0) > 0) {
    actions.push({
      label: '处理待发布职位', count: m.pendingJobs || 0,
      onClick: () => router.push('/workspace/enterprise/jobs'),
    })
  }
  if ((m.pendingCandidates || 0) > 0) {
    actions.push({
      label: '筛选推荐候选人', count: m.pendingCandidates || 0,
      onClick: () => router.push('/workspace/enterprise/candidates'),
    })
  }
  if ((m.pendingResumes || 0) > 0) {
    actions.push({
      label: '审阅待处理简历', count: m.pendingResumes || 0,
      onClick: () => router.push('/workspace/enterprise/candidates'),
    })
  }
  if (m.interviews > 0) {
    actions.push({
      label: '安排面试', count: m.interviews,
      onClick: () => router.push('/workspace/enterprise/interview'),
    })
  }
  if (m.offers > 0) {
    actions.push({
      label: '发送 Offer', count: m.offers,
      onClick: () => router.push('/workspace/enterprise/interview'),
    })
  }

  // Fallback: next step when no urgent items
  if (actions.length === 0) {
    actions.push({
      label: '创建新招聘岗位', count: 0,
      onClick: () => router.push('/workspace/enterprise/jobs'),
    })
  }

  return actions
})

/* ── AI 今日任务 ── */
const agentActivityData = computed(() => {
  if (!agentData.value.length) return []
  return agentData.value
    .filter(a => a.recentTask)
    .map(a => ({
      name: a.name,
      initial: a.name.charAt(0),
      action: a.recentTask || '工作中',
      status: a.status === 'active' ? '进行中' : '等待查看',
      taskType: a.taskType || '',
      taskLabel: getTaskTypeLabel(a.taskType || ''),
    }))
})

function getTaskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    jd_generation: 'JD生成',
    candidate_search: '人才搜索',
    interview_eval: '面试评估',
    matching: '智能匹配',
    resume_screening: '简历筛选',
    report: '报告生成',
    job_optimization: '岗位优化',
    candidate_analysis: '候选人分析',
    interview_questions: '面试题生成',
  }
  return labels[type] || ''
}

/* ── 漏斗 ── */
const funnelStages = computed(() => {
  return data.value?.funnel || []
})

/* ── Helpers ── */
function getRoleLabel(type: string): string {
  const labels: Record<string, string> = {
    recruiter: '招聘经理',
    interview: '面试官',
    talent_analyst: '人才分析师',
    interviewer: '面试官',
  }
  return labels[type] || 'AI 员工'
}

function navigateTo(path: string) {
  router.push(path)
}

/* ── Data Loading ── */
async function loadData() {
  loading.value = true
  try {
    const token = getAuthToken()
    if (!token) {
      visitor.value = true
      return
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    const res = await fetch('/api/enterprise/home', { headers })
    if (res.status === 401) {
      visitor.value = true
      return
    }
    if (res.ok) {
      const json = await res.json()
      if (json.todayMetrics) {
        data.value = json as EnterpriseHomeDTO
      }
    }
  } catch {
    visitor.value = true
  } finally {
    isDataLoaded.value = true
    loading.value = false
  }
}

async function loadSubscription() {
  subLoading.value = true
  try {
    const token = getAuthToken()
    if (!token) return
    const res = await fetch('/api/enterprise/subscription/current', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      subscriptionInfo.value = json?.data || json || null
    }
  } catch {
    // non-fatal
  } finally {
    subLoading.value = false
  }
}

async function loadAgents() {
  agentsLoading.value = true
  try {
    const token = getAuthToken()
    if (!token) return
    const res = await fetch('/api/enterprise/agent-profiles', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      if (json?.data) {
        agentData.value = json.data.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.agentType || a.type || 'recruiter',
          status: a.status || 'active',
          totalTasks: a.totalTasks || 0,
          recentTask: a.recentTask || '',
          taskType: a.taskType || a.recentTaskType || '',
        }))

        // Find Carol for dashboard identity card
        const carol = json.data.find((a: any) => {
          const name = (a.shortName || a.name || '').toLowerCase()
          return name.includes('carol') || name === 'c'
        })
        if (carol) {
          carolStatus.value = carol.status || 'inactive'
        }
      }
    }

    // P0: 检测企业是否已配置模型（OrgModelConfig + ProviderCredential 权威）
    // 未配置 → 显示引导横幅 → 跳转 AI模型设置
    try {
      const token2 = getAuthToken()
      if (!token2) return
      const mcRes = await fetch('/api/enterprise/model-config', {
        headers: { Authorization: `Bearer ${token2}` },
      })
      if (mcRes.ok) {
        const mcJson = await mcRes.json()
        const settings: any[] = mcJson?.data?.settings || []
        modelConfigured.value = settings.some((s: any) => s.hasCredential && s.healthStatus === 'ok')
      }
    } catch { /* non-fatal */ }
    modelCheckDone.value = true

    // Load Carol stats from report API
    try {
      const token3 = getAuthToken()
      if (!token3) return
      const reportRes = await fetch('/api/enterprise/reports/summary', {
        headers: { Authorization: `Bearer ${token3}` },
      })
      if (reportRes.ok) {
        const reportJson = await reportRes.json()
        if (reportJson.success && reportJson.report?.summary) {
          const s = reportJson.report.summary
          carolStats.value = {
            todayTasks: s.totalJobs || 0,
            analyzedCandidates: s.totalCandidates || 0,
            highMatch: s.highMatch || 0,
            reportsGenerated: 1,
          }
        }
      }
    } catch { /* non-fatal */ }
  } catch {
    // non-fatal
  } finally {
    agentsLoading.value = false
  }
}

onMounted(async () => {
  await auth.restoreSession()
  loadData()
  loadSubscription()
  loadAgents()
  loadAiSuggest()
})

/* ── Report Functions ── */
async function generateReport() {
  reportLoading.value = true
  try {
    const token = getAuthToken()
    if (!token) return
    const res = await fetch('/api/enterprise/reports/summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.report) {
        reportData.value = json.report
      }
    }
  } catch {
    // non-fatal
  } finally {
    reportLoading.value = false
  }
}

async function refreshReport() {
  await generateReport()
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════
   Recruitment Home — Product IA v2 (Driving Cockpit)
   以招聘运营效率为中心，非功能入口集合
   ═══════════════════════════════════════════════════ */

/* ── P0: AI 模型配置引导横幅（KMKI BYOK）── */
.rec-model-banner {
  display: flex;
  align-items: center;
  gap: var(--space-lg, 20px);
  padding: 20px 24px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08));
  border: 1px solid rgba(99,102,241,0.35);
}
.rec-model-banner-icon {
  font-size: 34px;
  flex-shrink: 0;
}
.rec-model-banner-content {
  flex: 1;
  min-width: 0;
}
.rec-model-banner-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--color-text-primary, #e8ecf4);
}
.rec-model-banner-text {
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-secondary, #9aa4b8);
  margin: 0 0 8px 0;
}
.rec-model-banner-text b {
  color: var(--color-text-primary, #e8ecf4);
}
.rec-model-banner-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted, #6b7688);
  margin: 0;
}
.rec-model-banner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  flex-shrink: 0;
}
.rec-model-banner .rec-btn-primary {
  flex-shrink: 0;
  white-space: nowrap;
}

.rec-home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-height: 100vh;
  background: var(--color-bg-primary, #0D1328);
  color: var(--color-text-primary, #E2E8F0);
}

/* ─── Section Title ─── */
.rec-sec-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary, #94A3B8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px;
}

/* ─── Buttons ─── */
.rec-btn-primary {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  background: #6366F1;
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}
.rec-btn-primary:hover { background: #4F46E5; }
.rec-btn-primary--sm { padding: 6px 14px; font-size: 13px; }
.rec-btn--lg { padding: 12px 28px; font-size: 15px; }

.rec-btn-outline {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
  color: var(--color-text-secondary, #94A3B8);
  cursor: pointer;
  transition: all 0.15s;
}
.rec-btn-outline:hover {
  background: var(--color-bg-elevated, #1E293B);
  color: var(--color-text-primary);
}
.rec-btn-outline--sm { padding: 6px 14px; font-size: 13px; }

.rec-btn-ghost {
  padding: 4px 10px;
  font-size: 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #818CF8;
  cursor: pointer;
  transition: background 0.15s;
}
.rec-btn-ghost:hover { background: rgba(99, 102, 241, 0.08); }

/* ─── 1. 驾驶舱 Header ─── */
.rec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
  flex-wrap: wrap;
  gap: 12px;
}

.rec-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rec-header-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary, #E2E8F0);
  margin: 0;
  letter-spacing: -0.3px;
}

.rec-header-org {
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
}

.rec-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rec-header-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
}

.rec-plan-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
.rec-plan-free {
  background: rgba(148, 163, 184, 0.12);
  color: #94A3B8;
}
.rec-plan-basic {
  background: rgba(99, 102, 241, 0.12);
  color: #818CF8;
}
.rec-plan-trial {
  background: rgba(148, 163, 184, 0.12);
  color: #94A3B8;
}
.rec-plan-professional {
  background: rgba(52, 211, 153, 0.12);
  color: #34D399;
}
.rec-plan-pro {
  background: rgba(52, 211, 153, 0.12);
  color: #34D399;
}
.rec-plan-enterprise {
  background: rgba(251, 191, 36, 0.12);
  color: #FBBF24;
}

.rec-plan-count {
  color: var(--color-text-muted, #64748B);
}

/* ─── 2. 招聘概览 ─── */
.rec-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.rec-metric-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 24px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
}

.rec-metric--skeleton {
  padding: 16px 24px;
}

.rec-metric-val {
  font-size: 30px;
  font-weight: 700;
  color: #818CF8;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.rec-metric-lbl {
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
  font-weight: 500;
}

.rec-skel-block {
  height: 80px;
  background: var(--color-bg-secondary, #1E293B);
  border-radius: 10px;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }

/* ─── 3. 下一步行动 ─── */
.rec-welcome {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 32px 28px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
}

.rec-welcome-text h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 4px;
}

.rec-welcome-text p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.rec-welcome-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rec-ws-step {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rec-ws-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #6366F1;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rec-ws-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rec-ws-body strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.rec-ws-body span {
  font-size: 13px;
  color: var(--color-text-muted);
}

.rec-ws-auto {
  font-size: 13px;
  color: #818CF8;
}

.rec-ws-sub {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 38px;
  color: var(--color-text-secondary, #94A3B8);
  font-size: 13px;
}

.rec-next-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.rec-next-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  font-size: inherit;
  text-align: left;
  width: 100%;
}
.rec-next-btn:hover {
  border-color: #6366F1;
  background: rgba(99, 102, 241, 0.04);
}

.rec-next-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.rec-next-badge {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  padding: 2px 8px;
  background: #6366F1;
  border-radius: 10px;
}

.rec-next-arrow {
  font-size: 14px;
  color: var(--color-text-muted, #475569);
  transition: transform 0.15s;
}
.rec-next-btn:hover .rec-next-arrow {
  transform: translateX(3px);
}

/* ─── 4. AI 招聘团队 ─── */
.rec-agent-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.rec-agent {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
  transition: border-color 0.15s;
}
.rec-agent:hover {
  border-color: rgba(99, 102, 241, 0.3);
}
.rec-agent--locked {
  opacity: 0.55;
  position: relative;
  cursor: default;
}
.rec-agent--locked:hover {
  border-color: var(--color-border-primary, #1E293B);
}

.rec-agent-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rec-agent-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rec-agent-meta {
  flex: 1;
  min-width: 0;
}

.rec-agent-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.rec-agent-role {
  font-size: 12px;
  color: var(--color-text-muted, #64748B);
}

.rec-agent-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.rec-agent-badge--online {
  background: rgba(34, 197, 94, 0.1);
  color: #4ADE80;
}

.rec-agent-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-muted, #64748B);
}

.rec-agent-stat-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.rec-agent-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rec-agent-stat-lbl {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.rec-agent-stat-val {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #E2E8F0);
  font-variant-numeric: tabular-nums;
}

.rec-agent-task {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-primary, #1E293B);
}

.rec-agent-task-lbl {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.rec-agent-task-text {
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
  line-height: 1.4;
}

.rec-agent-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-primary, #1E293B);
}

.rec-agent-locked-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.15);
  color: #94A3B8;
}

.rec-agent--skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
}
.rec-skel-rect {
  background: var(--color-bg-secondary, #1E293B);
  border-radius: 6px;
  height: 14px;
  animation: pulse 1.5s ease-in-out infinite;
}

.rec-agent-empty {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--color-bg-elevated, #111827);
  border: 1px dashed var(--color-border-primary, #1E293B);
  border-radius: 10px;
}
.rec-agent-empty p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.rec-agent-upgrade {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 20px;
  background: var(--color-bg-elevated, #111827);
  border: 1px dashed rgba(99, 102, 241, 0.3);
  border-radius: 10px;
  text-align: center;
  grid-column: 1 / -1;
}
.rec-agent-upgrade p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* ─── 4. 招聘健康度 ─── */
.rec-health-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
}

.rec-health-bar-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rec-health-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rec-health-bar-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #E2E8F0);
}

.rec-health-bar-pct {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary, #E2E8F0);
  font-variant-numeric: tabular-nums;
}

.rec-health-bar-track {
  width: 100%;
  height: 8px;
  background: var(--color-bg-secondary, #1E293B);
  border-radius: 4px;
  overflow: hidden;
}

.rec-health-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}

.rec-hf-pipeline {
  background: linear-gradient(90deg, #6366F1, #8B5CF6);
}

.rec-hf-talent {
  background: linear-gradient(90deg, #10B981, #34D399);
}

.rec-hf-interview {
  background: linear-gradient(90deg, #F59E0B, #F97316);
}

.rec-health-bar-desc {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
}

/* ─── Loading ─── */
.rec-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 80px 24px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
}

.rec-loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--color-border-primary, #1E293B);
  border-top-color: #6366F1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.rec-loading-text p {
  margin: 0;
  font-weight: 600;
  color: var(--color-text-primary);
  font-size: 14px;
  text-align: center;
}
.rec-loading-text span {
  font-size: 13px;
  color: var(--color-text-muted);
}

/* ─── Empty ─── */
.rec-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 24px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
}
.rec-empty--centered { padding: 80px 24px; }

.rec-empty h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}
.rec-empty p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 24px;
  max-width: 480px;
}

/* ─── Visitor ─── */
.rec-visitor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rec-visitor-banner {
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
  padding: 40px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.rec-visitor-banner-content h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 4px;
}
.rec-visitor-banner-content p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.rec-visitor-features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.rec-vf-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 20px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
}
.rec-vf-card strong {
  font-size: 14px;
  color: var(--color-text-primary);
}
.rec-vf-card span {
  font-size: 13px;
  color: var(--color-text-muted);
}

/* ─── Section wrapper (generic) ─── */
/* ─── 今日招聘行动 ─── */
.rec-activity-feed {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
}

.rec-activity-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.rec-activity-item + .rec-activity-item {
  border-top: 1px solid var(--color-border-primary, #1E293B);
}

.rec-activity-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.rec-activity-avatar--A {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
}
.rec-activity-avatar--B {
  background: linear-gradient(135deg, #10B981, #34D399);
}
.rec-activity-avatar--C {
  background: linear-gradient(135deg, #F59E0B, #F97316);
}

.rec-activity-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.rec-activity-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary, #E2E8F0);
}

.rec-activity-action {
  font-size: 12px;
  color: var(--color-text-secondary, #94A3B8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.rec-activity-tag {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(99, 102, 241, 0.1);
  color: #818CF8;
  flex-shrink: 0;
}

.rec-activity-tag--status {
  background: rgba(251, 191, 36, 0.1);
  color: #FBBF24;
}

.rec-activity-status {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted, #64748B);
  flex-shrink: 0;
}

.rec-activity-empty {
  padding: 12px 0;
  font-size: 13px;
  color: var(--color-text-muted, #64748B);
  text-align: center;
}

.rec-section {
  display: flex;
  flex-direction: column;
}

/* ─── Agent info (shared) ─── */
.rec-agent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ─── Responsive ─── */
@media (max-width: 1024px) {
  .rec-agent-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .rec-agent-grid { grid-template-columns: 1fr; }
  .rec-metrics-grid { grid-template-columns: 1fr; }
  .rec-next-grid { grid-template-columns: 1fr; }
  .rec-header { flex-direction: column; align-items: flex-start; }
  .rec-visitor-features { grid-template-columns: 1fr; }
  .rec-visitor-banner { flex-direction: column; text-align: center; }
  .rec-health-grid { gap: 12px; }
}

/* ─── 招聘报告 ─── */
.rec-report {
  padding: 20px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
}

.rec-report-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.rec-report-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.rec-report-empty p {
  margin: 0;
}

.rec-report-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rec-report-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.rec-report-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-secondary, #1E293B);
  border-radius: 8px;
}

.rec-report-stat-val {
  font-size: 22px;
  font-weight: 700;
  color: #818CF8;
  line-height: 1.2;
}

.rec-report-stat-lbl {
  font-size: 12px;
  color: var(--color-text-muted, #64748B);
  margin-top: 2px;
}

.rec-report-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rec-report-sec-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #E2E8F0);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border-primary, #1E293B);
}

.rec-report-dist {
  display: flex;
  gap: 10px;
}

.rec-report-dist-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-secondary, #1E293B);
  border-radius: 8px;
}

.rec-report-dist-label {
  font-size: 12px;
  color: var(--color-text-muted, #64748B);
}

.rec-report-dist-val {
  font-size: 20px;
  font-weight: 700;
  margin-top: 4px;
}

.rec-report-dist-high { color: #10B981; }
.rec-report-dist-mid { color: #F59E0B; }
.rec-report-dist-low { color: #EF4444; }

.rec-report-insights {
  margin: 0;
  padding: 0 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rec-report-insight-item {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary, #94A3B8);
}

.rec-report-jobs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rec-report-job {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-bg-secondary, #1E293B);
  border-radius: 6px;
}

.rec-report-job-title {
  font-size: 13px;
  color: var(--color-text-primary, #E2E8F0);
}

.rec-report-job-count {
  font-size: 13px;
  font-weight: 600;
  color: #818CF8;
}

@media (max-width: 768px) {
  .rec-report-stats {
    grid-template-columns: repeat(3, 1fr);
  }
  .rec-report-dist {
    flex-direction: column;
  }
}

/* ─── Carol AI 招聘专员状态条 ─── */
.rec-carol-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
}

.rec-carol-bar-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.rec-carol-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #F59E0B, #F97316);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rec-carol-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rec-carol-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #E2E8F0);
  line-height: 1.3;
}

.rec-carol-role {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
}

.rec-carol-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted, #64748B);
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.08);
  margin-left: 4px;
}

.rec-carol-status--active {
  color: #4ADE80;
  background: rgba(74, 222, 128, 0.08);
}

.rec-carol-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.rec-carol-status--active .rec-carol-dot {
  background: #4ADE80;
}

.rec-carol-bar-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  justify-content: center;
}

.rec-carol-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.rec-carol-stat-val {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary, #E2E8F0);
  font-variant-numeric: tabular-nums;
}

.rec-carol-stat-lbl {
  font-size: 10px;
  color: var(--color-text-muted, #64748B);
}

.rec-carol-bar .rec-btn-ghost {
  flex-shrink: 0;
}

/* ── AI-CENTER-02B：AI 大脑建议条 ── */
.rec-ai-suggest {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  margin-top: 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.10), rgba(245, 158, 11, 0.06));
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 10px;
  flex-wrap: wrap;
}
.rec-ai-suggest-main {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.rec-ai-suggest-badge {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  padding: 4px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  flex-shrink: 0;
}
.rec-ai-suggest-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rec-ai-suggest-lbl {
  font-size: 10px;
  color: var(--color-text-muted, #9CA3AF);
}
.rec-ai-suggest-val {
  font-size: 13px;
  color: var(--color-text-primary, #F9FAFB);
  font-weight: 600;
}
.rec-ai-suggest-val--reco {
  color: #F59E0B;
}
.rec-ai-suggest-score {
  font-size: 12px;
  font-weight: 700;
  color: #F97316;
}
.rec-ai-suggest-arrow {
  color: rgba(245, 158, 11, 0.6);
  font-size: 14px;
}
.rec-ai-suggest-reasons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}
.rec-ai-suggest-reason {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.10);
  border: 1px solid rgba(99, 102, 241, 0.18);
  color: #A5B4FC;
}
</style>
