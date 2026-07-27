<template>
  <div class="invite-page">
    <div class="invite-card">
      <!-- Loading -->
      <div v-if="loading" class="invite-loading">
        <p>加载中...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="invite-error">
        <h2>⚠️ {{ error }}</h2>
        <p v-if="inviteData">{{ inviteData.projectName }}</p>
        <button class="btn-primary" @click="navigateTo('/studio/')">返回工作室</button>
      </div>

      <!-- Invite Details -->
      <div v-else-if="inviteData" class="invite-details">
        <h2>🎬 项目邀请</h2>
        <p class="invite-project">{{ inviteData.projectName }}</p>
        <p class="invite-role">
          邀请你作为 <strong>{{ inviteData.roleLabel }}</strong>
        </p>

        <div v-if="!isLoggedIn" class="invite-login">
          <p>请先登录后接受邀请</p>
          <button class="btn-primary" @click="navigateTo('/login')">登录</button>
        </div>

        <div v-else-if="isPending" class="invite-actions">
          <button class="btn-primary" @click="handleAccept">加入团队</button>
          <button class="btn-decline" @click="handleDecline">拒绝</button>
        </div>

        <div v-else class="invite-status">
          <p v-if="inviteData.status === 'accepted'">✅ 你已接受此邀请</p>
          <p v-else-if="inviteData.status === 'expired'">⏰ 邀请已过期</p>
          <p v-else>邀请状态：{{ inviteData.status }}</p>
        </div>

        <p class="invite-expiry">有效期至：{{ formatDate(inviteData.expiresAt) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const route = useRoute()

const loading = ref(true)
const error = ref('')
const inviteData = ref<any>(null)

const isLoggedIn = computed(() => {
  try {
    const token = window.localStorage?.getItem('auth_token')
    if (!token) return false
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch { return false }
})

const isPending = computed(() => inviteData.value?.isPending)

function formatDate(date: string) {
  if (!date) return '—'
  return new Date(date).toLocaleString('zh-CN')
}

function navigateTo(path: string) {
  window.location.href = path
}

async function loadInvite() {
  try {
    const token = route.params.token as string
    const res = await fetch(`/api/v1/studio/team/invite/${token}`)
    const json = await res.json()
    if (json.success) {
      inviteData.value = json.data
    } else {
      error.value = json.error || '邀请不存在'
    }
  } catch (err) {
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}

async function handleAccept() {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const inviteToken = route.params.token as string
    const res = await fetch('/api/v1/studio/team/accept-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ token: inviteToken }),
    })
    const json = await res.json()
    if (json.success) {
      navigateTo(`/studio/v2?project=${json.data.projectId}`)
    } else {
      alert(json.error || '接受失败')
    }
  } catch (err) {
    alert('网络错误')
  }
}

function handleDecline() {
  navigateTo('/studio/')
}

onMounted(() => {
  loadInvite()
})
</script>

<style scoped>
.invite-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
  padding: 24px;
}

.invite-card {
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  border-radius: 16px;
  padding: 48px;
  max-width: 440px;
  width: 100%;
  text-align: center;
}

.invite-card h2 {
  font-size: 24px;
  margin-bottom: 16px;
}

.invite-project {
  font-size: 20px;
  color: #6366f1;
  font-weight: 600;
  margin-bottom: 8px;
}

.invite-role {
  font-size: 16px;
  color: #888;
  margin-bottom: 32px;
}

.invite-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
}

.btn-primary {
  padding: 10px 24px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}

.btn-primary:hover {
  background: #4f46e5;
}

.btn-decline {
  padding: 10px 24px;
  background: transparent;
  color: #888;
  border: 1px solid #3a3a4e;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}

.invite-expiry {
  font-size: 12px;
  color: #555;
}

.invite-loading, .invite-error, .invite-status {
  padding: 24px 0;
}

.invite-login {
  margin-top: 16px;
}
</style>
