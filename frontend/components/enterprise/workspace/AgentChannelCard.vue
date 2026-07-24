<template>
  <div class="agent-channel-card">
    <div class="channel-card-header">
      <h4 class="channel-card-title">工作渠道</h4>
      <button class="btn-add-channel" @click="showAddModal = true">
        + 添加渠道
      </button>
    </div>

    <!-- Channel List -->
    <div v-if="bindings.length > 0" class="channel-list">
      <div v-for="binding in bindings" :key="binding.id" class="channel-item">
        <div class="channel-item-left">
          <span class="channel-icon">{{ channelEmoji[binding.channelType] || '📱' }}</span>
          <div class="channel-info">
            <span class="channel-name">{{ binding.channelName }}</span>
            <span class="channel-type">{{ channelTypeLabel[binding.channelType] || binding.channelType }}</span>
          </div>
        </div>
        <div class="channel-item-right">
          <div class="channel-status" :class="`status-${binding.connectionStatus}`">
            {{ connectionStatusLabel[binding.connectionStatus] || '未知' }}
          </div>
          <div class="channel-permissions">
            <span v-for="(val, key) in binding.permissions" :key="key" :class="val ? 'perm-on' : 'perm-off'" class="perm-tag">
              {{ permLabels[key] || key }}
            </span>
          </div>
          <button class="btn-remove" @click="handleRemove(binding)" title="移除绑定">×</button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="channel-empty">
      <span class="empty-icon">📱</span>
      <p>还未绑定任何渠道</p>
      <p class="empty-sub">添加渠道后，AI 员工可以在该平台工作</p>
    </div>

    <!-- Add Channel Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <h3>添加工作渠道</h3>
        <div class="modal-body">
          <div class="form-group">
            <label>选择渠道</label>
            <select v-model="selectedChannelId">
              <option value="">请选择...</option>
              <option v-for="ch in availableChannels" :key="ch.id" :value="ch.id">
                {{ ch.channelName }} ({{ channelTypeLabel[ch.channelType] || ch.channelType }})
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>权限</label>
            <div class="perm-checkboxes">
              <label v-for="perm in permList" :key="perm.key" class="perm-checkbox">
                <input type="checkbox" v-model="newPermissions[perm.key]" />
                <span>{{ perm.label }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showAddModal = false">取消</button>
          <button class="btn-save" @click="handleAdd">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  bindings: { type: Array, default: () => [] },
  availableChannels: { type: Array, default: () => [] },
})

const emit = defineEmits(['add', 'remove'])

const showAddModal = ref(false)
const selectedChannelId = ref('')
const newPermissions = ref({ read: true, reply: true, createTask: false, execute: false })

const permList = [
  { key: 'read', label: '读取消息' },
  { key: 'reply', label: '回复消息' },
  { key: 'createTask', label: '创建任务' },
  { key: 'execute', label: '自动执行' },
]

const permLabels = {
  read: '读取',
  reply: '回复',
  createTask: '创建任务',
  execute: '执行',
  delete: '删除'
}

const channelEmoji = {
  wechat_work: '💼',
  wechat_official: '📢',
  douyin: '🎵',
  xiaohongshu: '📕',
  crm: '📊'
}

const channelTypeLabel = {
  wechat_work: '企业微信',
  wechat_official: '微信公众号',
  douyin: '抖音',
  xiaohongshu: '小红书',
  crm: 'CRM'
}

const connectionStatusLabel = {
  CONNECTED: '已连接',
  PENDING: '待连接',
  ERROR: '异常'
}

async function handleAdd() {
  if (!selectedChannelId.value) return
  emit('add', {
    channelAccountId: selectedChannelId.value,
    permissions: { ...newPermissions.value }
  })
  showAddModal.value = false
  selectedChannelId.value = ''
  newPermissions.value = { read: true, reply: true, createTask: false, execute: false }
}

async function handleRemove(binding) {
  emit('remove', binding.id)
}
</script>

<style scoped>
.agent-channel-card {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
}
.channel-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.channel-card-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin: 0;
}
.btn-add-channel {
  font-size: 11px;
  color: #60a5fa;
  background: transparent;
  border: 1px solid #60a5fa33;
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.btn-add-channel:hover {
  background: #60a5fa11;
}

/* Channel Items */
.channel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.channel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #0A0F1E;
  border-radius: 10px;
  border: 1px solid #1A2240;
}
.channel-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.channel-icon {
  font-size: 20px;
}
.channel-info {
  display: flex;
  flex-direction: column;
}
.channel-name {
  font-size: 13px;
  font-weight: 600;
  color: white;
}
.channel-type {
  font-size: 10px;
  color: #5A6A8A;
}
.channel-item-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.channel-status {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 12px;
}
.status-CONNECTED { background: #22c55e1a; color: #22c55e; }
.status-PENDING { background: #eab3081a; color: #eab308; }
.status-ERROR { background: #ef44441a; color: #ef4444; }
.channel-permissions {
  display: flex;
  gap: 4px;
}
.perm-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
}
.perm-on {
  background: #60a5fa1a;
  color: #60a5fa;
}
.perm-off {
  background: #1A2240;
  color: #3A4A6A;
}
.btn-remove {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #5A6A8A;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-remove:hover {
  background: #ef44441a;
  color: #ef4444;
}

/* Empty */
.channel-empty {
  text-align: center;
  padding: 24px 0;
}
.empty-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 6px;
}
.channel-empty p {
  font-size: 12px;
  color: #5A6A8A;
  margin: 0;
}
.empty-sub {
  font-size: 10px !important;
  margin-top: 4px !important;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}
.modal-content {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 24px;
  width: 360px;
  max-width: 90vw;
}
.modal-content h3 {
  font-size: 16px;
  font-weight: 700;
  color: white;
  margin: 0 0 16px;
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-group label {
  display: block;
  font-size: 12px;
  color: #8899B8;
  margin-bottom: 6px;
}
.form-group select {
  width: 100%;
  padding: 8px 12px;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
  color: white;
  font-size: 13px;
}
.perm-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.perm-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #B0B8D0;
  cursor: pointer;
}
.perm-checkbox input {
  accent-color: #60a5fa;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
.btn-cancel {
  padding: 7px 16px;
  background: transparent;
  border: 1px solid #1A2240;
  border-radius: 8px;
  color: #8899B8;
  font-size: 12px;
  cursor: pointer;
}
.btn-save {
  padding: 7px 16px;
  background: #60a5fa;
  border: none;
  border-radius: 8px;
  color: black;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
</style>
