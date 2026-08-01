<!--
  Sprint-MEDIA-DESIGN-SYSTEM-01 — AI Team Workspace 团队工作台（世界级 UI 重构）
  员工卡: 头像/名字/岗位/一句使命/解决的问题/能力标签/状态/订阅解锁
  视觉: 像「AI 团队」不像「员工列表」；点击卡片查看运行详情
  数据: GET /api/enterprise/media/overview（AgentInstance+Profile）+ AgentSchedule + AgentOutcome
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="AI Team Workspace"
      title="我的 AI 团队"
      :status="{ text: '订阅后自动部署', type: 'off' }"
      desc="一支为你运营新媒体业务的 AI 团队——每名员工：职责清晰、使命明确、订阅后自动部署并开始工作。"
    />

    <div class="to-layout">
      <!-- ═══ 团队卡列 ═══ -->
      <div class="to-list">
        <div class="to-list-head">
          <span>团队成员</span>
          <span class="to-list-count">{{ agents.length ? agents.length + ' 名在岗' : '标准编制 5 名' }}</span>
        </div>

        <div v-if="agents.length" class="to-list-body">
          <button
            v-for="a in agents" :key="a.instanceId"
            class="to-member" :class="{ 'is-selected': selected?.instanceId === a.instanceId }"
            @click="selected = a"
          >
            <span class="to-avatar" :class="stateClass(a.lifecycleState)">{{ a.avatar || a.name[0] }}</span>
            <div class="to-member-meta">
              <div class="to-member-name">{{ a.name }}</div>
              <div class="to-member-role">{{ a.role }}</div>
              <div class="to-member-duty">“{{ memberDuty(a.role) }}”</div>
            </div>
            <span class="to-state" :class="stateClass(a.lifecycleState)">{{ stateText(a.lifecycleState) }}</span>
          </button>
        </div>

        <!-- 标准编制（未部署） -->
        <div v-else class="to-list-body">
          <div
            v-for="m in roster" :key="m.name"
            class="to-member is-roster" :class="{ 'is-selected': selected?.name === m.name }"
            @click="selected = m"
          >
            <span class="to-avatar roster">{{ m.avatar }}</span>
            <div class="to-member-meta">
              <div class="to-member-name">{{ m.name }}</div>
              <div class="to-member-role">{{ m.role }}</div>
              <div class="to-member-duty">“{{ m.mission }}”</div>
              <div class="to-member-caps">
                <span v-for="c in m.capabilities" :key="c" class="to-mini-cap">{{ c }}</span>
              </div>
            </div>
            <span class="to-lock">🔒</span>
          </div>
          <NuxtLink to="/workspace/media" class="to-list-cta">解锁 AI 新媒体团队 →</NuxtLink>
          <div class="to-list-note">订阅后自动部署 · 绑定渠道资产 · 开始自动运营</div>
        </div>
      </div>

      <!-- ═══ 详情面板 ═══ -->
      <div class="to-detail">
        <template v-if="selected">
          <!-- 头卡 -->
          <div class="to-detail-head">
            <span class="to-detail-avatar" :class="selected.lifecycleState ? stateClass(selected.lifecycleState) : 'roster'">
              {{ selected.avatar || selected.name?.[0] }}
            </span>
            <div>
              <div class="to-detail-name">{{ selected.name }}</div>
              <div class="to-detail-role">{{ selected.role }}</div>
              <div v-if="selected.mission || selectedDuty" class="to-detail-mission">“{{ selected.mission || selectedDuty }}”</div>
            </div>
            <span v-if="selected.lifecycleState" class="to-detail-state" :class="stateClass(selected.lifecycleState)">{{ stateText(selected.lifecycleState) }}</span>
            <span v-else class="to-detail-state locked">🔒 订阅解锁</span>
          </div>

          <!-- 解决的问题 -->
          <div class="to-detail-block">
            <div class="to-block-title">💡 解决的问题</div>
            <div class="to-value">{{ selectedValue }}</div>
          </div>

          <!-- 能力标签 -->
          <div class="to-detail-block">
            <div class="to-block-title">⚡ 能力 <span class="to-block-src">CapabilityContract</span></div>
            <div class="to-caps">
              <span v-for="c in selectedCaps" :key="c" class="to-cap">{{ c }}</span>
            </div>
          </div>

          <!-- 运行状态（真实数据时） -->
          <template v-if="selected.lifecycleState">
            <div class="to-detail-stats">
              <div class="to-dstat"><b>{{ selected.totalTasks }}</b><span>累计任务</span></div>
              <div class="to-dstat"><b>{{ selected.totalErrors }}</b><span>错误</span></div>
              <div class="to-dstat"><b>{{ selected.lastActiveAt ? fmtTime(selected.lastActiveAt) : '—' }}</b><span>最近活跃</span></div>
            </div>

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

          <!-- 订阅后自动执行（未部署时） -->
          <template v-else>
            <div class="to-detail-block">
              <div class="to-block-title">⚙️ 订阅后自动执行</div>
              <div class="to-auto">{{ selected.auto }}</div>
            </div>
            <div class="to-detail-block">
              <div class="to-block-title">📌 岗位职责</div>
              <div class="to-duty">{{ selectedDuty }}</div>
            </div>
          </template>
        </template>

        <div v-else class="to-detail-placeholder">
          <div class="tdp-card">
            <span class="tdp-ico">🤖</span>
            <div class="tdp-title">选择一名 AI 员工</div>
            <div class="tdp-desc">查看岗位使命、能力清单与运行状态——这是你将拥有的 AI 运营团队。</div>
          </div>
        </div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'

const agents = ref<any[]>([])
const selected = ref<any>(null)
const schedules = ref<any[]>([])
const outcomes = ref<any[]>([])
const { $toast } = useNuxtApp() as any

// 标准编制：使命 + 解决的问题 + 能力标签 + 订阅后自动执行
const roster = [
  {
    name: 'Alice', role: '运营总监', avatar: '👩‍💼',
    mission: '负责你的内容增长战略',
    value: '减少人工策划成本：战略与排期自动生成，每周一份清晰运营计划',
    capabilities: ['战略规划', '内容排期', '增长分析'],
    duty: '统筹内容日历与发布节奏，制定月度运营策略，指挥团队执行',
    auto: '自动制定内容战略与月度排期，指挥团队执行',
  },
  {
    name: 'Bob', role: '内容策划', avatar: '🧑‍💻',
    mission: '让选题永远不缺灵感',
    value: '持续产生内容方向：选题自动排满内容日历，不再为“今天发什么”发愁',
    capabilities: ['热点追踪', '选题挖掘', '竞品分析'],
    duty: '追踪行业热点与竞品动态，产出选题池与内容策略建议',
    auto: '每日扫描热点与竞品，选题池自动填充',
  },
  {
    name: 'Carol', role: '内容生产', avatar: '👩‍🎨',
    mission: '把选题变成看得见的成品',
    value: '提高生产效率：图文视频批量产出，发布前可人工审核把关',
    capabilities: ['图文创作', '视频脚本', '素材制作'],
    duty: '按选题生产图文与视频内容，AI 辅助创作并输出成品',
    auto: '按选题自动生成图文与视频初稿，交人工审核',
  },
  {
    name: 'David', role: 'AI 客服', avatar: '🧑‍💼',
    mission: '不错过任何一位客户',
    value: '减少人工客服压力：私信秒回，客户线索自动分类，高价值客户及时转真人',
    capabilities: ['自动回复', '意向判断', '客户分级'],
    duty: '接待粉丝消息，识别高价值客户并转交真人跟进',
    auto: '自动回复粉丝私信，A/B/C 分级并提醒销售机会',
  },
  {
    name: 'Eve', role: '数据分析', avatar: '👩‍🔬',
    mission: '让每次运营都有据可依',
    value: '持续优化运营：每周自动复盘，什么有效、粉丝从哪来、下一步做什么',
    capabilities: ['数据回流', '周报生成', '增长洞察'],
    duty: '回流账号数据，产出运营周报与增长洞察',
    auto: '每周自动产出运营周报与增长建议',
  },
]

function rosterByRole(role: string) {
  return roster.find((x: any) => x.role === role)
}

// 员工卡使命（真实 agent 用标准编制使命兜底）
function memberDuty(role: string) {
  return rosterByRole(role)?.mission || (role === '未分配角色' ? '角色待分配，请先完成岗位配置' : `${role}：负责新媒体运营线对应环节`)
}

const selectedDuty = computed(() => {
  if (!selected.value) return ''
  if (selected.value.duty) return selected.value.duty
  return memberDuty(selected.value.role)
})
const selectedValue = computed(() => {
  if (!selected.value) return ''
  return selected.value.value || rosterByRole(selected.value.role)?.value || '运行中：执行新媒体运营任务并如实记录成果'
})
const selectedCaps = computed(() => {
  if (!selected.value) return []
  return selected.value.capabilities || rosterByRole(selected.value.role)?.capabilities || ['执行任务']
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

onMounted(async () => {
  try {
    const token = getAuthToken()
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      agents.value = data.data.agents || []
      schedules.value = data.data.today?.scheduleItems || []
      outcomes.value = data.data.recentOutcomes || []
      if (agents.value.length) selected.value = agents.value[0]
      else selected.value = roster[0]
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
  grid-template-columns: 360px 1fr;
  gap: var(--media-gap-card);
  align-items: start;
}

/* ── 团队卡列 ── */
.to-list {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  overflow: hidden;
  box-shadow: var(--media-card-shadow);
}
.to-list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-primary);
  font-size: 13px;
  font-weight: 800;
  color: var(--media-text-title);
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.05), transparent);
}
.to-list-count {
  font-size: 11px;
  color: var(--media-text-dim);
  font-weight: 400;
}
.to-list-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.to-member {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 14px;
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-panel);
  background: rgba(13, 19, 40, 0.5);
  cursor: pointer;
  text-align: left;
  transition: all 0.18s;
}
.to-member:hover {
  border-color: var(--media-card-border-hover);
  transform: translateY(-1px);
  box-shadow: var(--media-card-shadow);
}
.to-member.is-selected {
  background: linear-gradient(90deg, var(--media-ai-glow), rgba(59, 130, 246, 0.06));
  border-color: var(--media-ai-border);
  box-shadow: 0 0 0 1px var(--media-ai-border), var(--media-card-shadow);
}
.to-avatar {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  color: var(--media-text-title);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 17px;
  flex-shrink: 0;
}
.to-avatar.st-active { border-color: rgba(16, 185, 129, 0.45); }
.to-avatar.roster { background: rgba(51, 65, 85, 0.35); border-color: var(--media-card-border); }
.to-member-meta {
  flex: 1;
  min-width: 0;
}
.to-member-name {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--media-text-title);
}
.to-member-role {
  font-size: 10.5px;
  color: var(--media-brand-text);
  font-weight: 600;
  margin-top: 1px;
}
.to-member-duty {
  font-size: 10.5px;
  color: var(--media-text-dim);
  margin-top: 5px;
  line-height: 1.5;
  font-style: italic;
}
.to-member-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}
.to-mini-cap {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--color-decision);
  background: var(--color-decision-glow);
  border-radius: 6px;
  padding: 2px 8px;
}
.to-state {
  font-size: 9.5px;
  font-weight: 700;
  border-radius: var(--media-radius-pill);
  padding: 3px 9px;
  white-space: nowrap;
  flex-shrink: 0;
}
.to-state.st-active { background: var(--color-execution-glow); color: var(--color-execution); }
.to-state.st-paused { background: rgba(245, 158, 11, 0.12); color: var(--color-warning); }
.to-state.st-recovering { background: var(--color-decision-glow); color: var(--color-decision); }
.to-state.st-stopped { background: var(--color-bg-hover); color: var(--media-text-dim); }
.to-lock {
  font-size: 13px;
  flex-shrink: 0;
  align-self: center;
}
.to-list-cta {
  display: block;
  text-align: center;
  font-size: 12.5px;
  font-weight: 700;
  color: #fff;
  background: var(--media-brand-gradient);
  border-radius: var(--media-radius-node);
  padding: 10px 16px;
  text-decoration: none;
  box-shadow: 0 6px 18px var(--media-brand-glow);
  margin-top: 2px;
}
.to-list-cta:hover { filter: brightness(1.1); }
.to-list-note {
  text-align: center;
  font-size: 10px;
  color: var(--media-text-dim);
  line-height: 1.5;
  margin-top: 8px;
}

/* ── 详情面板 ── */
.to-detail {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  min-height: 520px;
  padding: 28px;
  box-shadow: var(--media-card-shadow);
}
.to-detail-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border-primary);
}
.to-detail-avatar {
  width: 60px;
  height: 60px;
  border-radius: 17px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  color: var(--media-text-title);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  flex-shrink: 0;
}
.to-detail-avatar.st-active { border-color: rgba(16, 185, 129, 0.45); }
.to-detail-name {
  font-size: 19px;
  font-weight: 900;
  color: var(--media-text-hero);
}
.to-detail-role {
  font-size: 12px;
  color: var(--media-brand-text);
  font-weight: 600;
  margin-top: 2px;
}
.to-detail-mission {
  font-size: 11.5px;
  color: var(--media-text-dim);
  margin-top: 6px;
  font-style: italic;
}
.to-detail-state {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  border-radius: var(--media-radius-pill);
  padding: 5px 14px;
  white-space: nowrap;
}
.to-detail-state.st-active { background: var(--color-execution-glow); color: var(--color-execution); }
.to-detail-state.st-paused { background: rgba(245, 158, 11, 0.12); color: var(--color-warning); }
.to-detail-state.st-recovering { background: var(--color-decision-glow); color: var(--color-decision); }
.to-detail-state.st-stopped { background: var(--color-bg-hover); color: var(--media-text-dim); }
.to-detail-state.locked { background: rgba(245, 158, 11, 0.1); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.3); }
.to-detail-block {
  padding: 18px 0 0;
}
.to-block-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--media-text-title);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.to-block-src {
  font-size: 9px;
  color: var(--media-text-dim);
  border: 1px dashed var(--color-border-secondary);
  border-radius: 6px;
  padding: 1px 6px;
  font-weight: 400;
}
.to-value {
  font-size: 12.5px;
  color: var(--color-decision);
  line-height: 1.7;
  background: var(--color-decision-glow);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: var(--media-radius-node);
  padding: 12px 14px;
}
.to-duty {
  font-size: 12px;
  color: var(--media-text-body);
  line-height: 1.7;
  background: var(--color-bg-secondary);
  border-radius: var(--media-radius-node);
  padding: 12px 14px;
}
.to-auto {
  font-size: 12px;
  color: var(--color-warning);
  line-height: 1.7;
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: var(--media-radius-node);
  padding: 12px 14px;
}
.to-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.to-cap {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-decision);
  background: var(--color-decision-glow);
  border-radius: 8px;
  padding: 5px 12px;
}
.to-detail-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 18px 0 0;
}
.to-dstat {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--media-radius-node);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.to-dstat b {
  font-size: 18px;
  color: var(--media-text-title);
  font-variant-numeric: tabular-nums;
}
.to-dstat span {
  font-size: 10px;
  color: var(--media-text-dim);
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
  border: 1px solid var(--color-border-primary);
  border-radius: var(--media-radius-node);
  padding: 10px 14px;
  font-size: 12px;
  color: var(--media-text-title);
}
.to-task-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-warning);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}
.to-task-time {
  margin-left: auto;
  font-size: 11px;
  color: var(--media-text-dim);
  font-family: var(--font-mono);
}
.to-block-empty {
  font-size: 12px;
  color: var(--media-text-dim);
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border-primary);
  border-radius: var(--media-radius-node);
  padding: 14px;
  text-align: center;
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
  border: 1px solid var(--color-border-primary);
  border-radius: var(--media-radius-node);
  padding: 10px 14px;
  font-size: 12px;
  color: var(--media-text-title);
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
  color: var(--media-text-dim);
  white-space: nowrap;
}
.to-detail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 460px;
}
.tdp-card {
  text-align: center;
  padding: 40px;
}
.tdp-ico {
  font-size: 40px;
  width: 76px;
  height: 76px;
  border-radius: 22px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}
.tdp-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--media-text-title);
  margin-bottom: 8px;
}
.tdp-desc {
  font-size: 12px;
  color: var(--media-text-dim);
  line-height: 1.7;
  max-width: 300px;
}
@media (max-width: 980px) {
  .to-layout { grid-template-columns: 1fr; }
}
</style>
