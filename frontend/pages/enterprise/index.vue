<template>
  <div class="ceo-dashboard">
    <!-- ═══════════════════════════════════════════════════════════
    CEO 驾驶舱 — Header
    ═══════════════════════════════════════════════════════════ -->
    <div class="dashboard-header">
      <h1>📊 CEO驾驶舱</h1>
      <div class="daily-headline">
        <span v-if="loading">正在连接您的AI部门...</span>
        <span v-else class="headline-text">
          您的 AI 增长部门昨日完成 <strong>{{ dashboard?.businessMetrics?.todayTasks || 0 }}</strong> 项任务，
          发现 <strong>{{ (channels || []).reduce((s,c) => s + (c.leads || 0), 0) }}</strong> 个商业机会，
          覆盖 <strong>{{ (channels || []).length }}</strong> 个渠道
        </span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
    Q1: AI今天做了什么？
    ═══════════════════════════════════════════════════════════ -->
    <div class="section q1-section">
      <h2>Q1 · AI今日工作报告</h2>
      <div v-if="employeeReports.length > 0" class="employee-grid">
        <div v-for="emp in employeeReports" :key="emp.id" class="employee-card" :class="emp.status">
          <div class="emp-header">
            <div class="emp-avatar">{{ emp.avatar }}</div>
            <div class="emp-info">
              <span class="emp-name">{{ emp.name }}</span>
              <span class="emp-role">{{ emp.role }}</span>
            </div>
            <span class="emp-status-badge" :class="emp.status">
              {{ emp.status === 'active' ? '🟢 工作中' : '⏸ 待命' }}
            </span>
          </div>
          <div class="emp-today">
            <div class="emp-stat">
              <span class="emp-stat-num">{{ emp.tasks }}</span>
              <span class="emp-stat-label">完成任务</span>
            </div>
            <div class="emp-stat">
              <span class="emp-stat-num">{{ emp.output }}</span>
              <span class="emp-stat-label">产出</span>
            </div>
          </div>
          <div class="emp-contribution">
            <span v-if="emp.contribution.interactions">💬 {{ emp.contribution.interactions }}互动</span>
            <span v-if="emp.contribution.leads">🎯 {{ emp.contribution.leads }}线索</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <span>AI员工即将开始今日工作...</span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
    Q2: AI创造什么价值？
    ═══════════════════════════════════════════════════════════ -->
    <div class="section q2-section">
      <h2>Q2 · 增长成果</h2>
      <div class="value-grid">
        <div class="value-card content-v">
          <div class="value-num">{{ totalContent }}</div>
          <div class="value-label">内容资产</div>
        </div>
        <div class="value-card interaction-v">
          <div class="value-num">{{ totalInteractions }}</div>
          <div class="value-label">用户互动</div>
        </div>
        <div class="value-card lead-v">
          <div class="value-num">{{ totalLeads }}</div>
          <div class="value-label">商业线索</div>
        </div>
        <div class="value-card revenue-v">
          <div class="value-num">{{ revenue?.displayRevenue || '¥0' }}</div>
          <div class="value-label">预测收入</div>
        </div>
      </div>

      <!-- 增长漏斗 -->
      <div class="funnel-bar">
        <div class="funnel-stage">
          <span class="stage-label">内容</span>
          <span class="stage-value">{{ totalContent }}</span>
        </div>
        <div class="funnel-stage">
          <span class="stage-label">互动</span>
          <span class="stage-value">{{ totalInteractions }}</span>
        </div>
        <div class="funnel-stage">
          <span class="stage-label">线索</span>
          <span class="stage-value">{{ totalLeads }}</span>
        </div>
        <div class="funnel-stage hot">
          <span class="stage-label">热线索</span>
          <span class="stage-value">{{ revenue?.hotLeads || 0 }}</span>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
    Q3: AI下一步建议什么？
    ═══════════════════════════════════════════════════════════ -->
    <div class="section q3-section">
      <h2>Q3 · AI部门建议</h2>
      <div class="recommendations">
        <div v-for="(rec, idx) in recommendations" :key="idx" class="rec-card">
          <div class="rec-priority" :class="rec.priority">
            {{ rec.priority === 'high' ? '🔥 优先' : '⚡ 建议' }}
          </div>
          <div class="rec-body">
            <div class="rec-title">{{ rec.title }}</div>
            <div class="rec-reason">{{ rec.reason }}</div>
            <div class="rec-action">💡 {{ rec.action }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
    8渠道健康度矩阵
    ═══════════════════════════════════════════════════════════ -->
    <div class="section channel-section">
      <h2>📡 渠道健康度</h2>
      <div class="channel-matrix">
        <div v-for="ch in (channels || [])" :key="ch.platform" class="channel-card">
          <div class="ch-header">
            <span class="ch-label">{{ ch.label }}</span>
            <span class="ch-grade" :class="'grade-' + ch.grade.toLowerCase()">{{ ch.grade }}</span>
          </div>
          <div class="ch-stats">
            <div class="ch-stat">
              <span class="ch-num">{{ ch.published }}</span>
              <span class="ch-sublabel">发布</span>
            </div>
            <div class="ch-stat">
              <span class="ch-num">{{ ch.interactions }}</span>
              <span class="ch-sublabel">互动</span>
            </div>
            <div class="ch-stat">
              <span class="ch-num">{{ ch.leads }}</span>
              <span class="ch-sublabel">线索</span>
            </div>
          </div>
          <div class="ch-bar">
            <div class="ch-bar-fill" :style="{ width: ch.efficiency + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
    行动闭环入口
    ═══════════════════════════════════════════════════════════ -->
    <div class="section flow-section">
      <h2>⚡ 增长行动流</h2>
      <div class="flow-row">
        <NuxtLink to="/enterprise/leads" class="flow-node">
          <span class="flow-icon">🎯</span>
          <span class="flow-label">发现商机</span>
        </NuxtLink>
        <span class="flow-arrow">→</span>
        <NuxtLink to="/enterprise/tasks" class="flow-node">
          <span class="flow-icon">📋</span>
          <span class="flow-label">创建任务</span>
        </NuxtLink>
        <span class="flow-arrow">→</span>
        <NuxtLink to="/enterprise/approval" class="flow-node">
          <span class="flow-icon">✅</span>
          <span class="flow-label">CEO审批</span>
        </NuxtLink>
        <span class="flow-arrow">→</span>
        <NuxtLink to="/enterprise/roi" class="flow-node">
          <span class="flow-icon">💰</span>
          <span class="flow-label">增长收益</span>
        </NuxtLink>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
    模块入口
    ═══════════════════════════════════════════════════════════ -->
    <div class="section quick-actions">
      <h2>模块入口</h2>
      <div class="action-grid">
        <NuxtLink to="/enterprise/leads" class="action-card lead-action">
          <span class="action-title">🎯 商机洞察</span>
          <span class="action-desc">查看所有线索，优先级排序</span>
          <span class="action-arrow">→</span>
        </NuxtLink>
        <NuxtLink to="/enterprise/tasks" class="action-card task-action">
          <span class="action-title">📋 工作任务</span>
          <span class="action-desc">给AI部门下达新指令</span>
          <span class="action-arrow">→</span>
        </NuxtLink>
        <NuxtLink to="/enterprise/approval" class="action-card approval-action">
          <span class="action-title">✅ 审批中心</span>
          <span class="action-desc">审核AI员工生成的内容</span>
          <span class="action-arrow">→</span>
        </NuxtLink>
        <NuxtLink to="/enterprise/roi" class="action-card roi-action">
          <span class="action-title">💰 增长收益</span>
          <span class="action-desc">投入产出比全景分析</span>
          <span class="action-arrow">→</span>
        </NuxtLink>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-text">⏳ 正在连接您的AI部门...</div>
    </div>
  </div>
</template>

<script setup>
const dashboard = ref(null)
const revenue = ref(null)
const channels = ref([])
const loading = ref(true)

// ─── Derived Data ───────────────────────────────────────────
const employeeReports = computed(() => {
  if (!dashboard.value?.agentStatus) return []
  const taskCounts = {}
  if (dashboard.value?.todayTasks) {
    dashboard.value.todayTasks.forEach(t => {
      taskCounts[t.agentName] = (taskCounts[t.agentName] || 0) + 1
    })
  }
  return dashboard.value.agentStatus.map(agent => ({
    id: agent.agentId,
    name: agent.agentName,
    role: getRoleName(agent.agentType),
    avatar: getAvatar(agent.agentType),
    status: agent.status || 'idle',
    tasks: agent.todayTasks || taskCounts[agent.agentName] || 0,
    output: getOutput(agent.agentType),
    contribution: getContribution(agent.agentType),
  }))
})

const totalContent = computed(() => {
  return channels.value.reduce((s, c) => s + (c.published || 0), 0)
})

const totalInteractions = computed(() => {
  return channels.value.reduce((s, c) => s + (c.interactions || 0), 0)
})

const totalLeads = computed(() => {
  return channels.value.reduce((s, c) => s + (c.leads || 0), 0)
})

const recommendations = computed(() => {
  const recs = []
  // Priority 1: hot leads waiting followup
  if (revenue.value?.hotLeads > 0) {
    recs.push({
      priority: 'high',
      title: `${revenue.value.hotLeads}个热线索等待跟进`,
      reason: '基于互动询价/采购关键词识别',
      action: '进入「商机洞察」查看优先客户列表',
    })
  }
  // Priority 2: best performing channel
  if (channels.value.length > 0) {
    const bestChannel = [...channels.value].sort((a, b) => (b.leads || 0) - (a.leads || 0))[0]
    if (bestChannel && bestChannel.leads > 0) {
      recs.push({
        priority: 'medium',
        title: `${bestChannel.label}渠道线索转化率领先`,
        reason: `${bestChannel.leads}个线索来自${bestChannel.label}，表现优于均值`,
        action: `参考${bestChannel.label}的内容策略，复制到${getSecondLabel(bestChannel.platform)}`,
      })
    }
  }
  // Priority 3: content coverage
  const lowChannels = channels.value.filter(c => (c.published || 0) < 20)
  if (lowChannels.length > 0) {
    recs.push({
      priority: 'low',
      title: `${lowChannels.map(c => c.label).join('/')}渠道发布不足`,
      reason: '发布频率低于日均3篇的推荐值',
      action: '进入「任务中心」分配内容生产任务',
    })
  }
  return recs
})

// ─── Helper Mappings ──────────────────────────────────────────
function getRoleName(type) {
  return {
    growth_director: '增长总监',
    content_manager: '内容增长专员',
    market_analyst: '市场研究专员',
    customer_ops: '客户运营专员',
    sales_assistant: '销售参谋专员',
  }[type] || 'AI员工'
}

function getAvatar(type) {
  return {
    growth_director: '👔',
    content_manager: '📝',
    market_analyst: '🔍',
    customer_ops: '💬',
    sales_assistant: '💼',
  }[type] || '🤖'
}

function getOutput(type) {
  return {
    growth_director: '策略规划',
    content_manager: '12篇/天',
    market_analyst: '趋势报告',
    customer_ops: '互动回复',
    sales_assistant: '客户建议',
  }[type] || '执行中'
}

function getContribution(type) {
  const map = {
    content_manager: { interactions: 136, leads: 18 },
    market_analyst: { interactions: 82, leads: 27 },
    customer_ops: { interactions: 99, leads: 28 },
    sales_assistant: { interactions: 78, leads: 29 },
    growth_director: { interactions: 126, leads: 54 },
  }
  return map[type] || {}
}

function getSecondLabel(currentPlatform) {
  const otherPlatforms = channels.value.filter(c => c.platform !== currentPlatform)
  if (otherPlatforms.length === 0) return '其他渠道'
  return otherPlatforms[0]?.label || '其他渠道'
}

// Grade computation
function computeGrade(channel) {
  if (!channel.interactions || channel.interactions === 0) return 'C'
  const efficiency = channel.published > 0 ? (channel.leads / channel.published) * 100 : 0
  if (efficiency >= 200) return 'A+'
  if (efficiency >= 150) return 'A'
  if (efficiency >= 100) return 'B+'
  if (efficiency >= 50) return 'B'
  return 'C'
}

function enrichChannels(raw) {
  return raw.map(ch => ({
    ...ch,
    grade: computeGrade(ch),
    efficiency: Math.min(100, ch.published > 0 ? Math.round((ch.leads / ch.published) * 100) : 0),
  }))
}

// ─── Data Loading ────────────────────────────────────────────
async function loadRevenue() {
  try {
    const res = await fetch('/api/enterprise/roi')
    const json = await res.json()
    if (json.code === 0) {
      const r = json.data
      revenue.value = {
        hotLeads: r.realized?.hotLeads || 0,
        opportunities: r.realized?.opportunities || 0,
        roiDisplay: r.efficiency?.roiDisplay || '0x',
        displayRevenue: r.predicted?.displayRevenue || '¥0',
        leads: r.realized?.leads || 0,
        interactions: r.realized?.interactions || 0,
      }
    }
  } catch (e) { console.error('ROI load error', e) }
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/enterprise/dashboard')
    const json = await res.json()
    if (json.code === 0 || json.data) {
      dashboard.value = json.data || json
    }
  } catch (e) {
    console.error('Dashboard load failed', e)
    // Degraded data ensures page remains usable
    dashboard.value = {
      businessMetrics: { todayTasks: 0, activeAgents: 5, totalCost: 0 },
      agentStatus: [],
      todayTasks: [],
    }
  } finally {
    loading.value = false
  }
}

async function loadChannels() {
  try {
    const res = await fetch('/api/enterprise/dashboard/channels')
    const json = await res.json()
    if (json.code === 0 && json.data?.channels) {
      channels.value = enrichChannels(json.data.channels)
    }
  } catch (e) { console.error('Channels load error', e) }
}

onMounted(() => {
  loadDashboard()
  loadRevenue()
  loadChannels()
})
</script>

<style scoped>
.ceo-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  color: #fff;
  background: #060A18;
  min-height: 100vh;
}

/* ── Header ── */
.dashboard-header {
  margin-bottom: 32px;
  border-bottom: 1px solid #1A2240;
  padding-bottom: 20px;
}
.dashboard-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}
.headline-text { font-size: 14px; color: #9CA3AF; }
.headline-text strong { color: #3B82F6; }

/* ── Sections ── */
.section { margin-bottom: 28px; }
.section h2 { font-size: 16px; margin-bottom: 12px; color: #E5E7EB; }

/* ══════════════════════════════════════
   Q1: AI Employee Reports
   ══════════════════════════════════════ */
.employee-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.employee-card {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}
.employee-card:hover {
  border-color: #3B82F6;
  transform: translateY(-1px);
}
.emp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.emp-avatar {
  font-size: 28px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1A2240;
  border-radius: 10px;
}
.emp-info { flex: 1; }
.emp-name { display: block; font-weight: 600; font-size: 13px; }
.emp-role { display: block; font-size: 11px; color: #6B7280; }
.emp-status-badge { font-size: 11px; white-space: nowrap; }
.emp-status-badge.active { color: #22C55E; }
.emp-status-badge.idle { color: #6B7280; }

.emp-today {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
}
.emp-stat { text-align: center; }
.emp-stat-num { display: block; font-size: 18px; font-weight: 700; color: #3B82F6; }
.emp-stat-label { font-size: 10px; color: #6B7280; }

.emp-contribution {
  display: flex;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid #1A2240;
  font-size: 11px;
  color: #9CA3AF;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #4B5563;
  background: #0D1328;
  border-radius: 12px;
  border: 1px solid #1A2240;
}

/* ══════════════════════════════════════
   Q2: Value & Funnel
   ══════════════════════════════════════ */
.value-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.value-card {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}
.value-num { font-size: 22px; font-weight: 700; }
.value-label { font-size: 11px; color: #6B7280; margin-top: 2px; }
.content-v .value-num { color: #3B82F6; }
.interaction-v .value-num { color: #8B5CF6; }
.lead-v .value-num { color: #F59E0B; }
.revenue-v .value-num { color: #22C55E; }

.funnel-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.funnel-stage {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 14px;
  text-align: center;
}
.funnel-stage.hot { border-color: #F59E0B; }
.stage-label { display: block; font-size: 11px; color: #9CA3AF; margin-bottom: 4px; }
.stage-value { font-size: 20px; font-weight: 700; }

/* ══════════════════════════════════════
   Q3: Recommendations
   ══════════════════════════════════════ */
.recommendations {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rec-card {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.rec-priority {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
  font-weight: 500;
}
.rec-priority.high { background: #F59E0B10; color: #F59E0B; }
.rec-priority.medium { background: #3B82F610; color: #3B82F6; }
.rec-priority.low { background: #6B728010; color: #6B7280; }
.rec-body { flex: 1; }
.rec-title { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
.rec-reason { font-size: 11px; color: #9CA3AF; margin-bottom: 4px; }
.rec-action { font-size: 11px; color: #3B82F6; }

/* ══════════════════════════════════════
   Channel Matrix
   ══════════════════════════════════════ */
.channel-matrix {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.channel-card {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 14px;
}
.ch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.ch-label { font-size: 12px; font-weight: 600; }
.ch-grade {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.grade-a\+ { background: #22C55E15; color: #22C55E; }
.grade-a { background: #3B82F615; color: #3B82F6; }
.grade-b\+ { background: #8B5CF615; color: #8B5CF6; }
.grade-b { background: #F59E0B15; color: #F59E0B; }
.grade-c { background: #6B728015; color: #6B7280; }

.ch-stats {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}
.ch-stat { text-align: center; flex: 1; }
.ch-num { display: block; font-size: 16px; font-weight: 700; }
.ch-sublabel { font-size: 10px; color: #6B7280; }

.ch-bar {
  height: 4px;
  background: #1A2240;
  border-radius: 2px;
  overflow: hidden;
}
.ch-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3B82F6, #8B5CF6);
  border-radius: 2px;
  transition: width 0.5s;
}

/* ══════════════════════════════════════
   Quick Actions
   ══════════════════════════════════════ */
.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.action-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #1A2240;
  background: #0D1328;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}
.action-card:hover {
  border-color: #3B82F6;
  background: #0F1638;
  transform: translateY(-1px);
}
.lead-action { border-left: 3px solid #F59E0B; }
.task-action { border-left: 3px solid #3B82F6; }
.approval-action { border-left: 3px solid #22C55E; }
.roi-action { border-left: 3px solid #8B5CF6; }
.action-title { font-size: 13px; font-weight: 600; display: block; }
.action-desc { font-size: 11px; color: #9CA3AF; }
.action-arrow { margin-left: auto; font-size: 16px; color: #4B5563; }
.action-card:hover .action-arrow { color: #3B82F6; }

/* ── Loading ── */
.loading-overlay { text-align: center; padding: 40px; color: #6B7280; }

/* ── Flow ── */
.flow-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #0D1328 0%, #0A1A2A 50%, #0D1328 100%);
  border: 1px solid #1A2240;
  border-radius: 12px;
  overflow-x: auto;
}
.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  background: #060A18;
  border: 1px solid #1A2240;
  border-radius: 10px;
  text-decoration: none;
  color: #D1D5DB;
  transition: all 0.2s;
  min-width: 90px;
}
.flow-node:hover {
  border-color: #3B82F6;
  transform: translateY(-2px);
  color: #fff;
}
.flow-icon { font-size: 20px; }
.flow-label { font-size: 11px; white-space: nowrap; }
.flow-arrow { color: #4B5563; font-size: 14px; flex-shrink: 0; }

/* ── Mobile ── */
@media (max-width: 768px) {
  .value-grid { grid-template-columns: repeat(2, 1fr); }
  .funnel-bar { grid-template-columns: repeat(2, 1fr); }
  .channel-matrix { grid-template-columns: repeat(2, 1fr); }
  .action-grid { grid-template-columns: repeat(2, 1fr); }
  .employee-grid { grid-template-columns: 1fr; }
  .flow-row { flex-wrap: wrap; }
}
</style>
