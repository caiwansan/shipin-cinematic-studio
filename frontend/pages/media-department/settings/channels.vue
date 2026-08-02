<template>
  <div class="channels-page">
    <KunlunNav :is-logged-in="isLoggedIn" @show-login="showLogin = true" @show-register="showRegister = true" />

    <main class="main-content">
      <div class="page-header">
        <h1 class="page-title">渠道账号管理</h1>
        <p class="page-subtitle">管理企业新媒体渠道账号，控制 AI 员工的数据访问权限</p>
      </div>

      <!-- 渠道卡片网格 -->
      <div class="channels-grid">
        <div
          v-for="channel in channels"
          :key="channel.id"
          class="channel-card"
          :class="`status-${channel.status}`"
        >
          <div class="channel-header">
            <div class="channel-platform-icon">{{ platformIcon(channel.platform) }}</div>
            <div class="channel-info">
              <h3 class="channel-name">{{ channel.accountName }}</h3>
              <span class="channel-platform">{{ platformLabel(channel.platform) }}</span>
            </div>
            <div class="channel-status" :class="channel.status">
              {{ statusLabel(channel.status) }}
            </div>
          </div>

          <div class="channel-meta">
            <span v-if="channel.accountIdentifier" class="channel-id">
              ID: {{ channel.accountIdentifier }}
            </span>
            <span class="channel-bindings">
              已绑定 {{ channel.bindingCount }} 个 AI 员工
            </span>
          </div>

          <!-- 绑定列表 -->
          <div v-if="channel.bindings && channel.bindings.length > 0" class="binding-list">
            <div v-for="b in channel.bindings" :key="b.id" class="binding-item">
              <span class="binding-agent">{{ b.agentName }}</span>
              <span class="binding-perms">{{ b.permissions.join(', ') }}</span>
              <button class="btn-unbind" @click="unbind(b.id)">解绑</button>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="channel-actions">
            <button
              v-if="channel.status === 'pending'"
              class="btn btn-primary btn-sm"
              @click="connect(channel.id)"
            >
              连接
            </button>
            <button
              v-if="channel.status === 'active'"
              class="btn btn-outline btn-sm"
              @click="openBindingModal(channel)"
            >
              {{ channel.bindingCount > 0 ? '管理绑定' : '绑定 AI 员工' }}
            </button>
            <button
              v-if="channel.status === 'active'"
              class="btn btn-danger btn-sm"
              @click="disconnect(channel.id)"
            >
              断开
            </button>
          </div>
        </div>

        <!-- 添加渠道卡片 -->
        <div class="channel-card channel-add" @click="showAddModal = true">
          <div class="add-icon">+</div>
          <span class="add-text">添加渠道账号</span>
        </div>
      </div>
    </main>

    <!-- 添加渠道弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3 class="modal-title">添加渠道账号</h3>
        <div class="form-group">
          <label>平台</label>
          <select v-model="newChannel.platform">
            <option value="xiaohongshu">小红书</option>
            <option value="wechat">微信公众号</option>
            <option value="douyin">抖音</option>
            <option value="shipinhao">视频号</option>
            <option value="weibo">微博</option>
            <option value="kuaishou">快手</option>
          </select>
        </div>
        <div class="form-group">
          <label>账号名称</label>
          <input v-model="newChannel.accountName" placeholder="例如：官方号、小红书创作号" />
        </div>
        <div class="form-group">
          <label>账号标识（可选）</label>
          <input v-model="newChannel.accountIdentifier" placeholder="抖音号/微信号/小红书ID" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showAddModal = false">取消</button>
          <button class="btn btn-primary" @click="addChannel">添加</button>
        </div>
      </div>
    </div>

    <!-- 绑定 AI 员工弹窗 -->
    <div v-if="showBindingModal" class="modal-overlay" @click.self="showBindingModal = false">
      <div class="modal">
        <h3 class="modal-title">绑定 AI 员工到 {{ selectedChannel?.accountName }}</h3>
        <div class="agent-select-list">
          <div
            v-for="agent in availableAgents"
            :key="agent.id"
            class="agent-option"
            :class="{ 'agent-selected': isAgentSelected(agent.id) }"
            @click="toggleAgentSelection(agent)"
          >
            <span class="agent-icon">{{ agentIcon(agent.type) }}</span>
            <span class="agent-name">{{ agent.name }}</span>
            <span class="agent-type">{{ agent.type }}</span>
          </div>
        </div>
        <div v-if="selectedAgentIds.length > 0" class="form-group">
          <label>权限</label>
          <div class="perm-checkboxes">
            <label v-for="perm in ['READ', 'CREATE', 'PUBLISH', 'ANALYZE']" :key="perm">
              <input type="checkbox" :value="perm" v-model="selectedPermissions" />
              {{ perm }}
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showBindingModal = false">取消</button>
          <button class="btn btn-primary" @click="bindAgents" :disabled="selectedAgentIds.length === 0">
            绑定 ({{ selectedAgentIds.length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, onMounted, computed } from 'vue'
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'

const isLoggedIn = ref(true)
const showLogin = ref(false)
const showRegister = ref(false)
const showAddModal = ref(false)
const showBindingModal = ref(false)

const channels = ref<any[]>([])
const availableAgents = ref<any[]>([])
const selectedChannel = ref<any>(null)
const selectedAgentIds = ref<string[]>([])
const selectedPermissions = ref<string[]>(['READ'])

const newChannel = ref({
  platform: 'xiaohongshu',
  accountName: '',
  accountIdentifier: '',
})

function getToken(): string {
  try { return getAuthToken() || '' } catch { return '' }
}

function platformIcon(platform: string): string {
  const map: Record<string, string> = {
    'douyin': '🎵', 'xiaohongshu': '📕', 'wechat': '💬',
    'weibo': '🐦', 'kuaishou': '⚡', 'shipinhao': '🎬',
  }
  return map[platform] || '📱'
}

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    'douyin': '抖音', 'xiaohongshu': '小红书', 'wechat': '微信公众号',
    'weibo': '微博', 'kuaishou': '快手', 'shipinhao': '视频号',
  }
  return map[platform] || platform
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    'pending': '未连接', 'active': '已连接', 'disconnected': '已断开', 'banned': '已封禁',
  }
  return map[status] || status
}

function agentIcon(type: string): string {
  const map: Record<string, string> = {
    'hotspot_analyst': '📡', 'content_creator': '✍️', 'content_reviewer': '🔍',
    'seo_optimizer': '🔎', 'data_analyst': '📊',
  }
  return map[type] || '🤖'
}

async function fetchChannels() {
  try {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${getToken()}` }
    const res = await fetch(`https://aigc.fushtn.com/api/enterprise/channel-accounts`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) {
        channels.value = data.data.channels.map((c: any) => ({ ...c, bindings: [] }))
        // Fetch bindings for each channel
        for (const ch of channels.value) {
          const res = await fetch(`https://aigc.fushtn.com/api/enterprise/channel-accounts/${ch.id}/bindings`, { headers })
          if (res.ok) {
            const d = await res.json()
            ch.bindings = d.data.bindings
          }
        }
      }
    }
  } catch (e) { console.warn('Fetch channels failed:', e) }
}

async function fetchAgents() {
  try {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${getToken()}` }
    const res = await fetch(`https://aigc.fushtn.com/api/enterprise/channel-accounts/agents`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) availableAgents.value = data.data.agents
    }
  } catch (e) { console.warn('Fetch agents failed:', e) }
}

async function addChannel() {
  if (!newChannel.value.accountName) return
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    }
    await fetch('https://aigc.fushtn.com/api/enterprise/channel-accounts', {
      method: 'POST', headers,
      body: JSON.stringify(newChannel.value),
    })
    showAddModal.value = false
    newChannel.value = { platform: 'xiaohongshu', accountName: '', accountIdentifier: '' }
    await fetchChannels()
  } catch (e) { console.warn('Add channel failed:', e) }
}

async function connect(channelId: string) {
  try {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${getToken()}` }
    await fetch(`https://aigc.fushtn.com/api/enterprise/channel-accounts/${channelId}/connect`, { method: 'POST', headers })
    await fetchChannels()
  } catch (e) { console.warn('Connect failed:', e) }
}

async function disconnect(channelId: string) {
  try {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${getToken()}` }
    await fetch(`https://aigc.fushtn.com/api/enterprise/channel-accounts/${channelId}`, { method: 'DELETE', headers })
    await fetchChannels()
  } catch (e) { console.warn('Disconnect failed:', e) }
}

function openBindingModal(channel: any) {
  selectedChannel.value = channel
  selectedAgentIds.value = channel.bindings.map((b: any) => b.agentInstanceId)
  selectedPermissions.value = ['READ']
  showBindingModal.value = true
}

function isAgentSelected(agentId: string): boolean {
  return selectedAgentIds.value.includes(agentId)
}

function toggleAgentSelection(agent: any) {
  const idx = selectedAgentIds.value.indexOf(agent.id)
  if (idx >= 0) selectedAgentIds.value.splice(idx, 1)
  else selectedAgentIds.value.push(agent.id)
}

async function bindAgents() {
  if (!selectedChannel.value) return
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    }
    for (const agentId of selectedAgentIds.value) {
      await fetch('https://aigc.fushtn.com/api/enterprise/channel-accounts/bindings', {
        method: 'POST', headers,
        body: JSON.stringify({
          channelAccountId: selectedChannel.value.id,
          agentInstanceId: agentId,
          permissions: selectedPermissions.value,
        }),
      })
    }
    showBindingModal.value = false
    await fetchChannels()
  } catch (e) { console.warn('Bind failed:', e) }
}

async function unbind(bindingId: string) {
  try {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${getToken()}` }
    await fetch(`https://aigc.fushtn.com/api/enterprise/channel-accounts/bindings/${bindingId}`, { method: 'DELETE', headers })
    await fetchChannels()
  } catch (e) { console.warn('Unbind failed:', e) }
}

onMounted(() => {
  fetchChannels()
  fetchAgents()
})
</script>

<style scoped>
.channels-page {
  min-height: 100vh;
  background: #08131F;
  color: #F8F6F1;
}
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px;
}
.page-header {
  margin-bottom: 40px;
}
.page-title {
  font-size: 32px;
  font-weight: 700;
  color: #F8F6F1;
  margin: 0 0 8px 0;
}
.page-subtitle {
  font-size: 16px;
  color: rgba(248, 246, 241, 0.5);
  margin: 0;
}
.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}
.channel-card {
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.08);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.2s;
}
.channel-card:hover {
  border-color: rgba(248, 246, 241, 0.15);
}
.channel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.channel-platform-icon {
  font-size: 28px;
  width: 44px;
  height: 44px;
  background: rgba(248, 246, 241, 0.05);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.channel-info {
  flex: 1;
}
.channel-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.channel-platform {
  font-size: 12px;
  color: rgba(248, 246, 241, 0.4);
}
.channel-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 500;
}
.channel-status.pending {
  background: rgba(248, 246, 241, 0.08);
  color: rgba(248, 246, 241, 0.5);
}
.channel-status.active {
  background: rgba(34, 197, 94, 0.15);
  color: #22C55E;
}
.channel-status.disconnected {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}
.channel-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(248, 246, 241, 0.3);
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(248, 246, 241, 0.05);
}
.binding-list {
  margin-bottom: 16px;
}
.binding-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
}
.binding-agent {
  font-weight: 500;
  color: rgba(248, 246, 241, 0.8);
}
.binding-perms {
  color: rgba(248, 246, 241, 0.4);
  font-size: 11px;
  flex: 1;
}
.btn-unbind {
  background: none;
  border: none;
  color: #EF4444;
  font-size: 12px;
  cursor: pointer;
  opacity: 0.7;
}
.btn-unbind:hover { opacity: 1; }
.channel-actions {
  display: flex;
  gap: 8px;
}
.channel-add {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  border: 2px dashed rgba(248, 246, 241, 0.15);
  background: transparent;
}
.channel-add:hover {
  border-color: rgba(248, 246, 241, 0.3);
  background: rgba(248, 246, 241, 0.02);
}
.add-icon {
  font-size: 36px;
  color: rgba(248, 246, 241, 0.3);
  font-weight: 300;
}
.add-text {
  font-size: 14px;
  color: rgba(248, 246, 241, 0.4);
}
.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-primary {
  background: rgba(248, 246, 241, 0.1);
  color: #F8F6F1;
  border: 1px solid rgba(248, 246, 241, 0.2);
}
.btn-primary:hover {
  background: rgba(248, 246, 241, 0.15);
}
.btn-outline {
  background: transparent;
  color: rgba(248, 246, 241, 0.7);
  border: 1px solid rgba(248, 246, 241, 0.15);
}
.btn-outline:hover {
  border-color: rgba(248, 246, 241, 0.3);
}
.btn-danger {
  background: transparent;
  color: #EF4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}
.btn-sm { padding: 6px 14px; font-size: 12px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #0F1D2E;
  border: 1px solid rgba(248, 246, 241, 0.1);
  border-radius: 16px;
  padding: 32px;
  width: 480px;
  max-width: 90vw;
}
.modal-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 24px 0;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  font-size: 13px;
  color: rgba(248, 246, 241, 0.6);
  margin-bottom: 8px;
}
.form-group input, .form-group select {
  width: 100%;
  padding: 10px 14px;
  background: rgba(248, 246, 241, 0.05);
  border: 1px solid rgba(248, 246, 241, 0.1);
  border-radius: 8px;
  color: #F8F6F1;
  font-size: 14px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
.agent-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
}
.agent-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(248, 246, 241, 0.08);
  cursor: pointer;
  transition: all 0.2s;
}
.agent-option:hover {
  background: rgba(248, 246, 241, 0.05);
}
.agent-option.agent-selected {
  border-color: #22C55E;
  background: rgba(34, 197, 94, 0.08);
}
.agent-name {
  font-weight: 500;
  flex: 1;
}
.agent-type {
  font-size: 12px;
  color: rgba(248, 246, 241, 0.4);
}
.perm-checkboxes {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.perm-checkboxes label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(248, 246, 241, 0.7);
  cursor: pointer;
}
</style>
