<template>
  <nav ref="navRef" class="kunlun-nav" :class="{ 'nav-scrolled': scrolled }">
    <div class="nav-inner">
      <!-- 左侧：Logo + 导航（紧凑排列） -->
      <div class="nav-left-group">
        <!-- Logo -->
        <NuxtLink to="/" class="nav-logo">
          <span class="logo-icon">
            <img src="/logo.png" alt="昆仑镜" class="nav-logo-img" />
          </span>
          <span class="logo-text">昆仑镜</span>
        </NuxtLink>

        <!-- 商城 + 社区 -->
        <NuxtLink
          v-for="item in primaryNav"
          :key="item.to"
          :to="item.to"
          class="nav-link"
        >
          <span class="nav-link-icon">{{ item.icon }}</span>
          {{ item.label }}
        </NuxtLink>

        <!-- 更多项目 Mega Menu 触发器 -->
        <div class="mega-menu-wrapper" ref="megaMenuRef">
          <button
            class="nav-link mega-trigger"
            :class="{ 'mega-open': megaOpen }"
            @click="toggleMegaMenu"
          >
            <span class="nav-link-icon">＋</span>
            更多项目
            <svg class="chevron" :class="{ 'chevron-open': megaOpen }" width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" />
            </svg>
          </button>

          <!-- Mega Menu 面板 -->
          <Transition name="mega-fade">
            <div v-if="megaOpen" class="mega-menu-panel">
              <div class="mega-menu-inner">
                <!-- 三排分类 -->
                <div v-for="category in navCategories" :key="category.title" class="mega-category">
                  <h4 class="mega-category-title">{{ category.title }}</h4>
                  <div class="mega-items">
                    <NuxtLink
                      v-for="item in category.items"
                      :key="item.to"
                      :to="item.disabled ? '#' : item.to"
                      class="mega-item"
                      :class="{ 'mega-item-disabled': item.disabled }"
                      :title="item.desc"
                      @click="item.disabled ? $event.preventDefault() : closeMegaMenu()"
                    >
                      <span class="mega-item-icon">{{ item.icon }}</span>
                      <div class="mega-item-content">
                        <span class="mega-item-label">
                          {{ item.label }}
                          <span v-if="item.badge" class="mega-item-badge">{{ item.badge }}</span>
                        </span>
                        <span v-if="item.desc" class="mega-item-desc">{{ item.desc }}</span>
                      </div>
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 操作区 -->
      <div class="nav-actions">
        <!-- 移动端：仅显示登录/注册/菜单按钮 -->
        <button class="mobile-menu-btn hide-desktop" @click="mobileMenuOpen = !mobileMenuOpen">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>

        <template v-if="!isLoggedIn">
          <button class="btn btn-outline btn-sm hide-mobile" @click="$emit('showLogin')">
            登录
          </button>
          <button class="btn btn-primary btn-sm hide-mobile" @click="$emit('showRegister')">
            免费注册
          </button>
        </template>
        <template v-else>
          <div class="user-menu hide-mobile">
            <NuxtLink to="/user/center" class="user-menu-entry">
              <UserAvatar :src="userAvatar" :name="userName" size="sm" class="user-menu-avatar" />
              <span class="user-menu-name">{{ userName }}</span>
            </NuxtLink>
            <NuxtLink to="/user/center" class="btn btn-primary btn-sm">
              会员中心 →
            </NuxtLink>
            <button class="btn btn-logout btn-sm" @click="handleLogout">退出</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 移动端菜单 -->
    <Transition name="mobile-slide">
      <div v-if="mobileMenuOpen" class="mobile-menu">
        <div class="mobile-menu-actions">
          <template v-if="!isLoggedIn">
            <button class="btn btn-outline btn-full" @click="$emit('showLogin'); mobileMenuOpen = false">登录</button>
            <button class="btn btn-primary btn-full" @click="$emit('showRegister'); mobileMenuOpen = false">免费注册</button>
          </template>
          <template v-else>
            <NuxtLink to="/user/center" class="btn btn-primary btn-full" @click="mobileMenuOpen = false">进入会员中心 →</NuxtLink>
            <button class="btn btn-logout btn-full" @click="handleLogout">退出</button>
          </template>
        </div>
        <div v-for="category in navCategories" :key="category.title" class="mobile-category">
          <h4 class="mobile-category-title">{{ category.title }}</h4>
          <NuxtLink
            v-for="item in category.items"
            :key="item.to"
            :to="item.disabled ? '#' : item.to"
            class="mobile-item"
            :class="{ 'mobile-item-disabled': item.disabled }"
            @click="item.disabled ? $event.preventDefault() : (mobileMenuOpen = false)"
          >
            <span class="mobile-item-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
            <span v-if="item.badge" class="mobile-item-badge">{{ item.badge }}</span>
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </nav>
</template>

<script setup lang="ts">
/**
 * KunlunNav — 昆仑镜首页导航栏 V2.1
 *
 * 层级：L4 business
 * 用途：全局导航，含登录/注册按钮和工作台入口。
 * 结构：Logo + 商城 + 社区 + 更多项目(Mega Menu) + 登录/注册
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { navCategories as rawNavCategories, primaryNav } from '~/config/navigation'
import { workspaces } from '~/config/workspaces'
import UserAvatar from '~/components/common/UserAvatar.vue'

// MEMBER-CENTER-02 全站头像：登录态从 localStorage 读取用户头像/昵称
const userAvatar = ref('')
const userName = ref('用户')

function refreshUserMeta() {
  try {
    const raw = window.localStorage?.getItem('auth_user')
    if (raw) {
      const u = JSON.parse(raw)
      userAvatar.value = u.avatarUrl || ''
      userName.value = u.username || u.email?.split('@')[0] || '用户'
    }
  } catch {}
}

// 过滤掉 hidden 工作台的导航分类
const navCategories = computed(() =>
  rawNavCategories
    .map(cat => ({
      ...cat,
      items: cat.items.filter(item => {
        const ws = workspaces.find(w => w.name === item.label)
        return !ws || ws.status !== 'hidden'
      }),
    }))
    .filter(cat => cat.items.length > 0)
)

defineProps<{
  isLoggedIn: boolean
}>()

defineEmits<{
  showLogin: []
  showRegister: []
  logout: []
}>()

const navRef = ref<HTMLElement | null>(null)
const megaMenuRef = ref<HTMLElement | null>(null)
const scrolled = ref(false)
const megaOpen = ref(false)
const mobileMenuOpen = ref(false)

function toggleMegaMenu() {
  megaOpen.value = !megaOpen.value
}

function closeMegaMenu() {
  megaOpen.value = false
}

function handleLogout() {
  ;['accessToken', 'auth_token', 'auth_user', 'token', 'refreshToken'].forEach(k => {
    try { localStorage.removeItem(k) } catch {}
  })
  ;['auth_token', 'auth_user', 'token', 'accessToken', 'refreshToken'].forEach(k => {
    document.cookie = `${k}=; path=/; max-age=0; samesite=lax`
  })
  try { sessionStorage.clear() } catch {}
  window.location.href = '/?logout=1'
}

function handleClickOutside(e: MouseEvent) {
  if (megaMenuRef.value && !megaMenuRef.value.contains(e.target as Node)) {
    megaOpen.value = false
  }
}

onMounted(() => {
  refreshUserMeta()
  const handleScroll = () => {
    scrolled.value = window.scrollY > 50
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
  document.addEventListener('click', handleClickOutside)
  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
    document.removeEventListener('click', handleClickOutside)
  })
})
</script>

<style scoped>
.kunlun-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 12px 24px;
  transition:
    background 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    backdrop-filter 0.4s ease,
    border-color 0.4s ease;
}

.nav-scrolled {
  background: rgba(8, 19, 31, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(248, 246, 241, 0.05);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Logo */
.nav-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.logo-icon {
  display: flex;
  align-items: center;
}

.nav-logo-img {
  height: 28px;
  width: auto;
}

.logo-text {
  font-size: 1rem;
  font-weight: 600;
  color: #F8F6F1;
}

/* 左侧：Logo + 导航紧凑排列 */
.nav-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 主导航 */
.nav-primary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: rgba(248, 246, 241, 0.6);
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 8px;
  transition: color 0.3s ease, background 0.3s ease;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.nav-link:hover {
  color: rgba(248, 246, 241, 0.9);
  background: rgba(248, 246, 241, 0.05);
}

.nav-link-icon {
  font-size: 0.9rem;
}

/* Mega Menu */
.mega-menu-wrapper {
  position: relative;
}

.mega-trigger {
  position: relative;
}

.mega-trigger.mega-open {
  color: rgba(248, 246, 241, 0.9);
  background: rgba(248, 246, 241, 0.05);
}

.chevron {
  transition: transform 0.3s ease;
  opacity: 0.5;
}

.chevron-open {
  transform: rotate(180deg);
}

/* Mega Menu 面板 */
.mega-menu-panel {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  width: 720px;
  background: rgba(8, 19, 31, 0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(248, 246, 241, 0.08);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.mega-menu-inner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.mega-category {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mega-category-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(248, 246, 241, 0.06);
}

.mega-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mega-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.2s ease;
  cursor: pointer;
}

.mega-item:hover {
  background: rgba(248, 246, 241, 0.05);
}

.mega-item-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mega-item-disabled:hover {
  background: transparent;
}

.mega-item-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.mega-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mega-item-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(248, 246, 241, 0.85);
  display: flex;
  align-items: center;
  gap: 6px;
}

.mega-item-badge {
  font-size: 0.6rem;
  font-weight: 600;
  color: rgba(201, 168, 108, 0.8);
  background: rgba(201, 168, 108, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.mega-item-desc {
  font-size: 0.72rem;
  color: rgba(248, 246, 241, 0.35);
  line-height: 1.4;
}

/* 操作区 */
.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn {
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  padding: 8px 18px;
  font-family: inherit;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(248, 246, 241, 0.15);
  color: rgba(248, 246, 241, 0.7);
}

.btn-outline:hover {
  border-color: rgba(248, 246, 241, 0.3);
  color: #F8F6F1;
}

.btn-primary {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  font-weight: 600;
}

.btn-primary:hover {
  box-shadow: 0 4px 16px rgba(201, 168, 108, 0.25);
}

.btn-sm {
  padding: 7px 16px;
  font-size: 0.8rem;
}

.btn-full {
  width: 100%;
  justify-content: center;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* MEMBER-CENTER-02 用户头像入口 */
.user-menu-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 10px 3px 3px;
  border-radius: 20px;
  border: 1px solid rgba(248, 246, 241, 0.08);
  background: rgba(248, 246, 241, 0.03);
  text-decoration: none;
  transition: all 0.25s;
}
.user-menu-entry:hover {
  background: rgba(248, 246, 241, 0.07);
  border-color: rgba(201, 168, 108, 0.3);
}
.user-menu-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.85);
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-logout {
  background: transparent;
  border: 1px solid rgba(248, 246, 241, 0.12);
  color: rgba(248, 246, 241, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.8rem;
  padding: 7px 12px;
}

.btn-logout:hover {
  border-color: rgba(239, 68, 68, 0.5);
  color: #EF4444;
}

/* 移动端 */
.mobile-menu-btn {
  background: transparent;
  border: none;
  color: rgba(248, 246, 241, 0.7);
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
}

.mobile-menu {
  margin-top: 12px;
  padding: 16px;
  background: rgba(8, 19, 31, 0.95);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(248, 246, 241, 0.08);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-menu-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-category {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-category-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
  padding: 4px 0;
}

.mobile-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: rgba(248, 246, 241, 0.7);
  font-size: 0.85rem;
  transition: background 0.2s ease;
}

.mobile-item:hover {
  background: rgba(248, 246, 241, 0.05);
}

.mobile-item-disabled {
  opacity: 0.4;
}

.mobile-item-icon {
  font-size: 1.1rem;
}

.mobile-item-badge {
  font-size: 0.6rem;
  font-weight: 600;
  color: rgba(201, 168, 108, 0.8);
  background: rgba(201, 168, 108, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
}

/* 动画 */
.mega-fade-enter-active,
.mega-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.mega-fade-enter-from,
.mega-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

.mobile-slide-enter-active,
.mobile-slide-leave-active {
  transition: opacity 0.3s ease, max-height 0.3s ease;
  max-height: 600px;
  overflow: hidden;
}

.mobile-slide-enter-from,
.mobile-slide-leave-to {
  opacity: 0;
  max-height: 0;
}

/* 响应式 */
.hide-mobile {
  display: flex;
}

.hide-desktop {
  display: none;
}

@media (max-width: 768px) {
  .hide-mobile {
    display: none;
  }
  .hide-desktop {
    display: flex;
  }
  .kunlun-nav {
    padding: 10px 16px;
  }
  .logo-text {
    font-size: 0.9rem;
  }
}

@media (max-width: 1024px) {
  .mega-menu-panel {
    width: 90vw;
    max-width: 600px;
  }
  .mega-menu-inner {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
