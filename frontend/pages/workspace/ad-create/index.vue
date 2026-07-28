<template>
  <div class="page-wrapper">
    <!-- 顶部导航条：用户信息 + 返回首页 -->
    <header class="top-nav">
      <div class="nav-left">
        <button class="back-btn" @click="goHome">← 返回首页</button>
        <span class="page-title">📢 广告制作</span>
      </div>
      <div class="nav-right">
        <!-- 用户信息 -->
        <span v-if="userName" class="user-name">{{ userName }}</span>
        <button v-if="isLoggedIn" class="nav-btn" @click="goToUserCenter">会员中心</button>
        <button v-if="isLoggedIn" class="nav-btn" @click="handleLogout">退出</button>
        <button v-if="!isLoggedIn" class="nav-btn" @click="goToLogin">登录</button>
      </div>
    </header>

    <!-- 工作台主体（含 PipelineSidebar + AdvertisementWorkspace + AssetSidebar） -->
    <main class="workspace-body">
      <AdWorkspaceLayout />
    </main>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
/**
 * /workspace/ad-create — 独立广告制作工作台
 * 引用昆仑镜用户体系 + 大模型设置体系
 */
import { ref, onMounted } from 'vue'
import AdWorkspaceLayout from '~/studio-v2/layout/AdWorkspaceLayout.vue'

const isLoggedIn = ref(false)
const userName = ref('')

onMounted(() => {
  try {
    const token = getAuthToken() || getAuthToken()
    if (token) {
      isLoggedIn.value = true
      const payload = JSON.parse(atob(token.split('.')[1]))
      userName.value = payload.username || payload.email || ''
    }
  } catch {}
})

function goHome() { window.location.href = '/' }
function goToLogin() { window.location.href = '/?login=1' }
function goToUserCenter() { window.location.href = '/user/center' }
function handleLogout() {
  ;['accessToken', 'auth_token', 'auth_user', 'token', 'refreshToken'].forEach(k => {
    try { localStorage.removeItem(k) } catch {}
  })
  window.location.href = '/?logout=1'
}
</script>

<style>
html, body, #__nuxt {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #0a0a0a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.nav-left, .nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.back-btn {
  padding: 6px 14px;
  font-size: 0.85rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  transition: all 0.15s;
}
.back-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
.page-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
}
.user-name {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.5);
}
.nav-btn {
  padding: 5px 12px;
  font-size: 0.8rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 5px;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  transition: all 0.15s;
}
.nav-btn:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
}
.workspace-body {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
</style>
