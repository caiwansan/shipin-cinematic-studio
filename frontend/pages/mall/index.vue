<template>
  <div class="min-h-screen bg-[#050A15]">
    <!-- 页面顶部 -->
    <div class="bg-gradient-to-b from-[#0A1628] to-[#050A15] py-6">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center transition shrink-0">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </NuxtLink>
          <div class="flex-1">
            <h1 class="text-2xl font-bold text-white">🛒 昆仑商城</h1>
            <p class="text-gray-400 text-sm mt-1">精选好物，品质生活</p>
          </div>
          <!-- 用户操作区 -->
          <div class="flex items-center gap-2">
            <template v-if="!isLoggedIn">
              <button @click="openLogin" class="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-[#1A2D4A] rounded-lg transition">登录</button>
              <button @click="openRegister" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition">注册</button>
            </template>
            <template v-else>
              <NuxtLink to="/mall/orders" class="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-[#1A2D4A] rounded-lg transition">📋 订单</NuxtLink>
              <NuxtLink to="/mall/cart" class="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-[#1A2D4A] rounded-lg transition">🛒 购物车</NuxtLink>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 登录/注册弹窗（公共组件 AuthModal，与首页完全一致） ===== -->
    <AuthModal v-model="showLogin" :initial-mode="authInitialMode" @logged-in="onAuthLoggedIn" />

    <div class="max-w-6xl mx-auto px-4 pb-12 space-y-8">
      <!-- ===== Hero 爆品价格轮播 ===== -->
      <div v-if="recommendProducts.length > 0" class="relative w-full rounded-xl overflow-hidden bg-gradient-to-br from-[#0D1B33] via-[#111D38] to-[#0A1628] border border-[#1A2D4A] shadow-xl">
        <div class="flex transition-transform duration-500 ease-in-out" :style="{ transform: `translateX(-${heroSlide * 100}%)` }">
          <div v-for="(p, i) in recommendProducts.slice(0, 6)" :key="'hero-' + p.id"
            class="w-full shrink-0 flex flex-col md:flex-row items-center gap-4 md:gap-6 p-6 md:p-10">
            <!-- 商品图 -->
            <div class="w-32 h-32 md:w-44 md:h-44 rounded-xl overflow-hidden bg-[#13233E] flex items-center justify-center shrink-0 shadow-lg">
              <img v-if="p.cover" :src="p.cover" :alt="p.name" class="w-full h-full object-cover" />
              <span v-else class="text-5xl text-gray-600">📦</span>
            </div>
            <!-- 文字信息 -->
            <div class="flex-1 text-center md:text-left">
              <div class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/20 mb-2">
                ⚡ 限时特惠
              </div>
              <h3 class="text-xl md:text-2xl font-bold text-white">{{ p.name }}</h3>
              <p class="text-xs text-gray-500 mt-1">{{ p.description || '精选好物，品质保证' }}</p>
              <div class="mt-3 flex items-center justify-center md:justify-start gap-3">
                <span class="text-2xl md:text-3xl font-extrabold text-red-400">¥{{ Number(p.price).toFixed(2) }}</span>
                <span v-if="p.originalPrice && Number(p.originalPrice) > Number(p.price)" class="text-sm text-gray-500 line-through">¥{{ Number(p.originalPrice).toFixed(2) }}</span>
              </div>
              <NuxtLink :to="`/mall/product/${p.id}`"
                class="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-medium rounded-lg transition shadow-lg shadow-indigo-600/20">
                立即抢购 →
              </NuxtLink>
            </div>
          </div>
        </div>
        <!-- 左右箭頭 -->
        <button @click="heroPrev" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center transition z-10 border border-white/10">‹</button>
        <button @click="heroNext" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center transition z-10 border border-white/10">›</button>
        <!-- 指示器 -->
        <div class="flex justify-center gap-1.5 pb-4">
          <button v-for="(p, i) in recommendProducts.slice(0, 6)" :key="'hd-' + i"
            @click="heroSlide = i"
            class="w-1.5 h-1.5 rounded-full transition-all duration-300"
            :class="i === heroSlide ? 'bg-indigo-400 w-4' : 'bg-white/20 hover:bg-white/40'">
          </button>
        </div>
      </div>

      <!-- ===== Banner 轮播 ===== -->
      <div v-if="banners.length > 0" class="relative w-full h-48 sm:h-64 md:h-80 rounded-xl overflow-hidden bg-[#0D1B33] shadow-lg" @mouseenter="autoPlay = false" @mouseleave="autoPlay = true">
        <div class="flex transition-transform duration-500 ease-in-out h-full" :style="{ transform: `translateX(-${currentBanner * 100}%)` }">
          <div v-for="(b, i) in banners" :key="b.id || i" class="w-full h-full shrink-0 flex items-center justify-center">
            <a v-if="b.linkType === 'product' && b.linkValue" :href="`/mall/product/${b.linkValue}`" class="w-full h-full">
              <img :src="b.image || b.imageUrl" :alt="'Banner ' + (i + 1)" class="w-full h-full object-cover" />
            </a>
            <a v-else-if="b.linkType === 'url' && b.linkValue" :href="b.linkValue" target="_blank" class="w-full h-full">
              <img :src="b.image || b.imageUrl" :alt="'Banner ' + (i + 1)" class="w-full h-full object-cover" />
            </a>
            <img v-else :src="b.image || b.imageUrl" :alt="'Banner ' + (i + 1)" class="w-full h-full object-cover cursor-default" />
          </div>
        </div>
        <!-- 指示器 -->
        <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          <button v-for="(b, i) in banners" :key="'dot-' + i" @click="currentBanner = i"
            class="w-2 h-2 rounded-full transition-all duration-300"
            :class="i === currentBanner ? 'bg-indigo-400 w-5' : 'bg-white/30 hover:bg-white/50'">
          </button>
        </div>
        <!-- 左右箭头 -->
        <button @click="prevBanner" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center transition">‹</button>
        <button @click="nextBanner" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center transition">›</button>
      </div>

      <!-- ===== 推荐商品 ===== -->
      <section v-if="recommendProducts.length > 0">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">🔥 推荐商品</h2>
          <NuxtLink to="/mall?recommend=1" class="text-sm text-indigo-400 hover:text-indigo-300">查看更多 →</NuxtLink>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700">
          <div v-for="p in recommendProducts" :key="p.id"
            class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] shrink-0 w-48 overflow-hidden hover:border-indigo-500/50 transition">
            <NuxtLink :to="`/mall/product/${p.id}`">
              <div class="h-36 bg-[#13233E] flex items-center justify-center overflow-hidden">
                <img v-if="p.cover" :src="p.cover" :alt="p.name" class="w-full h-full object-cover" />
                <span v-else class="text-4xl text-gray-600">📦</span>
              </div>
              <div class="p-3">
                <h3 class="text-sm font-medium text-white truncate">{{ p.name }}</h3>
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-base font-bold text-red-400">¥{{ Number(p.price).toFixed(2) }}</span>
                  <span class="text-xs bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded">立即购买</span>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- ===== 优惠专区 ===== -->
      <section v-if="availableCoupons.length > 0">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">🎫 优惠专区</h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="c in availableCoupons" :key="c.id"
            class="bg-gradient-to-r from-[#1A1A3A] to-[#0D1B33] rounded-xl border border-[#2A2A5A] p-4 flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold text-white">{{ c.name }}</div>
              <div class="text-xs text-gray-400 mt-1">
                <template v-if="c.type === 'fixed'">满{{ c.minAmount }}减{{ c.value }}元</template>
                <template v-else-if="c.type === 'discount'">{{ c.value }}折</template>
                <template v-else-if="c.type === 'full_reduce'">满{{ c.minAmount }}减{{ c.value }}元</template>
              </div>
              <div v-if="c.totalCount > 0" class="text-xs text-gray-500 mt-0.5">剩余 {{ c.totalCount - c.usedCount }} 张</div>
            </div>
            <button @click="claimCoupon(c.id)"
              class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg transition shrink-0"
              :disabled="claimingId === c.id">
              {{ claimingId === c.id ? '领取中...' : '领取' }}
            </button>
          </div>
        </div>
      </section>

      <!-- ===== 搜索 + 分类筛选 ===== -->
      <section>
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
          <div class="relative flex-1 max-w-md">
            <input v-model="searchQuery" @keydown.enter="doSearch" placeholder="搜索商品..."
              class="w-full bg-[#0D1B33] border border-[#1A2D4A] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            <button @click="doSearch" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              🔍
            </button>
          </div>
        </div>

        <!-- 分类 tabs -->
        <div class="flex gap-2 flex-wrap mb-4">
          <button @click="selectedCategory = ''; currentPage = 1"
            class="px-3 py-1.5 rounded-lg text-xs transition"
            :class="!selectedCategory ? 'bg-indigo-600 text-white' : 'bg-[#0D1B33] text-gray-400 border border-[#1A2D4A] hover:border-indigo-500/50'">
            全部
          </button>
          <button v-for="cat in categories" :key="cat.id" @click="selectedCategory = cat.id; currentPage = 1"
            class="px-3 py-1.5 rounded-lg text-xs transition"
            :class="selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-[#0D1B33] text-gray-400 border border-[#1A2D4A] hover:border-indigo-500/50'">
            {{ cat.name }}
          </button>
        </div>

        <!-- ===== 商品列表网格 ===== -->
        <div v-if="loading" class="text-center py-12 text-gray-400">加载中...</div>
        <div v-else-if="products.length === 0" class="text-center py-12 text-gray-500">暂无商品</div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div v-for="p in products" :key="p.id"
            class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] overflow-hidden hover:border-indigo-500/50 transition group">
            <NuxtLink :to="`/mall/product/${p.id}`">
              <div class="aspect-[4/3] bg-[#13233E] flex items-center justify-center overflow-hidden">
                <img v-if="p.cover" :src="p.cover" :alt="p.name" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                <span v-else class="text-4xl text-gray-600">📦</span>
              </div>
              <div class="p-3">
                <h3 class="text-sm font-medium text-white truncate">{{ p.name }}</h3>
                <div class="text-xs text-gray-500 truncate mt-0.5">{{ p.subtitle || '' }}</div>
                <div class="mt-2 flex items-baseline gap-1.5">
                  <span class="text-base font-bold text-red-400">¥{{ Number(p.price).toFixed(2) }}</span>
                  <span v-if="Number(p.originalPrice) > Number(p.price)" class="text-xs text-gray-500 line-through">¥{{ Number(p.originalPrice).toFixed(2) }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                  <span>已售 {{ p.sales || 0 }}</span>
                  <span v-if="p.isNew" class="bg-green-600/20 text-green-400 px-1.5 py-0.5 rounded text-[10px]">新品</span>
                  <span v-if="p.isRecommend" class="bg-orange-600/20 text-orange-400 px-1.5 py-0.5 rounded text-[10px]">推荐</span>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- ===== 分页 ===== -->
        <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-6">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage <= 1"
            class="px-3 py-1.5 rounded-lg text-xs border border-[#1A2D4A] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
            上一页
          </button>
          <span class="text-sm text-gray-400">第 {{ currentPage }} / {{ totalPages }} 页</span>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage >= totalPages"
            class="px-3 py-1.5 rounded-lg text-xs border border-[#1A2D4A] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
            下一页
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken } from '~/utils/token-cache'
import AuthModal from '~/components/kunlun/business/AuthModal.vue'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

function authHeaders() { return { Authorization: `Bearer ${getToken()}` } }
function authFetch(url: string, opts?: any) { return $fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } }) }

// ===== Data =====
const banners = ref<any[]>([])
const recommendProducts = ref<any[]>([])
const categories = ref<any[]>([])
const products = ref<any[]>([])
const availableCoupons = ref<any[]>([])

const currentPage = ref(1)
const pageSize = 12
const totalPages = ref(1)
const loading = ref(false)
const selectedCategory = ref('')
const searchQuery = ref('')
const currentBanner = ref(0)
const heroSlide = ref(0)
const autoPlay = ref(true)
let autoPlayTimer: ReturnType<typeof setInterval> | null = null
const claimingId = ref<string | null>(null)

// ===== 登录状态 =====
const isLoggedIn = ref(!!getToken())
const showLogin = ref(false)
const authInitialMode = ref<'login' | 'register'>('login')

// 统一登录/注册弹窗（AuthModal 与首页一致；token 统一写 auth_token）
function openLogin() { authInitialMode.value = 'login'; showLogin.value = true }
function openRegister() { authInitialMode.value = 'register'; showLogin.value = true }

function onAuthLoggedIn() {
  isLoggedIn.value = true
  fetchCoupons() // 登录后重新拉取优惠券
}

// ===== Fetch Functions =====
async function fetchBanners() {
  try {
    const res = await $fetch('/api/mall/banners')
    if (res?.success) banners.value = res.data || []
  } catch (e) { console.error('Banner 加载失败', e) }
}

async function fetchRecommendProducts() {
  try {
    const res = await $fetch('/api/mall/products?isRecommend=true&pageSize=10')
    if (res?.success) recommendProducts.value = res.data?.items || []
  } catch (e) { console.error('推荐商品加载失败', e) }
}

async function fetchCategories() {
  try {
    const res = await $fetch('/api/mall/categories')
    if (res?.success) categories.value = res.data || []
  } catch (e) { console.error('分类加载失败', e) }
}

async function fetchProducts() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', String(currentPage.value))
    params.set('pageSize', String(pageSize))
    if (selectedCategory.value) params.set('categoryId', selectedCategory.value)
    if (searchQuery.value) params.set('search', searchQuery.value)

    const res = await $fetch(`/api/mall/products?${params.toString()}`)
    if (res?.success) {
      products.value = res.data?.items || []
      totalPages.value = res.data?.totalPages || 1
    }
  } catch (e) { console.error('商品加载失败', e) }
  finally { loading.value = false }
}

async function fetchCoupons() {
  try {
    const res = await authFetch('/api/mall/coupons/available').catch(() => ({ success: false, data: [] }))
    if (res?.success) availableCoupons.value = res.data || []
  } catch {
    // 可能未登录
  }
}

async function claimCoupon(couponId: string) {
  claimingId.value = couponId
  try {
    const res = await authFetch(`/api/mall/coupons/${couponId}/claim`, { method: 'POST' })
    if (res?.success) {
      availableCoupons.value = availableCoupons.value.filter(c => c.id !== couponId)
    }
  } catch (e: any) {
    alert(e?.data?.error || '领取失败')
  } finally {
    claimingId.value = null
  }
}

function doSearch() {
  currentPage.value = 1
  fetchProducts()
}

function nextBanner() {
  currentBanner.value = (currentBanner.value + 1) % banners.value.length
}
function prevBanner() {
  currentBanner.value = (currentBanner.value - 1 + banners.value.length) % banners.value.length
}
function heroNext() {
  heroSlide.value = (heroSlide.value + 1) % Math.min(recommendProducts.value.length, 6)
}
function heroPrev() {
  heroSlide.value = (heroSlide.value - 1 + Math.min(recommendProducts.value.length, 6)) % Math.min(recommendProducts.value.length, 6)
}

// ===== Watchers =====
watch(currentPage, fetchProducts)
watch(selectedCategory, fetchProducts)

// ===== Lifecycle =====
onMounted(() => {
  fetchBanners()
  fetchRecommendProducts()
  fetchCategories()
  fetchProducts()
  fetchCoupons()

  autoPlayTimer = setInterval(() => {
    if (autoPlay.value && banners.value.length > 1) {
      nextBanner()
    }
  }, 4000)
})

onUnmounted(() => {
  if (autoPlayTimer) clearInterval(autoPlayTimer)
})
</script>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { height: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb { border-radius: 2px; }
</style>
