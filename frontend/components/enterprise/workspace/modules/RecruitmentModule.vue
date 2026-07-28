<!--
  FRONTEND-UX-POLISH-01: UX polish pass。
  只改视觉/文本/层级，不改变业务逻辑/数据流/组件结构。
-->
<template>
  <div class="recruitment-module">
    <!-- ═══════════════════════════════════════════════
         企业身份区
         ─ KPI 数据块强化色块感
         ─ 状态栏缩小，CTA 主次分明
         ═══════════════════════════════════════════════ -->
    <div class="rec-identity">
      <div class="rec-identity-top">
        <div class="rec-identity-brand">
          <span class="rec-identity-icon">🏢</span>
          <div>
            <h1 class="rec-identity-name">{{ orgName }} · 招聘工作台</h1>
            <p class="rec-identity-status">
              <span class="rec-status-dot rec-status-dot--healthy"></span>
              {{ activeAgentCount }} 个 AI 招聘员工运行中
            </p>
          </div>
        </div>
        <button class="rec-btn-primary" @click="goToCreateJob">
          📝 创建岗位 →
        </button>
      </div>

      <!-- 招聘概览 KPI -->
      <div class="rec-summary">
        <div class="rec-summary-item">
          <span class="rec-summary-value">{{ stats.totalJobs }}</span>
          <span class="rec-summary-label">在招岗位</span>
        </div>
        <div class="rec-summary-item rec-summary-item--candidates">
          <span class="rec-summary-value">{{ stats.totalCandidates }}</span>
          <span class="rec-summary-label">候选人</span>
        </div>
        <div class="rec-summary-item rec-summary-item--pending">
          <span class="rec-summary-value">{{ stats.pendingReview }}</span>
          <span class="rec-summary-label">待处理</span>
        </div>
        <div class="rec-summary-item rec-summary-item--ai">
          <span class="rec-summary-value">{{ stats.matchingTasks }}</span>
          <span class="rec-summary-label">AI 在办</span>
        </div>
      </div>

      <div class="rec-identity-foot">
        <button class="rec-btn-secondary" @click="goToRecruitment">
          🔍 人才池
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         Loading 状态 — 品牌脉冲
         ═══════════════════════════════════════════════ -->
    <div v-if="recruitmentState.value.loading" class="rec-state rec-state--loading">
      <div class="rec-loading-pulse">
        <span class="rec-loading-dot rec-loading-dot--1"></span>
        <span class="rec-loading-dot rec-loading-dot--2"></span>
        <span class="rec-loading-dot rec-loading-dot--3"></span>
      </div>
      <div class="rec-state-text">
        <p class="rec-state-title">AI 招聘团队正在就位</p>
        <span class="rec-state-desc">为您整理招聘数据</span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         Empty State — 情感化引导
         ═══════════════════════════════════════════════ -->
    <div v-else-if="recruitmentState.value.agents.length === 0" class="rec-state rec-state--empty">
      <div class="rec-empty-visual">
        <div class="rec-empty-orb"></div>
      </div>
      <h2 class="rec-empty-heading">开始你的 AI 招聘之旅</h2>
      <p class="rec-empty-sub">
        AI 招聘团队已就绪，等你创建第一个招聘岗位
      </p>
      <div class="rec-roadmap">
        <div class="rec-roadmap-step">
          <span class="rec-roadmap-icon">📝</span>
          <div>
            <span class="rec-roadmap-title">创建岗位</span>
            <span class="rec-roadmap-desc">填写职位信息，AI 自动生成 JD</span>
          </div>
          <span class="rec-roadmap-connector"></span>
        </div>
        <div class="rec-roadmap-step">
          <span class="rec-roadmap-icon">🤖</span>
          <div>
            <span class="rec-roadmap-title">AI 自动匹配</span>
            <span class="rec-roadmap-desc">AI 团队自动搜索人才、分析简历</span>
          </div>
          <span class="rec-roadmap-connector"></span>
        </div>
        <div class="rec-roadmap-step">
          <span class="rec-roadmap-icon">🎯</span>
          <div>
            <span class="rec-roadmap-title">推荐候选人</span>
            <span class="rec-roadmap-desc">AI 推荐最佳人选，你只需做决策</span>
          </div>
        </div>
      </div>
      <button class="rec-btn-primary rec-btn--lg" @click="goToCreateJob">
        📝 创建首个岗位 →
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════
         核心内容
         ═══════════════════════════════════════════════ -->
    <template v-else>
      <!-- ─── AI 招聘团队 ─── -->
      <div class="rec-section">
        <div class="rec-section-header">
          <h2 class="rec-section-title">
            🤖 AI 招聘团队
            <span class="rec-section-badge">{{ recruitmentState.value.agents.length }} 人</span>
          </h2>
        </div>
        <div class="rec-agent-grid">
          <div
            v-for="agent in recruitmentState.value.agents"
            :key="agent.id"
            class="rec-agent-card"
            :class="{ 'rec-agent-card--active': agent.status === 'active' }"
          >
            <div class="rec-agent-top">
              <div class="rec-agent-avatar">
                <span class="rec-agent-emoji">{{ getAgentEmoji(agent.type) }}</span>
                <span
                  class="rec-agent-dot"
                  :class="agent.status === 'active' ? 'rec-agent-dot--on' : 'rec-agent-dot--off'"
                ></span>
              </div>
              <div class="rec-agent-body">
                <div class="rec-agent-name">{{ agent.shortName || agent.name }}</div>
                <div class="rec-agent-tag">{{ getAgentDescription(agent.type) || getAgentLabel(agent.type) }}</div>
              </div>
            </div>
            <div class="rec-agent-caps">
              <span
                v-for="cap in (agent.capabilities || []).slice(0, 3)"
                :key="cap"
                class="rec-agent-cap"
              >{{ cap }}</span>
              <span v-if="(agent.capabilities || []).length > 3" class="rec-agent-cap rec-agent-cap--more">
                +{{ agent.capabilities.length - 3 }}
              </span>
            </div>
            <div class="rec-agent-footer">
              <span class="rec-agent-state">
                <span
                  class="rec-agent-pulse"
                  :class="agent.status === 'active' ? 'rec-pulse--on' : 'rec-pulse--off'"
                ></span>
                {{ agent.status === 'active' ? '工作中' : '待命中' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── 招聘驾驶舱 ─── -->
      <div class="rec-section rec-cockpit">
        <div class="rec-section-header">
          <h2 class="rec-section-title">📊 招聘驾驶舱</h2>
        </div>
        <div class="rec-cockpit-flow">
          <div
            v-for="(node, idx) in pipelineFlow"
            :key="node.label"
            class="rec-flow-node"
            :class="{ 'rec-flow-node--active': node.count > 0 }"
          >
            <span class="rec-flow-icon">{{ node.icon }}</span>
            <span class="rec-flow-count">{{ node.count }}</span>
            <span class="rec-flow-label">{{ node.label }}</span>
            <div v-if="idx < pipelineFlow.length - 1" class="rec-flow-arrow" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
        <!-- AI 建议 -->
        <div v-if="aiSuggestion" class="rec-suggestion">
          <span class="rec-suggestion-icon">💡</span>
          <div class="rec-suggestion-body">
            <span class="rec-suggestion-text">{{ aiSuggestion.text }}</span>
          </div>
          <button class="rec-suggestion-btn" @click="executeSuggestion(aiSuggestion)">
            {{ aiSuggestion.action }}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="vertical-align:-1px">
              <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- ─── AI 招聘角色 ─── -->
      <div class="rec-section">
        <div class="rec-section-header">
          <h2 class="rec-section-title">📋 AI 招聘角色</h2>
          <button class="rec-section-link" @click="goToCreateJob">创建新岗位 <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="vertical-align:-1px"><path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <div class="rec-role-grid">
          <div
            v-for="agent in recruitmentState.value.agents"
            :key="'role-' + agent.id"
            class="rec-role-card"
            @click="goToCreateJob"
          >
            <div class="rec-role-icon">{{ getAgentEmoji(agent.type) }}</div>
            <div class="rec-role-body">
              <div class="rec-role-name">{{ agent.shortName || agent.name }}</div>
              <div class="rec-role-caps">{{ (agent.capabilities || []).join(' · ') || getAgentLabel(agent.type) }}</div>
            </div>
            <span
              class="rec-role-status"
              :class="agent.status === 'active' ? 'rec-role-status--on' : 'rec-role-status--off'"
            >
              {{ agent.status === 'active' ? '招聘中' : '已暂停' }}
            </span>
            <svg class="rec-role-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </template>

    <!-- 创建岗位 Modal -->
    <CreateJobModal
      :visible="showCreateJobModal"
      @close="showCreateJobModal = false"
      @created="onJobCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRecruitmentHome, AGENT_META } from '~/composables/enterprise/useRecruitmentHome'
import CreateJobModal from '~/components/enterprise/recruitment/CreateJobModal.vue'

// ─── Props ───
const props = defineProps<{
  orgName?: string
}>()

const orgName = computed(() => props.orgName || '企业')

// ─── Navigation ───
const showCreateJobModal = ref(false)

function goToCreateJob() {
  showCreateJobModal.value = true
}

function goToRecruitment() {
  window.location.href = '/workspace/enterprise/talent'
}

// ─── Recruitment Home State ───
const { state: recruitmentState, refresh } = useRecruitmentHome()

// ─── 活跃 Agent 计数 ───
const activeAgentCount = computed(() =>
  recruitmentState.value.agents.filter(a => a.status === 'active').length
)

// ─── Stats ───
const stats = computed(() => {
  const m = recruitmentState.value.dashboard?.todayMetrics
  return {
    totalJobs: m?.pendingJobs ?? 0,
    matchingTasks: m?.conversations ?? 0,
    totalCandidates: m?.pendingCandidates ?? 0,
    pendingReview: m?.pendingResumes ?? 0,
  }
})

// ─── Pipeline Flow ───
const pipelineFlow = computed(() => {
  const funnel = recruitmentState.value.dashboard?.funnel
  if (funnel && funnel.length > 0) {
    const iconMap: Record<string, string> = {
      '职位': '📋', '收到简历': '📄', '筛选': '🔍',
      '沟通': '💬', '面试': '🎤', 'Offer': '📨', '录用': '🎉',
    }
    return funnel.map(f => ({
      label: f.label,
      icon: iconMap[f.label] || '📋',
      count: f.value,
    }))
  }
  const m = recruitmentState.value.dashboard?.todayMetrics
  return [
    { label: '今日沟通', icon: '💬', count: m?.conversations ?? 0 },
    { label: '今日面试', icon: '🎤', count: m?.interviews ?? 0 },
    { label: '今日简历', icon: '📄', count: m?.newResumes ?? 0 },
    { label: 'Offer', icon: '📨', count: m?.offers ?? 0 },
    { label: '录用', icon: '🎉', count: m?.hires ?? 0 },
  ]
})

// ─── AI Suggestion ───
const aiSuggestion = computed<{ text: string; action: string; route: string } | null>(() => {
  const attention = recruitmentState.value.dashboard?.needsAttention
  if (attention && attention.length > 0) {
    const first = attention[0]
    if (first.count > 0) {
      return {
        text: `${first.label}：${first.count} 项待处理，AI 已准备就绪`,
        action: '查看',
        route: 'attention',
      }
    }
  }
  const jobs = stats.value.totalJobs
  if (jobs === 0) {
    return { text: '暂无在招岗位，建议创建新岗位开始招聘', action: '创建岗位', route: 'create-job' }
  }
  return null
})

function executeSuggestion(s: { text: string; action: string; route: string }) {
  if (s.route === 'create-job') goToCreateJob()
}

// ─── Agent Helpers ───
function getAgentEmoji(type: string): string {
  return AGENT_META[type]?.emoji || '🤖'
}

function getAgentLabel(type: string): string {
  return AGENT_META[type]?.shortName || 'AI 招聘员工'
}

function getAgentDescription(type: string): string {
  return AGENT_META[type]?.label || ''
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }
  catch { return dateStr }
}

// ─── Callbacks ───
function onJobCreated() {
  refresh()
  showCreateJobModal.value = false
}

onMounted(() => { refresh() })
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   Layout
   ═══════════════════════════════════════════════════════════════ */
.recruitment-module {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0;
}

/* ═══════════════════════════════════════════════════════════════
   Identity — 企业身份区
   ═══════════════════════════════════════════════════════════════ */
.rec-identity {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rec-identity-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.rec-identity-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rec-identity-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.rec-identity-name {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.rec-identity-status {
  font-size: 12px;
  color: #6b7280;
  margin: 3px 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.rec-status-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  display: inline-block;
}
.rec-status-dot--healthy { background: #22c55e; }
.rec-status-dot--warning { background: #f59e0b; }
.rec-status-dot--critical { background: #ef4444; }

.rec-identity-foot {
  display: flex;
  align-items: center;
}

/* ─── Summary KPI ─── */
.rec-summary {
  display: flex;
  gap: 12px;
}

.rec-summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 8px;
  border-radius: 10px;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  transition: background 0.15s;
}
.rec-summary-item:hover { background: #f3f4f6; }

.rec-summary-item--candidates { background: rgba(37,99,235,0.03); border-color: rgba(37,99,235,0.08); }
.rec-summary-item--pending { background: rgba(245,158,11,0.03); border-color: rgba(245,158,11,0.08); }
.rec-summary-item--ai { background: rgba(139,92,246,0.03); border-color: rgba(139,92,246,0.08); }

.rec-summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2563eb;
  letter-spacing: -0.02em;
}

.rec-summary-label {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  font-weight: 500;
}

/* ─── Buttons ─── */
.rec-btn-primary {
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.rec-btn-primary:hover {
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}
.rec-btn--lg { padding: 12px 32px; font-size: 15px; }

.rec-btn-secondary {
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}
.rec-btn-secondary:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #374151;
}

/* ═══════════════════════════════════════════════════════════════
   Loading State — 品牌脉冲
   ═══════════════════════════════════════════════════════════════ */
.rec-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.rec-loading-pulse {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.rec-loading-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #2563eb;
  animation: rec-pulse 1.4s ease-in-out infinite both;
}
.rec-loading-dot--1 { animation-delay: -0.32s; }
.rec-loading-dot--2 { animation-delay: -0.16s; }
.rec-loading-dot--3 { animation-delay: 0s; }

@keyframes rec-pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.rec-state-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  animation: rec-type 2s steps(12) infinite;
}

.rec-state-desc {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
  display: block;
}

/* ═══════════════════════════════════════════════════════════════
   Empty State — 情感化引导
   ═══════════════════════════════════════════════════════════════ */
.rec-state--empty {
  padding: 60px 24px;
}

.rec-empty-visual {
  margin-bottom: 20px;
  position: relative;
}

.rec-empty-orb {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, rgba(37,99,235,0.12), rgba(37,99,235,0.04));
  animation: rec-orb 3s ease-in-out infinite;
  margin: 0 auto;
}

@keyframes rec-orb {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.08); opacity: 1; }
}

.rec-empty-heading {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px;
}

.rec-empty-sub {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 28px;
  max-width: 400px;
}

/* ─── Roadmap ─── */
.rec-roadmap {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 28px;
  max-width: 420px;
  text-align: left;
}

.rec-roadmap-step {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 16px 0;
  position: relative;
  border-bottom: 1px dashed #e5e7eb;
}
.rec-roadmap-step:last-child { border-bottom: none; }

.rec-roadmap-icon {
  font-size: 1.4rem;
  width: 40px; height: 40px;
  border-radius: 10px;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rec-roadmap-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  display: block;
}

.rec-roadmap-desc {
  font-size: 12px;
  color: #9ca3af;
  display: block;
  margin-top: 2px;
}

/* ═══════════════════════════════════════════════════════════════
   Sections
   ═══════════════════════════════════════════════════════════════ */
.rec-section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.rec-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.rec-section-title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-section-badge {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  background: #f3f4f6;
  padding: 1px 8px;
  border-radius: 8px;
}

.rec-section-link {
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 500;
  color: #2563eb;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: background 0.12s;
}
.rec-section-link:hover { background: #eff6ff; }

/* ═══════════════════════════════════════════════════════════════
   Agent Grid — AI 招聘团队
   ═══════════════════════════════════════════════════════════════ */
.rec-agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.rec-agent-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.rec-agent-card:hover {
  border-color: rgba(37, 99, 235, 0.2);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.rec-agent-card--active {
  border-color: rgba(34,197,94,0.15);
  background: linear-gradient(135deg, rgba(34,197,94,0.02), transparent);
}

.rec-agent-top {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.rec-agent-avatar {
  position: relative;
  font-size: 1.6rem;
  line-height: 1;
  flex-shrink: 0;
}

.rec-agent-emoji { display: block; }

.rec-agent-dot {
  position: absolute;
  bottom: -2px; right: -4px;
  width: 9px; height: 9px;
  border-radius: 50%;
  border: 2px solid #fafafa;
}
.rec-agent-dot--on { background: #22c55e; }
.rec-agent-dot--off { background: #9ca3af; }

.rec-agent-body {
  flex: 1;
  min-width: 0;
}

.rec-agent-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rec-agent-tag {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.rec-agent-caps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.rec-agent-cap {
  font-size: 11px;
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  color: #6b7280;
  line-height: 1.4;
}

.rec-agent-cap--more {
  background: #eff6ff;
  color: #2563eb;
}

.rec-agent-footer {
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  gap: 6px;
}

.rec-agent-state {
  font-size: 11px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 4px;
}

.rec-agent-pulse {
  width: 6px; height: 6px;
  border-radius: 50%;
}

.rec-pulse--on {
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34,197,94,0.4);
  animation: rec-pulse-dot 1.5s ease-in-out infinite;
}
.rec-pulse--off { background: #d1d5db; }

@keyframes rec-pulse-dot {
  0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
  70% { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}

/* ═══════════════════════════════════════════════════════════════
   Cockpit — 招聘驾驶舱
   ═══════════════════════════════════════════════════════════════ */
.rec-cockpit-flow {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 0;
}

.rec-flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 14px;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  min-width: 64px;
  flex-shrink: 0;
  transition: border-color 0.12s;
}
.rec-flow-node--active {
  border-color: rgba(37,99,235,0.15);
  background: rgba(37,99,235,0.02);
}

.rec-flow-icon { font-size: 1rem; margin-bottom: 3px; }
.rec-flow-count { font-size: 1.1rem; font-weight: 700; color: #2563eb; }
.rec-flow-label { font-size: 10px; color: #9ca3af; margin-top: 2px; white-space: nowrap; }

.rec-flow-arrow {
  color: #d1d5db;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* ─── Suggestion ─── */
.rec-suggestion {
  margin-top: 14px;
  padding: 12px 16px;
  background: rgba(37, 99, 235, 0.04);
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.rec-suggestion-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.rec-suggestion-body {
  flex: 1;
  min-width: 0;
}

.rec-suggestion-text {
  font-size: 13px;
  color: #1a1a1a;
}

.rec-suggestion-btn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: all 0.12s;
}
.rec-suggestion-btn:hover {
  background: rgba(37, 99, 235, 0.06);
  border-color: rgba(37, 99, 235, 0.2);
}

/* ═══════════════════════════════════════════════════════════════
   Role Grid — AI 招聘角色
   ═══════════════════════════════════════════════════════════════ */
.rec-role-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rec-role-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.rec-role-card:hover {
  border-color: rgba(37, 99, 235, 0.15);
  background: #fff;
}

.rec-role-icon {
  font-size: 1.4rem;
  width: 36px; height: 36px;
  border-radius: 8px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rec-role-body {
  flex: 1;
  min-width: 0;
}

.rec-role-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
}

.rec-role-caps {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rec-role-status {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
  flex-shrink: 0;
}
.rec-role-status--on { background: rgba(34,197,94,0.1); color: #16a34a; }
.rec-role-status--off { background: rgba(107,114,128,0.08); color: #9ca3af; }

.rec-role-arrow {
  color: #d1d5db;
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════════════════════════
   Responsive — 移动端
   ═══════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .rec-identity-top {
    flex-direction: column;
    gap: 12px;
  }

  .rec-summary {
    flex-wrap: wrap;
    gap: 8px;
  }

  .rec-summary-item {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
    padding: 12px 6px;
  }

  .rec-summary-value { font-size: 1.2rem; }

  .rec-agent-grid {
    grid-template-columns: 1fr;
  }

  .rec-cockpit-flow {
    gap: 2px;
  }

  .rec-flow-node {
    padding: 8px 10px;
    min-width: 54px;
  }

  .rec-role-card {
    padding: 10px 12px;
  }

  .rec-state--empty {
    padding: 40px 16px;
  }

  .rec-roadmap-step {
    padding: 12px 0;
  }
}
</style>
