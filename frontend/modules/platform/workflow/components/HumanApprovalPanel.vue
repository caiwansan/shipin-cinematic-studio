<template>
  <div class="human-approval-panel">
    <h3>人工审批</h3>

    <div v-if="pendingActions.length > 0" class="pending-list">
      <div v-for="action in pendingActions" :key="action.nodeId" class="action-card">
        <div class="action-header">
          <span class="action-type">{{ getHumanTypeLabel(action.type) }}</span>
          <span class="action-status pending">等待响应</span>
        </div>
        <div class="action-info">
          <p><strong>节点:</strong> {{ action.name }}</p>
          <p v-if="action.message"><strong>消息:</strong> {{ action.message }}</p>
          <p v-if="action.input"><strong>输入:</strong> {{ truncate(JSON.stringify(action.input), 100) }}</p>
        </div>
        <div class="action-controls">
          <button class="btn btn-approve" @click="$emit('approve', action.nodeId, action.type)">✓ 批准</button>
          <button class="btn btn-reject" @click="$emit('reject', action.nodeId, action.type)">✗ 拒绝</button>
          <button v-if="action.type === 'humanUpload'" class="btn btn-upload" @click="$emit('upload', action.nodeId, action.type)">
            📤 上传
          </button>
        </div>
      </div>
    </div>

    <div v-else class="no-pending">
      <p>没有待处理的审批</p>
    </div>

    <!-- Approve Modal -->
    <div v-if="showApproveModal" class="modal-overlay" @click.self="showApproveModal = false">
      <div class="modal">
        <h4>批准确认</h4>
        <textarea v-model="approveComment" placeholder="审批意见（可选）" rows="3"></textarea>
        <div class="modal-actions">
          <button class="btn btn-approve" @click="confirmApprove">确认批准</button>
          <button class="btn btn-secondary" @click="showApproveModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div v-if="showRejectModal" class="modal-overlay" @click.self="showRejectModal = false">
      <div class="modal">
        <h4>拒绝原因</h4>
        <textarea v-model="rejectReason" placeholder="请填写拒绝原因" rows="3"></textarea>
        <div class="modal-actions">
          <button class="btn btn-reject" @click="confirmReject">确认拒绝</button>
          <button class="btn btn-secondary" @click="showRejectModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { WorkflowEvent } from '../types/index.js'

const props = defineProps<{
  pendingActions: Array<{
    nodeId: string
    type: string
    name: string
    message?: string
    input?: any
  }>
}>()

const emit = defineEmits<{
  approve: [nodeId: string, type: string, comment?: string]
  reject: [nodeId: string, type: string, reason?: string]
  upload: [nodeId: string, type: string]
}>()

const showApproveModal = ref(false)
const showRejectModal = ref(false)
const approveComment = ref('')
const rejectReason = ref('')
const currentAction = ref<{ nodeId: string; type: string } | null>(null)

function getHumanTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    humanApproval: '审批', humanEdit: '编辑', humanReview: '审核',
    humanUpload: '上传', humanDecision: '决策',
  }
  return labels[type] || type
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str
}

function confirmApprove() {
  if (currentAction.value) {
    emit('approve', currentAction.value.nodeId, currentAction.value.type, approveComment.value)
  }
  showApproveModal.value = false
  approveComment.value = ''
}

function confirmReject() {
  if (currentAction.value) {
    emit('reject', currentAction.value.nodeId, currentAction.value.type, rejectReason.value)
  }
  showRejectModal.value = false
  rejectReason.value = ''
}
</script>

<style scoped>
.human-approval-panel {
  padding: 12px;
}

.human-approval-panel h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #e0e0e0;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-card {
  background: #16213e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
}

.action-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.action-type {
  font-weight: bold;
  font-size: 14px;
}

.action-status.pending {
  color: #FF9800;
  font-size: 12px;
}

.action-info {
  font-size: 13px;
  margin-bottom: 12px;
}

.action-info p {
  margin: 4px 0;
}

.action-controls {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-approve { background: #4CAF50; color: white; }
.btn-reject { background: #F44336; color: white; }
.btn-upload { background: #2196F3; color: white; }
.btn-secondary { background: #333; color: #e0e0e0; border: 1px solid #555; }

.no-pending {
  text-align: center;
  color: #555;
  padding: 20px;
}

/* ─── Modal ─── */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 20px;
  min-width: 400px;
}

.modal h4 {
  margin: 0 0 12px;
}

.modal textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #16213e;
  color: #e0e0e0;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
  margin-bottom: 12px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
