<template>
  <div class="legal-layout">
    <!-- 顶栏 -->
    <header class="legal-layout__header">
      <div class="legal-layout__header-left">
        <button
          class="legal-layout__mobile-toggle"
          :aria-label="navOpen ? '收起导航' : '展开导航'"
          @click="toggleNav"
          tabindex="0"
        >
          <span v-if="navOpen">✕</span>
          <span v-else>☰</span>
        </button>
        <NuxtLink to="/" class="legal-layout__brand">昆仑镜</NuxtLink>
        <span class="legal-layout__divider">/</span>
        <span class="legal-layout__workspace">法律工作台</span>
      </div>
      <div class="legal-layout__header-right">
        <span class="legal-layout__user-info">{{ userName }}</span>
      </div>
    </header>

    <div class="legal-layout__body">
      <!-- 侧边导航 -->
      <nav
        :class="['legal-layout__nav', { 'legal-layout__nav--open': navOpen }]"
        role="navigation"
        aria-label="法律工作台导航"
      >
        <router-link
          v-for="tab in navTabs"
          :key="tab.path"
          :to="tab.path"
          :class="['legal-layout__nav-item', { 'legal-layout__nav-item--active': isActive(tab.path) }]"
          :aria-current="isActive(tab.path) ? 'page' : undefined"
          @click="navOpen = false"
        >
          <span class="legal-layout__nav-icon" v-html="tab.icon" />
          <span class="legal-layout__nav-label">{{ tab.label }}</span>
        </router-link>

        <!-- 底部三卡：会员 + 大模型设置 + 本地模型 -->
        <div class="legal-layout__nav-bottom">
          <div class="legal-layout__card legal-layout__card--member" @click="memberTier !== 'free' ? goMemberCenter() : goMembership()">
            <div class="legal-layout__card-icon" :class="{ 'legal-layout__vip-icon': isVip }">
              {{ isVip ? '👑' : '💎' }}
            </div>
            <div class="legal-layout__card-info">
              <div class="legal-layout__card-title">{{ memberTier !== 'free' ? displayMemberName : '免费用户' }}</div>
              <div class="legal-layout__card-desc">{{ isVip ? `余额 ${memberCredits} 积分` : '了解会员权益' }}</div>
            </div>
            <div class="legal-layout__card-arrow">→</div>
          </div>
          <div class="legal-layout__card legal-layout__card--model" @click="showModelSettings = true">
            <div class="legal-layout__card-icon">🧩</div>
            <div class="legal-layout__card-info">
              <div class="legal-layout__card-title">大模型设置</div>
              <div class="legal-layout__card-desc">配置 AI 引擎与 API Key</div>
            </div>
            <div class="legal-layout__card-arrow">→</div>
          </div>
          <div class="legal-layout__card legal-layout__card--local" @click="showLocalEngine = true">
            <div class="legal-layout__card-icon">🖥️</div>
            <div class="legal-layout__card-info">
              <div class="legal-layout__card-title">本地引擎</div>
              <div class="legal-layout__card-desc">Ollama / ComfyUI / 本地模型</div>
            </div>
            <div class="legal-layout__card-arrow">→</div>
          </div>
        </div>
      </nav>

      <!-- 移动端遮罩 -->
      <div
        v-if="navOpen"
        class="legal-layout__overlay"
        @click="navOpen = false"
      />

      <!-- 内容区 -->
      <main class="legal-layout__content" role="main">
        <slot />
      </main>
    </div>

    <!-- 弹窗 -->
    <ModelSettingsModal :visible="showModelSettings" @close="showModelSettings = false" />
    <LocalEngineInstaller :visible="showLocalEngine" @close="showLocalEngine = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'
import LocalEngineInstaller from '~/components/director/LocalEngineInstaller.vue'

const route = useRoute()
const navOpen = ref(false)
const auth = useAuthStore()
const userName = computed(() => auth.userName || '用户')

const memberTier = ref('free')
const memberCredits = ref(0)
const showModelSettings = ref(false)
const showLocalEngine = ref(false)

const isVip = computed(() => {
  const t = memberTier.value.toLowerCase()
  return !['free', ''].includes(t)
})

const displayMemberName = computed(() => {
  const map: Record<string, string> = {
    free: '体验版', basic: '基础版', Pro: '高级会员', enterprise: '年卡',
  }
  return map[memberTier.value] || memberTier.value || '体验版'
})

async function fetchMembership() {
  try {
    const token = useAuthStore().getToken()
    if (!token) return
    const [planRes, meRes] = await Promise.all([
      fetch('/api/member/profile', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
    ])
    if (planRes.ok) {
      const data = await planRes.json()
      memberTier.value = data.memberTier || data.membership?.tier || 'free'
      memberCredits.value = data.credits ?? data.membership?.credits ?? 0
    } else if (meRes && meRes.ok) {
      const data = await meRes.json()
      const u = data.user || data
      memberTier.value = u.memberTier || u.membership?.tier || 'free'
      memberCredits.value = u.coins || u.membership?.credits || u.credits || 0
    }
  } catch {}
}

function goMemberCenter() {
  window.location.href = '/user/center'
}

function goMembership() {
  window.location.href = '/user/membership'
}

const navTabs = [
  { label: '工作台', path: '/workspace/legal/dashboard', icon: '&#128202;' },
  { label: 'AI 法律顾问', path: '/workspace/legal/adviser', icon: '&#129302;' },
  { label: '我的案件', path: '/workspace/legal/cases', icon: '&#128220;' },
  { label: '案件分析', path: '/workspace/legal/analysis', icon: '&#128300;' },
  { label: '证据中心', path: '/workspace/legal/evidence', icon: '&#128196;' },
  { label: '合同中心', path: '/workspace/legal/contracts', icon: '&#128203;' },
  { label: '法律文书', path: '/workspace/legal/documents', icon: '&#128214;' },
  { label: '法律法规', path: '/workspace/legal/laws', icon: '&#9878;' },
  { label: '案例中心', path: '/workspace/legal/cases-db', icon: '&#127758;' },
]

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}

function toggleNav() {
  navOpen.value = !navOpen.value
}

onMounted(() => {
  fetchMembership()
})
</script>

<style scoped>
.legal-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #030712;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  color: #F8F6F1;
}

/* ===== HEADER ===== */
.legal-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  border-bottom: 1px solid rgba(248, 246, 241, 0.08);
  background-color: #0a0f1e;
  flex-shrink: 0;
  z-index: 30;
}

.legal-layout__header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.legal-layout__mobile-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(248, 246, 241, 0.12);
  border-radius: 6px;
  background: transparent;
  color: #9CA3AF;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.legal-layout__mobile-toggle:hover {
  background: rgba(248, 246, 241, 0.05);
}

.legal-layout__brand {
  font-size: 16px;
  font-weight: 700;
  color: #F8F6F1;
  letter-spacing: -0.02em;
  text-decoration: none;
}

.legal-layout__divider {
  color: rgba(248, 246, 241, 0.2);
  font-size: 14px;
}

.legal-layout__workspace {
  font-size: 14px;
  color: rgba(248, 246, 241, 0.6);
  font-weight: 500;
}

.legal-layout__header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legal-layout__user-info {
  font-size: 14px;
  font-weight: 500;
  color: rgba(248, 246, 241, 0.7);
}

/* ===== BODY ===== */
.legal-layout__body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ===== SIDEBAR NAV ===== */
.legal-layout__nav {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px;
  border-right: 1px solid rgba(248, 246, 241, 0.06);
  background-color: #0a0f1e;
  overflow-y: auto;
  z-index: 20;
  transition: transform 0.2s ease-out;
}

.legal-layout__nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  text-decoration: none;
  color: rgba(248, 246, 241, 0.5);
  transition: all 0.15s;
  font-size: 14px;
  font-weight: 500;
}

.legal-layout__nav-item:hover {
  background-color: rgba(248, 246, 241, 0.05);
  color: rgba(248, 246, 241, 0.8);
}

.legal-layout__nav-item--active {
  background-color: rgba(251, 191, 36, 0.1);
  color: #FBBF24;
  font-weight: 600;
}

.legal-layout__nav-item--active:hover {
  color: #FBBF24;
}

.legal-layout__nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 16px;
  flex-shrink: 0;
}

.legal-layout__nav-label {
  line-height: 1;
}

/* ===== NAV BOTTOM CARDS ===== */
.legal-layout__nav-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid rgba(248, 246, 241, 0.06);
}

.legal-layout__card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.legal-layout__card:hover {
  background-color: rgba(248, 246, 241, 0.05);
  border-color: rgba(248, 246, 241, 0.08);
}

.legal-layout__card-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.legal-layout__vip-icon {
  color: #FBBF24;
}

.legal-layout__card-info {
  flex: 1;
  min-width: 0;
}

.legal-layout__card-title {
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.8);
  font-weight: 600;
}

.legal-layout__card-desc {
  font-size: 0.65rem;
  color: rgba(248, 246, 241, 0.4);
  margin-top: 1px;
}

.legal-layout__card-arrow {
  font-size: 0.75rem;
  color: rgba(248, 246, 241, 0.3);
  flex-shrink: 0;
}

.legal-layout__card--member:hover .legal-layout__card-icon { color: #FBBF24; }
.legal-layout__card--model:hover .legal-layout__card-icon { color: #818cf8; }
.legal-layout__card--local:hover .legal-layout__card-icon { color: #60a5fa; }

/* ===== OVERLAY (mobile) ===== */
.legal-layout__overlay {
  display: none;
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 15;
}

/* ===== CONTENT ===== */
.legal-layout__content {
  flex: 1;
  overflow-y: auto;
  padding: 32px 24px;
  background-color: #030712;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .legal-layout__nav {
    width: 220px;
  }
  .legal-layout__content {
    padding: 24px 16px;
  }
}

@media (max-width: 768px) {
  .legal-layout__mobile-toggle {
    display: flex;
  }
  .legal-layout__nav {
    position: fixed;
    top: 56px;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
    width: 280px;
    z-index: 20;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  }
  .legal-layout__nav--open {
    transform: translateX(0);
  }
  .legal-layout__overlay {
    display: block;
  }
  .legal-layout__content {
    padding: 16px;
  }
  .legal-layout__brand {
    font-size: 14px;
  }
}
</style>
