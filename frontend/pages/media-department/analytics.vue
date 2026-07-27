<template>
import { KunlunMediaApi } from '~/composables/enterprise/useMediaApi'
  <div class="media-department">
    <KunlunNav :is-logged-in="isLoggedIn" @show-login="showLogin = true" @show-register="showRegister = true" />
    
    <main class="main-content">
      <div class="sub-nav">
        <NuxtLink to="/media-department" class="sub-nav-back">← 返回首页</NuxtLink>
        <h1 class="sub-nav-title">数据看板</h1>
      </div>

      <div v-if="!isLoggedIn" class="empty-state">
        <p>请先登录</p>
        <button class="btn btn-primary" @click="showLogin = true">登录</button>
      </div>

      <div v-else-if="!hasOrganization" class="empty-state">
        <p>请先创建企业</p>
        <NuxtLink to="/media-department/settings" class="btn btn-primary">创建企业</NuxtLink>
      </div>

      <div v-else class="analytics-page">
        <div class="analytics-empty">
          <div class="empty-icon">📊</div>
          <h2>数据看板</h2>
          <p>连接新媒体账号后，AI 数据分析师将自动同步各平台运营数据。</p>
          <div class="placeholder-metrics">
            <div class="metric-item">
              <span class="metric-label">内容发布</span>
              <span class="metric-value">--</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">用户互动</span>
              <span class="metric-value">--</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">新增粉丝</span>
              <span class="metric-value">--</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">转化率</span>
              <span class="metric-value">--</span>
            </div>
          </div>
          <NuxtLink to="/media-department/settings" class="btn btn-primary">连接账号</NuxtLink>
          <p class="phase-note">数据看板功能将在 Phase 2 实现</p>
        </div>
      </div>
    </main>

    <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
      <div class="modal-content">
        <p>登录功能尚未实现，请联系管理员</p>
        <button class="btn btn-outline btn-sm" @click="showLogin = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'

const isLoggedIn = ref(false)
const showLogin = ref(false)
const showRegister = ref(false)
const hasOrganization = ref(false)

function getToken(): string {
  try { return localStorage.getItem('accessToken') || '' } catch { return '' }
}

onMounted(() => {
  const token = getToken()
  if (token) {
    isLoggedIn.value = true
  }
})
</script>

<style scoped>
.media-department {
  min-height: 100vh;
  background: #08131F;
  color: #F8F6F1;
}

.main-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 100px 24px 60px;
}

.sub-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.sub-nav-back {
  font-size: 0.85rem;
  color: rgba(248, 246, 241, 0.5);
  text-decoration: none;
}

.sub-nav-back:hover {
  color: #C9A86C;
}

.sub-nav-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: rgba(248, 246, 241, 0.5);
}

.analytics-empty {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.analytics-empty h2 {
  font-size: 1.3rem;
  margin-bottom: 8px;
}

.analytics-empty p {
  color: rgba(248, 246, 241, 0.5);
  margin-bottom: 32px;
}

.placeholder-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  max-width: 700px;
  margin: 0 auto 32px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
}

.metric-label {
  font-size: 0.75rem;
  color: rgba(248, 246, 241, 0.4);
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: rgba(248, 246, 241, 0.3);
}

.phase-note {
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.3);
  margin-top: 16px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.modal-content {
  background: #08131F;
  border: 1px solid rgba(248, 246, 241, 0.1);
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  max-width: 400px;
}

.btn {
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  font-size: 0.9rem;
  font-family: inherit;
}

.btn-primary {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  font-weight: 600;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(248, 246, 241, 0.2);
  color: rgba(248, 246, 241, 0.8);
}
</style>
