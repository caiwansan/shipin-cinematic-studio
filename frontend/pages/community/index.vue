<template>
  <div class="community-page cn-page">
    <!-- 导航栏（中式浅色，与社区风格统一） -->
    <nav class="nav-bar">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">昆仑镜</span>
        </div>
        <div class="nav-links">
          <a href="/" class="nav-link">首页</a>
          <a href="/community" class="nav-link nav-link-active">社区</a>
        </div>
        <div class="nav-actions">
          <button v-if="!isLoggedIn" class="cn-ink-btn" @click="showLogin = true">登录</button>
          <button v-if="!isLoggedIn" class="cn-seal-btn" @click="showLogin = true; isRegisterMode = true">免费注册</button>
          <template v-else>
            <div class="nav-user-badge" @click="goMemberCenter" title="会员中心">
              <div class="nav-user-avatar" :class="`nav-user-avatar--${tierClass}`">
                {{ avatarChar }}
              </div>
              <span class="nav-tier-tag" :class="`nav-tier-tag--${tierClass}`">
                {{ tierLabel }}
              </span>
            </div>
          </template>
        </div>
      </div>
    </nav>

    <CommunityHero />

    <div class="page-content" itemscope itemtype="https://schema.org/WebPage">
      <!-- 分类 Tabs（中式书签） -->
      <nav class="category-tabs" aria-label="社区分类">
        <div class="tabs-scroll">
          <button
            :class="['tab-btn', !activeCategory && 'tab-active']"
            @click="activeCategory = ''"
          >
            全部
          </button>
          <button
            v-for="cat in categories"
            :key="cat.slug"
            :class="['tab-btn', activeCategory === cat.slug && 'tab-active']"
            @click="activeCategory = cat.slug"
          >
            {{ cat.icon || '#' }} {{ cat.name }}
          </button>
        </div>
        <NuxtLink to="/community/new" class="cn-seal-btn btn-post">✒ 发帖</NuxtLink>
      </nav>
      <div class="cn-huiwen page-huiwen" aria-hidden="true" />

      <div class="content-layout">
        <!-- 左侧：帖子列表 -->
        <div class="posts-section">
          <div v-if="loading" class="loading-state">
            <div class="spinner" />
            <p>加载中...</p>
          </div>

          <div v-else-if="posts.length === 0" class="empty-state">
            <p class="empty-icon">📭</p>
            <p>暂无帖子，来发布第一条吧！</p>
            <NuxtLink to="/community/new" class="cn-seal-btn">发布帖子</NuxtLink>
          </div>

          <div v-else class="posts-list">
            <CommunityPostCard v-for="post in posts" :key="post.id" :post="post" />
          </div>

          <!-- 分页（中式） -->
          <div v-if="pagination && pagination.totalPages > 1" class="pagination">
            <button
              :disabled="pagination.page <= 1"
              class="cn-ink-btn page-btn"
              @click="changePage(pagination.page - 1)"
            >
              上一页
            </button>
            <span class="page-info">{{ pagination.page }} / {{ pagination.totalPages }}</span>
            <button
              :disabled="pagination.page >= pagination.totalPages"
              class="cn-ink-btn page-btn"
              @click="changePage(pagination.page + 1)"
            >
              下一页
            </button>
          </div>
        </div>

        <!-- 右侧：侧边栏（匾额） -->
        <aside class="sidebar">
          <!-- 侧边栏：版主入口/申请（COMMUNITY-MODERATOR-01） -->
        <div class="sidebar-card cn-card mod-card">
          <div class="cn-plaque sidebar-title">社 区 管 理</div>
          <template v-if="isLoggedIn">
            <div v-if="modMe.authInvalid" class="mod-card-body">
              <p class="mod-card-tip mod-card-tip--warn">⚠️ 登录状态已失效（账号在其他设备登录或已过期），请重新登录后查看版主权限</p>
              <button class="cn-seal-btn btn-block" @click="goRelogin">重新登录</button>
            </div>
            <div v-else-if="modMe.isModerator" class="mod-card-body">
              <p class="mod-card-role">👑 {{ modMe.role === 'co_moderator' ? '副版主' : '版主' }}</p>
              <NuxtLink to="/community/manage" class="cn-seal-btn btn-block">进入管理面板</NuxtLink>
            </div>
            <div v-else class="mod-card-body">
              <p v-if="modMe.status === 'pending'" class="mod-card-tip">⏳ 版主申请审核中，请耐心等待</p>
              <p v-else-if="modMe.status === 'rejected'" class="mod-card-tip">😔 申请未通过，可重新申请</p>
              <p v-else-if="modMe.status === 'removed'" class="mod-card-tip">已卸任，暂不能申请</p>
              <p v-else class="mod-card-tip">会员可申请成为版主，管理帖子审核、加精、置顶、删帖</p>
              <button v-if="modMe.status !== 'pending' && modMe.status !== 'removed'" class="cn-ink-btn btn-block" @click="applyModerator">
                {{ modMe.status === 'rejected' ? '重新申请版主' : '申请成为版主' }}
              </button>
            </div>
          </template>
          <div v-else class="mod-card-body">
            <p class="mod-card-tip">登录后可申请成为版主，管理帖子审核、加精、置顶、删帖</p>
            <button class="cn-ink-btn btn-block" @click="showLogin = true">登录后申请</button>
          </div>
        </div>

        <!-- 版主列表 -->
        <div v-if="moderators.length > 0" class="sidebar-card cn-card">
          <div class="cn-plaque sidebar-title">版 主 团 队</div>
          <div v-for="m in moderators" :key="m.userId" class="moderator-item">
            <span class="moderator-avatar">{{ (m.nickname || 'U').charAt(0) }}</span>
            <span class="moderator-name">{{ m.nickname }}</span>
            <span class="moderator-role" :class="m.role === 'co_moderator' ? 'moderator-role--co' : ''">
              {{ m.role === 'co_moderator' ? '副版主' : '版主' }}
            </span>
          </div>
        </div>

        <!-- 置顶帖 -->
          <div v-if="sidebar.pinned.length > 0" class="sidebar-card cn-card">
            <div class="cn-plaque sidebar-title">置 顶</div>
            <NuxtLink
              v-for="p in sidebar.pinned"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">{{ p.commentCount }} 💬</span>
            </NuxtLink>
          </div>

          <!-- 精华帖 -->
          <div v-if="sidebar.essence.length > 0" class="sidebar-card cn-card">
            <div class="cn-plaque sidebar-title">精 华</div>
            <NuxtLink
              v-for="p in sidebar.essence"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">{{ p.commentCount }} 💬</span>
            </NuxtLink>
          </div>

          <!-- 热门帖 -->
          <div v-if="sidebar.hot.length > 0" class="sidebar-card cn-card">
            <div class="cn-plaque sidebar-title">热 门</div>
            <NuxtLink
              v-for="p in sidebar.hot"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">{{ p.viewCount }} 👁️</span>
            </NuxtLink>
          </div>
        </aside>
      </div>
    </div>
  </div>

  <!-- 登录/注册弹窗（中式） -->
  <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
    <div class="modal-card">
      <button class="modal-close" @click="showLogin = false">✕</button>

      <div class="modal-header">
        <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="modal-logo-img" /></span>
        <h2>{{ isRegisterMode ? '创建账号' : '登录昆仑镜' }}</h2>
        <p>{{ isRegisterMode ? '开启 AI 影视制作之旅' : '回到你的工作空间' }}</p>
      </div>

      <!-- 登录/注册 Tab -->
      <div class="modal-tabs">
        <button :class="['tab-btn', !isRegisterMode && 'tab-active']" @click="isRegisterMode = false">登录</button>
        <button :class="['tab-btn', isRegisterMode && 'tab-active']" @click="isRegisterMode = true">注册</button>
      </div>

      <form @submit.prevent="doAuth" class="modal-form">
        <div v-if="isRegisterMode" class="form-group">
          <label>用户名</label>
          <input v-model="authName" type="text" placeholder="输入用户名" class="form-input" />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="authEmail" type="email" placeholder="your@email.com" class="form-input" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="authPassword" type="password" placeholder="至少 6 位" class="form-input" />
        </div>

        <p v-if="authError" class="form-error">{{ authError }}</p>
        <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>

        <button type="submit" class="cn-seal-btn btn-full" :disabled="authLoading">
          {{ authLoading ? '处理中...' : (isRegisterMode ? '注册并进入' : '登录') }}
        </button>
      </form>

      <!-- 微信登录分隔线 -->
      <div class="wechat-divider">
        <span class="divider-line"></span>
        <span class="divider-text">其他登录方式</span>
        <span class="divider-line"></span>
      </div>
      <button type="button" class="btn-wechat" @click="wechatLogin" :disabled="wechatLoading">
        <span class="wechat-icon">💬</span>
        <span>{{ wechatLoading ? '跳转中...' : (wechatStatus.enabled ? '微信扫码登录' : '微信登录暂未开放') }}</span>
      </button>
      <button type="button" class="btn-qq" @click="qqLogin" :disabled="qqLoading">
        <span class="wechat-icon">🐧</span>
        <span>{{ qqLoading ? '跳转中...' : (qqStatus.enabled ? 'QQ扫码登录' : 'QQ登录暂未开放') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAsyncData } from '#app'

// SSR 端直连后端（/api/* 是外部 4002 服务，非 Nitro 内部路由）；客户端用相对路径走 nginx
const apiBase = import.meta.server ? (process.env.BACKEND_URL || 'http://127.0.0.1:4002') : ''

const router = useRouter()
const isBrowser = typeof window !== 'undefined'

interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  postCount: number
}

interface Post {
  id: string
  title: string
  content: string
  tags: string
  category: string
  viewCount: number
  likeCount: number
  commentCount: number
  giftCount?: number
  isPinned: boolean
  isEssence: boolean
  createdAt: string
  user?: { id: string; username: string }
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const activeCategory = ref('')
const currentPage = ref(1)

// ─── SSR 数据获取 ───
const { data: categoriesData } = await useAsyncData('community-categories', async () => {
  const res = await $fetch(`${apiBase}/api/community/categories`)
  return (res.categories || []) as Category[]
})

const { data: postsData, refresh: refreshPosts } = await useAsyncData(
  'community-posts',
  async () => {
    const params = new URLSearchParams()
    params.set('page', String(currentPage.value))
    params.set('pageSize', '20')
    if (activeCategory.value) params.set('categorySlug', activeCategory.value)
    const res = await $fetch(`${apiBase}/api/community/posts?${params.toString()}`)
    return { posts: res.posts || [], pagination: res.pagination || null }
  },
  { lazy: false, watch: [currentPage, activeCategory] }
)

const { data: sidebarData } = await useAsyncData('community-sidebar', async () => {
  const res = await $fetch(`${apiBase}/api/community/sidebar`)
  return { pinned: res.pinned || [], essence: res.essence || [], hot: res.hot || [] }
})

const categories = computed(() => categoriesData.value || [])
const posts = computed(() => postsData.value?.posts || [])
const pagination = computed(() => postsData.value?.pagination || null)
const sidebar = computed(() => sidebarData.value || { pinned: [], essence: [], hot: [] })
const loading = computed(() => postsData.value === null)

// ─── 动态 Meta ───
useHead({
  title: '昆仑镜社区 - AI 短剧制作交流平台',
  meta: [
    { name: 'description', content: '昆仑镜社区是 AI 短剧制作者的交流聚集地，分享创作经验、讨论技术问题、发现行业趋势。' },
    { property: 'og:title', content: '昆仑镜社区 - AI 短剧制作交流平台' },
    { property: 'og:description', content: '昆仑镜社区是 AI 短剧制作者的交流聚集地，分享创作经验、讨论技术问题、发现行业趋势。' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://aigc.fushtn.com/community' },
    { property: 'og:image', content: 'https://aigc.fushtn.com/logo.png' },
    { property: 'og:site_name', content: '昆仑镜' },
  ],
  link: [
    { rel: 'canonical', href: 'https://aigc.fushtn.com/community' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '昆仑镜社区',
        description: '昆仑镜社区是 AI 短剧制作者的交流聚集地',
        url: 'https://aigc.fushtn.com/community',
        publisher: {
          '@type': 'Organization',
          name: '昆仑镜',
          logo: {
            '@type': 'ImageObject',
            url: 'https://aigc.fushtn.com/logo.png',
          },
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://aigc.fushtn.com/community?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      }),
    },
    // GEO-REVIEW-01: ItemList — 让 AI 能直接枚举社区已发布内容（检索/推荐的数据源）
    ...(postsData.value?.posts?.length
      ? [{
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: '昆仑镜社区最新帖子',
            numberOfItems: postsData.value.posts.length,
            itemListElement: postsData.value.posts.slice(0, 20).map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.title || '',
              url: `https://aigc.fushtn.com/community/post/${p.id}`,
            })),
          }),
        }]
      : []),
  ],
})

// --- 登录状态（与首页同步） ---
const isLoggedIn = ref(false)
const isRegisterMode = ref(false)
const showLogin = ref(false)
const authUser = ref<any>(null)

const tierClass = computed(() => {
  const coins = authUser.value?.coins ?? 0
  if (coins >= 10000) return 'ultra'
  if (coins >= 5000) return 'flagship'
  if (coins >= 1000) return 'premium'
  if (coins >= 500) return 'standard'
  return 'basic'
})
const tierLabel = computed(() => {
  const map: Record<string, string> = { ultra: '至尊', flagship: '旗舰', premium: '高级', standard: '标准', basic: '基础' }
  return map[tierClass.value] || '基础'
})
const avatarChar = computed(() => {
  return (authUser.value?.username || authUser.value?.email || 'U').charAt(0).toUpperCase()
})

function goMemberCenter() {
  router.push('/user/center')
}

function changePage(page: number) {
  currentPage.value = page
  if (isBrowser) window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(activeCategory, () => {
  currentPage.value = 1
})

onMounted(() => {
  const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
  isLoggedIn.value = !!token
  const authUserRaw = localStorage.getItem('auth_user')
  if (authUserRaw) {
    try { authUser.value = JSON.parse(authUserRaw) } catch {}
  }
  loadModerators()
  if (token) loadModMe()
  startModPolling()
})

onBeforeUnmount(() => {
  stopModPolling()
})

// ─── 版主体系（COMMUNITY-MODERATOR-01）───
const modMe = ref<any>({ isModerator: false, status: null })
const moderators = ref<any[]>([])
const applyMsg = ref('')

async function loadModerators() {
  try {
    const res = await fetch(`${apiBase}/api/community/moderators`)
    const data = await res.json()
    moderators.value = data.moderators || []
  } catch {}
}

async function loadModMe() {
  const token = getAuthTokenLocal()
  if (!token) return
  try {
    const res = await fetch(`${apiBase}/api/community/moderator/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) {
      modMe.value = data
      return
    }
    // 401 = token 失效/被其他设备顶掉（单设备机制）——不再静默降级成「申请成为版主」
    if (res.status === 401) {
      modMe.value = { ...modMe.value, authInvalid: true }
    }
  } catch {}
}

// 版主状态轮询：站长批准后无需手动刷新，入口自动出现（MODERATOR-UX-01）
let modPollTimer: ReturnType<typeof setInterval> | null = null
function startModPolling() {
  if (modPollTimer) return
  modPollTimer = setInterval(() => {
    const token = getAuthTokenLocal()
    if (!token) { stopModPolling(); return }
    loadModMe()
  }, 30000)
}
function stopModPolling() {
  if (modPollTimer) { clearInterval(modPollTimer); modPollTimer = null }
}

function goRelogin() {
  showLogin.value = true
}

function getAuthTokenLocal(): string {
  try {
    const { getToken } = require("~/utils/token-cache") as typeof import("~/utils/token-cache")
    return getToken()
  } catch { return '' }
}

async function applyModerator() {
  const token = getAuthTokenLocal()
  if (!token) { showLogin.value = true; return }
  const note = prompt('自荐说明（选填，200字内）：')
  if (note === null) return
  try {
    const res = await fetch(`${apiBase}/api/community/moderator/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note }),
    })
    const data = await res.json()
    if (res.ok) {
      modMe.value = { ...modMe.value, status: 'pending' }
      applyMsg.value = '申请已提交，请等待站长审批'
      alert(applyMsg.value)
    } else {
      alert(data.error || '申请失败')
    }
  } catch { alert('网络异常，请稍后重试') }
}

// ─── 登录相关 ───
const authName = ref('')
const authEmail = ref('')
const authPassword = ref('')
const authLoading = ref(false)
const authError = ref('')
const authSuccess = ref('')
const wechatLoading = ref(false)
const wechatStatus = ref({ enabled: false, appId: '' })
const qqLoading = ref(false)
const qqStatus = ref({ enabled: false, appId: '' })

let oauthListener: ((e: MessageEvent) => void) | null = null

function startOAuth(authUrl: string, onSuccess: (token: string, user: any) => void, onError: (err: string) => void) {
  const w = window.open(authUrl, '_blank', 'width=600,height=700')
  if (!w) { window.location.href = authUrl; return }
  if (oauthListener) { window.removeEventListener('message', oauthListener) }
  oauthListener = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'OAUTH_LOGIN') { onSuccess(e.data.token, e.data.user); window.removeEventListener('message', oauthListener!); oauthListener = null }
    else if (e.data?.type === 'OAUTH_ERROR') { onError(e.data.error); window.removeEventListener('message', oauthListener!); oauthListener = null }
  }
  window.addEventListener('message', oauthListener)
  const pollClose = setInterval(() => {
    if (w.closed) { clearInterval(pollClose); if (oauthListener) { window.removeEventListener('message', oauthListener); oauthListener = null; qqLoading.value = false; wechatLoading.value = false } }
  }, 1000)
}

function qqLogin() {
  if (!qqStatus.value.enabled) return
  qqLoading.value = true; authError.value = ''
  fetch('/api/auth/qq/authorize').then(r => r.json()).then(data => {
    const authUrl = data.data?.authUrl || data.authUrl
    if (authUrl) {
      startOAuth(authUrl, (token, user) => {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        setUser(user)
        isLoggedIn.value = true; showLogin.value = false; qqLoading.value = false
        const raw = localStorage.getItem('auth_user')
        if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
      }, (err) => { authError.value = err; qqLoading.value = false })
      qqLoading.value = false
    } else { authError.value = data.error || 'QQ登录启动失败'; qqLoading.value = false }
  }).catch(() => { authError.value = 'QQ登录暂时不可用'; qqLoading.value = false })
}

function wechatLogin() {
  if (!wechatStatus.value.enabled) return
  wechatLoading.value = true; authError.value = ''
  fetch('/api/auth/wechat/authorize').then(r => r.json()).then(data => {
    const authUrl = data.data?.authUrl || data.authUrl
    if (authUrl) {
      startOAuth(authUrl, (token, user) => {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        setUser(user)
        isLoggedIn.value = true; showLogin.value = false; wechatLoading.value = false
        const raw = localStorage.getItem('auth_user')
        if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
      }, (err) => { authError.value = err; wechatLoading.value = false })
      wechatLoading.value = false
    } else { authError.value = data.error || '微信登录启动失败'; wechatLoading.value = false }
  }).catch(() => { authError.value = '微信登录暂时不可用'; wechatLoading.value = false })
}

async function doAuth() {
  authError.value = ''; authSuccess.value = ''
  if (!authEmail.value || !authPassword.value) { authError.value = '请输入邮箱和密码'; return }
  if (isRegisterMode.value && !authName.value.trim()) { authError.value = '请输入用户名'; return }
  authLoading.value = true
  try {
    if (isRegisterMode.value) {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: authName.value, email: authEmail.value, password: authPassword.value, code: '' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      const token = data.accessToken || data.token
      if (token) {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) { setUser(data.user) }
        isLoggedIn.value = true; showLogin.value = false; authSuccess.value = '注册成功！'
      }
    } else {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail.value, password: authPassword.value }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      const token = data.accessToken || data.token
      if (token) {
        const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
        setToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) { setUser(data.user) }
        isLoggedIn.value = true; showLogin.value = false
        const raw = localStorage.getItem('auth_user')
        if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
      }
    }
  } catch (e: any) { authError.value = e.message || '网络错误' }
  finally { authLoading.value = false }
}

// 检查第三方登录配置状态
fetch('/api/auth/qq/status').then(r => r.json()).then(d => { if (d.data) qqStatus.value = d.data }).catch(() => {})
fetch('/api/auth/wechat/status').then(r => r.json()).then(d => { if (d.data) wechatStatus.value = d.data }).catch(() => {})
</script>

<style scoped>
.community-page {
  min-height: 100vh;
  font-family: var(--cn-body);
}

/* === 导航栏（中式浅色） === */
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(251, 248, 239, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(38, 84, 124, 0.14);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6) inset;
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 32px;
}
.nav-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-logo-img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}
.logo-text {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--cn-cobalt-deep);
  font-family: var(--cn-serif);
  letter-spacing: 2px;
}
.nav-links {
  display: flex;
  gap: 24px;
  flex: 1;
}
.nav-link {
  color: var(--cn-ink-soft);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.2s;
  font-family: var(--cn-serif);
  letter-spacing: 1px;
}
.nav-link:hover, .nav-link-active {
  color: var(--cn-cobalt-deep);
  font-weight: 600;
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nav-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}
.nav-user-badge:hover {
  background: rgba(38, 84, 124, 0.06);
}
.nav-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
}
.nav-user-avatar--basic { background: #8a8578; }
.nav-user-avatar--standard { background: #3f7fa3; }
.nav-user-avatar--premium { background: #6d5ba6; }
.nav-user-avatar--flagship { background: #b07f2e; }
.nav-user-avatar--ultra { background: linear-gradient(135deg, #b03a2e, #c9732a); }
.nav-tier-tag {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.nav-tier-tag--basic { background: rgba(138,133,120,0.14); color: #8a8578; }
.nav-tier-tag--standard { background: rgba(63,127,163,0.14); color: #3f7fa3; }
.nav-tier-tag--premium { background: rgba(109,91,166,0.14); color: #6d5ba6; }
.nav-tier-tag--flagship { background: rgba(176,127,46,0.14); color: #a87a2c; }
.nav-tier-tag--ultra { background: rgba(176,58,46,0.14); color: #b03a2e; }

.page-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px 60px;
}

/* Category Tabs（中式书签） */
.category-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 26px 0 14px;
}
.tabs-scroll {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}
.tab-btn {
  padding: 6px 16px;
  border-radius: 3px;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(38, 84, 124, 0.22);
  background: transparent;
  color: var(--cn-ink-soft);
  font-family: var(--cn-serif);
  letter-spacing: 1px;
  transition: all 0.2s;
}
.tab-btn:hover {
  border-color: var(--cn-cobalt);
  color: var(--cn-cobalt-deep);
  background: rgba(95, 168, 190, 0.08);
}
.tab-active {
  background: var(--cn-cobalt-deep);
  border-color: var(--cn-cobalt-deep);
  color: #F6F1E3;
  box-shadow: 0 2px 8px rgba(22, 58, 92, 0.25);
}
.btn-post {
  flex-shrink: 0;
}
.page-huiwen {
  margin-bottom: 22px;
}

/* Posts */
.posts-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Loading & Empty */
.loading-state, .empty-state {
  text-align: center;
  padding: 60px 0;
  color: var(--cn-ink-faint);
  font-family: var(--cn-serif);
}
.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(38, 84, 124, 0.12);
  border-top-color: var(--cn-celadon-deep);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 36px;
}
.page-btn {
  font-size: 0.8rem;
}
.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.page-info {
  font-size: 0.82rem;
  color: var(--cn-ink-soft);
  font-family: var(--cn-serif);
  letter-spacing: 2px;
}

/* 左右布局 */
.content-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.posts-section {
  flex: 3;
  min-width: 0;
}

/* 侧边栏（匾额） */
.sidebar {
  flex: 1;
  min-width: 220px;
  max-width: 300px;
  position: sticky;
  top: 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sidebar-card {
  padding: 16px 18px 12px;
}
.sidebar-title {
  font-size: 0.92rem;
}
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  text-decoration: none;
  border-bottom: 1px dashed rgba(38, 84, 124, 0.12);
}
.sidebar-link:last-child { border-bottom: none; }
.sidebar-link-text {
  flex: 1;
  font-size: 0.78rem;
  color: var(--cn-ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
  font-family: var(--cn-serif);
}
.sidebar-link:hover .sidebar-link-text { color: var(--cn-cobalt); }
.sidebar-link-meta {
  font-size: 0.65rem;
  color: var(--cn-ink-faint);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .nav-links { display: none; }
  .content-layout { flex-direction: column; }
  .sidebar { width: 100%; position: static; }
  .category-tabs { flex-wrap: wrap; }
  .btn-post { width: 100%; justify-content: center; }
}

/* ─── 登录弹窗（中式） ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(22, 38, 46, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-card {
  background: var(--cn-paper-card);
  border: 1px solid rgba(38, 84, 124, 0.35);
  border-radius: 8px;
  box-shadow: inset 0 0 0 3px rgba(246, 241, 227, 0.9), inset 0 0 0 4px rgba(38, 84, 124, 0.12), 0 18px 50px rgba(22, 38, 46, 0.3);
  padding: 32px 28px 28px;
  width: 400px;
  max-width: 92vw;
  position: relative;
  animation: modalIn 0.2s ease;
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.modal-close {
  position: absolute;
  top: 14px; right: 16px;
  background: none; border: none;
  color: var(--cn-ink-faint);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.modal-close:hover { color: var(--cn-cinnabar); }
.modal-header { text-align: center; margin-bottom: 24px; }
.modal-header .logo-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.modal-logo-img { width: 48px; height: 48px; border-radius: 8px; }
.modal-header h2 { font-size: 1.2rem; font-weight: 700; color: var(--cn-cobalt-deep); font-family: var(--cn-serif); letter-spacing: 2px; margin: 0 0 6px; }
.modal-header p { font-size: 0.8rem; color: var(--cn-ink-faint); margin: 0; }
.modal-tabs {
  display: flex;
  background: rgba(38, 84, 124, 0.06);
  border-radius: 6px;
  padding: 3px;
  margin-bottom: 24px;
}
.modal-tabs .tab-btn {
  flex: 1;
  padding: 8px;
  background: none;
  border: none;
  color: var(--cn-ink-soft);
  font-size: 0.85rem;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--cn-serif);
  letter-spacing: 2px;
}
.modal-tabs .tab-btn.tab-active {
  background: var(--cn-cobalt-deep);
  color: #F6F1E3;
  font-weight: 600;
}
.modal-form .form-group { margin-bottom: 16px; }
.modal-form label { display: block; font-size: 0.75rem; color: var(--cn-ink-soft); margin-bottom: 6px; font-family: var(--cn-serif); letter-spacing: 1px; }
.modal-form .form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 5px;
  background: rgba(246, 241, 227, 0.7);
  border: 1px solid rgba(38, 84, 124, 0.25);
  color: var(--cn-ink);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.modal-form .form-input:focus { border-color: var(--cn-celadon-deep); box-shadow: 0 0 0 3px rgba(95, 168, 190, 0.15); }
.form-error { color: var(--cn-cinnabar); font-size: 0.78rem; margin: 0 0 12px; }
.form-success { color: #3e7f63; font-size: 0.78rem; margin: 0 0 12px; }
.btn-full { width: 100%; padding: 10px; font-size: 0.9rem; justify-content: center; margin-top: 8px; }
@media (max-width: 480px) {
  .modal-card { width: 90%; margin: 0 16px; }
}
.wechat-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 14px;
}
.divider-line { flex: 1; height: 1px; background: rgba(38, 84, 124, 0.14); }
.divider-text { font-size: 0.72rem; color: var(--cn-ink-faint); white-space: nowrap; font-family: var(--cn-serif); letter-spacing: 1px; }
.btn-wechat, .btn-qq {
  width: 100%;
  padding: 10px;
  border: 1px solid rgba(38, 84, 124, 0.2);
  border-radius: 5px;
  background: rgba(246, 241, 227, 0.6);
  color: var(--cn-ink-soft);
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 8px;
  transition: all 0.2s;
}
.btn-wechat:hover:not(:disabled), .btn-qq:hover:not(:disabled) {
  background: rgba(95, 168, 190, 0.1);
  border-color: var(--cn-cobalt);
}
.btn-wechat:disabled, .btn-qq:disabled { opacity: 0.4; cursor: not-allowed; }
.wechat-icon { font-size: 1.1rem; }
.mod-card-body { padding: 10px 4px 4px; }
.mod-card-tip { font-size: 12px; color: var(--cn-ink-soft); margin: 0 0 10px; line-height: 1.6; }
.mod-card-tip--warn { color: #c0392b; }
.mod-card-role { font-size: 14px; color: var(--cn-cobalt); font-weight: 600; margin: 0 0 10px; }
.btn-block { width: 100%; text-align: center; }
.moderator-item { display: flex; align-items: center; gap: 8px; padding: 7px 2px; }
.moderator-avatar { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, var(--cn-cobalt-soft), rgba(95, 168, 190, 0.35)); color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.moderator-name { font-size: 13px; color: var(--cn-ink); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moderator-role { font-size: 10px; padding: 1px 8px; border-radius: 999px; background: rgba(200, 160, 40, 0.15); color: #9a7b1a; }
.moderator-role--co { background: rgba(95, 168, 190, 0.15); color: var(--cn-cobalt); }
</style>
