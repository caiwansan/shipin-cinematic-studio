<!--
  ⚠️ DEPRECATE — JOB-WORKSPACE-BOUNDARY-AUDIT 2026-07-26
  旧企业面试管理页面，已被 /workspace/recruitment 替代。
  保留原因：暂无替代页面，P4-FE-02 后删除。
  禁止：修改功能、添加新逻辑。
-->
<template>
  <div class="interview-workspace">
    <!-- PageHeader -->
    <div class="page-header">
      <div>
        <h1 class="page-title">面试决策</h1>
        <p class="page-subtitle">基于综合评估完成录用决策</p>
      </div>
      <div class="header-actions">
        <button class="btn-ghost" @click="loadData">🔄</button>
        <div class="date-toggle">
          <button
            v-for="opt in dateOptions"
            :key="opt.value"
            :class="['toggle-btn', { active: dateRange === opt.value }]"
            @click="dateRange = opt.value; loadData()"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && interviews.length === 0" class="empty-state">
      <div class="empty-icon">📅</div>
      <h3>今天没有面试安排</h3>
      <p>查看本周或待审核的面试记录</p>
      <div class="empty-actions">
        <button class="btn-secondary" @click="dateRange = 'week'; loadData()">查看本周</button>
        <button class="btn-secondary" @click="filterByPending">查看待审核</button>
      </div>
    </div>

    <!-- 第一屏：需要处理 -->
    <SectionCard v-if="pendingDecisions.length > 0" title="需要确认" :badge="String(pendingDecisions.length)">
      <div class="decision-list">
        <div
          v-for="item in pendingDecisions"
          :key="item.id"
          class="decision-card"
          @click="selectInterview(item)"
        >
          <div class="decision-main">
            <div class="candidate-info">
              <h3 class="candidate-name">{{ item.candidateName || '未知候选人' }}</h3>
              <span class="job-title">{{ item.jobTitle }}</span>
            </div>
            <div class="decision-metrics">
              <div class="metric-score">
                <span class="metric-label">综合评估</span>
                <span class="metric-value score-large">{{ item.overallScore ?? '—' }}</span>
              </div>
              <div class="metric-confidence" v-if="item.overallScore">
                <span class="metric-label">可信度</span>
                <span class="metric-value">{{ calcConfidence(item) }}%</span>
              </div>
            </div>
            <div class="decision-recommendation">
              <StatusBadge :status="item.recommendation || 'pending'" type="recommendation" />
            </div>
          </div>
          <div class="decision-action">
            <button class="btn-primary btn-sm">查看详情 →</button>
          </div>
        </div>
      </div>
    </SectionCard>

    <!-- 综合评估（选中候选人） -->
    <SectionCard v-if="selected" title="综合评估">
      <div class="evaluation-detail">
        <div class="eval-header">
          <div class="eval-candidate">
            <h2>{{ selected.candidateName || '未知候选人' }}</h2>
            <span class="eval-job">{{ selected.jobTitle }}</span>
          </div>
          <div class="eval-score-ring">
            <div class="score-circle">
              <span class="score-number">{{ selected.overallScore ?? '—' }}</span>
              <span class="score-label">综合评分</span>
            </div>
          </div>
        </div>

        <div class="eval-dimensions">
          <div class="dim-row">
            <span class="dim-label">技术能力</span>
            <div class="dim-bar">
              <div class="dim-fill" :style="{ width: ((selected.technicalScore || 0) * 10) + '%' }"></div>
            </div>
            <span class="dim-value">{{ selected.technicalScore ?? '—' }}</span>
          </div>
          <div class="dim-row">
            <span class="dim-label">沟通表达</span>
            <div class="dim-bar">
              <div class="dim-fill" :style="{ width: ((selected.communicationScore || 0) * 10) + '%' }"></div>
            </div>
            <span class="dim-value">{{ selected.communicationScore ?? '—' }}</span>
          </div>
          <div class="dim-row">
            <span class="dim-label">文化契合</span>
            <div class="dim-bar">
              <div class="dim-fill" :style="{ width: ((selected.cultureScore || 0) * 10) + '%' }"></div>
            </div>
            <span class="dim-value">{{ selected.cultureScore ?? '—' }}</span>
          </div>
        </div>

        <div class="eval-summary" v-if="selected.summary">
          <h4>综合评价</h4>
          <p>{{ selected.summary }}</p>
        </div>

        <div class="eval-strengths" v-if="selected.strengths && selected.strengths.length">
          <h4>优势</h4>
          <div class="tag-list">
            <span v-for="s in selected.strengths" :key="s" class="tag tag-success">{{ s }}</span>
          </div>
        </div>

        <div class="eval-concerns" v-if="selected.risks && selected.risks.length">
          <h4>关注点</h4>
          <div class="tag-list">
            <span v-for="r in selected.risks" :key="r" class="tag tag-warning">{{ r }}</span>
          </div>
        </div>

        <div class="eval-actions">
          <button class="btn-success" @click="makeDecision('pass')">✅ 通过</button>
          <button class="btn-danger" @click="makeDecision('reject')">❌ 拒绝</button>
          <button class="btn-secondary" @click="makeDecision('second_round')">🔄 二面</button>
        </div>
      </div>
    </SectionCard>

    <!-- 今日时间线 -->
    <SectionCard v-if="todayInterviews.length > 0" title="今日时间线">
      <div class="timeline">
        <div
          v-for="item in todayInterviews"
          :key="item.id"
          class="timeline-item"
          :class="'status-' + item.status"
          @click="selectInterview(item)"
        >
          <div class="timeline-marker">
            <span v-if="item.status === 'COMPLETED'" class="marker-icon done">✅</span>
            <span v-else-if="item.status === 'IN_PROGRESS'" class="marker-icon active">●</span>
            <span v-else class="marker-icon pending">○</span>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-name">{{ item.candidateName || '未知候选人' }}</span>
              <span class="timeline-time">{{ item.createdAt }}</span>
            </div>
            <div class="timeline-meta">
              <span>{{ item.jobTitle }}</span>
              <span v-if="item.overallScore" class="timeline-score">综合 {{ item.overallScore }} 分</span>
              <StatusBadge v-if="item.recommendation" :status="item.recommendation" type="recommendation" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </SectionCard>

    <!-- 招聘漏斗 -->
    <SectionCard title="招聘漏斗">
      <RecruitmentFunnel :data="funnelData" />
    </SectionCard>

    <!-- 历史记录 -->
    <SectionCard v-if="historyInterviews.length > 0" title="历史记录">
      <div class="history-list">
        <div
          v-for="item in historyInterviews"
          :key="item.id"
          class="history-item"
          @click="selectInterview(item)"
        >
          <span class="history-name">{{ item.candidateName || '未知候选人' }}</span>
          <span class="history-job">{{ item.jobTitle }}</span>
          <span class="history-score" v-if="item.overallScore">{{ item.overallScore }} 分</span>
          <StatusBadge v-if="item.recommendation" :status="item.recommendation" type="recommendation" size="sm" />
          <span class="history-date">{{ item.createdAt }}</span>
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import SectionCard from '~/components/recruitment/SectionCard.vue'
import StatusBadge from '~/components/recruitment/StatusBadge.vue'
import RecruitmentFunnel from '~/components/recruitment/RecruitmentFunnel.vue'

const loading = ref(true)
const interviews = ref([])
const selected = ref(null)
const dateRange = ref('today')
const funnelData = ref([])

const dateOptions = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]

// 需要处理的面试（有评估结果但尚未做决策）
const pendingDecisions = computed(() =>
  interviews.value.filter(i => i.overallScore && i.status === 'COMPLETED')
)

// 今日面试时间线
const todayInterviews = computed(() => interviews.value.slice(0, 10))

// 历史记录（非今日）
const historyInterviews = computed(() => interviews.value.slice(10))

function calcConfidence(item) {
  if (!item.overallScore) return 0
  // 可信度 = 综合评分的百分比映射（85分以上=高可信度）
  return Math.min(95, Math.max(60, item.overallScore))
}

function selectInterview(item) {
  selected.value = item
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function filterByPending() {
  // 筛选待审核的面试
  if (interviews.value.length > 0) {
    const pending = interviews.value.find(i => i.status === 'COMPLETED' && i.overallScore)
    if (pending) selected.value = pending
  }
}

async function makeDecision(decision) {
  if (!selected.value) return
  const labels = { pass: '通过', reject: '拒绝', second_round: '安排二面' }
  alert(`决策：${labels[decision]} - ${selected.value.candidateName}\n\n（实际项目中调用 POST /api/admin/recruitment/interviews/:id/decision）`)
}

async function loadData() {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token')
    const res = await fetch('/api/admin/recruitment/interviews?page=1&pageSize=50', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      interviews.value = data.list || data.data || []
      // 默认选中第一个待决策的
      if (!selected.value && pendingDecisions.value.length > 0) {
        selected.value = pendingDecisions.value[0]
      }
    }
    // 加载漏斗数据
    const funnelRes = await fetch('/api/enterprise/home', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (funnelRes.ok) {
      const homeData = await funnelRes.json()
      if (homeData.funnel) funnelData.value = homeData.funnel
    }
  } catch (e) {
    console.error('Failed to load interview data:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  // 60秒自动刷新
  setInterval(loadData, 60000)
})
</script>

<style scoped>
.interview-workspace {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
  font-family: 'Inter', -apple-system, sans-serif;
  color: #1A1A1A;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #6B7280;
  margin: 4px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-toggle {
  display: flex;
  background: #F3F4F6;
  border-radius: 6px;
  padding: 2px;
}

.toggle-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  color: #6B7280;
  transition: all 0.15s;
}

.toggle-btn.active {
  background: #fff;
  color: #1A1A1A;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 80px 24px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  margin: 0 0 8px;
}

.empty-state p {
  color: #6B7280;
  margin: 0 0 24px;
}

.empty-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* 需要处理 */
.decision-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.decision-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #FAFAFA;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  cursor: pointer;
  transition: all 0.15s;
}

.decision-card:hover {
  border-color: #2563EB;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
}

.decision-main {
  display: flex;
  align-items: center;
  gap: 32px;
  flex: 1;
}

.candidate-info h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.job-title {
  font-size: 13px;
  color: #6B7280;
}

.decision-metrics {
  display: flex;
  gap: 24px;
}

.metric-score, .metric-confidence {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-label {
  font-size: 11px;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
}

.score-large {
  font-size: 28px;
  font-weight: 700;
  color: #2563EB;
}

/* 综合评估 */
.evaluation-detail {
  padding: 8px 0;
}

.eval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #E5E7EB;
}

.eval-candidate h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.eval-job {
  font-size: 14px;
  color: #6B7280;
}

.score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.score-number {
  font-size: 24px;
  font-weight: 700;
}

.score-label {
  font-size: 10px;
  opacity: 0.8;
}

.eval-dimensions {
  margin-bottom: 24px;
}

.dim-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.dim-label {
  width: 80px;
  font-size: 13px;
  color: #6B7280;
  text-align: right;
}

.dim-bar {
  flex: 1;
  height: 8px;
  background: #F3F4F6;
  border-radius: 4px;
  overflow: hidden;
}

.dim-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563EB, #60A5FA);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.dim-value {
  width: 32px;
  font-size: 14px;
  font-weight: 600;
  text-align: right;
}

.eval-summary, .eval-strengths, .eval-concerns {
  margin-bottom: 20px;
}

.eval-summary h4, .eval-strengths h4, .eval-concerns h4 {
  font-size: 13px;
  font-weight: 600;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px;
}

.eval-summary p {
  font-size: 14px;
  line-height: 1.6;
  color: #1A1A1A;
  margin: 0;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.tag-success {
  background: #ECFDF5;
  color: #059669;
}

.tag-warning {
  background: #FFFBEB;
  color: #D97706;
}

.eval-actions {
  display: flex;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #E5E7EB;
}

/* 时间线 */
.timeline {
  position: relative;
}

.timeline-item {
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid #F3F4F6;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 6px;
  padding-left: 8px;
  padding-right: 8px;
}

.timeline-item:hover {
  background: #FAFAFA;
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  flex-shrink: 0;
}

.marker-icon {
  font-size: 14px;
}

.marker-icon.done { color: #10B981; }
.marker-icon.active { color: #2563EB; }
.marker-icon.pending { color: #D1D5DB; }

.timeline-content {
  flex: 1;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-name {
  font-size: 15px;
  font-weight: 600;
}

.timeline-time {
  font-size: 13px;
  color: #6B7280;
}

.timeline-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #6B7280;
}

.timeline-score {
  font-weight: 600;
  color: #1A1A1A;
}

/* 历史记录 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.history-item:hover {
  background: #FAFAFA;
}

.history-name {
  font-size: 14px;
  font-weight: 500;
  min-width: 100px;
}

.history-job {
  font-size: 13px;
  color: #6B7280;
  flex: 1;
}

.history-score {
  font-size: 14px;
  font-weight: 600;
}

.history-date {
  font-size: 12px;
  color: #9CA3AF;
}

/* 按钮 */
.btn-primary, .btn-secondary, .btn-success, .btn-danger, .btn-ghost {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: #2563EB;
  color: #fff;
}
.btn-primary:hover { background: #1D4ED8; }

.btn-secondary {
  background: #F3F4F6;
  color: #1A1A1A;
}
.btn-secondary:hover { background: #E5E7EB; }

.btn-success {
  background: #10B981;
  color: #fff;
}
.btn-success:hover { background: #059669; }

.btn-danger {
  background: #EF4444;
  color: #fff;
}
.btn-danger:hover { background: #DC2626; }

.btn-ghost {
  background: transparent;
  color: #6B7280;
  padding: 8px;
}
.btn-ghost:hover { background: #F3F4F6; }

/* 响应式 */
@media (max-width: 767px) {
  .interview-workspace { padding: 16px; }
  .page-header { flex-direction: column; gap: 16px; }
  .decision-main { flex-direction: column; gap: 12px; align-items: flex-start; }
  .eval-header { flex-direction: column; gap: 16px; }
  .eval-actions { flex-wrap: wrap; }
  .history-item { flex-wrap: wrap; }
}
</style>
