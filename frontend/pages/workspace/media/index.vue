<!--
  Sprint-MEDIA-UX-02 — 新媒体运营总览 Dashboard
  真实数据源: GET /api/enterprise/media/overview（AgentInstance + AgentSchedule + AgentOutcome + UsageLog）
  纪律: 全部真实数据 + 空态；行业雷达无数据源 → 待激活卡（禁 mock）
-->
<template>
  <MediaWorkspaceShell>
    <div class="md">
      <!-- ═══ 今日运营状态 ═══ -->
      <section class="md-section">
        <h2 class="md-section-title">📋 今日运营状态</h2>
        <div class="md-stat-grid">
          <div class="md-stat">
            <div class="md-stat-num md-stat-green">{{ today.completed }}</div>
            <div class="md-stat-label">🟢 已完成</div>
            <div class="md-stat-sub">AgentOutcome 今日计数</div>
          </div>
          <div class="md-stat">
            <div class="md-stat-num md-stat-yellow">{{ today.pendingSchedules }}</div>
            <div class="md-stat-label">🟡 待执行</div>
            <div class="md-stat-sub">AgentSchedule 今日排程</div>
          </div>
          <div class="md-stat">
            <div class="md-stat-num md-stat-gray">{{ today.byType.length }}</div>
            <div class="md-stat-label">📦 结果类型</div>
            <div class="md-stat-sub">今日产生的 outcome 种类</div>
          </div>
          <div class="md-stat">
            <div class="md-stat-num">${{ usage.todayCost.toFixed(4) }}</div>
            <div class="md-stat-label">💰 今日成本</div>
            <div class="md-stat-sub">UsageLog 真实归因 · {{ usage.executions }} 次执行</div>
          </div>
        </div>

        <!-- 今日任务清单 -->
        <div class="md-card">
          <div class="md-card-head">
            <span class="md-card-title">今日任务</span>
            <span class="md-card-note">真实排程 · AgentSchedule</span>
          </div>
          <div v-if="today.scheduleItems.length" class="md-tasks">
            <div v-for="t in today.scheduleItems" :key="t.id" class="md-task">
              <span class="md-task-dot md-task-dot-pending"></span>
              <span class="md-task-type">{{ taskTypeLabel(t.taskType) }}</span>
              <span class="md-task-time">{{ fmtTime(t.nextRunAt) }}</span>
            </div>
          </div>
          <div v-else class="md-empty">
            <p>今日暂无排程任务</p>
            <p class="md-empty-sub">AI 员工部署并配置排程后，任务将真实出现在这里</p>
          </div>
        </div>
      </section>

      <!-- ═══ AI 员工状态 ═══ -->
      <section class="md-section">
        <h2 class="md-section-title">🤖 AI 员工状态</h2>
        <div v-if="agents.length" class="md-agent-grid">
          <div v-for="a in agents" :key="a.instanceId" class="md-agent">
            <div class="md-agent-head">
              <span class="md-agent-avatar">{{ (a.avatar || a.name[0] || '👤') }}</span>
              <div class="md-agent-meta">
                <div class="md-agent-name">{{ a.name }}</div>
                <div class="md-agent-role">{{ a.role }}</div>
              </div>
              <span class="md-agent-state" :class="stateClass(a.lifecycleState)">{{ stateText(a.lifecycleState) }}</span>
            </div>
            <div class="md-agent-stats">
              <div><span class="md-k">{{ a.totalTasks }}</span> 累计任务</div>
              <div><span class="md-k">{{ a.totalErrors }}</span> 错误</div>
              <div class="md-agent-active">{{ a.lastActiveAt ? '最近活跃 ' + fmtTime(a.lastActiveAt) : '尚未活跃' }}</div>
            </div>
          </div>
        </div>
        <div v-else class="md-empty md-empty-card">
          <p>🤖 暂无已部署的 AI 员工</p>
          <p class="md-empty-sub">部署 AI 员工（激活后生成 Runtime 实例）后，实时状态将显示在这里</p>
        </div>
      </section>

      <!-- ═══ 内容运营日历 + 行业雷达 ═══ -->
      <div class="md-two-col">
        <section class="md-section">
          <h2 class="md-section-title">📅 内容运营日历</h2>
          <div class="md-calendar">
            <div v-for="day in calendar" :key="day.date" class="md-cal-day" :class="{ 'is-today': day.isToday }">
              <div class="md-cal-date">
                <span class="md-cal-week">{{ weekLabel(day.date) }}</span>
                <span class="md-cal-num">{{ dayNum(day.date) }}</span>
              </div>
              <div v-if="day.items.length" class="md-cal-items">
                <div v-for="(it, i) in day.items.slice(0, 3)" :key="i" class="md-cal-item" :class="it.kind">
                  <span v-if="it.kind === 'schedule'">🕐</span>
                  <span v-else>✅</span>
                  {{ shortLabel(it.outcomeType) }}
                </div>
                <div v-if="day.items.length > 3" class="md-cal-more">+{{ day.items.length - 3 }} 项</div>
              </div>
              <div v-else class="md-cal-empty">—</div>
            </div>
          </div>
        </section>

        <section class="md-section">
          <h2 class="md-section-title">📡 行业雷达</h2>
          <div v-if="industryRadar.supported" class="md-radar">
            <div class="md-radar-quad"><div class="md-radar-q-title">🔥 行业热点</div><div class="md-radar-q-body">{{ industryRadar.hot.length ? industryRadar.hot.join('、') : '暂无' }}</div></div>
            <div class="md-radar-quad"><div class="md-radar-q-title">⚔️ 竞品动态</div><div class="md-radar-q-body">{{ industryRadar.competitor.length ? industryRadar.competitor.join('、') : '暂无' }}</div></div>
            <div class="md-radar-quad"><div class="md-radar-q-title">📜 平台规则</div><div class="md-radar-q-body">{{ industryRadar.rule.length ? industryRadar.rule.join('、') : '暂无' }}</div></div>
            <div class="md-radar-quad"><div class="md-radar-q-title">💡 运营建议</div><div class="md-radar-q-body">{{ industryRadar.suggestion.length ? industryRadar.suggestion.join('、') : '暂无' }}</div></div>
          </div>
          <div v-else class="md-radar md-radar-inactive">
            <div class="md-radar-pulse">📡</div>
            <p>雷达待激活</p>
            <p class="md-empty-sub">{{ industryRadar.reason || '真实热点/竞品/规则数据源未接入' }}</p>
          </div>
        </section>
      </div>

      <!-- ═══ 最近执行 ═══ -->
      <section class="md-section">
        <h2 class="md-section-title">🕒 最近执行记录</h2>
        <div class="md-card">
          <div v-if="recentOutcomes.length" class="md-recent">
            <div v-for="o in recentOutcomes" :key="o.id" class="md-recent-item">
              <span class="md-recent-type">{{ o.outcomeType }}</span>
              <span class="md-recent-title">{{ o.title || '—' }}</span>
              <span class="md-recent-time">{{ fmtDateTime(o.createdAt) }}</span>
            </div>
          </div>
          <div v-else class="md-empty">
            <p>暂无执行记录</p>
            <p class="md-empty-sub">AI 员工产生真实业务结果（发布/回复/分析等）后，将按 agent_outcome 如实展示</p>
          </div>
        </div>
      </section>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'

const loading = ref(true)
const overview = ref<any>({
  agents: [],
  today: { completed: 0, pendingSchedules: 0, byType: [], scheduleItems: [] },
  calendar: [],
  recentOutcomes: [],
  usage: { todayCost: 0, executions: 0 },
  industryRadar: { supported: false, reason: '' },
})

const { agents, today, calendar, recentOutcomes, usage, industryRadar } = computed(() => overview.value)

const { $toast } = useNuxtApp() as any

onMounted(async () => {
  try {
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${useAuthToken()}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      overview.value = data.data
    } else {
      $toast?.error?.(data?.message || '加载运营中心失败')
    }
  } catch {
    $toast?.error?.('加载运营中心失败（网络异常）')
  } finally {
    loading.value = false
  }
})

function useAuthToken() {
  // 与现有前端一致的 token 获取方式（localStorage）
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
  }
  return ''
}

const TASK_TYPE_LABEL: Record<string, string> = {
  content: '内容生成',
  scan: '热点扫描',
  analysis: '数据分析',
  report: '日报生成',
  outreach: '粉丝触达',
  auto: '自动任务',
}
function taskTypeLabel(t: string) {
  return TASK_TYPE_LABEL[t] || t
}
function fmtTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}
function weekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
}
function dayNum(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').getDate()
}
function shortLabel(t: string) {
  const s = t.replace(/^schedule:/, '')
  return taskTypeLabel(s).slice(0, 4)
}
function stateText(s: string) {
  const map: Record<string, string> = {
    ACTIVE: '🟢 Working',
    PAUSED: '🟡 Paused',
    STOPPED: '⚪ Stopped',
    EMERGENCY_STOP: '🔴 紧急停止',
    RECOVERING: '🔄 恢复中',
  }
  return map[s] || s
}
function stateClass(s: string) {
  if (s === 'ACTIVE') return 's-active'
  if (s === 'PAUSED') return 's-paused'
  if (s === 'RECOVERING') return 's-recovering'
  return 's-stopped'
}
</script>

<style scoped>
.md-section {
  margin-bottom: 28px;
}
.md-section-title {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 12px;
}
.md-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.md-stat {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 16px;
}
.md-stat-num {
  font-size: 26px;
  font-weight: 800;
  color: #1a1a2e;
}
.md-stat-green { color: #16a34a; }
.md-stat-yellow { color: #d97706; }
.md-stat-gray { color: #6b7280; }
.md-stat-label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-top: 6px;
}
.md-stat-sub {
  font-size: 11px;
  color: #9a9aad;
  margin-top: 2px;
}
.md-card {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 16px;
}
.md-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.md-card-title {
  font-size: 13px;
  font-weight: 700;
  color: #333;
}
.md-card-note {
  font-size: 11px;
  color: #9a9aad;
}
.md-tasks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.md-task {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #444;
  background: #fafafc;
  border-radius: 8px;
  padding: 8px 12px;
}
.md-task-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.md-task-dot-pending { background: #d97706; }
.md-task-type { font-weight: 600; }
.md-task-time { margin-left: auto; color: #8a8a9e; font-size: 12px; }
.md-empty {
  padding: 18px;
  text-align: center;
  color: #8a8a9e;
  font-size: 13px;
}
.md-empty-card {
  background: #fff;
  border: 1px dashed #d8d8e2;
  border-radius: 12px;
}
.md-empty-sub {
  font-size: 12px;
  color: #b0b0c0;
  margin-top: 4px;
}
.md-agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.md-agent {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 14px;
}
.md-agent-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.md-agent-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #eef2ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
}
.md-agent-meta { flex: 1; }
.md-agent-name { font-size: 14px; font-weight: 700; color: #1a1a2e; }
.md-agent-role { font-size: 12px; color: #8a8a9e; }
.md-agent-state {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.s-active { background: #e8f7ee; color: #16a34a; }
.s-paused { background: #fdf3e3; color: #d97706; }
.s-recovering { background: #e8f1fd; color: #2563eb; }
.s-stopped { background: #f1f1f4; color: #6b7280; }
.md-agent-stats {
  display: flex;
  gap: 14px;
  margin-top: 12px;
  font-size: 12px;
  color: #6b7280;
}
.md-k { font-weight: 700; color: #1a1a2e; }
.md-agent-active { margin-left: auto; font-size: 11px; color: #9a9aad; }
.md-two-col {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
  align-items: start;
}
.md-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.md-cal-day {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 8px;
  min-height: 86px;
}
.md-cal-day.is-today {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px #2563eb;
}
.md-cal-date {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.md-cal-week {
  font-size: 11px;
  color: #9a9aad;
}
.md-cal-num {
  font-size: 15px;
  font-weight: 800;
  color: #1a1a2e;
}
.is-today .md-cal-num {
  color: #2563eb;
}
.md-cal-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.md-cal-item {
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 4px;
  background: #f4f7ff;
  color: #3b5bb3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.md-cal-item.schedule {
  background: #fdf3e3;
  color: #b26a00;
}
.md-cal-more {
  font-size: 10px;
  color: #9a9aad;
}
.md-cal-empty {
  color: #d8d8e2;
  font-size: 12px;
  text-align: center;
  padding-top: 18px;
}
.md-radar {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 14px;
}
.md-radar-quad {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f1f5;
}
.md-radar-quad:last-child { border-bottom: none; }
.md-radar-q-title {
  font-size: 12px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}
.md-radar-q-body {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.md-radar-inactive {
  text-align: center;
  padding: 28px 18px;
  color: #8a8a9e;
}
.md-radar-pulse {
  font-size: 34px;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.md-recent {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.md-recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 8px 10px;
  background: #fafafc;
  border-radius: 8px;
}
.md-recent-type {
  font-size: 11px;
  background: #eef2ff;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.md-recent-title {
  color: #444;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.md-recent-time {
  margin-left: auto;
  font-size: 11px;
  color: #9a9aad;
  white-space: nowrap;
}
@media (max-width: 900px) {
  .md-stat-grid { grid-template-columns: repeat(2, 1fr); }
  .md-two-col { grid-template-columns: 1fr; }
}
</style>
