<!-- 企业招聘匹配结果页 -->
<!-- 位置：/workspace/recruitment/matches -->
<!-- 职责：岗位选择 + 推荐候选列表 + 加入Pipeline（P5-RECRUITMENT-BETA-02） -->
<template>
  <div class="matches-page">
    <!-- Header -->
    <div class="matches-header">
      <div class="flex items-center gap-3">
        <button @click="navigateTo('/workspace/enterprise')" class="text-gray-400 hover:text-white text-sm cursor-pointer bg-transparent border-none">← 返回</button>
        <h1 class="text-lg font-semibold text-white/90">匹配结果</h1>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载中...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs mx-4">
      ⚠️ {{ error }} <button @click="fetchData" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <template v-else>
      <!-- Job Selector -->
      <div class="job-selector">
        <div class="text-xs text-gray-500 mb-2">选择岗位</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="job in jobs"
            :key="job.id"
            @click="selectJob(job.id)"
            class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition"
            :class="selectedJobId === job.id
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
              : 'bg-[#0D1328] text-gray-400 border-[#1A2240] hover:border-[#2A3F6E]'"
          >
            {{ job.title }}
            <span class="ml-1 text-[10px] opacity-60">{{ job.status }}</span>
          </button>
        </div>
      </div>

      <!-- Match Results -->
      <div v-if="selectedJobId">
        <!-- Stats Bar -->
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-val">{{ jobMatches.length }}</span>
            <span class="stat-label">推荐候选</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ highScoreCount }}</span>
            <span class="stat-label">高分匹配(≥70)</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ avgScore }}</span>
            <span class="stat-label">平均分</span>
          </div>
        </div>

        <!-- Empty -->
        <div v-if="!jobMatches.length" class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-text">该岗位暂无匹配候选人</div>
          <div class="empty-hint">让 AI 猎聘顾问为您寻找匹配的人才</div>
          <button class="empty-btn" @click="startAiMatch">
            🤖 启动 AI 人才搜索
          </button>
        </div>

        <!-- Match Cards -->
        <div v-else class="match-cards">
          <div
            v-for="match in jobMatches"
            :key="match.id"
            class="match-card"
            :class="{ 'match-card--high': match.matchScore >= 70 }"
          >
            <!-- Score Badge -->
            <div class="match-score-section">
              <div class="match-score" :class="scoreClass(match.matchScore)">{{ match.matchScore }}</div>
              <div class="match-score-label">匹配分</div>
            </div>

            <!-- Candidate Info -->
            <div class="match-info">
              <div class="match-candidate-name">{{ match.candidate?.name || '候选人' }}</div>
              <div class="match-candidate-meta">
                <span v-if="match.candidate?.city">{{ match.candidate.city }}</span>
                <span v-if="match.candidate?.education">{{ match.candidate.education }}</span>
                <span v-if="match.candidate?.experience">{{ match.candidate.experience }}</span>
              </div>

              <!-- Breakdown -->
              <div v-if="match.matchBreakdown" class="match-breakdown">
                <div v-for="(val, key) in breakdownEntries(match.matchBreakdown)" :key="key" class="breakdown-item">
                  <span class="breakdown-key">{{ breakdownLabel(key) }}</span>
                  <div class="breakdown-bar-bg">
                    <div class="breakdown-bar" :style="{ width: val + '%' }" :class="breakdownBarClass(val)"></div>
                  </div>
                  <span class="breakdown-val" :class="scoreClass(val)">{{ val }}</span>
                </div>
              </div>

              <!-- AI Analysis -->
              <div v-if="match.aiAnalysis" class="match-ai-analysis">
                🤖 {{ match.aiAnalysis }}
              </div>
            </div>

            <!-- Actions -->
            <div class="match-actions">
              <button
                @click="addToPipeline(match)"
                :disabled="match._adding"
                class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-40 cursor-pointer border-none transition"
              >
                {{ match._adding ? '添加中...' : '+ 加入Pipeline' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No Job Selected -->
      <div v-else class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">请先选择一个岗位</div>
      </div>
    </template>

    <!-- Success Toast -->
    <div v-if="toast" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
// P5-RECRUITMENT-BETA-02: 企业招聘匹配结果页
// 数据来源：CandidateMatch + JobPosting + JobCandidate
// 加入Pipeline：POST /api/pipeline

const loading = ref(false)
const error = ref('')
const jobs = ref<any[]>([])
const matches = ref<any[]>([])
const selectedJobId = ref('')
const toast = ref<{ message: string; type: string } | null>(null)

const token = computed(() => getAuthToken() || '')
const workspaceId = computed(() => localStorage.getItem('workspace_id') || localStorage.getItem('enterprise_id') || '')

const jobMatches = computed(() => {
  if (!selectedJobId.value) return []
  return matches.value
    .filter(m => m.jobId === selectedJobId.value)
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
})

const highScoreCount = computed(() => jobMatches.value.filter(m => m.matchScore >= 70).length)
const avgScore = computed(() => {
  if (!jobMatches.value.length) return 0
  const sum = jobMatches.value.reduce((s, m) => s + (m.matchScore || 0), 0)
  return Math.round(sum / jobMatches.value.length)
})

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    // 并行获取岗位和匹配数据
    const [jobsRes, matchesRes] = await Promise.all([
      fetch('/api/enterprise/postings', {
        headers: { 'Authorization': `Bearer ${token.value}` },
      }),
      fetch(`/api/pipeline/kanban?workspaceId=${encodeURIComponent(workspaceId.value)}`, {
        headers: { 'Authorization': `Bearer ${token.value}` },
      }),
    ])

    if (!jobsRes.ok) throw new Error(`岗位加载失败 HTTP ${jobsRes.status}`)
    const jobsData = await jobsRes.json()
    jobs.value = Array.isArray(jobsData) ? jobsData : (jobsData.postings || jobsData.data || [])

    // 获取匹配数据——直接从后端获取 CandidateMatch
    await fetchMatches()
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function fetchMatches() {
  try {
    const res = await fetch(`/api/enterprise/matches?workspaceId=${encodeURIComponent(workspaceId.value)}`, {
      headers: { 'Authorization': `Bearer ${token.value}` },
    })
    if (!res.ok) {
      // 如果专用 API 不存在，尝试从 admin 路由获取
      return await fetchMatchesFromAdmin()
    }
    matches.value = await res.json()
  } catch {
    return await fetchMatchesFromAdmin()
  }
}

async function fetchMatchesFromAdmin() {
  // 备选：通过 admin-recruitment 的 candidates 接口获取匹配数据
  try {
    const res = await fetch('/api/admin/recruitment/candidates?limit=50', {
      headers: { 'Authorization': `Bearer ${token.value}` },
    })
    if (!res.ok) return
    const data = await res.json()
    // 将候选数据转为匹配格式
    const items = Array.isArray(data) ? data : (data.candidates || data.data || [])
    matches.value = items.map((c: any) => ({
      id: c.id,
      jobId: c.jobId || '',
      candidateId: c.id,
      matchScore: c.matchScore || c.score || 0,
      matchBreakdown: c.breakdown || null,
      aiAnalysis: c.aiAnalysis || c.reason || '',
      candidate: {
        name: c.name || c.candidateName || '候选人',
        city: c.city,
        education: c.education,
        experience: c.experience,
      },
    }))
  } catch {
    // 静默失败
  }
}

async function startAiMatch() {
  if (!selectedJobId.value || !workspaceId.value) return
  try {
    const res = await fetch('/api/enterprise/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
      },
      body: JSON.stringify({ workspaceId: workspaceId.value, jobId: selectedJobId.value }),
    })
    if (res.ok) {
      showToast('AI 匹配已启动，请稍后刷新', 'success')
      await fetchMatches()
    } else {
      showToast('启动失败，请重试', 'error')
    }
  } catch {
    showToast('网络错误', 'error')
  }
}

function selectJob(jobId: string) {
  selectedJobId.value = jobId
}

async function addToPipeline(match: any) {
  match._adding = true
  try {
    const res = await fetch('/api/pipeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
      },
      body: JSON.stringify({
        workspaceId: workspaceId.value,
        candidateName: match.candidate?.name || '候选人',
        jobId: match.jobId,
        source: 'match',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    showToast(`${match.candidate?.name} 已加入 Pipeline`, 'success')
  } catch (e: any) {
    showToast(e.message || '加入失败', 'error')
  } finally {
    match._adding = false
  }
}

function showToast(message: string, type: string) {
  toast.value = { message, type }
  setTimeout(() => { toast.value = null }, 3000)
}

function breakdownEntries(breakdown: any): [string, number][] {
  if (!breakdown) return []
  return Object.entries(breakdown)
    .filter(([_, v]) => typeof v === 'number')
    .sort(([_, a], [__, b]) => (b as number) - (a as number))
}

function breakdownLabel(key: string): string {
  const map: Record<string, string> = { skills: '技能', experience: '经验', education: '学历', city: '城市', salary: '薪资' }
  return map[key] || key
}

function breakdownBarClass(val: number): string {
  if (val >= 80) return 'bg-green-500'
  if (val >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function scoreClass(score: number): string {
  if (score >= 70) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

onMounted(fetchData)
</script>

<style scoped>
.matches-page {
  min-height: 100vh;
  background: #080D1E;
  padding: 1.5rem;
}

.matches-header {
  margin-bottom: 1.5rem;
}

/* Job Selector */
.job-selector {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 12px;
}

/* Stats */
.stats-bar {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 10px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-val {
  font-size: 1.1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.stat-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.15rem;
}

/* Match Cards */
.match-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.match-card {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  padding: 1rem;
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 12px;
  transition: all 0.15s;
}

.match-card:hover {
  border-color: #2A3F6E;
  background: #111B36;
}

.match-card--high {
  border-left: 3px solid #10b981;
}

.match-score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 56px;
}

.match-score {
  font-size: 1.3rem;
  font-weight: 700;
}

.match-score-label {
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.35);
  margin-top: 0.15rem;
}

.match-info {
  flex: 1;
  min-width: 0;
}

.match-candidate-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0.25rem;
}

.match-candidate-meta {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.match-candidate-meta span {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.match-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.65rem;
}

.breakdown-key {
  color: rgba(255, 255, 255, 0.4);
  min-width: 28px;
}

.breakdown-bar-bg {
  width: 48px;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.breakdown-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.breakdown-val {
  font-weight: 600;
  min-width: 20px;
  text-align: right;
}

.match-ai-analysis {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.45);
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
}

.match-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.35rem;
  min-width: 120px;
}

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.empty-text {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
}

.empty-hint {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.25);
  margin-top: 0.35rem;
  margin-bottom: 1rem;
}

.empty-btn {
  padding: 10px 20px;
  font-size: 0.85rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
}

.empty-btn:hover {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
  transform: translateY(-1px);
}

/* Toast */
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.75rem;
  z-index: 100;
  animation: toast-in 0.2s ease;
}

.toast.success {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.toast.error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
