<template>
  <div class="channel-connect-center">
    <div class="config-header">
      <h2>渠道连接中心</h2>
      <span class="header-desc">连接您的客户触达渠道，让 AI 帮您管理客户关系</span>
    </div>

    <!-- Channel Grid -->
    <div class="channel-grid-connect">
      <div
        v-for="ch in channels"
        :key="ch.id"
        class="channel-connect-card"
        :class="{ connected: ch.connected }"
      >
        <div class="ch-card-header">
          <span class="ch-card-icon">{{ ch.icon }}</span>
          <div class="ch-card-info">
            <span class="ch-card-name">{{ ch.name }}</span>
            <span class="ch-card-desc">{{ ch.description }}</span>
          </div>
        </div>
        <div class="ch-card-status">
          <StatusBadge :type="ch.connected ? 'connected' : 'disconnected'" :label="ch.connected ? '已连接' : '未连接'" />
        </div>
        <div class="ch-card-action">
          <button v-if="!ch.connected" class="btn-connect" @click="handleConnect(ch.id)">连接</button>
          <button v-else class="btn-manage" @click="handleManage(ch.id)">管理</button>
        </div>
      </div>
    </div>

    <!-- Connection Form Modal -->
    <div v-if="showConnectModal" class="modal-overlay" @click.self="showConnectModal = false">
      <div class="modal-content">
        <h3>连接 {{ connectingChannel?.name }}</h3>
        <div class="connect-form">
          <div class="form-group">
            <label>渠道名称</label>
            <input v-model="connectForm.name" placeholder="例如: 企业微信主账号" />
          </div>
          <div class="form-group">
            <label>AppID / CorpID</label>
            <input v-model="connectForm.appId" placeholder="应用 ID 或企业 ID" />
          </div>
          <div class="form-group">
            <label>AppSecret / Token</label>
            <input v-model="connectForm.secret" type="password" placeholder="应用密钥" />
          </div>
          <div class="form-group">
            <label>备注</label>
            <input v-model="connectForm.note" placeholder="可选备注信息" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showConnectModal = false">取消</button>
          <button class="btn-save" @click="handleSaveConnect">连接渠道</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import StatusBadge from '~/components/enterprise-ui/feedback/StatusBadge.vue'

interface ChannelDef {
  id: string
  name: string
  icon: string
  description: string
  connected: boolean
}

const channels = ref<ChannelDef[]>([
  { id: 'wecom', name: '企业微信', icon: '💼', description: '内部员工沟通与客户联系', connected: true },
  { id: 'wechat', name: '微信公众号', icon: '💬', description: '面向客户的内容发布与服务', connected: false },
  { id: 'douyin', name: '抖音', icon: '🎵', description: '短视频内容营销与客户触达', connected: false },
  { id: 'xiaohongshu', name: '小红书', icon: '📕', description: '生活方式种草与品牌建设', connected: false },
  { id: 'website', name: '官网', icon: '🌐', description: '企业官网与落地页', connected: false },
  { id: 'api', name: 'API 接入', icon: '🔌', description: '通过 API 接入自有系统', connected: false },
])

const showConnectModal = ref(false)
const connectingChannel = ref<ChannelDef | null>(null)
const connectForm = ref({ name: '', appId: '', secret: '', note: '' })

function handleConnect(id: string) {
  const ch = channels.value.find(c => c.id === id)
  if (ch) {
    connectingChannel.value = ch
    connectForm.value = { name: '', appId: '', secret: '', note: '' }
    showConnectModal.value = true
  }
}

function handleManage(_id: string) {
  // Open manage modal or navigate to channel detail
}

function handleSaveConnect() {
  if (connectingChannel.value) {
    const idx = channels.value.findIndex(c => c.id === connectingChannel.value!.id)
    if (idx >= 0) channels.value[idx].connected = true
  }
  showConnectModal.value = false
}
</script>

<style scoped>
.channel-connect-center {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.config-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.config-header h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.header-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.channel-grid-connect {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
}

.channel-connect-card {
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  transition: border-color 0.2s;
}

.channel-connect-card.connected {
  border-color: var(--color-execution);
}

.ch-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.ch-card-icon {
  font-size: 28px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}

.ch-card-info {
  display: flex;
  flex-direction: column;
}

.ch-card-name { font-weight: 600; }
.ch-card-desc { font-size: var(--font-size-xs); color: var(--color-text-muted); }

.ch-card-status {
  display: flex;
  justify-content: flex-start;
}

.ch-card-action {
  display: flex;
  gap: var(--space-sm);
}

.btn-connect {
  padding: var(--space-xs) var(--space-md);
  background: var(--color-intelligence);
  color: #000;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  flex: 1;
}

.btn-connect:hover { opacity: 0.85; }

.btn-manage {
  padding: var(--space-xs) var(--space-md);
  background: transparent;
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-muted);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  flex: 1;
}

.btn-manage:hover { background: var(--color-bg-hover); }

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
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
  width: 90%;
  max-width: 500px;
}

.modal-content h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.connect-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-group label { font-size: var(--font-size-sm); font-weight: 500; }

.form-group input {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
}

.form-group input:focus { border-color: var(--color-intelligence); }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.btn-cancel {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-save {
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-intelligence);
  color: #000;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 768px) {
  .channel-grid-connect { grid-template-columns: 1fr; }
}
</style>
