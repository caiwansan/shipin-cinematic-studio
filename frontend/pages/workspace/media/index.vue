<!--
  Sprint-MEDIA-UX-03 — AI 运营驾驶舱（产品级 Dashboard）
  真实数据源: GET /api/enterprise/media/overview
  健康度 = 真实计算（今日完成率 + 错误惩罚）；无数据 → 诚实空态（禁 mock）
-->
<template>
  <MediaWorkspaceShell>
    <!-- 页面头 -->
    <MediaPageHeader
      kicker="AI Media Ops · Command Center"
      title="运营驾驶舱"
      desc="你的 AI 新媒体运营部门实时状态：员工、任务、成本与业务结果一屏掌握。"
    >
      <template #actions>
        <NuxtLink to="/workspace/media/intelligence" class="mph-btn">📡 行业智能</NuxtLink>
      </template>
    </MediaPageHeader>

    <!-- ═══ 健康度 + KPI ═══ -->
    <div class="dash-hero">
      <div class="dash-health">
        <MediaHealthRing :score="healthScore" foot="今日任务完成率 · 真实计算（agent_outcome + agent_schedule + 错误惩罚）" />
      </div>
      <div class="dash-kpis">
        <MediaKpiCard
          icon="📝" label="内容生产" :value="today.completed ? String(today.completed) : '0'"
          :sub="today.completed ? `今日完成 ${today.completed} 项任务` : '今日暂无任务记录'"
          source="agent_outcome" accent="green"
        />
        <MediaKpiCard
          icon="💬" label="互动" :value="null"
          empty-text="等待微信消息接入" source="SocialMetricsSnapshot · Sprint-MEDIA-01"
        />
        <MediaKpiCard
          icon="👥" label="客户" :value="null"
          empty-text="等待 AI 客服识别" source="客户价值识别 · Sprint-MEDIA-04"
        />
        <MediaKpiCard
          icon="⚠️" label="风险" :value="String(riskCount)" :sub="riskCount ? '累计错误待处理' : '无运行错误'"
          source="EnterpriseAgentInstance" accent="red"
        />
      </div>
    </div>

    <!-- ═══ AI 部门概览 + 今日时间轴 ═══ -->
    <div class="dash-grid">
      <MediaPanel icon="🧑‍💼" title="AI 部门概览" :sub="agents.length ? `${agents.length} 名员工 · ${activeCount} 名工作中` : '等待 AI 员工部署'">
        <template v-if="agents.length">
          <div class="dept-list">
            <div v-for="a in agents" :key="a.instanceId" class="dept-row">
              <span class="dept-avatar">{{ a.avatar || a.name[0] }}</span>
              <div class="dept-meta">
                <div class="dept-name">{{ a.name }} <span class="dept-role">{{ a.role }}</span></div>
                <div class="dept-sub">{{ a.totalTasks }} 任务 · {{ a.totalErrors }} 错误 · {{ a.lastActiveAt ? '活跃 ' + fmtTime(a.lastActiveAt) : '未活跃' }}</div>
              </div>
              <span class="dept-state" :class="stateClass(a.lifecycleState)">{{ stateText(a.lifecycleState) }}</span>
            </div>
          </div>
        </template>
        <MediaEmptyState
          v-else icon="🤖" title="AI 部门待组建"
          desc="部署 AI 员工后，他们的实时状态、任务与成果将出现在这里。"
          source="EnterpriseAgentInstance + AgentProfile"
        />
      </MediaPanel>

      <MediaPanel icon="🕒" title="今日运营时间轴" :sub="`${today.scheduleItems.length} 项排程 · ${today.completed} 项完成`">
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
    </div>

    <!-- ═══ 行业智能 + 最近执行 ═══ -->
    <div class="dash-grid">
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
          v-else icon="📡" title="雷达待激活"
          :desc="industryRadar.reason || '热点/竞品/规则真实数据源未接入。'"
          source="Sprint-MEDIA-03 数据源接入后启用"
        />
      </MediaPanel>

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
    </div>

    <!-- ═══ 今日成本 ═══ -->
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
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
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
  industryRadar: { supported: false, reason: '' },
})

const { $toast } = useNuxtApp() as any

const agents = computed(() => overview.value.agents || [])
const today = computed(() => overview.value.today || {})
const usage = computed(() => overview.value.usage || {})
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

onMounted(async () => {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      overview.value = data.data
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
.mph-btn {
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 4px 16px var(--color-intelligence-glow);
}
.mph-btn:hover {
  opacity: 0.92;
}

.dash-hero {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.dash-health {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 20px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dash-kpis {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
  align-items: start;
}

/* 部门概览 */
.dept-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dept-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 12px 14px;
}
.dept-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--color-intelligence-glow);
  color: var(--color-intelligence);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 15px;
}
.dept-meta {
  flex: 1;
  min-width: 0;
}
.dept-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.dept-role {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-left: 6px;
  font-weight: 400;
}
.dept-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.dept-state {
  font-size: 10px;
  font-weight: 700;
  border-radius: 10px;
  padding: 3px 10px;
  white-space: nowrap;
}
.st-active { background: var(--color-execution-glow); color: var(--color-execution); }
.st-paused { background: rgba(245, 158, 11, 0.12); color: var(--color-warning); }
.st-recovering { background: var(--color-decision-glow); color: var(--color-decision); }
.st-stopped { background: var(--color-bg-hover); color: var(--color-text-muted); }

/* 时间轴 */
.tl {
  display: flex;
  flex-direction: column;
}
.tl-item {
  display: flex;
  gap: 12px;
}
.tl-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
}
.tl-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.tl-dot.schedule { background: var(--color-warning); box-shadow: 0 0 8px rgba(245, 158, 11, 0.5); }
.tl-dot.outcome { background: var(--color-execution); box-shadow: 0 0 8px var(--color-execution-glow); }
.tl-line {
  width: 2px;
  flex: 1;
  background: var(--color-border-primary);
  margin-top: 4px;
}
.tl-body {
  padding: 4px 0 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tl-label {
  font-size: 13px;
  color: var(--color-text-primary);
}
.tl-time {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* 行业雷达四象限 */
.radar-quads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.radar-quad {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 12px 14px;
}
.radar-q-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}
.radar-q-body {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* 最近执行 */
.rec-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rec-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 12px;
}
.rec-type {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-decision);
  background: var(--color-decision-glow);
  border-radius: 8px;
  padding: 2px 8px;
  white-space: nowrap;
}
.rec-title {
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rec-time {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* 成本条 */
.dash-cost {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(90deg, var(--color-bg-elevated), var(--color-intelligence-glow));
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 18px 22px;
}
.dash-cost-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dash-cost-ico {
  font-size: 22px;
}
.dash-cost-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.dash-cost-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.dash-cost-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-execution);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 1000px) {
  .dash-hero { grid-template-columns: 1fr; }
  .dash-grid { grid-template-columns: 1fr; }
}
</style>
