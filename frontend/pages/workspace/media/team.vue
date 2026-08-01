<!--
  Sprint-MEDIA-UX-03 — AI Team Operating Center 员工运营中心
  布局: 员工列表（左） + 员工详情面板（右：状态/今日任务/能力）
  真实数据: GET /api/enterprise/media/overview（AgentInstance+Profile）+ AgentSchedule（今日任务）
  能力清单: CapabilityContract（能力目录，后续绑定后展示）
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="AI Team Operating Center"
      title="AI 员工团队"
      desc="管理你的 AI 新媒体运营部门——每名员工：职责清晰、价值明确，订阅后自动部署并开始工作。"
    />

    <div class="to-layout">
      <!-- 员工列表 -->
      <div class="to-list">
        <div class="to-list-head">
          <span>部门成员</span>
          <span class="to-list-count">{{ agents.length ? agents.length + ' 名' : '0 名' }}</span>
        </div>
        <div v-if="agents.length" class="to-list-body">
          <button
            v-for="a in agents" :key="a.instanceId"
            class="to-member" :class="{ 'is-selected': selected?.instanceId === a.instanceId }"
            @click="selected = a"
          >
            <span class="to-avatar">{{ a.avatar || a.name[0] }}</span>
            <div class="to-member-meta">
              <div class="to-member-name">{{ a.name }}</div>
              <div class="to-member-role">{{ a.role }}</div>
            </div>
            <span class="to-dot" :class="stateClass(a.lifecycleState)"></span>
          </button>
        </div>
        <div v-else class="to-list-empty">
          <MediaEmptyState icon="🤖" title="部门待组建" desc="先连接新媒体账号，再解锁 AI 员工团队——部署后自动开始运营。" source="EnterpriseAgentInstance" action>
            <template #action>
              <NuxtLink to="/workspace/media/accounts" class="to-empty-cta">① 连接公众号 →</NuxtLink>
            </template>
          </MediaEmptyState>
        </div>

        <!-- 标准编制（未部署时的组织架构） -->
        <div class="to-roster">
          <div class="to-roster-title">标准编制 · 订阅后自动部署</div>
          <div v-for="r in roster" :key="r.role" class="to-roster-item">
            <span>{{ r.avatar }}</span>
            <div class="to-roster-meta">
              <div><b>{{ r.name }}</b><span class="to-roster-role">{{ r.role }}</span></div>
              <div class="to-roster-duty">{{ r.duty }}</div>
              <div class="to-roster-value">→ {{ r.value }}</div>
              <div class="to-roster-auto">⚙️ 订阅后自动执行：{{ r.auto }}</div>
            </div>
            <span class="to-roster-tag">🔒 订阅解锁</span>
          </div>
          <NuxtLink to="/workspace/media" class="to-roster-cta">解锁 AI 新媒体团队 →</NuxtLink>
          <div class="to-roster-note">订阅后：自动部署 AI 员工 → 绑定渠道资产 → 开始自动运营 → 成果回流 CEO 驾驶舱</div>
        </div>
      </div>

      <!-- 详情面板 -->
      <div class="to-detail">
        <template v-if="selected">
          <div class="to-detail-head">
            <span class="to-detail-avatar">{{ selected.avatar || selected.name[0] }}</span>
            <div>
              <div class="to-detail-name">{{ selected.name }}</div>
              <div class="to-detail-role">{{ selected.role }}</div>
            </div>
            <span class="to-detail-state" :class="stateClass(selected.lifecycleState)">{{ stateText(selected.lifecycleState) }}</span>
          </div>

          <!-- 岗位职责（产品感: 用户雇佣的是团队，不是软件） -->
          <div class="to-detail-block">
            <div class="to-block-title">📌 岗位职责</div>
            <div class="to-duty">{{ selectedDuty }}</div>
          </div>

          <div class="to-detail-stats">
            <div class="to-dstat"><b>{{ selected.totalTasks }}</b><span>累计任务</span></div>
            <div class="to-dstat"><b>{{ selected.totalErrors }}</b><span>错误</span></div>
            <div class="to-dstat"><b>{{ selected.lastActiveAt ? fmtTime(selected.lastActiveAt) : '—' }}</b><span>最近活跃</span></div>
          </div>

          <!-- 今日任务 -->
          <div class="to-detail-block">
            <div class="to-block-title">📋 今日任务 <span class="to-block-src">AgentSchedule</span></div>
            <div v-if="selectedTasks.length" class="to-tasks">
              <div v-for="t in selectedTasks" :key="t.id" class="to-task">
                <span class="to-task-dot"></span>
                <span>{{ taskTypeLabel(t.taskType) }}</span>
                <span class="to-task-time">{{ fmtTime(t.nextRunAt) }}</span>
              </div>
            </div>
            <div v-else class="to-block-empty">今日暂无排程任务</div>
          </div>

          <!-- 能力清单 -->
          <div class="to-detail-block">
            <div class="to-block-title">⚡ 能力 <span class="to-block-src">CapabilityContract</span></div>
            <div v-if="selectedCapabilities.length" class="to-caps">
              <span v-for="c in selectedCapabilities" :key="c" class="to-cap">{{ c }}</span>
            </div>
            <div v-else class="to-block-empty">能力绑定后将在此展示</div>
          </div>

          <!-- 最近产出（产品感: 雇佣的团队看得见成果） -->
          <div class="to-detail-block">
            <div class="to-block-title">🏆 最近产出 <span class="to-block-src">AgentOutcome · 近 7 天</span></div>
            <div v-if="selectedOutcomes.length" class="to-outcomes">
              <div v-for="o in selectedOutcomes" :key="o.id" class="to-outcome">
                <span class="to-outcome-type">{{ o.outcomeType }}</span>
                <span class="to-outcome-title">{{ o.title || '—' }}</span>
                <span class="to-outcome-time">{{ fmtDate(o.createdAt) }}</span>
              </div>
            </div>
            <div v-else class="to-block-empty">该员工暂无产出记录，执行任务后将如实展示</div>
          </div>
        </template>

        <div v-else class="to-detail-placeholder">
          <MediaEmptyState icon="🧑‍💼" title="选择一名 AI 员工" desc="查看运行状态、今日任务与能力清单" source="AgentInstance + AgentProfile + AgentSchedule + CapabilityContract" />
        </div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'

const agents = ref<any[]>([])
const selected = ref<any>(null)
const schedules = ref<any[]>([])
const outcomes = ref<any[]>([])
const { $toast } = useNuxtApp() as any

const roster = [
  { name: 'Alice', role: '运营总监', avatar: '👩‍💼', duty: '统筹内容日历与发布节奏，制定月度运营策略，指挥团队执行', value: '减少人工策划成本：战略与排期自动生成', auto: '每月内容战略与排期计划，自动指挥团队执行' },
  { name: 'Bob', role: '内容策划', avatar: '🧑‍💻', duty: '追踪行业热点与竞品动态，产出选题池与内容策略建议', value: '持续产生内容方向：选题自动排满日历', auto: '每日扫描热点与竞品，选题池自动填充' },
  { name: 'Carol', role: '内容生产', avatar: '👩‍🎨', duty: '按选题生产图文与视频内容，AI 辅助创作并输出成品', value: '提高生产效率：图文视频批量产出', auto: '按选题自动生成图文与视频初稿，交人工审核' },
  { name: 'David', role: '客服互动', avatar: '🧑‍💼', duty: '接待粉丝消息，识别高价值客户并转交真人跟进', value: '减少人工客服压力：私信秒回自动接待', auto: '自动回复粉丝私信，A/B/C 分级并提醒销售机会' },
  { name: 'Eve', role: '数据分析', avatar: '👩‍🔬', duty: '回流账号数据，产出运营周报与增长洞察', value: '持续优化运营：每周自动复盘', auto: '每周自动产出运营周报与增长建议' },
]

// 岗位职责：优先真实档案（暂无 desc 字段）→ 标准编制职责兜底
const selectedDuty = computed(() => {
  if (!selected.value) return ''
  const r = roster.find((x: any) => x.role === selected.value.role)
  return r?.duty || (selected.value.role === '未分配角色' ? '角色待分配，请先完成岗位配置' : `${selected.value.role}：负责新媒体运营线对应环节`) 
})

const selectedTasks = computed(() => {
  if (!selected.value) return []
  return (schedules.value || []).filter((s: any) => s.agentId === selected.value.employeeId || s.agentId === selected.value.instanceId)
})

// 最近产出：overview.recentOutcomes 按员工实例过滤（纯前端，无新接口）
const selectedOutcomes = computed(() => {
  if (!selected.value) return []
  return (outcomes.value || [])
    .filter((o: any) => o.agentInstanceId === selected.value.instanceId)
    .slice(0, 6)
})

const selectedCapabilities = computed(() => {
  // 能力来自 CapabilityContract 绑定（后续接入）；当前无绑定 → 空
  return [] as string[]
})

onMounted(async () => {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      agents.value = data.data.agents || []
      schedules.value = data.data.today?.scheduleItems || []
      outcomes.value = data.data.recentOutcomes || []
      if (agents.value.length) selected.value = agents.value[0]
    }
  } catch {
    $toast?.error?.('加载团队失败')
  }
})

function taskTypeLabel(t: string) {
  const map: Record<string, string> = { content: '内容生成', scan: '热点扫描', analysis: '数据分析', report: '日报生成', outreach: '粉丝触达', auto: '自动任务' }
  return map[t] || t
}
function fmtTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
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
.to-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  align-items: start;
}
.to-list {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  overflow: hidden;
}
.to-list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-primary);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.to-list-count {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 400;
}
.to-list-body {
  padding: 10px;
}
.to-member {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  margin-bottom: 4px;
}
.to-member:hover {
  background: var(--color-bg-hover);
}
.to-member.is-selected {
  background: var(--color-intelligence-glow);
  border-color: var(--color-intelligence);
}
.to-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--color-bg-hover);
  color: var(--color-intelligence);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 15px;
}
.to-member-meta {
  flex: 1;
  min-width: 0;
}
.to-member-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.to-member-role {
  font-size: 11px;
  color: var(--color-text-muted);
}
.to-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.to-list-empty {
  padding: 10px;
}
.to-empty-cta {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  border-radius: 10px;
  padding: 9px 16px;
  text-decoration: none;
  box-shadow: 0 4px 14px var(--color-intelligence-glow);
}
.to-empty-cta:hover { filter: brightness(1.12); }
.to-roster {
  border-top: 1px solid var(--color-border-primary);
  padding: 14px 18px;
}
.to-roster-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-disabled);
  margin-bottom: 10px;
}
.to-roster-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-primary);
}
.to-roster-item:last-of-type { border-bottom: none; }
.to-roster-meta { flex: 1; min-width: 0; }
.to-roster-meta b { color: var(--color-text-primary); }
.to-roster-role {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-left: 6px;
}
.to-roster-value {
  font-size: 10px;
  color: var(--color-decision);
  margin-top: 2px;
  line-height: 1.4;
}
.to-roster-duty {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
  line-height: 1.4;
}
.to-roster-auto {
  font-size: 10px;
  color: var(--color-warning);
  margin-top: 2px;
  line-height: 1.4;
}
.to-roster-tag {
  margin-left: auto;
  font-size: 9px;
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.12);
  border-radius: 8px;
  padding: 2px 8px;
  white-space: nowrap;
}
.to-roster-cta {
  display: block;
  text-align: center;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--color-intelligence), var(--color-decision));
  border-radius: 10px;
  padding: 10px 16px;
  text-decoration: none;
  box-shadow: 0 4px 14px var(--color-intelligence-glow);
}
.to-roster-cta:hover { filter: brightness(1.1); }
.to-roster-note {
  margin-top: 8px;
  font-size: 10px;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.5;
}

/* 详情 */
.to-detail {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  min-height: 480px;
  padding: 24px;
}
.to-detail-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--color-border-primary);
}
.to-detail-avatar {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-intelligence-glow), var(--color-decision-glow));
  color: var(--color-intelligence);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 800;
}
.to-detail-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-primary);
}
.to-detail-role {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.to-detail-state {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  border-radius: 12px;
  padding: 4px 12px;
}
.st-active { background: var(--color-execution-glow); color: var(--color-execution); }
.st-paused { background: rgba(245, 158, 11, 0.12); color: var(--color-warning); }
.st-recovering { background: var(--color-decision-glow); color: var(--color-decision); }
.st-stopped { background: var(--color-bg-hover); color: var(--color-text-muted); }
.to-duty {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.7;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 10px 12px;
}
.to-detail-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border-primary);
}
.to-dstat {
  background: var(--color-bg-secondary);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.to-dstat b {
  font-size: 17px;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}
.to-dstat span {
  font-size: 10px;
  color: var(--color-text-muted);
}
.to-detail-block {
  padding: 16px 0 0;
}
.to-block-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.to-block-src {
  font-size: 9px;
  color: var(--color-text-disabled);
  border: 1px dashed var(--color-border-secondary);
  border-radius: 6px;
  padding: 1px 6px;
  font-weight: 400;
}
.to-tasks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.to-task {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 12px;
  color: var(--color-text-primary);
}
.to-task-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-warning);
}
.to-task-time {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-text-muted);
}
.to-block-empty {
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border-primary);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.to-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.to-cap {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--color-decision);
  background: var(--color-decision-glow);
  border-radius: 8px;
  padding: 4px 10px;
}
.to-outcomes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.to-outcome {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 12px;
  color: var(--color-text-primary);
}
.to-outcome-type {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-decision);
  background: var(--color-decision-glow);
  border-radius: 6px;
  padding: 2px 8px;
  white-space: nowrap;
  font-family: var(--font-mono);
}
.to-outcome-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.to-outcome-time {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.to-detail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 440px;
}
@media (max-width: 900px) {
  .to-layout { grid-template-columns: 1fr; }
}
</style>
