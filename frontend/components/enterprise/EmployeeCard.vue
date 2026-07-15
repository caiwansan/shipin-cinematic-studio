<template>
  <div class="employee-card" :class="statusClass">
    <!-- Header: Identity -->
    <div class="emp-header">
      <div class="emp-avatar-wrap">
        <div class="emp-avatar" :style="avatarStyle">
          {{ avatar }}
        </div>
        <div class="emp-status-dot" :class="statusClass" />
      </div>
      <div class="emp-id">
        <h3 class="emp-name">{{ displayName }}</h3>
        <div class="emp-role">{{ roleName }}</div>
        <div class="emp-resp">{{ responsibility }}</div>
      </div>
      <div class="emp-actions">
        <button
          @click="$emit('toggle')"
          :class="employee.status === 'active' ? 'btn-pause' : 'btn-resume'"
        >
          {{ employee.status === 'active' ? '⏸ 暂停' : '▶ 启用' }}
        </button>
      </div>
    </div>

    <!-- Today Work Section -->
    <div class="emp-today-section">
      <div class="emp-section-title">今日工作</div>
      <div class="emp-task-list">
        <div v-for="(task, idx) in displayTasks" :key="idx" class="emp-task-item">
          <span class="emp-task-icon">{{ task.icon }}</span>
          <span class="emp-task-text">{{ task.text }}</span>
        </div>
        <div v-if="displayTasks.length === 0" class="emp-task-empty">
          等待今日任务派发...
        </div>
      </div>
    </div>

    <!-- Contribution Section -->
    <div class="emp-contribution-section">
      <div class="emp-section-title">今日贡献</div>
      <div class="emp-contrib-grid">
        <div class="emp-contrib-item" v-for="c in contributions" :key="c.label">
          <div class="emp-contrib-num" :class="c.color">{{ c.value }}</div>
          <div class="emp-contrib-label">{{ c.label }}</div>
        </div>
      </div>
    </div>

    <!-- Expertise Tags -->
    <div class="emp-expertise-section">
      <div class="emp-section-title">专业能力</div>
      <div class="emp-tag-list">
        <span v-for="skill in displaySkills" :key="skill" class="emp-skill-tag">
          {{ skill }}
        </span>
      </div>
    </div>

    <!-- CEO Note -->
    <div class="emp-note-section">
      <div class="emp-section-title">CEO指令</div>
      <input
        type="text"
        :value="employee.managerNote"
        @change="$emit('update-note', $event.target.value)"
        placeholder="给AI员工的工作指令..."
        class="emp-note-input"
      />
    </div>

    <!-- Progress -->
    <div class="emp-progress-section">
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>今日完成度</span>
        <span class="text-blue-400 font-medium">{{ employee.todayCompleted || 0 }}/{{ employee.dailyTarget || 0 }} 项任务</span>
      </div>
      <div class="emp-progress-bar">
        <div class="emp-progress-fill" :style="{ width: progressPercent + '%' }" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  employee: { type: Object, required: true },
  todayTaskList: { type: Array, default: () => [] }
})

defineEmits(['toggle', 'update-note'])

// ─── Identity Mapping ───────────────────────────────────────
const roleNames = {
  growth_director: '增长总监',
  content_manager: '内容增长专员',
  market_analyst: '市场研究专员',
  customer_ops: '客户运营专员',
  sales_assistant: '销售参谋专员',
}

const avatarMap = {
  growth_director: '👔',
  content_manager: '📝',
  market_analyst: '🔍',
  customer_ops: '💬',
  sales_assistant: '💼',
}

const avatarColors = {
  growth_director: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
  content_manager: 'linear-gradient(135deg, #06B6D4, #3B82F6)',
  market_analyst: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
  customer_ops: 'linear-gradient(135deg, #10B981, #06B6D4)',
  sales_assistant: 'linear-gradient(135deg, #F59E0B, #EF4444)',
}

const role = computed(() => props.employee.agentType || props.employee.role)
const displayName = computed(() => props.employee.name || 'AI员工')
const roleName = computed(() => roleNames[role.value] || 'AI员工')
const avatar = computed(() => avatarMap[role.value] || '🤖')
const avatarStyle = computed(() => ({ background: avatarColors[role.value] || 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }))
const statusClass = computed(() => props.employee.status === 'active' ? 'active' : 'idle')

const responsibility = computed(() => {
  const g = props.employee.goal
  if (!g) return '负责企业增长相关任务'
  return g.length > 20 ? g.slice(0, 20) + '...' : g
})

// ─── Today Tasks (from dashboard API) ──────────────────────
const displayTasks = computed(() => {
  const tasks = props.todayTaskList
  if (!tasks || tasks.length === 0) {
    // Fallback: synthesize from capabilities
    const caps = parseJSON(props.employee.capabilities, [])
    if (caps.length > 0) {
      return caps.slice(0, 3).map(c => ({ icon: '✓', text: c }))
    }
    return []
  }
  return tasks.slice(0, 4).map(t => {
    const icon = t.action?.includes('content') ? '📝'
      : t.action?.includes('analysis') ? '📊'
      : t.action?.includes('scan') ? '🔍'
      : t.action?.includes('report') ? '📋'
      : '✓'
    return { icon, text: t.action || '执行任务' }
  })
})

// ─── Contributions ─────────────────────────────────────────
const contributions = computed(() => {
  const kpi = parseJSON(props.employee.kpiMetrics, {})
  const contrib = []
  if (kpi.opportunities_found !== undefined) {
    const channels = parseJSON(props.employee.kpiMetrics, {})
    contrib.push({ value: channels.opportunities_found || 0, label: '发现机会', color: 'text-yellow-400' })
  }
  if (kpi.content_created !== undefined) {
    const channels = parseJSON(props.employee.kpiMetrics, {})
    contrib.push({ value: channels.content_created || 0, label: '生产内容', color: 'text-blue-400' })
  }
  if (kpi.interactions_handled !== undefined) {
    const channels = parseJSON(props.employee.kpiMetrics, {})
    contrib.push({ value: channels.interactions_handled || 0, label: '处理互动', color: 'text-cyan-400' })
  }
  if (kpi.leads_processed !== undefined) {
    const channels = parseJSON(props.employee.kpiMetrics, {})
    contrib.push({ value: channels.leads_processed || 0, label: '处理线索', color: 'text-orange-400' })
  }
  if (kpi.reports_generated !== undefined) {
    const channels = parseJSON(props.employee.kpiMetrics, {})
    contrib.push({ value: channels.reports_generated || 0, label: '生成报告', color: 'text-purple-400' })
  }
  if (contrib.length === 0) {
    // Default contribution from todayCompleted
    contrib.push(
      { value: props.employee.todayCompleted || 0, label: '完成任务', color: 'text-green-400' },
      { value: props.employee.dailyTarget || 0, label: '目标总量', color: 'text-blue-400' }
    )
  }
  return contrib.slice(0, 4)
})

// ─── Skills ────────────────────────────────────────────────
const displaySkills = computed(() => {
  const caps = parseJSON(props.employee.capabilities, [])
  if (caps.length > 0) return caps.slice(0, 5)
  const knowledge = parseJSON(props.employee.knowledgeScope, [])
  return knowledge.slice(0, 5)
})

// ─── Progress ──────────────────────────────────────────────
const progressPercent = computed(() => {
  const target = props.employee.dailyTarget || 1
  const completed = props.employee.todayCompleted || 0
  return Math.min(100, Math.round((completed / target) * 100))
})

// ─── Helpers ───────────────────────────────────────────────
function parseJSON(val, fallback) {
  if (!val) return fallback
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return fallback }
}
</script>

<style scoped>
.employee-card {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
  transition: all 0.2s;
}
.employee-card:hover {
  border-color: #3B82F6;
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1);
}
.employee-card.idle {
  opacity: 0.7;
}

/* ── Header ── */
.emp-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;
}
.emp-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.emp-avatar {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.emp-status-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #0D1328;
}
.emp-status-dot.active { background: #22C55E; box-shadow: 0 0 6px #22C55E50; }
.emp-status-dot.idle { background: #6B7280; }

.emp-id { flex: 1; min-width: 0; }
.emp-name { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
.emp-role { font-size: 12px; color: #3B82F6; margin-bottom: 2px; }
.emp-resp { font-size: 11px; color: #6B7280; }

.emp-actions { flex-shrink: 0; }
.btn-pause, .btn-resume {
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-pause { color: #F87171; border-color: #F8717130; }
.btn-pause:hover { background: #F8717115; }
.btn-resume { color: #22C55E; border-color: #22C55E30; }
.btn-resume:hover { background: #22C55E15; }

/* ── Sections ── */
.emp-section-title {
  font-size: 11px;
  color: #6B7280;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.emp-today-section,
.emp-contribution-section,
.emp-expertise-section,
.emp-note-section {
  margin-bottom: 14px;
}

/* ── Task List ── */
.emp-task-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.emp-task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #D1D5DB;
}
.emp-task-icon { font-size: 12px; }
.emp-task-empty { font-size: 11px; color: #4B5563; }

/* ── Contributions ── */
.emp-contrib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  gap: 8px;
}
.emp-contrib-item { text-align: center; }
.emp-contrib-num { font-size: 18px; font-weight: 700; }
.emp-contrib-label { font-size: 10px; color: #6B7280; }

/* ── Skills ── */
.emp-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.emp-skill-tag {
  font-size: 10px;
  padding: 3px 8px;
  background: #1A2240;
  border: 1px solid #2A3358;
  border-radius: 6px;
  color: #9CA3AF;
}

/* ── Note Input ── */
.emp-note-input {
  width: 100%;
  background: #060A18;
  border: 1px solid #1A2240;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: #D1D5DB;
  transition: border-color 0.2s;
}
.emp-note-input:focus {
  outline: none;
  border-color: #3B82F6;
}
.emp-note-input::placeholder { color: #4B5563; }

/* ── Progress ── */
.emp-progress-section { padding-top: 4px; }
.emp-progress-bar {
  height: 4px;
  background: #1A2240;
  border-radius: 2px;
  overflow: hidden;
}
.emp-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3B82F6, #06B6D4);
  border-radius: 2px;
  transition: width 0.5s;
}
</style>
