<!-- 企业简历管理页 -->
<!-- 位置：/workspace/recruitment/resumes -->
<!-- 职责：简历列表 + 上传 + 解析结果展示（P5-RECRUITMENT-BETA-03） -->
<template>
  <div class="resumes-page">
    <!-- Header -->
    <div class="resumes-header">
      <div class="flex items-center gap-3">
        <button @click="navigateTo('/workspace/recruitment')" class="text-gray-400 hover:text-white text-sm cursor-pointer bg-transparent border-none">← 返回</button>
        <h1 class="text-lg font-semibold text-white/90">简历管理</h1>
      </div>
      <button
        @click="showUpload = true"
        class="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 cursor-pointer border-none transition"
      >
        📤 上传简历
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载中...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs mx-4">
      ⚠️ {{ error }} <button @click="fetchResumes" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <template v-else>
      <!-- Stats -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-val">{{ resumes.length }}</span>
          <span class="stat-label">简历总数</span>
        </div>
        <div class="stat-item">
          <span class="stat-val">{{ parsedCount }}</span>
          <span class="stat-label">已解析</span>
        </div>
        <div class="stat-item">
          <span class="stat-val">{{ pendingCount }}</span>
          <span class="stat-label">待解析</span>
        </div>
        <div class="stat-item">
          <span class="stat-val">{{ failedCount }}</span>
          <span class="stat-label">解析失败</span>
        </div>
      </div>

      <!-- Empty -->
      <div v-if="!resumes.length" class="empty-state">
        <div class="empty-icon">📄</div>
        <div class="empty-text">暂无简历</div>
        <div class="empty-hint">点击右上角「上传简历」开始添加</div>
      </div>

      <!-- Resume List -->
      <div v-else class="resume-list">
        <div
          v-for="resume in resumes"
          :key="resume.id"
          class="resume-card"
          @click="selectResume(resume)"
        >
          <!-- Status Indicator -->
          <div class="resume-status-dot" :class="statusClass(resume.status)"></div>

          <!-- Info -->
          <div class="resume-info">
            <div class="resume-name">
              {{ resume.profile?.name || resume.candidateName || '未知候选人' }}
              <span class="resume-file-name">{{ resume.fileName }}</span>
            </div>
            <div class="resume-meta">
              <span v-if="resume.profile?.city">{{ resume.profile.city }}</span>
              <span v-if="resume.profile?.education">{{ resume.profile.education }}</span>
              <span v-if="resume.profile?.experienceYears">{{ resume.profile.experienceYears }}年经验</span>
              <span v-if="resume.profile?.skills?.length">{{ resume.profile.skills.length }}项技能</span>
            </div>
            <div v-if="resume.profile?.skills?.length" class="resume-skills">
              <span v-for="skill in resume.profile.skills.slice(0, 5)" :key="skill" class="skill-tag">{{ skill }}</span>
              <span v-if="resume.profile.skills.length > 5" class="skill-more">+{{ resume.profile.skills.length - 5 }}</span>
            </div>
          </div>

          <!-- Right Side -->
          <div class="resume-right">
            <div class="resume-status-badge" :class="statusClass(resume.status)">
              {{ statusLabel(resume.status) }}
            </div>
            <div v-if="resume.profile?.qualityScore" class="resume-quality">
              <span class="quality-score" :class="qualityClass(resume.profile.qualityScore)">{{ resume.profile.qualityScore }}</span>
              <span class="quality-label">质量分</span>
            </div>
            <div class="resume-date">{{ formatDate(resume.createdAt) }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- Upload Modal -->
    <div v-if="showUpload" class="modal-overlay" @click.self="showUpload = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="text-sm font-semibold text-white/90">上传简历</h3>
          <button @click="showUpload = false" class="text-gray-500 hover:text-white cursor-pointer bg-transparent border-none text-lg">×</button>
        </div>
        <div class="modal-body">
          <!-- Drop Zone -->
          <div
            class="upload-zone"
            :class="{ 'upload-zone--active': dragOver }"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent="handleDrop"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".pdf,.txt,.docx"
              class="hidden"
              @change="handleFileSelect"
            />
            <div class="upload-icon">📤</div>
            <div class="upload-text">拖拽文件到此处，或点击选择</div>
            <div class="upload-hint">支持 PDF / TXT / DOCX，最大 10MB</div>
          </div>

          <!-- Selected File -->
          <div v-if="selectedFile" class="selected-file">
            <span class="file-name">📎 {{ selectedFile.name }}</span>
            <span class="file-size">{{ formatSize(selectedFile.size) }}</span>
          </div>

          <!-- Upload Progress -->
          <div v-if="uploading" class="upload-progress">
            <div class="animate-spin w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
            <span class="text-xs text-gray-400">上传中...</span>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showUpload = false" class="px-3 py-1.5 rounded-lg text-xs bg-transparent text-gray-400 border border-gray-700 hover:border-gray-500 cursor-pointer">取消</button>
          <button
            @click="uploadResume"
            :disabled="!selectedFile || uploading"
            class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 cursor-pointer border-none transition"
          >
            {{ uploading ? '上传中...' : '确认上传' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedResume" class="modal-overlay" @click.self="selectedResume = null">
      <div class="modal modal--large">
        <div class="modal-header">
          <h3 class="text-sm font-semibold text-white/90">
            {{ selectedResume.profile?.name || selectedResume.candidateName || '简历详情' }}
          </h3>
          <button @click="selectedResume = null" class="text-gray-500 hover:text-white cursor-pointer bg-transparent border-none text-lg">×</button>
        </div>
        <div class="modal-body overflow-y-auto max-h-[70vh]">
          <!-- Parse Actions -->
          <div v-if="selectedResume.status !== 'parsed' && selectedResume.status !== 'analyzed'" class="parse-actions">
            <button
              @click="parseResume(selectedResume)"
              :disabled="selectedResume._parsing"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-40 cursor-pointer border-none transition"
            >
              {{ selectedResume._parsing ? '解析中...' : '🔍 解析简历' }}
            </button>
          </div>

          <!-- Profile Sections -->
          <div v-if="selectedResume.profile" class="profile-sections">
            <!-- Basic Info -->
            <div class="profile-section">
              <div class="section-title">基本信息</div>
              <div class="info-grid">
                <div v-if="selectedResume.profile.email" class="info-item">
                  <span class="info-label">邮箱</span>
                  <span class="info-value">{{ selectedResume.profile.email }}</span>
                </div>
                <div v-if="selectedResume.profile.phone" class="info-item">
                  <span class="info-label">电话</span>
                  <span class="info-value">{{ selectedResume.profile.phone }}</span>
                </div>
                <div v-if="selectedResume.profile.city" class="info-item">
                  <span class="info-label">城市</span>
                  <span class="info-value">{{ selectedResume.profile.city }}</span>
                </div>
                <div v-if="selectedResume.profile.education" class="info-item">
                  <span class="info-label">学历</span>
                  <span class="info-value">{{ selectedResume.profile.education }}</span>
                </div>
                <div v-if="selectedResume.profile.major" class="info-item">
                  <span class="info-label">专业</span>
                  <span class="info-value">{{ selectedResume.profile.major }}</span>
                </div>
                <div v-if="selectedResume.profile.experienceYears" class="info-item">
                  <span class="info-label">经验</span>
                  <span class="info-value">{{ selectedResume.profile.experienceYears }}年</span>
                </div>
                <div v-if="selectedResume.profile.salaryMin || selectedResume.profile.salaryMax" class="info-item">
                  <span class="info-label">期望薪资</span>
                  <span class="info-value">{{ selectedResume.profile.salaryMin }}k - {{ selectedResume.profile.salaryMax }}k</span>
                </div>
              </div>
            </div>

            <!-- Skills -->
            <div v-if="selectedResume.profile.skills?.length" class="profile-section">
              <div class="section-title">技能标签</div>
              <div class="resume-skills">
                <span v-for="skill in selectedResume.profile.skills" :key="skill" class="skill-tag skill-tag--lg">{{ skill }}</span>
              </div>
            </div>

            <!-- Experience -->
            <div v-if="selectedResume.profile.experience" class="profile-section">
              <div class="section-title">工作经历</div>
              <div class="section-text">{{ selectedResume.profile.experience }}</div>
            </div>

            <!-- Projects -->
            <div v-if="selectedResume.profile.projects" class="profile-section">
              <div class="section-title">项目经验</div>
              <div class="section-text">{{ selectedResume.profile.projects }}</div>
            </div>

            <!-- Career Goal -->
            <div v-if="selectedResume.profile.careerGoal" class="profile-section">
              <div class="section-title">职业目标</div>
              <div class="section-text">{{ selectedResume.profile.careerGoal }}</div>
            </div>

            <!-- Quality Assessment -->
            <div v-if="selectedResume.profile.qualityScore" class="profile-section">
              <div class="section-title">质量评估 ({{ selectedResume.profile.qualityScore }}分)</div>
              <div v-if="selectedResume.profile.strengths?.length" class="quality-list">
                <div class="quality-list-title text-green-400">✅ 优势</div>
                <ul>
                  <li v-for="s in selectedResume.profile.strengths" :key="s">{{ s }}</li>
                </ul>
              </div>
              <div v-if="selectedResume.profile.weaknesses?.length" class="quality-list">
                <div class="quality-list-title text-yellow-400">⚠️ 不足</div>
                <ul>
                  <li v-for="w in selectedResume.profile.weaknesses" :key="w">{{ w }}</li>
                </ul>
              </div>
              <div v-if="selectedResume.profile.suggestions?.length" class="quality-list">
                <div class="quality-list-title text-blue-400">💡 建议</div>
                <ul>
                  <li v-for="sg in selectedResume.profile.suggestions" :key="sg">{{ sg }}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- No Profile -->
          <div v-else class="no-profile">
            <div class="no-profile-icon">📋</div>
            <div class="no-profile-text">该简历尚未解析</div>
            <button
              @click="parseResume(selectedResume)"
              :disabled="selectedResume._parsing"
              class="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-40 cursor-pointer border-none transition"
            >
              {{ selectedResume._parsing ? '解析中...' : '🔍 立即解析' }}
            </button>
          </div>

          <!-- Resume Meta -->
          <div class="resume-meta-info">
            <span>文件名: {{ selectedResume.fileName }}</span>
            <span>类型: {{ selectedResume.fileType }}</span>
            <span>大小: {{ formatSize(selectedResume.fileSize) }}</span>
            <span>上传时间: {{ formatDate(selectedResume.createdAt) }}</span>
            <span>状态: {{ statusLabel(selectedResume.status) }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button
            @click="deleteResume(selectedResume)"
            class="px-3 py-1.5 rounded-lg text-xs bg-red-900/20 text-red-400 border border-red-800/30 hover:bg-red-900/30 cursor-pointer mr-auto"
          >
            🗑️ 删除
          </button>
          <button @click="selectedResume = null" class="px-3 py-1.5 rounded-lg text-xs bg-transparent text-gray-400 border border-gray-700 hover:border-gray-500 cursor-pointer">关闭</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
// P5-RECRUITMENT-BETA-03: 企业简历管理页
// 数据来源：Resume + ResumeProfile
// API：GET/POST/DELETE /enterprise/resumes

const loading = ref(false)
const error = ref('')
const resumes = ref<any[]>([])
const showUpload = ref(false)
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const dragOver = ref(false)
const selectedResume = ref<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const toast = ref<{ message: string; type: string } | null>(null)

const token = computed(() => localStorage.getItem('token') || '')
const workspaceId = computed(() => localStorage.getItem('workspace_id') || localStorage.getItem('enterprise_id') || '')

const parsedCount = computed(() => resumes.value.filter(r => r.status === 'parsed' || r.status === 'analyzed').length)
const pendingCount = computed(() => resumes.value.filter(r => r.status === 'pending' || r.status === 'parsing').length)
const failedCount = computed(() => resumes.value.filter(r => r.status === 'parse_failed').length)

async function fetchResumes() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/enterprise/resumes?workspaceId=${encodeURIComponent(workspaceId.value)}`, {
      headers: { 'Authorization': `Bearer ${token.value}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    resumes.value = data.items || data || []
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) {
    selectedFile.value = target.files[0]
  }
}

function handleDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files?.[0]) {
    selectedFile.value = e.dataTransfer.files[0]
  }
}

async function uploadResume() {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    const res = await fetch(`/api/enterprise/resumes/upload?workspaceId=${encodeURIComponent(workspaceId.value)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.value}` },
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    const data = await res.json()
    showUpload.value = false
    selectedFile.value = null
    if (data.profileCreated) {
      showToast('上传成功，简历已自动解析', 'success')
    } else {
      showToast('上传成功，等待解析', 'success')
    }
    await fetchResumes()
  } catch (e: any) {
    showToast(e.message || '上传失败', 'error')
  } finally {
    uploading.value = false
  }
}

function selectResume(resume: any) {
  selectedResume.value = resume
}

async function parseResume(resume: any) {
  resume._parsing = true
  try {
    const res = await fetch(`/api/enterprise/resumes/${resume.id}/parse?workspaceId=${encodeURIComponent(workspaceId.value)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.value}` },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    showToast('解析完成', 'success')
    await fetchResumes()
    // 刷新选中的简历
    const updated = resumes.value.find(r => r.id === resume.id)
    if (updated) selectedResume.value = { ...updated }
  } catch (e: any) {
    showToast(e.message || '解析失败', 'error')
  } finally {
    resume._parsing = false
  }
}

async function deleteResume(resume: any) {
  if (!confirm(`确定删除简历「${resume.profile?.name || resume.candidateName}」？`)) return
  try {
    const res = await fetch(`/api/enterprise/resumes/${resume.id}?workspaceId=${encodeURIComponent(workspaceId.value)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token.value}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    showToast('已删除', 'success')
    selectedResume.value = null
    await fetchResumes()
  } catch (e: any) {
    showToast(e.message || '删除失败', 'error')
  }
}

function showToast(message: string, type: string) {
  toast.value = { message, type }
  setTimeout(() => { toast.value = null }, 3000)
}

function statusClass(status: string): string {
  if (status === 'parsed' || status === 'analyzed') return 'status--success'
  if (status === 'parsing') return 'status--processing'
  if (status === 'parse_failed') return 'status--failed'
  return 'status--pending'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    parsed: '已解析',
    analyzed: '已分析',
    parsing: '解析中',
    pending: '待解析',
    parse_failed: '解析失败',
  }
  return map[status] || status
}

function qualityClass(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

function formatDate(date: string): string {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return d.toLocaleDateString('zh-CN')
}

onMounted(fetchResumes)
</script>

<style scoped>
.resumes-page {
  min-height: 100vh;
  background: #080D1E;
  padding: 1.5rem;
}

.resumes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
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

/* Resume List */
.resume-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.resume-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.resume-card:hover {
  border-color: #2A3F6E;
  background: #111B36;
}

.resume-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status--success { background: #10b981; }
.status--processing { background: #3b82f6; animation: pulse 1.5s infinite; }
.status--pending { background: #6b7280; }
.status--failed { background: #ef4444; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.resume-info {
  flex: 1;
  min-width: 0;
}

.resume-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resume-file-name {
  font-size: 0.65rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.3);
  margin-left: 0.5rem;
}

.resume-meta {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.resume-meta span {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.resume-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.skill-tag {
  font-size: 0.55rem;
  color: rgba(99, 102, 241, 0.7);
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.15);
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
}

.skill-tag--lg {
  font-size: 0.65rem;
  padding: 0.15rem 0.5rem;
}

.skill-more {
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.3);
}

.resume-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  flex-shrink: 0;
}

.resume-status-badge {
  font-size: 0.55rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-weight: 500;
}

.resume-status-badge.status--success {
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
}

.resume-status-badge.status--processing {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}

.resume-status-badge.status--pending {
  background: rgba(107, 114, 128, 0.1);
  color: #9ca3af;
}

.resume-status-badge.status--failed {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.resume-quality {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.quality-score {
  font-size: 0.9rem;
  font-weight: 700;
}

.quality-label {
  font-size: 0.5rem;
  color: rgba(255, 255, 255, 0.3);
}

.resume-date {
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.25);
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
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal {
  background: #111B36;
  border: 1px solid #1A2240;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal--large {
  max-width: 640px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #1A2240;
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #1A2240;
}

/* Upload Zone */
.upload-zone {
  border: 2px dashed #2A3F6E;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}

.upload-zone:hover,
.upload-zone--active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.04);
}

.upload-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.upload-text {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.upload-hint {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 0.35rem;
}

.selected-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 8px;
}

.file-name {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}

.file-size {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
}

.upload-progress {
  display: flex;
  align-items: center;
  margin-top: 0.75rem;
}

/* Profile Sections */
.parse-actions {
  margin-bottom: 1rem;
}

.profile-sections {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-section {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.section-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.info-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.35);
}

.info-value {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
}

.section-text {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  white-space: pre-wrap;
}

.quality-list {
  margin-top: 0.5rem;
}

.quality-list-title {
  font-size: 0.7rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.quality-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.quality-list li {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  padding: 0.15rem 0;
  padding-left: 0.75rem;
  position: relative;
}

.quality-list li::before {
  content: '•';
  position: absolute;
  left: 0.25rem;
  color: rgba(255, 255, 255, 0.3);
}

.no-profile {
  text-align: center;
  padding: 2rem 0;
}

.no-profile-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.no-profile-text {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.resume-meta-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.resume-meta-info span {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.3);
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
