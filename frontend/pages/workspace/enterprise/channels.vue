<!-- UX-05: 招聘渠道中心（Phase 1）
     掌柜蓝图：添加渠道 = 授权 AI 招聘团队把企业岗位投放、同步、追踪到外部招聘生态
     Phase 1: 渠道模型 + 渠道配置页 + 渠道数据统计 + 手动导入候选人（诚实状态：接入准备中，不显示已连接）
     Phase 2: 真实 API（Boss/猎聘/智联）→ 岗位同步
     Phase 3: AI 招聘闭环（发布→曝光分析→主动搜寻→AI邀约→AI面试→录用预测） -->
<template>
  <div class="rec-page">
    <!-- ═══ 头部 ═══ -->
    <header class="rec-header">
      <div>
        <h1 class="rec-header-title">招聘渠道中心</h1>
        <p class="rec-header-desc">
          AI 招聘员工的外部人才入口层 — 渠道是招聘漏斗的入口，候选人经渠道进入昆仑镜，
          由 Alice 筛选 · Bob 面试 · Carol 评估
        </p>
      </div>
    </header>

    <!-- ═══ 阶段说明 ═══ -->
    <section class="rec-phase-strip">
      <span class="rec-phase-item rec-phase-active">① 渠道接入准备中（当前）</span>
      <span class="rec-phase-arrow">→</span>
      <span class="rec-phase-item">② 真实 API 岗位同步（Boss / 猎聘 / 智联）</span>
      <span class="rec-phase-arrow">→</span>
      <span class="rec-phase-item">③ AI 招聘闭环（发布 · 曝光分析 · 主动搜寻 · AI 邀约）</span>
    </section>

    <!-- ═══ 渠道卡片 ═══ -->
    <section class="rec-section">
      <h2 class="rec-sec-title">招聘渠道</h2>
      <div v-if="loading" class="rec-empty">加载中...</div>
      <div v-else-if="channels.length === 0" class="rec-empty">暂无可用渠道</div>
      <div v-else class="ch-grid">
        <div v-for="ch in channels" :key="ch.channelId" class="ch-card">
          <div class="ch-card-top">
            <span class="ch-card-icon">{{ ch.icon }}</span>
            <div class="ch-card-head">
              <span class="ch-card-name">{{ ch.name }}</span>
              <span class="ch-card-pos">{{ ch.positioning }}</span>
            </div>
          </div>
          <div class="ch-card-status">
            <span class="ch-status-badge ch-status-preparing">🟡 {{ ch.integrationStatusLabel }}</span>
            <span class="ch-status-note">Phase 2 接入真实 API 后自动变为已连接</span>
          </div>
          <div class="ch-stats">
            <div class="ch-stat">
              <span class="ch-stat-value">{{ ch.stats.jobCount }}</span>
              <span class="ch-stat-label">发布岗位</span>
            </div>
            <div class="ch-stat">
              <span class="ch-stat-value">{{ ch.stats.candidateCount }}</span>
              <span class="ch-stat-label">收到候选</span>
            </div>
            <div class="ch-stat">
              <span class="ch-stat-value">{{ ch.stats.aiScreened }}</span>
              <span class="ch-stat-label">AI 筛选</span>
            </div>
            <div class="ch-stat">
              <span class="ch-stat-value">{{ ch.stats.conversionRate }}%</span>
              <span class="ch-stat-label">转化率</span>
            </div>
          </div>
          <div class="ch-card-actions">
            <button class="rec-btn-primary rec-btn--sm" @click="openImport(ch)">
              导入候选人
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 渠道候选人列表 ═══ -->
    <section class="rec-section">
      <div class="ch-list-head">
        <h2 class="rec-sec-title">渠道候选人</h2>
        <div class="ch-filters">
          <select v-model="filterChannel" class="ch-select" @change="loadCandidates">
            <option value="">全部渠道</option>
            <option v-for="ch in channels" :key="ch.channelId" :value="ch.channelId">{{ ch.name }}</option>
          </select>
          <select v-model="filterStatus" class="ch-select" @change="loadCandidates">
            <option value="">全部状态</option>
            <option value="new">新候选人</option>
            <option value="screening">筛选中</option>
            <option value="interviewing">面试中</option>
            <option value="hired">已录用</option>
            <option value="rejected">已淘汰</option>
          </select>
        </div>
      </div>

      <div v-if="candidatesLoading" class="rec-empty">加载中...</div>
      <div v-else-if="candidates.length === 0" class="rec-empty">
        暂无渠道候选人 — 点击渠道卡片「导入候选人」，将外部渠道候选人带入昆仑镜
      </div>
      <div v-else class="ch-cand-list">
        <div v-for="c in candidates" :key="c.id" class="ch-cand-item">
          <div class="ch-cand-main">
            <div class="ch-cand-line1">
              <span class="ch-cand-name">{{ c.name }}</span>
              <span class="ch-cand-source">{{ c.channel?.name }}</span>
              <span class="ch-cand-status" :class="'ch-st-' + c.status">{{ c.statusLabel }}</span>
            </div>
            <div class="ch-cand-line2">
              <span v-if="c.skills?.length" class="ch-cand-skills">{{ c.skills.join(' · ') }}</span>
              <span v-if="c.experienceYears" class="ch-cand-meta">{{ c.experienceYears }} 年经验</span>
              <span v-if="c.expectedSalary" class="ch-cand-meta">期望 {{ c.expectedSalary }}</span>
              <span v-if="c.summary" class="ch-cand-meta">{{ c.summary }}</span>
            </div>
            <div v-if="c.aiAnalysis" class="ch-cand-ai">
              <span class="ch-cand-ai-label">🤖 AI 评价</span>
              {{ c.aiAnalysis }}
            </div>
            <div v-else class="ch-cand-ai ch-cand-ai-empty">
              <span class="ch-cand-ai-label">🤖 AI 评价</span>
              未生成（企业未配置模型或生成失败）— 配置 AI 模型后导入自动生成
            </div>
          </div>
          <div class="ch-cand-actions">
            <button
              v-if="c.status === 'new'"
              class="ch-act-btn"
              @click="updateStatus(c, 'screening')"
            >开始筛选</button>
            <button
              v-if="c.status === 'screening'"
              class="ch-act-btn"
              @click="updateStatus(c, 'interviewing')"
            >安排面试</button>
            <button
              v-if="c.status === 'interviewing'"
              class="ch-act-btn ch-act-hire"
              @click="updateStatus(c, 'hired')"
            >录用</button>
            <button
              v-if="c.status !== 'rejected' && c.status !== 'hired'"
              class="ch-act-btn ch-act-reject"
              @click="updateStatus(c, 'rejected')"
            >淘汰</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 导入候选人弹窗 ═══ -->
    <div v-if="showImport" class="modal-overlay" @click.self="showImport = false">
      <div class="modal-content">
        <h3 class="modal-title">导入候选人 — {{ importForm.channelName }}</h3>
        <p class="modal-desc">候选人数据归企业所有，进入昆仑镜后由 AI 招聘团队筛选、面试、评估</p>
        <div class="modal-form">
          <div class="form-group">
            <label>姓名 *</label>
            <input v-model="importForm.name" placeholder="候选人姓名" />
          </div>
          <div class="form-group">
            <label>技能（逗号分隔）</label>
            <input v-model="importForm.skillsText" placeholder="例如: Java, Spring, MySQL" />
          </div>
          <div class="form-group-row">
            <div class="form-group">
              <label>经验年限</label>
              <input v-model.number="importForm.experienceYears" type="number" min="0" placeholder="5" />
            </div>
            <div class="form-group">
              <label>期望薪资</label>
              <input v-model="importForm.expectedSalary" placeholder="例如: 30-40K" />
            </div>
          </div>
          <div class="form-group">
            <label>个人简介</label>
            <textarea v-model="importForm.summary" rows="2" placeholder="工作经历、项目亮点等"></textarea>
          </div>
          <div class="form-group">
            <label>联系电话</label>
            <input v-model="importForm.phone" placeholder="选填" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="rec-btn-ghost" @click="showImport = false">取消</button>
          <button class="rec-btn-primary" :disabled="importing" @click="submitImport">
            {{ importing ? '导入中...' : '确认导入' }}
          </button>
        </div>
        <p v-if="importError" class="modal-error">{{ importError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

interface ChannelItem {
  channelId: string
  name: string
  type: string
  icon: string
  positioning: string
  integrationStatus: string
  integrationStatusLabel: string
  stats: { jobCount: number; candidateCount: number; aiScreened: number; hired: number; conversionRate: number }
}

interface ChannelCandidate {
  id: string
  name: string
  channel?: { id: string; name: string; type: string }
  skills: string[]
  experienceYears: number
  expectedSalary: string | null
  summary: string | null
  status: string
  statusLabel: string
  aiAnalysis: string | null
  createdAt: string
}

const channels = ref<ChannelItem[]>([])
const loading = ref(true)
const candidates = ref<ChannelCandidate[]>([])
const candidatesLoading = ref(true)
const filterChannel = ref('')
const filterStatus = ref('')

const showImport = ref(false)
const importing = ref(false)
const importError = ref('')
const importForm = ref({
  channelId: '',
  channelName: '',
  name: '',
  skillsText: '',
  experienceYears: 0,
  expectedSalary: '',
  summary: '',
  phone: '',
})

async function api(path: string, options: RequestInit = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(path, { ...options, headers })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

async function loadOverview() {
  loading.value = true
  try {
    const data = await api('/api/enterprise/channel-center/overview')
    channels.value = data.channels || []
  } catch (e) {
    console.warn('[channel-center] overview failed:', e)
  } finally {
    loading.value = false
  }
}

async function loadCandidates() {
  candidatesLoading.value = true
  try {
    const params = new URLSearchParams()
    if (filterChannel.value) params.set('channelId', filterChannel.value)
    if (filterStatus.value) params.set('status', filterStatus.value)
    const data = await api(`/api/enterprise/channel-center/candidates?${params.toString()}`)
    candidates.value = data.candidates || []
  } catch (e) {
    console.warn('[channel-center] candidates failed:', e)
  } finally {
    candidatesLoading.value = false
  }
}

function openImport(ch: ChannelItem) {
  importForm.value = {
    channelId: ch.channelId,
    channelName: ch.name,
    name: '',
    skillsText: '',
    experienceYears: 0,
    expectedSalary: '',
    summary: '',
    phone: '',
  }
  importError.value = ''
  showImport.value = true
}

async function submitImport() {
  if (!importForm.value.name.trim()) {
    importError.value = '请填写候选人姓名'
    return
  }
  importing.value = true
  importError.value = ''
  try {
    const skills = importForm.value.skillsText
      .split(/[,，、]/)
      .map((s: string) => s.trim())
      .filter(Boolean)
    const data = await api('/api/enterprise/channel-center/import', {
      method: 'POST',
      body: JSON.stringify({
        channelId: importForm.value.channelId,
        name: importForm.value.name.trim(),
        skills,
        experienceYears: importForm.value.experienceYears || 0,
        expectedSalary: importForm.value.expectedSalary || null,
        summary: importForm.value.summary || null,
        phone: importForm.value.phone || null,
      }),
    })
    showImport.value = false
    await Promise.all([loadOverview(), loadCandidates()])
  } catch (e: any) {
    importError.value = e.message || '导入失败'
  } finally {
    importing.value = false
  }
}

async function updateStatus(c: ChannelCandidate, status: string) {
  try {
    await api(`/api/enterprise/channel-center/candidates/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    await Promise.all([loadOverview(), loadCandidates()])
  } catch (e) {
    console.warn('[channel-center] update failed:', e)
  }
}

onMounted(() => {
  loadOverview()
  loadCandidates()
})
</script>

<style scoped>
.rec-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 20px);
  padding: var(--space-xl, 24px);
}
.rec-header-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text-primary, #e8edf7);
  margin: 0 0 6px;
}
.rec-header-desc {
  color: var(--color-text-secondary, #93a0b8);
  font-size: 14px;
  margin: 0;
}
.rec-phase-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: var(--color-bg-secondary, #121a2c);
  border: 1px solid var(--color-border-primary, #232f4a);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 13px;
}
.rec-phase-item {
  color: var(--color-text-secondary, #93a0b8);
}
.rec-phase-active {
  color: #f5c451;
  font-weight: 600;
}
.rec-phase-arrow {
  color: #3a4a6b;
}
.rec-section {
  background: var(--color-bg-secondary, #121a2c);
  border: 1px solid var(--color-border-primary, #232f4a);
  border-radius: 16px;
  padding: 20px;
}
.rec-sec-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary, #e8edf7);
  margin: 0 0 16px;
}
.rec-empty {
  color: var(--color-text-secondary, #93a0b8);
  font-size: 14px;
  padding: 24px;
  text-align: center;
}
.ch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.ch-card {
  background: var(--color-bg-tertiary, #0d1424);
  border: 1px solid var(--color-border-primary, #232f4a);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: border-color 0.2s;
}
.ch-card:hover {
  border-color: #2e4066;
}
.ch-card-top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.ch-card-icon {
  font-size: 30px;
  line-height: 1;
}
.ch-card-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ch-card-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary, #e8edf7);
}
.ch-card-pos {
  font-size: 13px;
  color: var(--color-text-secondary, #93a0b8);
}
.ch-card-status {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ch-status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
}
.ch-status-preparing {
  background: rgba(245, 196, 81, 0.12);
  color: #f5c451;
  border: 1px solid rgba(245, 196, 81, 0.3);
}
.ch-status-note {
  font-size: 11px;
  color: var(--color-text-tertiary, #5d6b8a);
}
.ch-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.ch-stat {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  padding: 10px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ch-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary, #e8edf7);
}
.ch-stat-label {
  font-size: 11px;
  color: var(--color-text-tertiary, #5d6b8a);
}
.ch-card-actions {
  display: flex;
  justify-content: flex-end;
}
.rec-btn-primary {
  background: linear-gradient(135deg, #6d5df6, #8b5cf6);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.rec-btn-primary:hover {
  opacity: 0.88;
}
.rec-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rec-btn--sm {
  padding: 7px 14px;
  font-size: 13px;
}
.rec-btn-ghost {
  background: transparent;
  color: var(--color-text-secondary, #93a0b8);
  border: 1px solid var(--color-border-primary, #232f4a);
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 14px;
  cursor: pointer;
}
.ch-list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ch-filters {
  display: flex;
  gap: 10px;
}
.ch-select {
  background: var(--color-bg-tertiary, #0d1424);
  color: var(--color-text-primary, #e8edf7);
  border: 1px solid var(--color-border-primary, #232f4a);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
}
.ch-cand-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}
.ch-cand-item {
  background: var(--color-bg-tertiary, #0d1424);
  border: 1px solid var(--color-border-primary, #232f4a);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.ch-cand-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.ch-cand-line1 {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ch-cand-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary, #e8edf7);
}
.ch-cand-source {
  font-size: 12px;
  color: #6d5df6;
  background: rgba(109, 93, 246, 0.12);
  border-radius: 999px;
  padding: 2px 10px;
}
.ch-cand-status {
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 10px;
}
.ch-st-new { background: rgba(109, 93, 246, 0.15); color: #a99df8; }
.ch-st-screening { background: rgba(245, 196, 81, 0.15); color: #f5c451; }
.ch-st-interviewing { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
.ch-st-hired { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.ch-st-rejected { background: rgba(248, 113, 113, 0.15); color: #f87171; }
.ch-cand-line2 {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--color-text-secondary, #93a0b8);
}
.ch-cand-skills {
  color: var(--color-text-primary, #e8edf7);
}
.ch-cand-ai {
  font-size: 13px;
  color: var(--color-text-secondary, #93a0b8);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 10px 12px;
  line-height: 1.6;
}
.ch-cand-ai-empty {
  color: var(--color-text-tertiary, #5d6b8a);
  font-style: italic;
}
.ch-cand-ai-label {
  font-weight: 600;
  color: #38bdf8;
  margin-right: 6px;
}
.ch-cand-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-width: 90px;
}
.ch-act-btn {
  background: rgba(109, 93, 246, 0.12);
  color: #a99df8;
  border: 1px solid rgba(109, 93, 246, 0.3);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ch-act-btn:hover {
  background: rgba(109, 93, 246, 0.22);
}
.ch-act-hire {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.3);
}
.ch-act-reject {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.25);
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 18, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}
.modal-content {
  background: var(--color-bg-secondary, #121a2c);
  border: 1px solid var(--color-border-primary, #232f4a);
  border-radius: 16px;
  padding: 24px;
  width: 480px;
  max-width: 92vw;
  max-height: 86vh;
  overflow-y: auto;
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary, #e8edf7);
  margin: 0 0 6px;
}
.modal-desc {
  font-size: 13px;
  color: var(--color-text-secondary, #93a0b8);
  margin: 0 0 18px;
}
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.form-group-row {
  display: flex;
  gap: 12px;
}
.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #93a0b8);
}
.form-group input,
.form-group textarea {
  background: var(--color-bg-tertiary, #0d1424);
  color: var(--color-text-primary, #e8edf7);
  border: 1px solid var(--color-border-primary, #232f4a);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
}
.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #6d5df6;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
.modal-error {
  color: #f87171;
  font-size: 13px;
  margin: 12px 0 0;
}
</style>
