/**
 * GeoWorkspaceLayout.vue — Product Polish (Phase 8)
 *
 * Design System tokens: color, spacing, typography, radius, motion, elevation
 * Features: page transitions, responsive layout, keyboard navigation, focus management
 *
 * 用户体系接入：会员卡片（侧栏底部+header菜单）、大模型设置弹窗
 */
<template>
  <div class="geo-layout">
    <!-- Header -->
    <header class="geo-layout__header">
      <div class="geo-layout__header-left">
        <button
          class="geo-layout__mobile-toggle"
          :aria-label="navOpen ? 'Close navigation' : 'Open navigation'"
          @click="toggleNav"
          @keydown.escape="navOpen = false"
          tabindex="0"
        >
          <span v-if="navOpen">✕</span>
          <span v-else>☰</span>
        </button>
        <router-link to="/" class="geo-layout__home-btn" title="返回首页">
          🏠
        </router-link>
        <span class="geo-layout__brand">昆仑镜 · GEO</span>
        <span class="geo-layout__workspace-selector">工作台</span>
      </div>
      <div class="geo-layout__header-right">
        <button class="geo-layout__brand-link" @click="goBrandDetail" :title="currentBrandName">
          <span class="geo-layout__user-info">{{ currentBrandName }}</span>
        </button>
        <button class="geo-layout__restart-wt" @click="restartWalkthrough" title="Restart Walkthrough">
          🔄 重新引导
        </button>
      </div>
    </header>

    <div class="geo-layout__body">
      <!-- Sidebar Navigation -->
      <nav
        :class="['geo-layout__nav', { 'geo-layout__nav--open': navOpen }]"
        role="navigation"
        aria-label="GEO Workspace Navigation"
      >
        <div class="geo-layout__nav-items">
          <router-link
            v-for="tab in navTabs"
            :key="tab.path"
            :to="tab.path"
            :class="['geo-layout__nav-item', { 'geo-layout__nav-item--active': isActive(tab.path) }]"
            :aria-current="isActive(tab.path) ? 'page' : undefined"
            @click="navOpen = false"
            @keydown.enter="navOpen = false"
          >
            <span class="geo-layout__nav-icon" v-html="tab.icon" />
            <span class="geo-layout__nav-label">{{ tab.label }}</span>
          </router-link>
        </div>

        <!-- 侧边栏底部卡片 — 会员卡片（100% 参照 PipelineSidebar 设计） -->
        <div class="geo-layout__nav-bottom">
          <!-- 会员卡片：点击跳转（免费→会员中心，已付费→个人中心） -->
          <div class="vip-card-wrapper" @click="goMemberCenter">
            <div class="vip-card" :style="vipCardStyle" :class="{ 'guest': memberPlanClass === 'free' }">
              <div class="vip-card-bg" :style="{ background: vipInfo?.gradient }" />
              <div class="vip-card-glow" :style="{ background: vipInfo?.glowColor }" />
              <div class="vip-card-content">
                <div class="vip-card-left">
                  <div class="vip-card-avatar" :style="{ background: vipInfo?.gradient }">{{ avatarChar }}</div>
                </div>
                <div class="vip-card-right">
                  <div class="vip-card-top">
                    <span class="vip-card-tier-icon">{{ vipInfo?.icon }}</span>
                    <span class="vip-card-tier-name" :style="{ color: vipInfo?.color }">{{ vipInfo?.label || displayMemberName }}</span>
                  </div>
                  <div class="vip-card-coins">
                    <span class="vip-coins-icon">🪙</span>
                    <span class="vip-coins-num">{{ memberCredits }}</span>
                    <span class="vip-coins-unit">积分</span>
                  </div>
                  <div class="vip-card-expiry">
                    <span class="vip-expiry-label">到期日:</span>
                    <span class="vip-expiry-date">{{ formattedExpiry }}</span>
                  </div>
                  <template v-if="memberPlanClass === 'free'">
                    <button class="vip-card-upgrade" @click.stop="goUpgrade">升级 VIP</button>
                  </template>
                  <template v-else>
                    <div class="vip-card-entrance" @click.stop="goUserCenter">
                      <span class="vip-entrance-text">进入个人中心 →</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
          <div class="geo-layout__nav-card geo-layout__nav-card--model" @click="showModelSettings = true">
            <div class="geo-layout__nav-card-icon">🧩</div>
            <div class="geo-layout__nav-card-info">
              <div class="geo-layout__nav-card-title">大模型设置</div>
              <div class="geo-layout__nav-card-desc">配置 AI 引擎与 API Key</div>
            </div>
            <div class="geo-layout__nav-card-arrow">→</div>
          </div>
        </div>
      </nav>

      <!-- 大模型设置弹窗（复用 DirectorModelSettingsModal） -->
      <DirectorModelSettingsModal :visible="showModelSettings" @close="showModelSettings = false" />

      <!-- Overlay for mobile nav -->
      <div
        v-if="navOpen"
        class="geo-layout__overlay"
        @click="navOpen = false"
        @keydown.escape="navOpen = false"
        tabindex="0"
      />

      <!-- Content Area with page transition -->
      <main class="geo-layout__content" role="main">
        <div class="geo-layout__transition">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { walkthroughService } from '../services/walkthroughService'
import { useAuthStore } from '../../../stores/auth'

const route = useRoute()
const router = useRouter()
const navOpen = ref(false)
const showModelSettings = ref(false)
const auth = useAuthStore()

// ========== 会员 / VIP 信息（100% 参照 PipelineSidebar 设计） ==========
const memberTier = ref('free')
const memberCredits = ref(0)
const memberExpiresAt = ref('')

const isVip = computed(() => {
  const t = memberTier.value.toLowerCase()
  return t === 'vip' || t === 'pro' || t === 'partner' || t === 'director' || t === 'gold' || t === 'premium' || t === 'enterprise' || t === 'vip_year' || t === 'vip_platinum'
})
const displayMemberName = computed(() => {
  const map: Record<string, string> = {
    vip: 'VIP 会员',
    pro: '专业版',
    partner: '合作伙伴',
    director: '导演版',
    free: '免费用户',
    basic: '基础版',
    gold: '黄金会员',
    premium: '黄金会员',
    enterprise: '年卡',
  }
  return map[memberTier.value] || memberTier.value || '体验版'
})

const memberPlanClass = computed(() => {
  return memberTier.value.toLowerCase()
})

const formattedExpiry = computed(() => {
  if (!memberExpiresAt.value) return '永久'
  try {
    return new Date(memberExpiresAt.value).toLocaleDateString('zh-CN')
  } catch {
    return memberExpiresAt.value
  }
})

const avatarChar = computed(() => {
  // 取会员等级的拼音首字符或默认
  return displayMemberName.value.charAt(0) || 'U'
})

const vipInfo = computed(() => {
  const MAP: Record<string, { label: string; icon: string; color: string; gradient: string; glowColor: string }> = {
    free: { label: '免费用户', icon: '🆓', color: '#9ca3af', gradient: 'linear-gradient(135deg, #374151, #4b5563)', glowColor: 'rgba(107,114,128,0.15)' },
    trial: { label: '新人体验卡', icon: '🎁', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #fcd34d)', glowColor: 'rgba(245,158,11,0.2)' },
    basic: { label: '基础版', icon: '⭐', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glowColor: 'rgba(59,130,246,0.2)' },
    pro: { label: '本地版', icon: '💻', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #c084fc)', glowColor: 'rgba(168,85,247,0.2)' },
    enterprise: { label: '年卡', icon: '👑', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)', glowColor: 'rgba(34,197,94,0.2)' },
    gold: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.2)' },
    premium: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.2)' },
    vip: { label: '黄金会员', icon: '⭐', color: '#D4AF37', gradient: 'linear-gradient(135deg, #D4AF37, #fbbf24)', glowColor: 'rgba(212,175,55,0.25)' },
    Pro: { label: '钻石会员', icon: '💎', color: '#E53E3E', gradient: 'linear-gradient(135deg, #E53E3E, #fc8181)', glowColor: 'rgba(229,62,62,0.2)' },
    director: { label: '年卡会员', icon: '👑', color: '#9333EA', gradient: 'linear-gradient(135deg, #9333EA, #c084fc)', glowColor: 'rgba(147,51,234,0.2)' },
    vip_year: { label: '钻石会员', icon: '💎', color: '#E53E3E', gradient: 'linear-gradient(135deg, #E53E3E, #fc8181)', glowColor: 'rgba(229,62,62,0.2)' },
    vip_platinum: { label: '至尊会员', icon: '👑', color: '#9333EA', gradient: 'linear-gradient(135deg, #9333EA, #f472b6)', glowColor: 'rgba(147,51,234,0.2)' },
  }
  return MAP[memberPlanClass.value] || MAP.free
})

const vipCardStyle = computed(() => ({
  borderColor: vipInfo.value?.color ? vipInfo.value.color + '20' : 'transparent',
}))

async function loadMemberInfo() {
  try {
    const token = auth.getToken()
    if (!token) return
    const res = await fetch('/api/member/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      memberTier.value = data.memberTier || data.membership?.tier || 'free'
      memberCredits.value = data.credits ?? data.membership?.credits ?? 0
      memberExpiresAt.value = data.expiresAt || data.membership?.expiresAt || ''
    }
  } catch { /* ignore */ }
}

function goMemberCenter() {
  if (memberPlanClass.value === 'free') {
    router.push('/user/membership')
  } else {
    router.push('/user/center')
  }
}

function goUpgrade() {
  router.push('/user/membership')
}

function goUserCenter() {
  router.push('/user/center')
}

// 从 mission control 获取当前品牌名
const currentBrandName = ref('GEO 工作台')
const currentProjectId = ref<string | null>(null)

async function goBrandDetail() {
  if (currentProjectId.value) {
    router.push(`/workspace/geo/brand/${currentProjectId.value}`)
  } else {
    goCreateBrand()
  }
}

function goCreateBrand() {
  router.push('/workspace/geo/create')
}

async function restartWalkthrough() {
  try {
    await walkthroughService.restart()
    router.push('/workspace/geo/dashboard')
  } catch {
    // Silent fail
  }
}

// 从路由参数或 mission control 加载品牌信息
import { getMissionControl } from '../services/missionControlService.js'

const navTabs = computed(() => [
  { label: '数据总览', path: '/workspace/geo/dashboard', icon: '&#128202;' },
  { label: '洞察发现', path: '/workspace/geo/discovery', icon: '&#128300;' },
  { label: '品牌健康', path: '/workspace/geo/health', icon: '&#9829;' },
  { label: '智能推荐', path: '/workspace/geo/recommendations', icon: '&#9733;' },
  { label: '内容核验', path: '/workspace/geo/verification', icon: '&#10003;' },
  { label: '发布管理', path: '/workspace/geo/publishing', icon: '&#8644;' },
  { label: '成长分析', path: '/workspace/geo/growth', icon: '&#8599;' },
  { label: '知识库', path: currentProjectId.value ? `/workspace/geo/knowledge?projectId=${currentProjectId.value}` : '/workspace/geo/knowledge', icon: '&#128214;' },
])

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}

function toggleNav() {
  navOpen.value = !navOpen.value
}

// 组件挂载后加载当前品牌信息 + 会员信息
import { onMounted } from 'vue'
onMounted(async () => {
  try {
    const res = await getMissionControl()
    if (res.entityName) {
      currentBrandName.value = res.entityName
      currentProjectId.value = res.projectId
    }
  } catch {
    // 使用默认名称
  }
  loadMemberInfo()
})
</script>

<style scoped>
.geo-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--color-surface, #ffffff);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  color: var(--color-text-primary, #111111);
}

/* ===== HEADER ===== */
.geo-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 var(--space-5, 24px);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  background-color: var(--color-surface, #ffffff);
  flex-shrink: 0;
  z-index: 30;
}

.geo-layout__header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4, 16px);
}

.geo-layout__mobile-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface, #ffffff);
  color: var(--color-text-secondary, #6b7280);
  font-size: 18px;
  cursor: pointer;
  transition: background-color var(--motion-fast-duration, 100ms) ease-out;
}

.geo-layout__mobile-toggle:hover {
  background-color: var(--color-surface-dim, #f9fafb);
}

.geo-layout__mobile-toggle:focus-visible {
  outline: 2px solid var(--color-info, #3b82f6);
  outline-offset: 2px;
}

.geo-layout__home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm, 4px);
  text-decoration: none;
  font-size: 18px;
  transition: background-color var(--motion-fast-duration, 100ms) ease-out;
}
.geo-layout__home-btn:hover {
  background-color: var(--color-surface-dim, #f3f4f6);
}
.geo-layout__brand {
  font-size: var(--text-body-size, 16px);
  font-weight: 700;
  color: var(--color-text-primary, #111111);
  letter-spacing: -0.02em;
}

.geo-layout__workspace-selector {
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface-dim, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
}

.geo-layout__header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.geo-layout__brand-link {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  line-height: 1;
}
.geo-layout__brand-link:hover .geo-layout__user-info {
  color: var(--color-accent, #2563eb);
}

.geo-layout__user-info {
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
  transition: color 0.15s;
}

.geo-layout__restart-wt {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}

.geo-layout__restart-wt:hover {
  background: #f3f4f6;
  color: #374151;
  border-color: #9ca3af;
}

/* ===== BODY ===== */
.geo-layout__body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ===== SIDEBAR NAV ===== */
.geo-layout__nav {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
  padding: var(--space-4, 16px) var(--space-4, 16px) var(--space-3, 12px);
  border-right: 1px solid var(--color-border, #e5e7eb);
  background-color: var(--color-surface, #ffffff);
  overflow-y: auto;
  z-index: 20;
  transition: transform var(--motion-normal-duration, 200ms) ease-out;
}

.geo-layout__nav-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
}

.geo-layout__nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  text-decoration: none;
  color: var(--color-text-secondary, #6b7280);
  transition: all var(--motion-fast-duration, 100ms) ease-out;
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  outline: none;
}

.geo-layout__nav-item:hover {
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-text-primary, #111111);
}

.geo-layout__nav-item:focus-visible {
  outline: 2px solid var(--color-info, #3b82f6);
  outline-offset: -2px;
}

.geo-layout__nav-item:active {
  background-color: var(--color-border, #e5e7eb);
}

.geo-layout__nav-item--active {
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-info, #3b82f6);
  font-weight: 600;
}

.geo-layout__nav-item--active:hover {
  color: var(--color-info, #3b82f6);
}

.geo-layout__nav-item--active:focus-visible {
  outline-color: var(--color-info, #3b82f6);
}

.geo-layout__nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 16px;
  flex-shrink: 0;
}

.geo-layout__nav-label {
  line-height: 1;
}

/* ===== 侧边栏底部卡片 ==== */
.geo-layout__nav-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: var(--space-3, 12px);
  border-top: 1px solid var(--color-border, #e5e7eb);
}

/* ── VIP 会员卡片（100% PipelineSidebar 设计）── */
.vip-card-wrapper {
  padding: 0 0 2px;
  cursor: pointer;
}
.vip-card {
  position: relative;
  border-radius: 12px;
  padding: 12px;
  overflow: hidden;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.vip-card:hover { transform: translateY(-1px); }
.vip-card.guest { background: rgba(0,0,0,0.03); border-color: #e5e7eb; }
.vip-card-bg {
  position: absolute;
  inset: 0;
  opacity: 0.12;
}
.vip-card-glow {
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.15;
}
.vip-card-content {
  position: relative;
  display: flex;
  gap: 10px;
}
.vip-card-left { flex-shrink: 0; }
.vip-card-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}
.vip-card-right { flex: 1; min-width: 0; }
.vip-card-top {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.vip-card-tier-icon { font-size: 12px; }
.vip-card-tier-name {
  font-size: 12px;
  font-weight: 600;
}
.vip-card-sub {
  font-size: 11px;
  color: #6b7280;
  margin-top: 6px;
}
.vip-card-coins {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 2px;
}
.vip-coins-icon { font-size: 11px; }
.vip-coins-num {
  font-size: 13px;
  font-weight: 700;
  color: #fbbf24;
}
.vip-coins-unit {
  font-size: 10px;
  color: #6b7280;
  margin-left: 1px;
}
.vip-card-expiry {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.vip-expiry-label { font-size: 10px; color: #6b7280; }
.vip-expiry-date { font-size: 10px; color: #9ca3af; }
.vip-card-upgrade {
  display: block;
  width: 100%;
  padding: 4px 0;
  border-radius: 6px;
  border: none;
  background: linear-gradient(135deg, #D4AF37, #fbbf24);
  color: #000;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.vip-card-upgrade:hover { opacity: 0.85; }
.vip-card-entrance {
  margin-top: 4px;
  cursor: pointer;
  text-align: center;
}
.vip-entrance-text {
  font-size: 11px;
  color: #60a5fa;
  opacity: 0.8;
  transition: opacity 0.15s;
}
.vip-card-entrance:hover .vip-entrance-text {
  opacity: 1;
}

/* ── 大模型设置卡片 ── */
.geo-layout__nav-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}
.geo-layout__nav-card:hover {
  background-color: var(--color-surface-dim, #f9fafb);
}
.geo-layout__nav-card:active {
  background-color: var(--color-border, #e5e7eb);
}

.geo-layout__nav-card-icon {
  font-size: 20px;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
}
.geo-vip-icon {
  filter: drop-shadow(0 0 2px rgba(217, 119, 6, 0.3));
}

.geo-layout__nav-card-info {
  flex: 1;
  min-width: 0;
}

.geo-layout__nav-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #111111);
  line-height: 1.3;
}

.geo-layout__nav-card-desc {
  font-size: 11px;
  color: var(--color-text-tertiary, #9ca3af);
  line-height: 1.3;
  margin-top: 1px;
}

.geo-layout__nav-card-arrow {
  font-size: 14px;
  color: var(--color-text-tertiary, #d1d5db);
  transition: transform 0.15s;
}
.geo-layout__nav-card:hover .geo-layout__nav-card-arrow {
  transform: translateX(2px);
}

/* ===== OVERLAY (mobile) ===== */
.geo-layout__overlay {
  display: none;
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 15;
}

/* ===== CONTENT ===== */
.geo-layout__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6, 32px) var(--space-5, 24px);
  background-color: var(--color-surface, #ffffff);
}

.geo-layout__transition {
  animation: geo-page-enter var(--motion-normal-duration, 200ms) ease-out;
}

@keyframes geo-page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .geo-layout__nav {
    width: 220px;
  }

  .geo-layout__content {
    padding: var(--space-5, 24px) var(--space-4, 16px);
  }
}

@media (max-width: 768px) {
  .geo-layout__mobile-toggle {
    display: flex;
  }

  .geo-layout__nav {
    position: fixed;
    top: 56px;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
    width: 280px;
    z-index: 20;
    box-shadow: var(--elevation-lg, 0 4px 24px rgba(0,0,0,0.12));
  }

  .geo-layout__nav--open {
    transform: translateX(0);
  }

  .geo-layout__overlay {
    display: block;
  }

  .geo-layout__content {
    padding: var(--space-4, 16px);
  }

  .geo-layout__brand {
    font-size: var(--text-body-sm-size, 14px);
  }
}

@media (max-width: 480px) {
  .geo-layout__workspace-selector {
    display: none;
  }

  .geo-layout__content {
    padding: var(--space-3, 12px);
  }
}
</style>
