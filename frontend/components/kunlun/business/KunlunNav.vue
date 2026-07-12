<template>
  <nav ref="navRef" class="kunlun-nav" :class="{ 'nav-scrolled': scrolled }">
    <div class="nav-inner">
      <!-- Logo -->
      <NuxtLink to="/" class="nav-logo">
        <span class="logo-icon">
          <img src="/logo.png" alt="昆仑镜" class="nav-logo-img" />
        </span>
        <span class="logo-text">昆仑镜</span>
      </NuxtLink>

      <!-- 导航链接 -->
      <div class="nav-links hide-mobile">
        <NuxtLink to="/studio/v2" class="nav-link">
          🎬 短剧工作台
        </NuxtLink>
        <NuxtLink to="/hdz" class="nav-link">
          📖 小说工作台
        </NuxtLink>
        <NuxtLink to="/mall" class="nav-link nav-link-mall">
          🛍️ 商城
        </NuxtLink>
        <NuxtLink to="/workspace/legal" class="nav-link nav-link-legal">
          ⚖️ 法律工作台
        </NuxtLink>
        <a href="/ppt/" class="nav-link nav-link-ppt">
          🍌 潇湘子 PPT
        </a>
        <NuxtLink to="/workspace/geo/dashboard" class="nav-link nav-link-geo">
          🌏 品牌GEO
        </NuxtLink>
        <NuxtLink to="/community" class="nav-link">
          🌐 社区
        </NuxtLink>
        <!-- @deprecated 生活助手 — V4.2 业务废弃，入口已隐藏，保留代码可恢复 -->
        <!-- <NuxtLink to="/p0/life-assistant" class="nav-link nav-link-p0">
          🪞 生活助手
        </NuxtLink> -->
      </div>

      <!-- 操作区 -->
      <div class="nav-actions">
        <template v-if="!isLoggedIn">
          <button class="btn btn-outline btn-sm" @click="$emit('showLogin')">
            登录
          </button>
          <button class="btn btn-primary btn-sm" @click="$emit('showRegister')">
            免费注册
          </button>
        </template>
        <template v-else>
          <div class="user-menu">
            <NuxtLink
              to="/user/center"
              class="btn btn-primary btn-sm"
            >
              进入会员中心 →
            </NuxtLink>
            <button class="btn btn-logout btn-sm" @click="handleLogout">
              退出
            </button>
          </div>
        </template>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
/**
 * KunlunNav — 昆仑镜首页导航栏
 *
 * 层级：L4 business
 * 用途：全局导航，含登录/注册按钮和工作台入口。
 */

defineProps<{
  isLoggedIn: boolean
}>()

defineEmits<{
  showLogin: []
  showRegister: []
  logout: []
}>()

function handleLogout() {
  // 统一清除所有 token 缓存
  ;['accessToken', 'auth_token', 'auth_user', 'token', 'refreshToken'].forEach(k => {
    try { localStorage.removeItem(k) } catch {}
  })
  ;['auth_token', 'auth_user', 'token', 'accessToken', 'refreshToken'].forEach(k => {
    document.cookie = `${k}=; path=/; max-age=0; samesite=lax`
  })
  try { sessionStorage.clear() } catch {}
  window.location.href = '/?logout=1'
}

const navRef = ref<HTMLElement | null>(null)
const scrolled = ref(false)

onMounted(() => {
  const handleScroll = () => {
    scrolled.value = window.scrollY > 50
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', handleScroll))
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

/* 导航链接 */
.nav-links {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-link {
  font-size: 0.85rem;
  color: rgba(248, 246, 241, 0.6);
  text-decoration: none;
  transition: color 0.3s ease;
}

.nav-link:hover {
  color: rgba(248, 246, 241, 0.9);
}

.nav-link-ppt {
  color: rgba(167, 139, 250, 0.7);
}

.nav-link-mall {
  color: rgba(251, 191, 36, 0.8);
}

.nav-link-legal {
  color: rgba(52, 211, 153, 0.8);
}

.nav-link-p0 {
  color: rgba(201, 168, 108, 0.7);
}

.nav-link-geo {
  color: rgba(129, 140, 248, 0.7);
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
  transition:
    background 0.3s ease,
    color 0.3s ease,
    border-color 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  padding: 8px 18px;
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

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
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

@media (max-width: 768px) {
  .hide-mobile {
    display: none;
  }
}
</style>
