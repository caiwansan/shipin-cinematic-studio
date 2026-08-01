<!--
  Sprint-MEDIA-DESIGN-SYSTEM-01 — AI 新媒体运营总控中心（世界级 UI 重构）
  结构: Hero(标题+CTA+运营状态) → 我的AI团队 → 内容生产流水线 → 客户运营中心 → 数据洞察 → 运营轨迹/行业智能 → 最近执行/成本
  数据源: GET /api/enterprise/media/overview（唯一驾驶舱数据源）
  诚实原则: 数字 = 真实计数；无数据 → 产品化空态（禁 mock）
  视觉: Media Design Language（media-tokens.css，基于 Kunlun）
-->
<template>
  <MediaWorkspaceShell>
    <!-- ═══ 身份引导（登录过期 → 弹窗登录；个人空间 → 欢迎引导）═══ -->
    <div v-if="identityState === 'login-expired'" class="dash-identity-error">
      <b>🔐 登录已过期</b>
      <span>当前会话已失效，请重新登录后再进入你的新媒体运营空间。</span>
      <NuxtLink to="/?showLogin=1&redirect=/workspace/media" class="dash-identity-btn">去登录 →</NuxtLink>
    </div>
    <div v-else-if="identityState === 'personal-space'" class="dash-identity-ok">
      <b>🚀 欢迎，这是你的个人 AI 新媒体运营空间</b>
      <span>无需企业身份，绑定你的平台账号（公众号 / 抖音 / 小红书 / 视频号）即可开始 AI 运营。</span>
    </div>

    <!-- ═══ Hero · 总控中心 ═══ -->
    <section class="hero">
      <div class="hero-grid"></div>
      <div class="hero-glow hero-glow-a"></div>
      <div class="hero-glow hero-glow-b"></div>

      <div class="hero-body">
        <div class="hero-kicker">
          <span class="hero-kicker-dot"></span>
          AI MEDIA OPERATIONS · 你的 AI 新媒体部门
        </div>
        <h1 class="hero-title">
          AI 新媒体运营<span class="hero-title-accent">总控中心</span>
        </h1>
        <p class="hero-desc">
          {{ agents.length
            ? '你的 AI 团队正在工作——内容生产、客户运营、数据洞察，全部自动执行，成果回流这里。'
            : '你的 AI 团队正在等待启动——连接渠道资产、解锁 AI 员工，新媒体运营将全自动执行。' }}
        </p>
        <div class="hero-cta">
          <NuxtLink to="/workspace/media/accounts" class="hero-btn hero-btn-primary">
            🔗 连接渠道资产
          </NuxtLink>
          <button v-if="!agents.length" class="hero-btn hero-btn-ghost" @click="showSubscribe = true">
            🤖 解锁 AI 团队 →
          </button>
          <NuxtLink v-else to="/workspace/media/team" class="hero-btn hero-btn-ghost">
            🤖 查看 AI 团队 →
          </NuxtLink>
        </div>
        <div class="hero-hint">
          {{ agents.length
            ? `${activeCount} 名 AI 员工运行中 · 今日已完成 ${today.completed} 项任务`
            : '免费查看完整价值地图 · 订阅后 AI 员工自动部署并开始工作' }}
        </div>
      </div>

      <!-- 运营状态（Hero 右侧 · 三大指标） -->
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-ico ai">🤖</div>
          <div class="hero-stat-num">{{ agents.length }}<span class="hero-stat-unit">/5</span></div>
          <div class="hero-stat-label">AI 员工</div>
          <div class="hero-stat-sub">{{ agents.length ? activeCount + ' 名运行中' : '待启动' }}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-ico ch">🌐</div>
          <div class="hero-stat-num">{{ channels.connected }}<span class="hero-stat-unit">/{{ channels.total }}</span></div>
          <div class="hero-stat-label">渠道已连接</div>
          <div class="hero-stat-sub">{{ channels.connected ? 'AI 可执行运营' : '连接后 AI 开始工作' }}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-ico tk">✅</div>
          <div class="hero-stat-num">{{ today.completed }}<span class="hero-stat-unit">/{{ today.completed + today.pendingSchedules }}</span></div>
          <div class="hero-stat-label">今日任务</div>
          <div class="hero-stat-sub">{{ today.pendingSchedules ? today.pendingSchedules + ' 项待执行' : '暂无排程' }}</div>
        </div>
      </div>
    </section>

    <!-- ═══ 我的 AI 团队 ═══ -->
    <section class="sec">
      <div class="sec-head">
        <div class="sec-head-left">
          <span class="sec-ico">🤖</span>
          <div>
            <h2 class="sec-title">我的 AI 团队</h2>
            <p class="sec-sub">免费查看完整编制 · 订阅后自动部署并开始工作</p>
          </div>
        </div>
        <NuxtLink to="/workspace/media/team" class="sec-more">进入团队工作台 →</NuxtLink>
      </div>

      <div v-if="agents.length" class="team-grid">
        <div
          v-for="a in agents" :key="a.instanceId"
          class="team-card" @click="$router.push('/workspace/media/team')"
        >
          <div class="team-card-avatar" :class="stateClass(a.lifecycleState)">{{ a.avatar || a.name[0] }}</div>
          <div class="team-card-meta">
            <div class="team-card-name">{{ a.name }}</div>
            <div class="team-card-role">{{ a.role }}</div>
          </div>
          <span class="team-card-state" :class="stateClass(a.lifecycleState)">{{ stateText(a.lifecycleState) }}</span>
          <div class="team-card-stats">
            <span>{{ a.totalTasks }} 任务</span>
            <span>{{ a.totalErrors }} 错误</span>
            <span>{{ a.lastActiveAt ? '活跃 ' + fmtTime(a.lastActiveAt) : '未活跃' }}</span>
          </div>
        </div>
      </div>

      <div v-else class="team-grid">
        <div v-for="m in teamRoster" :key="m.name" class="team-card is-locked" @click="showSubscribe = true">
          <div class="team-card-avatar roster">{{ m.avatar }}</div>
          <div class="team-card-meta">
            <div class="team-card-name">{{ m.name }}</div>
            <div class="team-card-role">{{ m.role }}</div>
          </div>
          <span class="team-card-lock">🔒 订阅解锁</span>
          <div class="team-card-duty">“{{ m.duty }}”</div>
          <div class="team-card-value">→ {{ m.value }}</div>
        </div>
      </div>

      <div v-if="!agents.length" class="sec-cta">
        <button class="sec-cta-btn" @click="showSubscribe = true">解锁 AI 新媒体团队</button>
        <span class="sec-cta-note">订阅后：自动部署 AI 员工 · 绑定渠道资产 · 开始自动运营 · 成果回流总控中心</span>
      </div>
    </section>

    <!-- ═══ 内容生产流水线 ═══ -->
    <section class="sec">
      <div class="sec-head">
        <div class="sec-head-left">
          <span class="sec-ico">🏭</span>
          <div>
            <h2 class="sec-title">内容生产流水线</h2>
            <p class="sec-sub">战略 → 选题 → 创作 → 审核 → 发布 → 复盘 · AI 员工自动执行</p>
          </div>
        </div>
        <NuxtLink to="/workspace/media/content" class="sec-more">进入内容车间 →</NuxtLink>
      </div>

      <div class="factory">
        <div v-for="(s, i) in factoryStages" :key="s.key" class="factory-node">
          <div class="factory-ico">{{ s.icon }}</div>
          <div class="factory-num">{{ i + 1 }}</div>
          <div class="factory-name">{{ s.name }}</div>
          <div class="factory-worker">{{ s.worker }}</div>
          <span class="factory-ai">AI 自动</span>
        </div>
        <span v-for="i in 5" :key="'a' + i" class="factory-arrow">→</span>
      </div>
    </section>

    <!-- ═══ 客户运营中心 ═══ -->
    <section class="sec">
      <div class="sec-head">
        <div class="sec-head-left">
          <span class="sec-ico">💬</span>
          <div>
            <h2 class="sec-title">客户运营中心</h2>
            <p class="sec-sub">客户进入 → AI 理解需求 → 价值判断 → 自动回复 → 销售机会 → 人工接管</p>
          </div>
        </div>
        <NuxtLink to="/workspace/media/messages" class="sec-more">进入客户运营 →</NuxtLink>
      </div>

      <div class="cust-flow">
        <div v-for="(c, i) in custStages" :key="c.key" class="cust-node">
          <span class="cust-num">{{ i + 1 }}</span>
          <span class="cust-ico">{{ c.icon }}</span>
          <div class="cust-meta">
            <div class="cust-name">{{ c.name }}</div>
            <div class="cust-sub">{{ c.sub }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 数据洞察（健康环 + KPI）═══ -->
    <section class="sec">
      <div class="sec-head">
        <div class="sec-head-left">
          <span class="sec-ico">📊</span>
          <div>
            <h2 class="sec-title">数据洞察</h2>
            <p class="sec-sub">真实数据回流 · 诚实展示 · 禁 mock</p>
          </div>
        </div>
      </div>

      <div class="insight">
        <div class="insight-health">
          <MediaHealthRing :score="healthScore" foot="今日任务完成率 · 真实计算（agent_outcome + agent_schedule + 错误惩罚）" />
        </div>
        <div class="insight-kpis">
          <MediaKpiCard
            icon="📝" label="内容生产" :value="today.completed ? String(today.completed) : '0'"
            :sub="today.completed ? `今日完成 ${today.completed} 项任务` : '今日暂无任务记录'"
            source="agent_outcome" accent="green"
          />
          <MediaKpiCard
            icon="💬" label="互动" :value="null"
            empty-text="等待微信消息接入" source="SocialMetricsSnapshot"
          />
          <MediaKpiCard
            icon="👥" label="客户" :value="null"
            empty-text="等待 AI 客服识别" source="客户价值识别"
          />
          <MediaKpiCard
            icon="⚠️" label="风险" :value="String(riskCount)" :sub="riskCount ? '累计错误待处理' : '无运行错误'"
            source="EnterpriseAgentInstance" accent="red"
          />
        </div>
      </div>
    </section>

    <!-- ═══ 运营轨迹 + 行业智能 ═══ -->
    <div class="dash-grid">
      <MediaPanel icon="🕒" title="今日运营轨迹" :sub="`${today.scheduleItems.length} 项排程 · ${today.completed} 项完成`">
        <template v-if="timeline.length">
          <div class="tl">
            <div v-for="(t, i) in timeline" :key="i" class="tl-item" :class="t.kind">
              <div class="tl-rail">
                <span class="tl-dot" :class="t.kind"></span>
                <span v-if="i < timeline.length - 1" class="tl-line"></span>
              </div>
              <div class="tl-body">
                <span class="tl-label">{{ t.kind === 'schedule' ? '🕐 待执行' : '✅ 已完成' }} · {{ t.title }}</span>
                <span class="tl-time">{{ t.time }}</span>
              </div>
            </div>
          </div>
        </template>
        <MediaEmptyState
          v-else icon="🗓️" title="今日暂无运营轨迹"
          desc="AI 员工执行排程任务后，时间轴将如实记录每一次运营动作。"
          source="AgentSchedule + AgentOutcome"
        />
      </MediaPanel>

      <MediaPanel icon="📡" title="行业智能" sub="热点 · 竞品 · 规则 · 机会">
        <template v-if="industryRadar.supported">
          <div class="radar-quads">
            <div v-for="q in radarQuads" :key="q.key" class="radar-quad">
              <div class="radar-q-title">{{ q.icon }} {{ q.title }}</div>
              <div class="radar-q-body">{{ q.items.length ? q.items.join('、') : '暂无数据' }}</div>
            </div>
          </div>
        </template>
        <MediaEmptyState
          v-else icon="📡" title="行业雷达待激活"
          :desc="industryRadar.reason || '热点/竞品/规则真实数据源未接入。'"
          source="Sprint-MEDIA-03 数据源接入后启用"
        />
      </MediaPanel>
    </div>

    <!-- ═══ 最近执行 + 今日成本 ═══ -->
    <div class="dash-grid">
      <MediaPanel icon="🧾" title="最近执行记录" :sub="`${recentOutcomes.length} 条 · 近 7 天`">
        <template v-if="recentOutcomes.length">
          <div class="rec-list">
            <div v-for="o in recentOutcomes" :key="o.id" class="rec-row">
              <span class="rec-type">{{ o.outcomeType }}</span>
              <span class="rec-title">{{ o.title || '—' }}</span>
              <span class="rec-time">{{ fmtDateTime(o.createdAt) }}</span>
            </div>
          </div>
        </template>
        <MediaEmptyState
          v-else icon="🧾" title="暂无执行记录"
          desc="AI 员工产生真实业务结果（发布/回复/分析）后如实展示。"
          source="AgentOutcome · 近 7 天"
        />
      </MediaPanel>

      <div class="dash-cost">
        <div class="dash-cost-left">
          <span class="dash-cost-ico">💰</span>
          <div>
            <div class="dash-cost-label">今日 AI 运营成本</div>
            <div class="dash-cost-sub">UsageLog 真实归因 · {{ usage.executions }} 次模型执行</div>
          </div>
        </div>
        <div class="dash-cost-value">${{ usage.todayCost.toFixed(4) }}</div>
      </div>
    </div>

    <!-- ═══ 解锁 AI 团队弹窗 ═══ -->
    <Teleport to="body">
      <div v-if="showSubscribe" class="sub-modal-mask" @click.self="showSubscribe = false">
        <div class="sub-modal">
          <div class="sub-modal-head">
            <div>
              <div class="sub-modal-title">🤖 解锁 AI 新媒体团队</div>
              <div class="sub-modal-sub">一份订阅 · 5 名 AI 员工 · 自动部署自动工作</div>
            </div>
            <button class="sub-modal-close" @click="showSubscribe = false">✕</button>
          </div>
          <div class="sub-modal-list">
            <div v-for="m in teamRoster" :key="m.name" class="sub-modal-row">
              <span class="sub-modal-avatar">{{ m.avatar }}</span>
              <div class="sub-modal-meta">
                <div class="sub-modal-name">{{ m.name }} · {{ m.role }}</div>
                <div class="sub-modal-duty">📌 {{ m.duty }}</div>
                <div class="sub-modal-value">→ {{ m.value }}</div>
                <div class="sub-modal-auto">⚙️ 订阅后自动执行：{{ m.auto }}</div>
              </div>
            </div>
          </div>
          <div class="sub-modal-foot">
            <div class="sub-modal-note">订阅后：自动部署 AI 员工 → 绑定渠道资产 → 开始自动运营 → 成果回流总控中心</div>
            <div class="sub-modal-actions">
              <NuxtLink to="/workspace/media/accounts" class="sub-modal-secondary" @click="showSubscribe = false">先去连接公众号 →</NuxtLink>
              <button class="sub-modal-primary" @click="showSubscribe = false">知道了</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaKpiCard from '~/components/media/MediaKpiCard.vue'
import MediaPanel from '~/components/media/MediaPanel.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'
import MediaHealthRing from '~/components/media/MediaHealthRing.vue'

const overview = ref<any>({
  agents: [],
  today: { completed: 0, pendingSchedules: 0, byType: [], scheduleItems: [] },
  calendar: [],
  recentOutcomes: [],
  usage: { todayCost: 0, executions: 0 },
  channels: { connected: 0, total: 4 },
  industryRadar: { supported: false, reason: '' },
})

const { $toast } = useNuxtApp() as any

const agents = computed(() => overview.value.agents || [])
const today = computed(() => overview.value.today || {})
const usage = computed(() => overview.value.usage || {})
const channels = computed(() => overview.value.channels || { connected: 0, total: 4 })
const recentOutcomes = computed(() => overview.value.recentOutcomes || [])
const industryRadar = computed(() => overview.value.industryRadar || {})

const activeCount = computed(() => agents.value.filter((a: any) => a.lifecycleState === 'ACTIVE').length)
const riskCount = computed(() => agents.value.reduce((s: number, a: any) => s + (a.totalErrors || 0), 0))

// 健康度：真实计算。今日完成率 + 错误惩罚；无数据 → null
const healthScore = computed(() => {
  const completed = today.value.completed || 0
  const pending = today.value.pendingSchedules || 0
  if (completed === 0 && pending === 0) return null
  const base = pending > 0 ? Math.round((completed / (completed + pending)) * 100) : 100
  const penalty = Math.min(riskCount.value * 5, 60)
  return Math.max(base - penalty, 0)
})

const timeline = computed(() => {
  const items: { kind: 'schedule' | 'outcome'; title: string; time: string }[] = []
  for (const s of today.value.scheduleItems || []) {
    items.push({ kind: 'schedule', title: taskTypeLabel(s.taskType), time: fmtTime(s.nextRunAt) })
  }
  for (const o of overview.value.recentOutcomes || []) {
    const d = new Date(o.createdAt)
    const todayStr = new Date().toDateString()
    if (d.toDateString() === todayStr) {
      items.push({ kind: 'outcome', title: o.outcomeType + (o.title ? ' · ' + o.title : ''), time: fmtTime(o.createdAt) })
    }
  }
  return items.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 8)
})

const radarQuads = computed(() => [
  { key: 'hot', icon: '🔥', title: '行业热点', items: industryRadar.value.hot || [] },
  { key: 'competitor', icon: '⚔️', title: '竞品动态', items: industryRadar.value.competitor || [] },
  { key: 'rule', icon: '📜', title: '平台规则', items: industryRadar.value.rule || [] },
  { key: 'opportunity', icon: '💡', title: '内容机会', items: industryRadar.value.suggestion || [] },
])

// 渠道资产蓝图（产品 4 平台；连接状态由 overview.channels 真实计数，平台级映射待真实接入后细化）
const channelBlueprints = computed(() => {
  const connected = channels.value.connected || 0
  const defs = [
    { key: 'wechat', icon: '🟢', name: '微信公众号', plan: '企业认证服务号' },
    { key: 'douyin', icon: '📱', name: '抖音', plan: '企业号' },
    { key: 'xiaohongshu', icon: '📕', name: '小红书', plan: '企业号' },
    { key: 'video', icon: '📺', name: '视频号', plan: '企业认证' },
  ]
  return defs.map((d, i) => ({ ...d, connected: i < connected }))
})

// 标准编制（免费可见价值 · 订阅解锁）
const teamRoster = [
  { name: 'Alice', role: '运营总监', avatar: '👩‍💼', duty: '统筹内容日历与发布节奏，制定月度运营策略', value: '减少人工策划成本：运营策略与排期自动生成，每周一份清晰运营计划', auto: '自动制定内容战略与月度排期，指挥团队执行' },
  { name: 'Bob', role: '内容策划', avatar: '🧑‍💻', duty: '追踪行业热点与竞品动态，产出选题池与策略建议', value: '持续产生内容方向：选题自动排满内容日历，不再为“今天发什么”发愁', auto: '每日扫描热点与竞品，选题池自动填充' },
  { name: 'Carol', role: '内容生产', avatar: '👩‍🎨', duty: '按选题生产图文与视频内容，AI 辅助创作输出成品', value: '提高生产效率：图文视频批量产出，发布前可人工审核把关', auto: '按选题自动生成图文与视频初稿，交人工审核' },
  { name: 'David', role: 'AI 客服', avatar: '🧑‍💼', duty: '接待粉丝消息，识别高价值客户并转交真人跟进', value: '减少人工客服压力：私信秒回，客户线索自动分类，不错过潜在客户', auto: '自动回复粉丝私信，A/B/C 分级并提醒销售机会' },
  { name: 'Eve', role: '数据分析', avatar: '👩‍🔬', duty: '回流账号数据，产出运营周报与增长洞察', value: '持续优化运营：每周自动复盘，什么有效、粉丝从哪来、下一步做什么', auto: '每周自动产出运营周报与增长建议' },
]

// 内容生产流水线（首页简版 · 与 content.vue 六节点一致）
const factoryStages = [
  { key: 'strategy', icon: '🎯', name: '战略', worker: 'Alice 运营总监' },
  { key: 'ideas', icon: '💡', name: '选题', worker: 'Bob 内容策划' },
  { key: 'produce', icon: '✍️', name: '创作', worker: 'Carol 内容生产' },
  { key: 'review', icon: '🔍', name: '审核', worker: '合规检查' },
  { key: 'publish', icon: '🚀', name: '发布', worker: '渠道直发' },
  { key: 'feedback', icon: '📈', name: '复盘', worker: 'Eve 数据分析' },
]

// 客户运营流程（首页简版 · 与 messages.vue 一致）
const custStages = [
  { key: 'in', icon: '📥', name: '客户进入', sub: '私信/评论' },
  { key: 'understand', icon: '🧠', name: 'AI 理解需求', sub: '意图识别' },
  { key: 'value', icon: '💎', name: '价值判断', sub: 'A/B/C 分级' },
  { key: 'reply', icon: '⚡', name: '自动回复', sub: '秒级响应' },
  { key: 'lead', icon: '💰', name: '销售机会', sub: '提醒跟进' },
  { key: 'human', icon: '👤', name: '人工接管', sub: '高价值客户' },
]

const showSubscribe = ref(false)
const identityState = ref('') // '' | 'login-expired' | 'personal-space'

onMounted(async () => {
  const token = getAuthToken()
  try {
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      overview.value = data.data
      // SPRINT-MEDIA-IDENTITY-REALITY-FIX-02: 个人空间（无企业身份）→ 欢迎引导而非报错
      if (data.data.personalSpace) identityState.value = 'personal-space'
    } else if (res.status === 401) {
      // 有 token 但 401 = 会话失效（token 过期/被吊销）→ 引导重新登录
      identityState.value = 'login-expired'
    } else {
      $toast?.error?.(data?.message || '加载驾驶舱失败')
    }
  } catch {
    $toast?.error?.('加载驾驶舱失败（网络异常）')
  }
})

const TASK_TYPE_LABEL: Record<string, string> = {
  content: '内容生成', scan: '热点扫描', analysis: '数据分析',
  report: '日报生成', outreach: '粉丝触达', auto: '自动任务',
}
function taskTypeLabel(t: string) {
  return TASK_TYPE_LABEL[t] || t
}
function fmtTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(iso)}`
}
function stateText(s: string) {
  const map: Record<string, string> = { ACTIVE: 'Working', PAUSED: 'Paused', STOPPED: 'Stopped', EMERGENCY_STOP: '紧急停止', RECOVERING: '恢复中' }
  return map[s] || s
}
function stateClass(s: string) {
  if (s === 'ACTIVE') return 'st-active'
  if (s === 'PAUSED') return 'st-paused'
  if (s === 'RECOVERING') return 'st-recovering'
  return 'st-stopped'
}
</script>

<style scoped>
/* ── 身份引导 ── */
.dash-identity-error, .dash-identity-ok {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 18px;
  border-radius: var(--media-radius-panel);
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: var(--media-gap-section);
}
.dash-identity-error { border: 1px solid rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.07); color: var(--media-text-body); }
.dash-identity-error b { color: var(--color-warning); font-size: 13px; }
.dash-identity-ok { border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.06); color: var(--media-text-body); }
.dash-identity-ok b { color: var(--color-execution); font-size: 13px; }
.dash-identity-btn {
  align-self: flex-start;
  margin-top: 4px;
  padding: 5px 14px;
  border-radius: 8px;
  background: var(--media-brand-gradient);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

/* ── Hero ── */
.hero {
  position: relative;
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 32px;
  align-items: center;
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: 20px;
  padding: 44px 44px 40px;
  margin-bottom: var(--media-gap-section);
  overflow: hidden;
  box-shadow: var(--media-card-shadow);
}
.hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--media-hero-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--media-hero-grid-line) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: radial-gradient(ellipse at 30% 40%, #000 30%, transparent 75%);
  pointer-events: none;
}
.hero-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
}
.hero-glow-a { width: 380px; height: 380px; top: -140px; left: -80px; background: var(--media-hero-glow-1); }
.hero-glow-b { width: 300px; height: 300px; bottom: -120px; right: 10%; background: var(--media-hero-glow-2); }
.hero-body { position: relative; z-index: 1; }
.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--media-brand-text);
  text-transform: uppercase;
  margin-bottom: 14px;
}
.hero-kicker-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--media-ai);
  box-shadow: 0 0 10px var(--media-ai);
}
.hero-title {
  font-size: 34px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--media-text-hero);
  margin: 0 0 12px;
  line-height: 1.25;
}
.hero-title-accent {
  background: var(--media-brand-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-desc {
  font-size: 14px;
  color: var(--media-text-body);
  line-height: 1.7;
  max-width: 460px;
  margin: 0 0 22px;
}
.hero-cta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 700;
  border-radius: var(--media-radius-node);
  padding: 11px 22px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.18s;
}
.hero-btn-primary {
  background: var(--media-brand-gradient);
  color: #fff;
  border: none;
  box-shadow: 0 8px 24px var(--media-brand-glow);
}
.hero-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.08); }
.hero-btn-ghost {
  background: rgba(51, 65, 85, 0.3);
  color: var(--media-text-title);
  border: 1px solid var(--media-card-border);
}
.hero-btn-ghost:hover { border-color: var(--media-ai-border); background: var(--media-ai-glow); }
.hero-hint {
  margin-top: 16px;
  font-size: 11.5px;
  color: var(--media-text-dim);
  display: flex;
  align-items: center;
  gap: 6px;
}
.hero-hint::before {
  content: '✨';
}
/* Hero 状态 */
.hero-stats {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.hero-stat {
  background: rgba(7, 11, 22, 0.55);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-panel);
  padding: 18px 14px;
  text-align: center;
  backdrop-filter: blur(6px);
  transition: all 0.2s;
}
.hero-stat:hover { border-color: var(--media-card-border-hover); transform: translateY(-2px); }
.hero-stat-ico {
  width: 38px; height: 38px;
  border-radius: 12px;
  margin: 0 auto 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
}
.hero-stat-ico.ai { background: var(--media-ai-glow); border: 1px solid var(--media-ai-border); }
.hero-stat-ico.ch { background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); }
.hero-stat-ico.tk { background: var(--color-execution-glow); border: 1px solid rgba(16, 185, 129, 0.3); }
.hero-stat-num {
  font-size: 26px;
  font-weight: 900;
  color: var(--media-text-hero);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.hero-stat-unit { font-size: 13px; font-weight: 700; color: var(--media-text-dim); }
.hero-stat-label { font-size: 11.5px; font-weight: 700; color: var(--media-text-body); margin-top: 3px; }
.hero-stat-sub { font-size: 10px; color: var(--media-text-dim); margin-top: 2px; }

/* ── Section 通用 ── */
.sec { margin-bottom: var(--media-gap-section); }
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.sec-head-left { display: flex; align-items: center; gap: 12px; }
.sec-ico {
  width: 38px; height: 38px;
  border-radius: var(--media-radius-node);
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
}
.sec-title { font-size: 16px; font-weight: 800; color: var(--media-text-title); margin: 0; letter-spacing: -0.01em; }
.sec-sub { font-size: 11.5px; color: var(--media-text-dim); margin: 3px 0 0; }
.sec-more {
  font-size: 12px;
  font-weight: 600;
  color: var(--media-ai);
  text-decoration: none;
  padding: 7px 14px;
  border-radius: var(--media-radius-pill);
  border: 1px solid var(--media-ai-border);
  background: var(--media-ai-glow);
  transition: all 0.15s;
}
.sec-more:hover { background: rgba(139, 92, 246, 0.25); }
.sec-cta {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 16px 20px;
  background: linear-gradient(90deg, var(--media-card-bg-solid), rgba(139, 92, 246, 0.08));
  border: 1px dashed var(--media-ai-border);
  border-radius: var(--media-radius-panel);
}
.sec-cta-btn {
  font-size: 13px; font-weight: 700;
  color: #fff;
  background: var(--media-brand-gradient);
  border: none;
  border-radius: var(--media-radius-node);
  padding: 10px 22px;
  cursor: pointer;
  box-shadow: 0 6px 18px var(--media-brand-glow);
}
.sec-cta-btn:hover { filter: brightness(1.1); }
.sec-cta-note { font-size: 11px; color: var(--media-text-dim); }

/* ── AI 团队卡 ── */
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: var(--media-gap-card);
}
.team-card {
  position: relative;
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--media-card-shadow);
}
.team-card:hover {
  transform: translateY(-3px);
  border-color: var(--media-card-border-hover);
  box-shadow: var(--media-shadow-hover);
}
.team-card-avatar {
  width: 46px; height: 46px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 800;
  margin-bottom: 12px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
}
.team-card-avatar.st-active { border-color: rgba(16, 185, 129, 0.4); }
.team-card-avatar.roster { background: rgba(51, 65, 85, 0.4); border-color: var(--media-card-border); }
.team-card-meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.team-card-name { font-size: 15px; font-weight: 800; color: var(--media-text-title); }
.team-card-role { font-size: 11px; color: var(--media-brand-text); font-weight: 600; }
.team-card-state {
  position: absolute; top: 18px; right: 18px;
  font-size: 10px; font-weight: 700;
  border-radius: var(--media-radius-pill);
  padding: 3px 10px;
}
.team-card-state.st-active { background: var(--color-execution-glow); color: var(--color-execution); }
.team-card-state.st-paused { background: rgba(245, 158, 11, 0.12); color: var(--color-warning); }
.team-card-state.st-recovering { background: var(--color-decision-glow); color: var(--color-decision); }
.team-card-state.st-stopped { background: var(--color-bg-hover); color: var(--media-text-dim); }
.team-card-stats {
  display: flex; gap: 14px;
  font-size: 10.5px; color: var(--media-text-dim);
  border-top: 1px solid var(--media-card-border);
  padding-top: 10px; margin-top: 10px;
}
.team-card-lock {
  position: absolute; top: 18px; right: 18px;
  font-size: 10px; font-weight: 700;
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--media-radius-pill);
  padding: 3px 10px;
}
.team-card-duty {
  font-size: 11.5px;
  color: var(--media-text-body);
  line-height: 1.6;
  margin-top: 6px;
}
.team-card-value {
  font-size: 10.5px;
  color: var(--color-decision);
  margin-top: 8px;
  line-height: 1.5;
}
.team-card.is-locked:hover { border-color: rgba(245, 158, 11, 0.35); }

/* ── 内容生产流水线 ── */
.factory {
  position: relative;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 24px 20px;
  box-shadow: var(--media-card-shadow);
}
.factory-node {
  position: relative;
  text-align: center;
  padding: 10px 6px;
}
.factory-ico {
  width: 46px; height: 46px;
  margin: 0 auto 8px;
  border-radius: 14px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  transition: all 0.2s;
}
.factory-node:hover .factory-ico {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px var(--media-brand-glow);
}
.factory-num {
  position: absolute;
  top: 4px; right: calc(50% - 32px);
  width: 17px; height: 17px;
  border-radius: 50%;
  background: var(--media-brand-gradient);
  color: #fff;
  font-size: 9px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px var(--media-brand-glow);
}
.factory-name { font-size: 13px; font-weight: 800; color: var(--media-text-title); }
.factory-worker { font-size: 10px; color: var(--media-text-dim); margin-top: 3px; }
.factory-ai {
  display: inline-block;
  margin-top: 7px;
  font-size: 9px; font-weight: 700;
  color: var(--media-ai);
  background: var(--media-ai-glow);
  border-radius: var(--media-radius-pill);
  padding: 2px 9px;
  letter-spacing: 0.06em;
}
.factory-arrow {
  position: absolute;
  top: 50%;
  font-size: 14px;
  color: var(--media-text-dim);
  z-index: 1;
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
}
.factory-arrow:nth-of-type(1) { left: calc(100% / 6 - 4px); }
.factory-arrow:nth-of-type(2) { left: calc(100% / 6 * 2 - 4px); }
.factory-arrow:nth-of-type(3) { left: calc(100% / 6 * 3 - 4px); }
.factory-arrow:nth-of-type(4) { left: calc(100% / 6 * 4 - 4px); }
.factory-arrow:nth-of-type(5) { left: calc(100% / 6 * 5 - 4px); }

/* ── 客户运营流程 ── */
.cust-flow {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}
.cust-node {
  position: relative;
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 16px 12px;
  text-align: center;
  transition: all 0.2s;
  box-shadow: var(--media-card-shadow);
}
.cust-node:hover { border-color: var(--media-card-border-hover); transform: translateY(-2px); }
.cust-num {
  position: absolute;
  top: 8px; left: 10px;
  font-size: 10px; font-weight: 800;
  color: var(--media-text-dim);
  font-family: var(--font-mono);
}
.cust-ico { font-size: 20px; display: block; margin-bottom: 7px; }
.cust-name { font-size: 12px; font-weight: 700; color: var(--media-text-title); }
.cust-sub { font-size: 10px; color: var(--media-text-dim); margin-top: 2px; }

/* ── 数据洞察 ── */
.insight {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--media-gap-card);
}
.insight-health {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 20px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--media-card-shadow);
}
.insight-kpis {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--media-gap-card);
}

/* ── 双栏网格（轨迹/智能/执行） ── */
.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--media-gap-card);
  margin-bottom: var(--media-gap-section);
}
.tl { display: flex; flex-direction: column; }
.tl-item { display: flex; gap: 10px; }
.tl-rail { display: flex; flex-direction: column; align-items: center; }
.tl-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--media-text-dim);
  margin-top: 4px;
  flex-shrink: 0;
}
.tl-dot.schedule { background: var(--color-warning); box-shadow: 0 0 8px rgba(245, 158, 11, 0.5); }
.tl-dot.outcome { background: var(--color-execution); box-shadow: 0 0 8px rgba(16, 185, 129, 0.5); }
.tl-line { width: 1px; flex: 1; background: var(--color-border-primary); margin: 3px 0; }
.tl-body {
  display: flex; flex-direction: column;
  padding-bottom: 14px;
  gap: 2px;
}
.tl-label { font-size: 12px; color: var(--media-text-body); }
.tl-time { font-size: 10.5px; color: var(--media-text-dim); font-family: var(--font-mono); }
.radar-quads { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.radar-quad {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 12px;
}
.radar-q-title { font-size: 11.5px; font-weight: 700; color: var(--media-text-title); margin-bottom: 6px; }
.radar-q-body { font-size: 11px; color: var(--media-text-dim); line-height: 1.6; }
.rec-list { display: flex; flex-direction: column; gap: 8px; }
.rec-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 12px;
  color: var(--media-text-title);
}
.rec-type {
  font-size: 10px; font-weight: 700;
  color: var(--color-decision);
  background: var(--color-decision-glow);
  border-radius: 6px;
  padding: 2px 8px;
  white-space: nowrap;
  font-family: var(--font-mono);
}
.rec-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rec-time { font-size: 11px; color: var(--media-text-dim); white-space: nowrap; }

/* ── 成本卡 ── */
.dash-cost {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  padding: 24px;
  box-shadow: var(--media-card-shadow);
}
.dash-cost-left { display: flex; align-items: center; gap: 14px; }
.dash-cost-ico {
  width: 44px; height: 44px;
  border-radius: 13px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 19px;
}
.dash-cost-label { font-size: 13px; font-weight: 700; color: var(--media-text-title); }
.dash-cost-sub { font-size: 10.5px; color: var(--media-text-dim); margin-top: 3px; }
.dash-cost-value { font-size: 24px; font-weight: 900; color: var(--color-warning); font-variant-numeric: tabular-nums; }

/* ── 订阅弹窗 ── */
.sub-modal-mask {
  position: fixed; inset: 0;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.sub-modal {
  width: 560px; max-width: 100%;
  max-height: 84vh;
  overflow-y: auto;
  background: linear-gradient(170deg, #111827, #0B1020);
  border: 1px solid var(--media-card-border);
  border-radius: 20px;
  padding: 26px;
  box-shadow: var(--media-shadow-float);
}
.sub-modal-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 16px;
}
.sub-modal-title { font-size: 17px; font-weight: 800; color: var(--media-text-hero); }
.sub-modal-sub { font-size: 11.5px; color: var(--media-text-dim); margin-top: 4px; }
.sub-modal-close {
  background: transparent; border: none;
  color: var(--media-text-dim); font-size: 16px;
  cursor: pointer;
}
.sub-modal-list { display: flex; flex-direction: column; gap: 10px; }
.sub-modal-row {
  display: flex; gap: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 12px 14px;
}
.sub-modal-avatar {
  width: 38px; height: 38px;
  border-radius: 11px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.sub-modal-name { font-size: 13px; font-weight: 700; color: var(--media-text-title); }
.sub-modal-duty { font-size: 11px; color: var(--media-text-body); margin-top: 3px; }
.sub-modal-value { font-size: 10.5px; color: var(--color-decision); margin-top: 3px; }
.sub-modal-auto { font-size: 10.5px; color: var(--color-warning); margin-top: 3px; }
.sub-modal-foot {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-primary);
}
.sub-modal-note { font-size: 11px; color: var(--media-text-dim); margin-bottom: 12px; line-height: 1.6; }
.sub-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.sub-modal-secondary {
  font-size: 12px; font-weight: 600;
  color: var(--media-text-body);
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 9px 16px;
  text-decoration: none;
}
.sub-modal-primary {
  font-size: 12px; font-weight: 700;
  color: #fff;
  background: var(--media-brand-gradient);
  border: none;
  border-radius: 10px;
  padding: 9px 20px;
  cursor: pointer;
}

@media (max-width: 1100px) {
  .hero { grid-template-columns: 1fr; }
  .factory { grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .factory-arrow { display: none; }
  .cust-flow { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 760px) {
  .insight { grid-template-columns: 1fr; }
  .dash-grid { grid-template-columns: 1fr; }
  .insight-kpis { grid-template-columns: 1fr; }
  .hero-stats { grid-template-columns: repeat(3, 1fr); }
  .team-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
}
</style>
