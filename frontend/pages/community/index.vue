<template>
  <div class="community-page cn-page">
    <!-- ═══════════════════════════════════════════════════════════
         导航栏（全息玻璃）
         ═══════════════════════════════════════════════════════════ -->
    <nav class="nav-bar">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">昆仑镜</span>
          <span class="logo-version">v2.0</span>
        </div>
        <div class="nav-links">
          <a href="/" class="nav-link">首页</a>
          <a href="/community" class="nav-link nav-link-active">社区</a>
        </div>
        <div class="nav-actions">
          <button v-if="!isLoggedIn" class="cn-ink-btn" @click="showLogin = true">登录</button>
          <button v-if="!isLoggedIn" class="cn-seal-btn nav-cta-btn" @click="showLogin = true; isRegisterMode = true">注 册</button>
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

    <!-- Hero -->
    <CommunityHero />

    <!-- ═══════════════════════════════════════════════════════════
         主内容
         ═══════════════════════════════════════════════════════════ -->
    <div class="page-content" itemscope itemtype="https://schema.org/WebPage">
      <!-- 操作栏：分类 + 排序 + 搜索 + 发帖 -->
      <nav class="category-tabs" aria-label="社区分类">
        <div class="tabs-scroll">
          <button
            :class="['tab-btn', !activeCategory && 'tab-active']"
            @click="activeCategory = ''; syncCategoryUrl('')"
          >
            全部
          </button>
          <button
            v-for="cat in categories"
            :key="cat.slug"
            :class="['tab-btn', activeCategory === cat.slug && 'tab-active']"
            @click="activeCategory = cat.slug; syncCategoryUrl(cat.slug)"
          >
            {{ cat.icon || '#' }} {{ cat.name }}
          </button>
        </div>

        <!-- 排序切换 -->
        <div class="sort-switch" role="tablist" aria-label="排序方式">
          <button
            :class="['sort-btn', sortMode === 'latest' && 'sort-btn-on']"
            @click="syncSortUrl('latest')"
          >
            🕐 最新
          </button>
          <button
            :class="['sort-btn', sortMode === 'hot' && 'sort-btn-on']"
            @click="syncSortUrl('hot')"
          >
            🔥 热门
          </button>
          <button
            :class="['sort-btn', sortMode === 'best' && 'sort-btn-on']"
            @click="syncSortUrl('best')"
          >
            🏆 精选
          </button>
        </div>

        <!-- 搜索框 -->
        <div class="search-box">
          <span class="search-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          <input
            v-model.trim="searchInput"
            type="search"
            placeholder="搜索..."
            class="search-input"
            aria-label="搜索社区文章"
            @keyup.enter="doSearch"
          />
        </div>

        <NuxtLink to="/community/new" class="cn-seal-btn btn-post">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          发帖
        </NuxtLink>
      </nav>

      <!-- 分隔线 -->
      <div class="cn-huiwen page-huiwen" aria-hidden="true" />

      <div class="content-layout">
        <!-- 左侧：帖子列表 -->
        <div class="posts-section">
          <div v-if="loading" class="loading-state">
            <div class="spinner" />
            <p>LOADING DATA...</p>
          </div>

          <div v-else-if="posts.length === 0" class="empty-state">
            <div class="empty-icon">◈</div>
            <p v-if="searchKeyword">NO RESULTS FOR 「{{ searchKeyword }}」</p>
            <p v-else>EMPTY — BE THE FIRST TO POST</p>
            <button v-if="searchKeyword" class="cn-ink-btn" @click="clearSearch">CLEAR</button>
            <NuxtLink v-else to="/community/new" class="cn-seal-btn">发布帖子</NuxtLink>
          </div>

          <div v-else class="posts-list">
            <CommunityPostCard v-for="post in posts" :key="post.id" :post="post" />
          </div>

          <!-- 分页 -->
          <div v-if="pagination && pagination.totalPages > 1" class="pagination">
            <button
              :disabled="pagination.page <= 1"
              class="cn-ink-btn page-btn"
              @click="changePage(pagination.page - 1)"
            >
              ← PREV
            </button>
            <span class="page-info">
              <span class="page-current">{{ pagination.page }}</span>
              <span class="page-divider">/</span>
              <span class="page-total">{{ pagination.totalPages }}</span>
            </span>
            <button
              :disabled="pagination.page >= pagination.totalPages"
              class="cn-ink-btn page-btn"
              @click="changePage(pagination.page + 1)"
            >
              NEXT →
            </button>
          </div>
        </div>

        <!-- 右侧：侧边栏 -->
        <aside class="sidebar">
          <!-- 社区管理 -->
          <div class="sidebar-card cn-card">
            <div class="cn-plaque sidebar-title">ADMIN</div>
            <template v-if="isLoggedIn">
              <div v-if="modMe.authInvalid" class="mod-card-body">
                <p class="mod-card-tip mod-card-tip--warn">⚠ SESSION EXPIRED</p>
                <button class="cn-seal-btn btn-block" @click="goRelogin">RE-LOGIN</button>
              </div>
              <div v-else-if="modMe.isModerator" class="mod-card-body">
                <p class="mod-card-role">👑 {{ modMe.role === 'co_moderator' ? 'CO-MOD' : 'MODERATOR' }}</p>
                <NuxtLink to="/community/manage" class="cn-seal-btn btn-block">OPEN PANEL</NuxtLink>
              </div>
              <div v-else class="mod-card-body">
                <p v-if="modMe.status === 'pending'" class="mod-card-tip">⏳ PENDING REVIEW</p>
                <p v-else-if="modMe.status === 'rejected'" class="mod-card-tip">✕ REJECTED — REAPPLY</p>
                <p v-else-if="modMe.status === 'removed'" class="mod-card-tip">DEACTIVATED</p>
                <p v-else class="mod-card-tip">MEMBERS CAN APPLY AS MODERATOR</p>
                <button v-if="modMe.status !== 'pending' && modMe.status !== 'removed'" class="cn-ink-btn btn-block" @click="applyModerator">
                  {{ modMe.status === 'rejected' ? 'REAPPLY' : 'APPLY' }}
                </button>
              </div>
            </template>
            <div v-else class="mod-card-body">
              <p class="mod-card-tip">LOGIN TO APPLY AS MODERATOR</p>
              <button class="cn-ink-btn btn-block" @click="showLogin = true">LOGIN</button>
            </div>
          </div>

          <!-- 版主列表 -->
          <div v-if="moderators.length > 0" class="sidebar-card cn-card">
            <div class="cn-plaque sidebar-title">MODERATORS</div>
            <div v-for="m in moderators" :key="m.userId" class="moderator-item">
              <span class="moderator-avatar">{{ (m.nickname || 'U').charAt(0) }}</span>
              <span class="moderator-name">{{ m.nickname }}</span>
              <span class="moderator-role" :class="m.role === 'co_moderator' ? 'moderator-role--co' : ''">
                {{ m.role === 'co_moderator' ? 'CO-MOD' : 'MOD' }}
              </span>
            </div>
          </div>

          <!-- 置顶帖 -->
          <div v-if="sidebar.pinned.length > 0" class="sidebar-card cn-card">
            <div class="cn-plaque sidebar-title">PINNED</div>
            <NuxtLink
              v-for="p in sidebar.pinned"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">💬 {{ p.commentCount }}</span>
            </NuxtLink>
          </div>

          <!-- 精华帖 -->
          <div v-if="sidebar.essence.length > 0" class="sidebar-card cn-card">
            <div class="cn-plaque sidebar-title">ESSENCE</div>
            <NuxtLink
              v-for="p in sidebar.essence"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">💬 {{ p.commentCount }}</span>
            </NuxtLink>
          </div>

          <!-- 热门帖 -->
          <div v-if="sidebar.hot.length > 0" class="sidebar-card cn-card">
            <div class="cn-plaque sidebar-title">TRENDING</div>
            <NuxtLink
              v-for="p in sidebar.hot"
              :key="p.id"
              :to="`/community/post/${p.id}`"
              class="sidebar-link"
            >
              <span class="sidebar-link-text">{{ p.title }}</span>
              <span class="sidebar-link-meta">👁 {{ p.viewCount }}</span>
            </NuxtLink>
          </div>
        </aside>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         登录/注册弹窗（全息玻璃）
         ═══════════════════════════════════════════════════════════ -->
    <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
      <div class="modal-card">
        <button class="modal-close" @click="showLogin = false">✕</button>

        <div class="modal-header">
          <span class="modal-logo-icon"><img src="/logo.png" alt="昆仑镜" class="modal-logo-img" /></span>
          <h2>{{ isRegisterMode ? 'CREATE ACCOUNT' : 'SIGN IN' }}</h2>
          <p>{{ isRegisterMode ? 'Join the creator network' : 'Access your workspace' }}</p>
        </div>

        <div class="modal-tabs">
          <button :class="['tab-btn', !isRegisterMode && 'tab-active']" @click="isRegisterMode = false">SIGN IN</button>
          <button :class="['tab-btn', isRegisterMode && 'tab-active']" @click="isRegisterMode = true">REGISTER</button>
        </div>

        <form @submit.prevent="doAuth" class="modal-form">
          <div v-if="isRegisterMode" class="form-group">
            <label>USERNAME</label>
            <input v-model="authName" type="text" placeholder="Enter username" class="form-input" />
          </div>
          <div class="form-group">
            <label>EMAIL</label>
            <input v-model="authEmail" type="email" placeholder="your@email.com" class="form-input" />
          </div>
          <div class="form-group">
            <label>PASSWORD</label>
            <input v-model="authPassword" type="password" placeholder="Min 6 characters" class="form-input" />
          </div>

          <p v-if="authError" class="form-error">{{ authError }}</p>
          <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>

          <button type="submit" class="cn-seal-btn btn-full" :disabled="authLoading">
            {{ authLoading ? 'PROCESSING...' : (isRegisterMode ? 'CREATE ACCOUNT' : 'SIGN IN') }}
          </button>
        </form>

        <!-- 第三方登录 -->
        <div class="wechat-divider">
          <span class="divider-line"></span>
          <span class="divider-text">OTHER METHODS</span>
          <span class="divider-line"></span>
        </div>
        <button type="button" class="btn-wechat" @click="wechatLogin" :disabled="wechatLoading || !wechatStatus.enabled">
          <span class="oauth-icon">💬</span>
          <span>{{ wechatLoading ? 'REDIRECTING...' : (wechatStatus.enabled ? 'WECHAT LOGIN' : 'WECHAT N/A') }}</span>
        </button>
        <button type="button" class="btn-qq" @click="qqLogin" :disabled="qqLoading || !qqStatus.enabled">
          <span class="oauth-icon">🐧</span>
          <span>{{ qqLoading ? 'REDIRECTING...' : (qqStatus.enabled ? 'QQ LOGIN' : 'QQ N/A') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoute, useAsyncData } from '#app'

const apiBase = import.meta.server ? (process.env.BACKEND_URL || 'http://127.0.0.1:4002') : ''

const router = useRouter()
const route = useRoute()
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

const activeCategory = ref((route.query.categorySlug as string) || '')
const currentPage = ref(Number(route.query.page) > 1 ? Number(route.query.page) : 1)
const sortMode = ref((route.query.sort as string) === 'hot' || (route.query.sort as string) === 'best' ? (route.query.sort as string) : 'latest')
const searchKeyword = ref((route.query.q as string) || '')
const searchInput = ref((route.query.q as string) || '')

function syncSortUrl(sort: string) {
  if (sort === sortMode.value) return
  sortMode.value = sort
  currentPage.value = 1
  if (!isBrowser) return
  const q: Record<string, string> = { ...(route.query as Record<string, string>) }
  if (sort === 'hot') q.sort = 'hot'
  else if (sort === 'best') q.sort = 'best'
  else delete q.sort
  delete q.page
  router.replace({ query: q })
}

function syncCategoryUrl(slug: string) {
  if (!isBrowser) return
  const q: Record<string, string> = { ...(route.query as Record<string, string>) }
  if (slug) q.categorySlug = slug
  else delete q.categorySlug
  delete q.page
  router.replace({ query: q })
}
function syncPageUrl(page: number) {
  if (!isBrowser) return
  const q: Record<string, string> = { ...(route.query as Record<string, string>) }
  if (page > 1) q.page = String(page)
  else delete q.page
  router.replace({ query: q })
}
function doSearch() {
  const kw = searchInput.value.trim()
  if (kw === searchKeyword.value) return
  searchKeyword.value = kw
  currentPage.value = 1
  if (!isBrowser) return
  const q: Record<string, string> = { ...(route.query as Record<string, string>) }
  if (kw) q.q = kw
  else delete q.q
  delete q.page
  router.replace({ query: q })
}
watch(
  () => route.query,
  (q) => {
    const cs = (q.categorySlug as string) || ''
    const pg = Number(q.page) > 1 ? Number(q.page) : 1
    const kw = (q.q as string) || ''
    const st = (q.sort as string) === 'hot' || (q.sort as string) === 'best' ? (q.sort as string) : 'latest'
    if (cs !== activeCategory.value) activeCategory.value = cs
    if (pg !== currentPage.value) currentPage.value = pg
    if (st !== sortMode.value) sortMode.value = st
    if (kw !== searchKeyword.value) {
      searchKeyword.value = kw
      searchInput.value = kw
    }
  }
)

// SSR 数据获取
const { data: categoriesData } = await useAsyncData('community-categories', async () => {
  const res = await $fetch(`${apiBase}/api/community/categories`)
  return (res.categories || []) as Category[]
})

const { data: postsData, refresh: refreshPosts } = await useAsyncData(
  'community-posts',
  async () => {
    const params = new URLSearchParams()
    params.set('page', String(currentPage.value))
    params.set('pageSize', '30')
    if (sortMode.value === 'hot') params.set('sort', 'hot')
    if (sortMode.value === 'best') params.set('sort', 'best')
    if (activeCategory.value) params.set('categorySlug', activeCategory.value)
    if (searchKeyword.value) params.set('search', searchKeyword.value)
    const res = await $fetch(`${apiBase}/api/community/posts?${params.toString()}`)
    return { posts: res.posts || [], pagination: res.pagination || null }
  },
  { lazy: false, watch: [currentPage, activeCategory, searchKeyword, sortMode] }
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

// SEO
const activeCategoryName = computed(() => {
  if (!activeCategory.value) return ''
  return categories.value.find((c: any) => c.slug === activeCategory.value)?.name || ''
})
const categoryTitle = computed(() =>
  activeCategoryName.value ? `${activeCategoryName.value} - 昆仑镜社区` : '昆仑镜社区 - AI 短剧制作交流平台'
)
const categoryDescription = computed(() =>
  activeCategoryName.value
    ? `昆仑镜社区「${activeCategoryName.value}」精选内容：${activeCategoryName.value}相关的教程、经验分享与技术问答。`
    : '昆仑镜社区是 AI 短剧制作者的交流聚集地，分享创作经验、讨论技术问题、发现行业趋势。'
)
const isPaginated = computed(() => currentPage.value > 1)
const canonicalUrl = computed(() =>
  activeCategory.value
    ? `https://aigc.fushtn.com/community?categorySlug=${activeCategory.value}`
    : 'https://aigc.fushtn.com/community'
)

useHead({
  title: categoryTitle,
  meta: [
    { name: 'description', content: categoryDescription },
    ...(isPaginated.value ? [{ name: 'robots', content: 'noindex, follow' }] : []),
    { property: 'og:title', content: categoryTitle },
    { property: 'og:description', content: categoryDescription },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: 'https://aigc.fushtn.com/og-cover.png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/png' },
    { property: 'og:site_name', content: '昆仑镜' },
  ],
  link: [
    { rel: 'canonical', href: canonicalUrl },
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
          logo: { '@type': 'ImageObject', url: 'https://aigc.fushtn.com/og-cover.png' },
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: 'https://aigc.fushtn.com/community?q={search_term_string}' },
          'query-input': 'required name=search_term_string',
        },
        sameAs: ['https://aigc.fushtn.com/', 'https://aigc.fushtn.com/about', 'https://aigc.fushtn.com/pricing', 'https://aigc.fushtn.com/community'],
      }),
    },
    ...(activeCategory.value
      ? [{
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: categoryTitle.value,
            description: categoryDescription.value,
            url: `https://aigc.fushtn.com/community?categorySlug=${activeCategory.value}`,
            isPartOf: { '@type': 'WebSite', name: '昆仑镜社区', url: 'https://aigc.fushtn.com/community' },
          }),
        }]
      : []),
    ...(postsData.value?.posts?.length
      ? [{
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: '昆仑镜社区最新帖子',
            numberOfItems: postsData.value.posts.length,
            itemListElement: postsData.value.posts.slice(0, 30).map((p, i) => ({
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

// 登录状态
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
  const map: Record<string, string> = { ultra: 'ULTRA', flagship: 'FLAGSHIP', premium: 'PREMIUM', standard: 'BASIC', basic: 'BASE' }
  return map[tierClass.value] || 'BASE'
})
const avatarChar = computed(() => {
  return (authUser.value?.username || authUser.value?.email || 'U').charAt(0).toUpperCase()
})

function goMemberCenter() { router.push('/user/center') }

function changePage(page: number) {
  currentPage.value = page
  syncPageUrl(page)
  if (isBrowser) window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(activeCategory, () => { currentPage.value = 1 })

function clearSearch() { searchInput.value = ''; doSearch() }

onMounted(() => {
  const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
  isLoggedIn.value = !!token
  const authUserRaw = localStorage.getItem('auth_user')
  if (authUserRaw) { try { authUser.value = JSON.parse(authUserRaw) } catch {} }
  loadModerators()
  if (token) loadModMe()
  startModPolling()
})

onBeforeUnmount(() => { stopModPolling() })

// 版主体系
const modMe = ref<any>({ isModerator: false, status: null })
const moderators = ref<any[]>([])
const applyMsg = ref('')

async function loadModerators() {
  try { const res = await fetch(`${apiBase}/api/community/moderators`); const data = await res.json(); moderators.value = data.moderators || [] } catch {}
}

async function loadModMe() {
  const token = getAuthTokenLocal()
  if (!token) return
  try {
    const res = await fetch(`${apiBase}/api/community/moderator/me`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (res.ok) { modMe.value = data; return }
    if (res.status === 401) { modMe.value = { ...modMe.value, authInvalid: true } }
  } catch {}
}

let modPollTimer: ReturnType<typeof setInterval> | null = null
function startModPolling() {
  if (modPollTimer) return
  modPollTimer = setInterval(() => { const token = getAuthTokenLocal(); if (!token) { stopModPolling(); return } loadModMe() }, 30000)
}
function stopModPolling() { if (modPollTimer) { clearInterval(modPollTimer); modPollTimer = null } }

function goRelogin() { showLogin.value = true }

function getAuthTokenLocal(): string {
  try { const { getToken } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); return getToken() } catch { return '' }
}

async function applyModerator() {
  const token = getAuthTokenLocal()
  if (!token) { showLogin.value = true; return }
  const note = prompt('自荐说明（选填，200字内）：')
  if (note === null) return
  try {
    const res = await fetch(`${apiBase}/api/community/moderator/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ note }) })
    const data = await res.json()
    if (res.ok) { modMe.value = { ...modMe.value, status: 'pending' }; applyMsg.value = '申请已提交，请等待站长审批'; alert(applyMsg.value) }
    else { alert(data.error || '申请失败') }
  } catch { alert('网络异常，请稍后重试') }
}

// 登录相关
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
    if (w.closed) {
      clearInterval(pollClose)
      if (oauthListener) { window.removeEventListener('message', oauthListener); oauthListener = null }
      // Mobile fallback: popup may not have window.opener, but localStorage is shared (same-origin)
      const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || localStorage.getItem('token')
      const storedUser = localStorage.getItem('auth_user')
      if (storedToken && !oauthListener) {
        try {
          const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
          setToken(storedToken)
          const user = storedUser ? JSON.parse(storedUser) : { username: '用户' }
          setUser(user)
          onSuccess(storedToken, user)
        } catch { qqLoading.value = false; wechatLoading.value = false }
      } else {
        qqLoading.value = false; wechatLoading.value = false
      }
    }
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
        setToken(token); setUser(user); isLoggedIn.value = true; showLogin.value = false; qqLoading.value = false
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
        setToken(token); setUser(user); isLoggedIn.value = true; showLogin.value = false; wechatLoading.value = false
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
        setToken(token); document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
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
        setToken(token); document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) { setUser(data.user) }
        isLoggedIn.value = true; showLogin.value = false
        const raw = localStorage.getItem('auth_user')
        if (raw) { try { authUser.value = JSON.parse(raw) } catch {} }
      }
    }
  } catch (e: any) { authError.value = e.message || '网络错误' }
  finally { authLoading.value = false }
}

fetch('/api/auth/qq/status').then(r => r.json()).then(d => { if (d.data) qqStatus.value = d.data }).catch(() => {})
fetch('/api/auth/wechat/status').then(r => r.json()).then(d => { if (d.data) wechatStatus.value = d.data }).catch(() => {})
</script>

<style scoped>
.community-page {
  min-height: 100vh;
  font-family: var(--sf-sans);
}

/* ═══════════ 导航栏（全息玻璃） ═══════════ */
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(10, 12, 20, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--sf-border-subtle);
  box-shadow: 0 1px 0 rgba(0, 229, 255, 0.05) inset, 0 4px 20px rgba(0, 0, 0, 0.4);
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
  font-size: 1rem;
  font-weight: 700;
  color: var(--sf-text-primary);
  letter-spacing: 2px;
}
.logo-version {
  font-family: var(--sf-mono);
  font-size: 0.55rem;
  color: var(--sf-cyan);
  background: var(--sf-cyan-subtle);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--sf-border-subtle);
  letter-spacing: 0.5px;
}
.nav-links {
  display: flex;
  gap: 24px;
  flex: 1;
}
.nav-link {
  color: var(--sf-text-tertiary);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 500;
  transition: color var(--duration-fast);
  letter-spacing: 0.5px;
}
.nav-link:hover, .nav-link-active {
  color: var(--sf-cyan);
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nav-cta-btn {
  font-size: 0.78rem;
  padding: 5px 14px;
}
.nav-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background var(--duration-fast);
}
.nav-user-badge:hover {
  background: var(--sf-cyan-subtle);
}
.nav-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
}
.nav-user-avatar--basic { background: linear-gradient(135deg, #4a5568, #718096); }
.nav-user-avatar--standard { background: linear-gradient(135deg, var(--sf-cyan-deep), var(--sf-celadon, #3E7F99)); }
.nav-user-avatar--premium { background: linear-gradient(135deg, var(--sf-purple-deep), var(--sf-purple)); }
.nav-user-avatar--flagship { background: linear-gradient(135deg, #b45309, var(--sf-gold)); }
.nav-user-avatar--ultra { background: linear-gradient(135deg, var(--sf-cyan), var(--sf-purple)); }
.nav-tier-tag {
  font-family: var(--sf-mono);
  font-size: 0.58rem;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.nav-tier-tag--basic { background: rgba(116, 136, 156, 0.15); color: #8899aa; }
.nav-tier-tag--standard { background: var(--sf-cyan-subtle); color: var(--sf-cyan); }
.nav-tier-tag--premium { background: var(--sf-purple-glow); color: var(--sf-purple-bright); }
.nav-tier-tag--flagship { background: var(--sf-gold-glow); color: var(--sf-gold); }
.nav-tier-tag--ultra { background: linear-gradient(135deg, var(--sf-cyan-subtle), var(--sf-purple-glow)); color: var(--sf-cyan); }

.page-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px 60px;
}

/* ═══════════ 操作栏（分类+排序+搜索） ═══════════ */
.category-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 14px;
}
.tabs-scroll {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}
.tab-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--sf-border-subtle);
  background: transparent;
  color: var(--sf-text-tertiary);
  font-family: var(--sf-sans);
  letter-spacing: 0.5px;
  transition: all var(--duration-fast);
}
.tab-btn:hover {
  border-color: var(--sf-border-glow);
  color: var(--sf-cyan);
  background: var(--sf-cyan-subtle);
}
.tab-active {
  background: var(--sf-cyan);
  border-color: var(--sf-cyan);
  color: var(--sf-bg-void);
  box-shadow: var(--glow-sm);
}
.btn-post {
  flex-shrink: 0;
  font-size: 0.8rem;
  padding: 6px 16px;
}

/* 排序切换 */
.sort-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--sf-border-subtle);
  background: rgba(15, 18, 32, 0.5);
}
.sort-btn {
  padding: 5px 12px;
  border-radius: 5px;
  font-size: 0.75rem;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--sf-text-tertiary);
  font-family: var(--sf-sans);
  transition: all var(--duration-fast);
}
.sort-btn:hover { color: var(--sf-text-secondary); }
.sort-btn-on {
  background: var(--sf-cyan-subtle);
  color: var(--sf-cyan);
  box-shadow: inset 0 0 0 1px var(--sf-border-glow);
}

/* 搜索框 */
.search-box {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border: 1px solid var(--sf-border-subtle);
  border-radius: 8px;
  background: rgba(15, 18, 32, 0.5);
  overflow: hidden;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}
.search-box:focus-within {
  border-color: var(--sf-border-glow);
  box-shadow: var(--glow-sm);
}
.search-icon {
  display: flex;
  align-items: center;
  padding: 0 0 0 10px;
  color: var(--sf-text-tertiary);
}
.search-input {
  width: 160px;
  padding: 6px 10px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.8rem;
  color: var(--sf-text-primary);
  font-family: var(--sf-sans);
}
.search-input::placeholder { color: var(--sf-text-disabled); }

.page-huiwen { margin-bottom: 24px; }

/* ═══════════ 帖子列表 ═══════════ */
.posts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* 入场错峰（配合 sf-rise，顶级站点细节） */
.posts-list .post-card:nth-child(2) { animation-delay: 0.05s; }
.posts-list .post-card:nth-child(3) { animation-delay: 0.10s; }
.posts-list .post-card:nth-child(4) { animation-delay: 0.15s; }
.posts-list .post-card:nth-child(5) { animation-delay: 0.20s; }
.posts-list .post-card:nth-child(6) { animation-delay: 0.25s; }
.posts-list .post-card:nth-child(7) { animation-delay: 0.30s; }
.posts-list .post-card:nth-child(8) { animation-delay: 0.35s; }

/* Loading & Empty */
.loading-state, .empty-state {
  text-align: center;
  padding: 60px 0;
  color: var(--sf-text-tertiary);
}
.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  color: var(--sf-border-glow);
}
.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--sf-border-subtle);
  border-top-color: var(--sf-cyan);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 36px;
}
.page-btn { font-size: 0.75rem; }
.page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.page-info {
  font-family: var(--sf-mono);
  font-size: 0.82rem;
  color: var(--sf-text-tertiary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-current {
  color: var(--sf-cyan);
  font-weight: 700;
}
.page-divider { opacity: 0.3; }
.page-total { opacity: 0.5; }

/* ═══════════ 左右布局 ═══════════ */
.content-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.posts-section {
  flex: 3;
  min-width: 0;
}

/* ═══════════ 侧边栏 ═══════════ */
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
  padding: 16px 18px 14px;
}
.sidebar-title {
  font-size: 0.82rem;
}
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  text-decoration: none;
  border-bottom: 1px solid var(--sf-border-subtle);
}
.sidebar-link:last-child { border-bottom: none; }
.sidebar-link-text {
  flex: 1;
  font-size: 0.76rem;
  color: var(--sf-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast);
}
.sidebar-link:hover .sidebar-link-text { color: var(--sf-cyan); }
.sidebar-link-meta {
  font-family: var(--sf-mono);
  font-size: 0.62rem;
  color: var(--sf-text-tertiary);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .nav-links { display: none; }
  .content-layout { flex-direction: column; }
  .sidebar { width: 100%; position: static; max-width: none; }
  .category-tabs { flex-wrap: wrap; }
  .search-box { width: 100%; order: 3; }
  .search-input { width: 100%; flex: 1; }
  .btn-post { width: 100%; justify-content: center; }
}

/* ═══════════ 登录弹窗（全息玻璃） ═══════════ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 7, 10, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-card {
  background: var(--sf-bg-surface);
  backdrop-filter: blur(20px);
  border: 1px solid var(--sf-border-default);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), var(--glow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  padding: 32px 28px 28px;
  width: 400px;
  max-width: 92vw;
  position: relative;
  animation: modalIn 0.25s var(--ease-out-expo);
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.modal-close {
  position: absolute;
  top: 14px; right: 16px;
  background: none; border: none;
  color: var(--sf-text-tertiary);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color var(--duration-fast);
}
.modal-close:hover { color: var(--sf-magenta); }
.modal-header { text-align: center; margin-bottom: 24px; }
.modal-logo-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
.modal-logo-img { width: 44px; height: 44px; border-radius: 10px; }
.modal-header h2 { font-size: 1.15rem; font-weight: 700; color: var(--sf-text-primary); margin: 0 0 6px; letter-spacing: 1px; }
.modal-header p { font-size: 0.78rem; color: var(--sf-text-tertiary); margin: 0; }
.modal-tabs {
  display: flex;
  background: rgba(10, 12, 20, 0.6);
  border-radius: 8px;
  padding: 3px;
  margin-bottom: 24px;
  border: 1px solid var(--sf-border-subtle);
}
.modal-tabs .tab-btn {
  flex: 1;
  padding: 8px;
  background: none;
  border: none;
  color: var(--sf-text-tertiary);
  font-size: 0.78rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--duration-fast);
  font-family: var(--sf-sans);
  letter-spacing: 1px;
}
.modal-tabs .tab-btn.tab-active {
  background: var(--sf-cyan-subtle);
  color: var(--sf-cyan);
  box-shadow: inset 0 0 0 1px var(--sf-border-glow);
}
.modal-form .form-group { margin-bottom: 16px; }
.modal-form label {
  display: block;
  font-family: var(--sf-mono);
  font-size: 0.62rem;
  letter-spacing: 1.5px;
  color: var(--sf-text-tertiary);
  margin-bottom: 6px;
  text-transform: uppercase;
}
.modal-form .form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(10, 12, 20, 0.6);
  border: 1px solid var(--sf-border-subtle);
  color: var(--sf-text-primary);
  font-size: 0.85rem;
  outline: none;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
  box-sizing: border-box;
}
.modal-form .form-input:focus {
  border-color: var(--sf-border-glow);
  box-shadow: var(--glow-sm);
}
.form-error { color: var(--sf-magenta); font-size: 0.75rem; margin: 0 0 12px; }
.form-success { color: var(--sf-cyan); font-size: 0.75rem; margin: 0 0 12px; }
.btn-full { width: 100%; padding: 10px; font-size: 0.85rem; justify-content: center; margin-top: 8px; }

@media (max-width: 480px) {
  .modal-card { width: 90%; margin: 0 16px; }
}

.wechat-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 14px;
}
.divider-line { flex: 1; height: 1px; background: var(--sf-border-subtle); }
.divider-text { font-family: var(--sf-mono); font-size: 0.62rem; letter-spacing: 1px; color: var(--sf-text-disabled); white-space: nowrap; }
.btn-wechat, .btn-qq {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--sf-border-subtle);
  border-radius: 8px;
  background: rgba(10, 12, 20, 0.4);
  color: var(--sf-text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
  transition: all var(--duration-fast);
}
.btn-wechat:hover:not(:disabled), .btn-qq:hover:not(:disabled) {
  background: var(--sf-cyan-subtle);
  border-color: var(--sf-border-glow);
  color: var(--sf-cyan);
}
.btn-wechat:disabled, .btn-qq:disabled { opacity: 0.3; cursor: not-allowed; }
.oauth-icon { font-size: 1.1rem; }

/* 版主 */
.mod-card-body { padding: 10px 4px 4px; }
.mod-card-tip { font-size: 0.75rem; color: var(--sf-text-tertiary); margin: 0 0 10px; line-height: 1.6; }
.mod-card-tip--warn { color: var(--sf-magenta); }
.mod-card-role { font-size: 0.82rem; color: var(--sf-cyan); font-weight: 600; margin: 0 0 10px; }
.btn-block { width: 100%; text-align: center; }
.moderator-item { display: flex; align-items: center; gap: 8px; padding: 7px 2px; }
.moderator-avatar {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--sf-cyan-deep), var(--sf-purple-deep));
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.moderator-name { font-size: 0.78rem; color: var(--sf-text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moderator-role {
  font-family: var(--sf-mono);
  font-size: 0.58rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--sf-gold-glow);
  color: var(--sf-gold);
  letter-spacing: 0.5px;
}
.moderator-role--co { background: var(--sf-cyan-subtle); color: var(--sf-cyan); }
</style>
