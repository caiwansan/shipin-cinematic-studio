<!-- 人才搜索页 — Sprint 07 Week 1 -->
<!-- 位置：/workspace/enterprise/talent -->
<!-- 职责：人才库搜索入口，调用已有 API 搜索候选人 -->
<template>
  <div class="talent-page">
    <!-- Page Header -->
    <div class="talent-header">
      <div>
        <h1 class="talent-title">🔍 人才库搜索</h1>
        <p class="talent-subtitle">输入岗位需求，AI 猎聘顾问为您寻找最佳候选人</p>
      </div>
    </div>

    <!-- Search Form -->
    <div class="talent-search-form">
      <div class="search-row">
        <div class="search-field">
          <label>岗位</label>
          <select v-model="searchParams.jobId" class="search-select">
            <option value="">选择岗位（可选）</option>
            <option v-for="job in jobs" :key="job.id" :value="job.id">
              {{ job.title }}
            </option>
          </select>
        </div>
        <div class="search-field">
          <label>技能</label>
          <input
            v-model="searchParams.skills"
            class="search-input"
            placeholder="如：Vue3, TypeScript, Node.js"
          />
        </div>
        <div class="search-field">
          <label>地区</label>
          <input
            v-model="searchParams.location"
            class="search-input"
            placeholder="如：北京、上海"
          />
        </div>
        <button
          class="search-btn"
          @click="handleSearch"
          :disabled="isSearching"
        >
          <span v-if="isSearching" class="btn-loading">
            <span class="spinner"></span>
            搜索中...
          </span>
          <span v-else>🔍 搜索候选人</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isSearching" class="talent-loading">
      <div class="loading-spinner"></div>
      <span>AI 正在搜索候选人...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="searchError" class="talent-error">
      <span class="error-icon">⚠️</span>
      <span>{{ searchError }}</span>
      <button @click="handleSearch" class="retry-btn">重试</button>
    </div>

    <!-- Search Results -->
    <div v-else-if="searchResults.length > 0" class="talent-results">
      <div class="results-header">
        <span class="results-count">找到 {{ searchResults.length }} 位候选人</span>
      </div>
      <div class="results-grid">
        <div
          v-for="candidate in searchResults"
          :key="candidate.id"
          class="candidate-card"
        >
          <div class="candidate-header">
            <span class="candidate-name">👤 {{ candidate.name || '候选人' }}</span>
            <span class="candidate-match" :class="getMatchClass(candidate.matchScore)">
              {{ candidate.matchScore || '—' }}% 匹配
            </span>
          </div>
          <div class="candidate-body">
            <div class="candidate-meta">
              <span v-if="candidate.city">📍 {{ candidate.city }}</span>
              <span v-if="candidate.experience">💼 {{ candidate.experience }}</span>
              <span v-if="candidate.education">🎓 {{ candidate.education }}</span>
            </div>
            <div v-if="candidate.skills?.length" class="candidate-skills">
              <span v-for="skill in candidate.skills.slice(0, 5)" :key="skill" class="skill-tag">
                {{ skill }}
              </span>
            </div>
          </div>
          <div class="candidate-footer">
            <button class="action-btn primary" @click="handleAnalyze(candidate.id)">
              🤖 AI 分析
            </button>
            <button class="action-btn secondary" @click="handleExplain(candidate.id)">
              💡 解释匹配
            </button>
          </div>

          <!-- Talent Agent Result -->
          <div v-if="talentResults[candidate.id]" class="talent-result">
            <div class="talent-result-header">
              <span>🤖 AI 猎聘顾问</span>
              <button class="talent-close" @click="clearTalentResult(candidate.id)">×</button>
            </div>
            <div class="talent-result-content" v-html="formatTalentResult(talentResults[candidate.id])"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="hasSearched && searchResults.length === 0" class="talent-empty">
      <div class="empty-icon">🔍</div>
      <h3>未找到匹配的候选人</h3>
      <p>请尝试调整搜索条件或创建岗位后重新搜索</p>
    </div>

    <!-- Initial State -->
    <div v-else class="talent-initial">
      <div class="initial-icon">🎯</div>
      <h3>开始搜索候选人</h3>
      <p>输入岗位、技能或地区，AI 猎聘顾问将为您推荐最佳候选人</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'

// ─── State ───
const isSearching = ref(false)
const searchError = ref('')
const hasSearched = ref(false)
const searchParams = ref({
  jobId: '',
  skills: '',
  location: '',
})
const jobs = ref<any[]>([])
const searchResults = ref<any[]>([])
const talentResults = ref<Record<string, any>>({})
const analyzingId = ref<string | null>(null)

// ─── Load Jobs ───
async function loadJobs() {
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/postings', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const data = await res.json()
      jobs.value = data.data || []
    }
  } catch (e) {
    console.error('Failed to load jobs:', e)
  }
}

// ─── Search ───
async function handleSearch() {
  isSearching.value = true
  searchError.value = ''
  searchResults.value = []

  try {
    const token = getAuthToken() || ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    // 调用人才搜索 API
    const res = await fetch('/api/enterprise/agents/talent/search', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobId: searchParams.value.jobId || undefined,
        limit: 10,
      }),
    })

    if (!res.ok) {
      // 如果搜索 API 不可用，尝试从匹配结果获取
      return await fetchFromMatches()
    }

    const json = await res.json()
    if (json.success && json.result) {
      searchResults.value = Array.isArray(json.result) ? json.result : [json.result]
    }
    hasSearched.value = true
  } catch (e: any) {
    searchError.value = e.message || '搜索失败'
    hasSearched.value = true
  } finally {
    isSearching.value = false
  }
}

async function fetchFromMatches() {
  try {
    const token = getAuthToken() || ''
    const workspaceId = localStorage.getItem('workspace_id') || localStorage.getItem('enterprise_id') || ''
    const res = await fetch(`/api/enterprise/matches?workspaceId=${encodeURIComponent(workspaceId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json()
    searchResults.value = (data.matches || []).map((m: any) => ({
      id: m.candidateId,
      name: m.candidateName,
      matchScore: m.matchScore,
      city: m.candidate?.city,
      education: m.candidate?.education,
      experience: m.candidate?.experience,
      skills: m.candidate?.skills || [],
    }))
  } catch {
    // 静默失败
  }
}

// ─── Talent Agent Handlers ───
async function handleAnalyze(candidateId: string) {
  analyzingId.value = candidateId
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/agents/talent/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ candidateId }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.result) {
        talentResults.value[candidateId] = json.result
      }
    }
  } catch (e: any) {
    talentResults.value[candidateId] = {
      content: `❌ 分析失败: ${e.message}`,
    }
  } finally {
    analyzingId.value = null
  }
}

async function handleExplain(candidateId: string) {
  analyzingId.value = candidateId
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/agents/talent/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ matchId: candidateId }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.result) {
        talentResults.value[candidateId] = json.result
      }
    }
  } catch (e: any) {
    talentResults.value[candidateId] = {
      content: `❌ 解释失败: ${e.message}`,
    }
  } finally {
    analyzingId.value = null
  }
}

function clearTalentResult(candidateId: string) {
  delete talentResults.value[candidateId]
}

function formatTalentResult(result: any): string {
  if (!result?.content) return ''
  return result.content
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>')
}

function getMatchClass(score: number): string {
  if (!score) return ''
  if (score >= 80) return 'match-high'
  if (score >= 60) return 'match-medium'
  return 'match-low'
}

// ─── Init ───
onMounted(() => {
  loadJobs()
})
</script>

<style scoped>
.talent-page {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.talent-header {
  margin-bottom: 24px;
}

.talent-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.talent-subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 4px 0 0;
}

/* Search Form */
.talent-search-form {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.search-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.search-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 150px;
}

.search-field label {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
}

.search-input,
.search-select {
  padding: 10px 14px;
  font-size: 0.88rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus,
.search-select:focus {
  border-color: rgba(96, 165, 250, 0.4);
}

.search-btn {
  padding: 10px 24px;
  font-size: 0.9rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s;
  white-space: nowrap;
}

.search-btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading */
.talent-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 24px;
  color: rgba(255, 255, 255, 0.5);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error */
.talent-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  color: #f59e0b;
}

.retry-btn {
  margin-left: auto;
  padding: 4px 12px;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  color: #f59e0b;
  cursor: pointer;
}

/* Results */
.results-header {
  margin-bottom: 16px;
}

.results-count {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.candidate-card {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  padding: 16px;
  transition: border-color 0.15s;
}

.candidate-card:hover {
  border-color: rgba(96, 165, 250, 0.3);
}

.candidate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.candidate-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.candidate-match {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.match-high {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.match-medium {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.match-low {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.candidate-meta {
  display: flex;
  gap: 12px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
}

.candidate-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}

.skill-tag {
  padding: 2px 8px;
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border-radius: 4px;
  font-size: 0.72rem;
}

.candidate-footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.action-btn {
  padding: 6px 14px;
  font-size: 0.78rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.action-btn.primary {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.3);
}

.action-btn.primary:hover {
  background: rgba(96, 165, 250, 0.25);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  border-color: rgba(255, 255, 255, 0.1);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* Talent Result */
.talent-result {
  margin-top: 12px;
  padding: 12px;
  background: rgba(96, 165, 250, 0.05);
  border: 1px solid rgba(96, 165, 250, 0.15);
  border-radius: 8px;
}

.talent-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #60a5fa;
}

.talent-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 1.2rem;
  cursor: pointer;
}

.talent-result-content {
  font-size: 0.82rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
}

/* Empty / Initial States */
.talent-empty,
.talent-initial {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 24px;
  text-align: center;
}

.empty-icon,
.initial-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.talent-empty h3,
.talent-initial h3 {
  font-size: 1.1rem;
  color: #fff;
  margin: 0 0 8px;
}

.talent-empty p,
.talent-initial p {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

/* Button Loading */
.btn-loading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
</style>
