<template>
  <div class="admin-recruitment">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">🏢 企业招聘管理</h1>
        <p class="page-subtitle">查看企业招聘数据、冻结/恢复企业</p>
      </div>
      <div class="header-right">
        <button @click="goBack" class="ceo-btn-secondary">← 返回企业列表</button>
        <button @click="refresh" class="ceo-btn-secondary" :disabled="loading">🔄 刷新</button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button @click="refresh" class="ceo-btn-primary">重试</button>
    </div>

    <!-- Main Content -->
    <div v-else-if="data" class="recruitment-content">
      <!-- Enterprise Info Card -->
      <div class="card info-card">
        <div class="card-header">
          <h2>企业信息</h2>
          <span :class="['status-badge', data.subscription?.status || 'none']">
            {{ statusLabels[data.subscription?.status] || '未订阅' }}
          </span>
        </div>
        <div class="info-grid">
          <div class="info-item"><span class="info-label">企业名称</span><span>{{ data.organization.name }}</span></div>
          <div class="info-item"><span class="info-label">套餐</span><span>{{ data.subscription?.planName || '-' }}</span></div>
          <div class="info-item"><span class="info-label">创建时间</span><span>{{ new Date(data.organization.createdAt).toLocaleDateString('zh-CN') }}</span></div>
          <div class="info-item"><span class="info-label">到期时间</span><span>{{ data.subscription?.expireAt ? new Date(data.subscription.expireAt).toLocaleDateString('zh-CN') : '-' }}</span></div>
        </div>
      </div>

      <!-- Recruitment Stats -->
      <div class="card stats-card">
        <div class="card-header">
          <h2>招聘数据</h2>
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{{ data.recruitment.resumeCount }}</span>
            <span class="stat-label">📄 简历</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ data.recruitment.candidateCount }}</span>
            <span class="stat-label">👤 候选人</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ data.recruitment.offerCount }}</span>
            <span class="stat-label">💼 Offer</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ data.recruitment.interviewCount }}</span>
            <span class="stat-label">🗓️ 面试</span>
          </div>
        </div>
        <div class="stage-breakdown">
          <div class="stage-item" v-for="(count, stage) in data.recruitment.stageCounts" :key="stage">
            <span class="stage-name">{{ stageLabels[stage] || stage }}</span>
            <span class="stage-count">{{ count }}</span>
          </div>
        </div>
      </div>

      <!-- Management Actions -->
      <div class="card actions-card">
        <div class="card-header">
          <h2>管理能力</h2>
        </div>
        <div class="actions-list">
          <button @click="confirmFreeze" class="ceo-btn-danger" :disabled="data.subscription?.status === 'suspended'">
            ❄️ 冻结企业
          </button>
          <button @click="confirmUnfreeze" class="ceo-btn-primary" :disabled="data.subscription?.status !== 'suspended'">
            🔓 恢复企业
          </button>
        </div>
        <p class="action-note">注意：不允许直接修改业务数据。冻结将暂停企业所有服务。</p>
      </div>

      <!-- Recent Activities -->
      <div class="card activities-card">
        <div class="card-header">
          <h2>最近招聘活动</h2>
        </div>
        <div v-if="data.recentActivities.length > 0" class="activities-list">
          <div v-for="activity in data.recentActivities" :key="activity.id" class="activity-item">
            <span class="activity-type">{{ activityLabels[activity.type] || activity.type }}</span>
            <span class="activity-candidate">{{ activity.candidateName || '-' }}</span>
            <span class="activity-stage" v-if="activity.fromStage">
              {{ stageLabels[activity.fromStage] || activity.fromStage }} → {{ stageLabels[activity.toStage] || activity.toStage }}
            </span>
            <span class="activity-time">{{ new Date(activity.createdAt).toLocaleString('zh-CN') }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">📋</span>
          <p>暂无招聘活动</p>
        </div>
      </div>

      <!-- Audit Logs -->
      <div class="card logs-card">
        <div class="card-header">
          <h2>操作日志</h2>
          <button @click="loadLogs" class="ceo-btn-small">刷新日志</button>
        </div>
        <div v-if="logs.length > 0" class="logs-list">
          <div v-for="log in logs" :key="log.id" class="log-item">
            <span class="log-action">{{ log.action }}</span>
            <span class="log-resource">{{ log.resource }}</span>
            <span class="log-time">{{ new Date(log.createdAt).toLocaleString('zh-CN') }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">📋</span>
          <p>暂无操作日志</p>
        </div>
      </div>
    </div>

    <!-- Freeze Confirm Modal -->
    <div v-if="showFreezeConfirm" class="modal-overlay" @click.self="showFreezeConfirm = false">
      <div class="modal-content">
        <h3>❄️ 确认冻结企业</h3>
        <p>确定要冻结 <strong>{{ data?.organization.name }}</strong> 吗？</p>
        <p class="warning">冻结后企业将无法使用所有服务。</p>
        <textarea v-model="freezeReason" placeholder="冻结原因（可选）" class="modal-textarea"></textarea>
        <div class="modal-actions">
          <button @click="showFreezeConfirm = false" class="ceo-btn-secondary">取消</button>
          <button @click="freezeEnterprise" class="ceo-btn-danger">确认冻结</button>
        </div>
      </div>
    </div>

    <!-- Unfreeze Confirm Modal -->
    <div v-if="showUnfreezeConfirm" class="modal-overlay" @click.self="showUnfreezeConfirm = false">
      <div class="modal-content">
        <h3>🔓 确认恢复企业</h3>
        <p>确定要恢复 <strong>{{ data?.organization.name }}</strong> 吗？</p>
        <p class="note">恢复后企业将重新获得所有服务访问权限。</p>
        <textarea v-model="unfreezeReason" placeholder="恢复原因（可选）" class="modal-textarea"></textarea>
        <div class="modal-actions">
          <button @click="showUnfreezeConfirm = false" class="ceo-btn-secondary">取消</button>
          <button @click="unfreezeEnterprise" class="ceo-btn-primary">确认恢复</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAdminToken } from '~/utils/token-cache'

const route = useRoute()

const loading = ref(true)
const error = ref('')
const data = ref<any>(null)
const logs = ref<any[]>([])
const showFreezeConfirm = ref(false)
const showUnfreezeConfirm = ref(false)
const freezeReason = ref('')
const unfreezeReason = ref('')

const statusLabels: Record<string, string> = {
  active: '生效中',
  expired: '已过期',
  cancelled: '已取消',
  suspended: '已冻结',
  trial: '试用中',
}

const stageLabels: Record<string, string> = {
  discovered: '待筛选',
  screening: '筛选中',
  interview: '面试中',
  offer: 'Offer',
  hired: '已入职',
  rejected: '已拒绝',
}

const activityLabels: Record<string, string> = {
  stage_change: '阶段变更',
  ai_score: 'AI评分',
  ai_interview: 'AI面试',
  ai_invite: 'AI邀约',
  ai_offer: 'AI Offer',
  note: '备注',
  created: '创建',
}

function getEnterpriseId(): string | null {
  const id = route.params.id as string || route.query.id as string || null
  return id && id.trim() !== '' ? id : null
}

async function loadRecruitmentData() {
  loading.value = true
  error.value = ''
  try {
    const enterpriseId = getEnterpriseId()
    if (!enterpriseId) {
      error.value = 'NO_ENTERPRISE_ID：缺少企业身份，请从企业列表选择一家企业后进入'
      loading.value = false
      return
    }
    const res = await fetch(`/api/admin/enterprises/${enterpriseId}/recruitment`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` }
    })
    const result = await res.json()
    if (result.success) {
      data.value = result.data
    } else {
      error.value = result.message || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

async function loadLogs() {
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) return
  try {
    const res = await fetch(`/api/admin/enterprises/${enterpriseId}/recruitment/logs?limit=20`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` }
    })
    const result = await res.json()
    if (result.success) {
      logs.value = result.data
    }
  } catch (e) {
    console.error('加载日志失败', e)
  }
}

function refresh() {
  loadRecruitmentData()
  loadLogs()
}

function goBack() {
  window.location.href = '/admin/aigc/enterprises'
}

function confirmFreeze() {
  showFreezeConfirm.value = true
  freezeReason.value = ''
}

function confirmUnfreeze() {
  showUnfreezeConfirm.value = true
  unfreezeReason.value = ''
}

async function freezeEnterprise() {
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) return
  try {
    const res = await fetch(`/api/admin/enterprises/${enterpriseId}/freeze`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify({ reason: freezeReason.value }),
    })
    const result = await res.json()
    if (result.success) {
      showFreezeConfirm.value = false
      await loadRecruitmentData()
      await loadLogs()
    } else {
      alert(result.message || '冻结失败')
    }
  } catch (e: any) {
    alert('冻结失败: ' + e.message)
  }
}

async function unfreezeEnterprise() {
  const enterpriseId = getEnterpriseId()
  if (!enterpriseId) return
  try {
    const res = await fetch(`/api/admin/enterprises/${enterpriseId}/unfreeze`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify({ reason: unfreezeReason.value }),
    })
    const result = await res.json()
    if (result.success) {
      showUnfreezeConfirm.value = false
      await loadRecruitmentData()
      await loadLogs()
    } else {
      alert(result.message || '恢复失败')
    }
  } catch (e: any) {
    alert('恢复失败: ' + e.message)
  }
}

onMounted(() => {
  loadRecruitmentData()
  loadLogs()
})
</script>

<style scoped>
.admin-recruitment {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: #dc2626;
}

.error-icon {
  font-size: 48px;
}

.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active { background: #dcfce7; color: #16a34a; }
.status-badge.expired { background: #fef3c7; color: #d97706; }
.status-badge.cancelled { background: #fee2e2; color: #dc2626; }
.status-badge.suspended { background: #fee2e2; color: #dc2626; }
.status-badge.trial { background: #dbeafe; color: #2563eb; }
.status-badge.none { background: #f3f4f6; color: #6b7280; }

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #6b7280;
}

.info-item span:last-child {
  font-size: 14px;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2563eb;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

.stage-breakdown {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stage-item {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 12px;
  background: #f3f4f6;
  border-radius: 16px;
  font-size: 12px;
}

.stage-name {
  color: #6b7280;
}

.stage-count {
  font-weight: 600;
  color: #111827;
}

.actions-list {
  display: flex;
  gap: 12px;
}

.action-note {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 12px;
  margin-bottom: 0;
}

.activities-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.activity-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 13px;
}

.activity-type {
  font-weight: 500;
  color: #2563eb;
  min-width: 80px;
}

.activity-candidate {
  font-weight: 500;
  min-width: 80px;
}

.activity-stage {
  color: #6b7280;
  flex: 1;
}

.activity-time {
  font-size: 12px;
  color: #9ca3af;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 12px;
}

.log-action {
  font-weight: 500;
  color: #2563eb;
  min-width: 200px;
}

.log-resource {
  color: #6b7280;
  min-width: 100px;
}

.log-time {
  color: #9ca3af;
  margin-left: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px;
  color: #9ca3af;
}

.empty-icon {
  font-size: 36px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px;
}

.modal-content p {
  margin: 0 0 8px;
  color: #374151;
}

.modal-content .warning {
  color: #dc2626;
  font-weight: 500;
}

.modal-content .note {
  color: #2563eb;
  font-weight: 500;
}

.modal-textarea {
  width: 100%;
  min-height: 60px;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  margin-top: 12px;
  resize: vertical;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: flex-end;
}

/* Buttons */
.ceo-btn-primary {
  padding: 8px 16px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
}

.ceo-btn-primary:hover {
  background: #1d4ed8;
}

.ceo-btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.ceo-btn-secondary {
  padding: 8px 16px;
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.ceo-btn-secondary:hover {
  background: #f9fafb;
}

.ceo-btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ceo-btn-danger {
  padding: 8px 16px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
}

.ceo-btn-danger:hover {
  background: #b91c1c;
}

.ceo-btn-danger:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.ceo-btn-small {
  padding: 4px 10px;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
</style>
