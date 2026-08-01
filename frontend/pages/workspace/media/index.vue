<!--
  Sprint-MEDIA-PRODUCT-ONBOARDING-01A — CEO 驾驶舱产品化（SaaS 价值地图）
  产品逻辑: 免费看到完整价值地图 → 理解能力 → 订阅解锁 AI 员工 → 启动运营闭环
  真实数据源: GET /api/enterprise/media/overview（唯一驾驶舱数据源）
  诚实原则: 数字 = 真实计数；无数据 → 等待激活/未连接（禁 mock）
-->
<template>
  <MediaWorkspaceShell>
    <!-- 页面头 -->
    <MediaPageHeader
      kicker="AI Media Ops · SaaS"
      title="AI 新媒体运营中心"
      desc="帮助企业管理渠道、生产内容、运营客户——免费使用运营基础设施，订阅解锁 AI 员工自动执行。"
    >
      <template #actions>
        <NuxtLink to="/workspace/media/intelligence" class="mph-btn">📡 行业智能</NuxtLink>
      </template>
    </MediaPageHeader>

    <!-- ═══ 产品定位（30 秒理解：这是什么产品）═══ -->
    <div class="dash-position">
      <span class="dash-pos-label">这是你的 AI 新媒体运营部</span>
      <span class="dash-pos-item">📢 管理渠道</span>
      <span class="dash-pos-arrow">→</span>
      <span class="dash-pos-item">📝 生产内容</span>
      <span class="dash-pos-arrow">→</span>
      <span class="dash-pos-item">💬 运营客户</span>
      <span class="dash-pos-arrow">→</span>
      <span class="dash-pos-item dash-pos-ai">🤖 由 AI 员工自动执行</span>
    </div>

    <!-- ═══ ① CEO 驾驶舱 · 部门状态卡 ═══ -->
    <div class="dash-dept">
      <div class="dash-dept-title">
        <span class="dash-dept-ico">🏢</span>
        <div>
          <div class="dash-dept-name">AI 新媒体运营部</div>
          <div class="dash-dept-sub">EnterpriseAgentInstance · 真实部署状态</div>
        </div>
        <span class="dash-dept-state" :class="deptStateClass">{{ deptStateText }}</span>
      </div>
      <div class="dash-dept-metrics">
        <div class="dash-dept-metric">
          <div class="ddm-value">{{ agents.length }}<span class="ddm-unit">/5</span></div>
          <div class="ddm-label">AI 员工</div>
        </div>
        <div class="dash-dept-metric">
          <div class="ddm-value">{{ channels.connected }}<span class="ddm-unit">/{{ channels.total }}</span></div>
          <div class="ddm-label">渠道已连接</div>
        </div>
        <div class="dash-dept-metric">
          <div class="ddm-value">{{ today.completed }}<span class="ddm-unit">/{{ today.completed + today.pendingSchedules }}</span></div>
          <div class="ddm-label">今日任务完成</div>
        </div>
      </div>
    </div>

    <!-- ═══ ② 我的 AI 团队（免费可见价值 · 订阅解锁）═══ -->
    <MediaPanel icon="🤖" title="我的 AI 团队" sub="免费查看完整编制 · 订阅后自动部署并开始工作" class="dash-team-panel">
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
      <template v-else>
        <div class="team-grid">
          <button
            v-for="m in teamRoster" :key="m.name"
            class="team-card" @click="showSubscribe = true"
          >
            <div class="team-card-avatar">{{ m.avatar }}</div>
            <div class="team-card-meta">
              <div class="team-card-name">{{ m.name }}</div>
              <div class="team-card-role">{{ m.role }}</div>
            </div>
            <div class="team-card-duty">{{ m.duty }}</div>
            <div class="team-card-value">{{ m.value }}</div>
            <span class="team-card-lock">🔒 订阅解锁</span>
          </button>
        </div>
        <div class="team-cta-row">
          <button class="team-cta" @click="showSubscribe = true">解锁 AI 新媒体团队</button>
          <span class="team-cta-note">订阅后：自动部署 AI 员工 · 绑定渠道资产 · 开始自动运营 · 成果回流 CEO 驾驶舱</span>
        </div>
      </template>
    </MediaPanel>

    <!-- ═══ ③ 渠道资产中心（产品蓝图 4 平台 · 连接后 AI 才能运营）═══ -->
    <MediaPanel icon="🔗" title="渠道资产中心" sub="连接账号后，AI 员工才能开始运营你的渠道" class="dash-assets">
      <div class="dash-assets-row">
        <div v-for="p in channelBlueprints" :key="p.key" class="dash-asset" :class="{ 'is-connected': p.connected }">
          <span class="dash-asset-ico">{{ p.icon }}</span>
          <div class="dash-asset-meta">
            <div class="dash-asset-name">{{ p.name }}</div>
            <div class="dash-asset-sub">{{ p.connected ? '已连接' : '未连接' }}</div>
          </div>
          <NuxtLink v-if="!p.connected" to="/workspace/media/accounts" class="dash-asset-cta">去连接 →</NuxtLink>
          <span v-else class="dash-asset-ok">✅</span>
        </div>
      </div>
      <div class="dash-assets-foot">免费用户可手动管理渠道 · AI 自动运营随员工订阅解锁</div>
    </MediaPanel>

    <!-- ═══ ④ 健康度 + KPI（免费运营基础设施）═══ -->
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

    <!-- ═══ ⑤ 今日时间轴 + 行业智能 ═══ -->
    <div class="dash-grid">
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
    </div>

    <!-- ═══ ⑥ 最近执行 + 今日成本 ═══ -->
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

    <!-- ═══ AI 员工订阅说明弹窗（01A 价值说明 · 01C 接入真实商业入口）═══ -->
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
                <div class="sub-modal-duty">{{ m.duty }}</div>
                <div class="sub-modal-value">→ {{ m.value }}</div>
              </div>
            </div>
          </div>
          <div class="sub-modal-foot">
            <div class="sub-modal-note">订阅后：自动部署 AI 员工 → 绑定渠道资产 → 开始自动运营 → 成果回流 CEO 驾驶舱</div>
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

// 部门状态（真实计算）
const deptStateText = computed(() => {
  if (!agents.value.length) return '未激活'
  return activeCount.value > 0 ? '运行中' : '已部署 · 待激活'
})
const deptStateClass = computed(() => {
  if (!agents.value.length) return 'dd-st-inactive'
  return activeCount.value > 0 ? 'dd-st-active' : 'dd-st-pending'
})

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
  { name: 'Alice', role: '运营总监', avatar: '👩‍💼', duty: '统筹内容日历与发布节奏，制定月度运营策略', value: '减少人工策划成本：运营策略与排期自动生成，每周一份清晰运营计划' },
  { name: 'Bob', role: '内容策划', avatar: '🧑‍💻', duty: '追踪行业热点与竞品动态，产出选题池与策略建议', value: '持续产生内容方向：选题自动排满内容日历，不再为“今天发什么”发愁' },
  { name: 'Carol', role: '内容生产', avatar: '👩‍🎨', duty: '按选题生产图文与视频内容，AI 辅助创作输出成品', value: '提高生产效率：图文视频批量产出，发布前可人工审核把关' },
  { name: 'David', role: 'AI 客服', avatar: '🧑‍💼', duty: '接待粉丝消息，识别高价值客户并转交真人跟进', value: '减少人工客服压力：私信秒回，客户线索自动分类，不错过潜在客户' },
  { name: 'Eve', role: '数据分析', avatar: '👩‍🔬', duty: '回流账号数据，产出运营周报与增长洞察', value: '持续优化运营：每周自动复盘，什么有效、粉丝从哪来、下一步做什么' },
]

const showSubscribe = ref(false)

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

/* ─── 产品定位条 ─── */
.dash-position {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 10px 18px;
  margin-bottom: 14px;
  font-size: 12px;
}
.dash-pos-label {
  font-weight: 800;
  color: var(--color-text-primary);
  margin-right: 4px;
}
.dash-pos-item {
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  padding: 4px 12px;
  white-space: nowrap;
}
.dash-pos-ai {
  color: var(--color-warning);
  border-color: rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.1);
}
.dash-pos-arrow {
  color: var(--color-text-disabled);
}

/* ─── ① 部门状态卡 ─── */
.dash-dept {
  background: linear-gradient(135deg, var(--color-bg-elevated), var(--color-intelligence-glow));
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 18px 22px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.dash-dept-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dash-dept-ico { font-size: 26px; }
.dash-dept-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-primary);
}
.dash-dept-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.dash-dept-state {
  font-size: 11px;
  font-weight: 700;
  border-radius: 20px;
  padding: 4px 14px;
  white-space: nowrap;
}
.dd-st-active { background: var(--color-execution-glow); color: var(--color-execution); }
.dd-st-pending { background: rgba(245, 158, 11, 0.14); color: var(--color-warning); }
.dd-st-inactive { background: var(--color-bg-hover); color: var(--color-text-muted); }
.dash-dept-metrics {
  display: flex;
  gap: 28px;
}
.dash-dept-metric {
  text-align: center;
}
.ddm-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}
.ddm-unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-left: 2px;
}
.ddm-label {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* ─── ② 我的 AI 团队 ─── */
.dash-team-panel { margin-bottom: 16px; }
.team-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.team-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 16px 12px;
  cursor: pointer;
  transition: transform .12s ease, border-color .12s ease;
  text-align: center;
  font-family: inherit;
}
.team-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-intelligence);
}
.team-card-avatar { font-size: 28px; }
.team-card-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-primary);
}
.team-card-role {
  font-size: 11px;
  color: var(--color-intelligence);
  background: var(--color-intelligence-glow);
  border-radius: 8px;
  padding: 2px 10px;
  font-weight: 600;
}
.team-card-duty {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.5;
  min-height: 34px;
}
.team-card-value {
  font-size: 11px;
  color: var(--color-decision);
  line-height: 1.5;
  background: var(--color-decision-glow);
  border-radius: 8px;
  padding: 5px 8px;
  min-height: 32px;
}
.team-card-lock {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.12);
  border-radius: 8px;
  padding: 3px 10px;
}
.team-cta-row {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}
.team-cta {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  cursor: pointer;
  box-shadow: 0 4px 14px var(--color-intelligence-glow);
}
.team-cta:hover { filter: brightness(1.1); }
.team-cta-note {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* ─── ③ 渠道资产中心 ─── */
.dash-assets { margin-bottom: 16px; }
.dash-assets-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.dash-asset {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 14px 16px;
}
.dash-asset.is-connected { border-color: var(--color-execution); }
.dash-asset-ico { font-size: 24px; }
.dash-asset-meta { flex: 1; min-width: 0; }
.dash-asset-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.dash-asset-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.dash-asset-cta {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-intelligence);
  background: var(--color-intelligence-glow);
  border-radius: 8px;
  padding: 6px 12px;
  text-decoration: none;
  white-space: nowrap;
}
.dash-asset-cta:hover { filter: brightness(1.15); }
.dash-asset-ok { font-size: 14px; }
.dash-assets-foot {
  margin-top: 12px;
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
}

/* ─── ④ 健康度 + KPI ─── */
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

/* 部门员工列表（已部署态） */
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

/* ─── 订阅说明弹窗 ─── */
.sub-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 24, 0.66);
  backdrop-filter: blur(3px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.sub-modal {
  width: 560px;
  max-width: 100%;
  max-height: 86vh;
  overflow-y: auto;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 16px;
  padding: 22px 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}
.sub-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.sub-modal-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text-primary);
}
.sub-modal-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 4px;
}
.sub-modal-close {
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-muted);
  border-radius: 8px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 12px;
}
.sub-modal-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sub-modal-row {
  display: flex;
  gap: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 12px 14px;
}
.sub-modal-avatar { font-size: 22px; }
.sub-modal-meta { flex: 1; min-width: 0; }
.sub-modal-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.sub-modal-duty {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 3px;
  line-height: 1.5;
}
.sub-modal-value {
  font-size: 11px;
  color: var(--color-decision);
  margin-top: 3px;
  line-height: 1.5;
}
.sub-modal-foot {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--color-border-primary);
}
.sub-modal-note {
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
  margin-bottom: 12px;
}
.sub-modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.sub-modal-primary {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  border: none;
  border-radius: 10px;
  padding: 10px 22px;
  cursor: pointer;
}
.sub-modal-secondary {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 10px 22px;
  text-decoration: none;
}

@media (max-width: 1100px) {
  .team-grid { grid-template-columns: repeat(3, 1fr); }
  .dash-assets-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1000px) {
  .dash-hero { grid-template-columns: 1fr; }
  .dash-grid { grid-template-columns: 1fr; }
  .dash-dept { flex-direction: column; align-items: flex-start; }
}
@media (max-width: 640px) {
  .team-grid { grid-template-columns: repeat(2, 1fr); }
  .dash-assets-row { grid-template-columns: 1fr; }
}
</style>
