<template>
  <div class="min-h-screen bg-[#050A15]">
    <!-- 顶部 -->
    <div class="bg-gradient-to-b from-[#0A1628] to-[#050A15] py-4">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex items-center justify-between">
          <NuxtLink to="/mall" class="text-sm text-gray-400 hover:text-white">← 返回商城</NuxtLink>
          <div class="flex items-center gap-2">
            <template v-if="!isLoggedIn">
              <button @click="showLogin = true" class="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-[#1A2D4A] rounded-lg transition">登录</button>
              <NuxtLink to="/register" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition">注册</NuxtLink>
            </template>
            <template v-else>
              <NuxtLink to="/mall/orders" class="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-[#1A2D4A] rounded-lg transition">📋 订单</NuxtLink>
              <NuxtLink to="/mall/cart" class="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-[#1A2D4A] rounded-lg transition">🛒 购物车</NuxtLink>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 登录弹窗 ===== -->
    <div v-if="showLogin" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="showLogin = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[360px] shadow-2xl relative">
        <h2 class="text-base font-semibold text-white mb-4 text-center">🔑 登录</h2>
        <div v-if="loginError" class="text-red-400 text-xs mb-3 text-center">{{ loginError }}</div>
        <div class="space-y-3">
          <input v-model="loginForm.account" placeholder="手机号 / 邮箱 / 账号"
            class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500" />
          <input v-model="loginForm.password" type="password" placeholder="密码"
            class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500" />
          <button @click="doLogin" :disabled="loginLoading"
            class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition border-none cursor-pointer">
            {{ loginLoading ? '登录中...' : '登录' }}
          </button>
        </div>
        <p class="text-center text-xs text-gray-500 mt-3">
          还没有账号？<NuxtLink to="/register" @click="showLogin = false" class="text-indigo-400 hover:text-indigo-300">去注册</NuxtLink>
        </p>
        <button @click="showLogin = false" class="absolute top-3 right-3 text-gray-500 hover:text-white text-lg leading-none cursor-pointer bg-transparent border-none">✕</button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-20 text-gray-400">加载中...</div>

    <div v-else-if="product" class="max-w-6xl mx-auto px-4 pb-24">
      <!-- ===== 商品轮播图 + 信息区 ===== -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
        <div>
          <div class="relative bg-[#0D1B33] rounded-xl border border-[#1A2D4A] overflow-hidden">
            <div class="aspect-square flex items-center justify-center overflow-hidden">
              <img v-if="currentImage" :src="currentImage" :alt="product.name" class="w-full h-full object-cover" />
              <span v-else class="text-6xl text-gray-600">📦</span>
            </div>
            <!-- 缩略图切换 -->
            <div v-if="allImages.length > 1" class="flex gap-2 p-3 overflow-x-auto bg-[#0A1628]">
              <button v-for="(img, i) in allImages" :key="i" @click="currentImageIndex = i"
                class="w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition"
                :class="i === currentImageIndex ? 'border-indigo-500' : 'border-transparent opacity-60 hover:opacity-100'">
                <img :src="img" alt="" class="w-full h-full object-cover" />
              </button>
            </div>
          </div>
          <!-- 图文详情 — 在轮播图正下方 -->
          <div v-if="parsedDetail.length > 0" class="mt-6">
            <h3 class="text-sm font-semibold text-white mb-3">📄 商品详情</h3>
            <div class="space-y-3">
              <img v-for="(url, i) in parsedDetail" :key="i" :src="url" alt="商品详情图"
                class="w-full rounded-lg" />
            </div>
          </div>
        </div>

        <!-- ===== 商品信息 ===== -->
        <div>
          <h1 class="text-xl font-bold text-white">{{ product.name }}</h1>
          <p v-if="product.subtitle" class="text-sm text-gray-400 mt-1">{{ product.subtitle }}</p>

          <div class="flex items-baseline gap-3 mt-4">
            <span class="text-2xl font-bold text-red-400">¥{{ Number(product.price).toFixed(2) }}</span>
            <span v-if="Number(product.originalPrice) > Number(product.price)" class="text-sm text-gray-500 line-through">¥{{ Number(product.originalPrice).toFixed(2) }}</span>
          </div>

          <div class="flex items-center gap-4 mt-3 text-sm text-gray-400">
            <span>📦 库存：{{ product.stock }}</span>
            <span>🔥 已售：{{ product.sales || 0 }}</span>
            <span v-if="product.isNew" class="bg-green-600/20 text-green-400 px-2 py-0.5 rounded text-xs">新品</span>
            <span v-if="product.isRecommend" class="bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded text-xs">推荐</span>
          </div>

          <!-- 分类 -->
          <div v-if="product.category" class="mt-3">
            <span class="text-xs bg-[#1A2D4A] text-gray-300 px-2 py-1 rounded">{{ product.category.name }}</span>
          </div>

          <!-- 数量选择 -->
          <div class="flex items-center gap-3 mt-6">
            <span class="text-sm text-gray-400">数量：</span>
            <button @click="quantity = Math.max(1, quantity - 1)" class="w-8 h-8 rounded-lg border border-[#1A2D4A] text-gray-300 hover:border-indigo-500">−</button>
            <span class="w-10 text-center text-white font-medium">{{ quantity }}</span>
            <button @click="quantity = Math.min(product.stock, quantity + 1)" class="w-8 h-8 rounded-lg border border-[#1A2D4A] text-gray-300 hover:border-indigo-500">+</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-500">商品不存在</div>

    <!-- ===== 底部固定操作栏 ===== -->
    <div class="fixed bottom-0 left-0 right-0 bg-[#0A1628]/95 backdrop-blur border-t border-[#1A2D4A] p-4 z-50">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <span class="text-xl font-bold text-red-400">¥{{ Number(product?.price).toFixed(2) }}</span>
          <span v-if="Number(product?.originalPrice) > Number(product?.price)" class="text-sm text-gray-500 line-through ml-2">¥{{ Number(product?.originalPrice).toFixed(2) }}</span>
        </div>
        <div class="flex gap-3">
          <button @click="addToCart" :disabled="cartLoading"
            class="border border-indigo-500 text-indigo-400 px-6 py-2.5 rounded-lg text-sm hover:bg-indigo-600/10 transition disabled:opacity-50">
            {{ cartLoading ? '添加中...' : '🛒 加入购物车' }}
          </button>
          <button @click="buyNow"
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm transition">
            立即购买
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken } from '~/utils/token-cache'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

function authHeaders() { return { Authorization: `Bearer ${getToken()}` } }
function authFetch(url: string, opts?: any) { return $fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } }) }

const route = useRoute()
const router = useRouter()
const product = ref<any>(null)
const loading = ref(true)
const quantity = ref(1)
const cartLoading = ref(false)
const currentImageIndex = ref(0)

// ===== 登录状态 =====
const isLoggedIn = ref(!!getToken())
const showLogin = ref(false)
const loginLoading = ref(false)
const loginError = ref('')
const loginForm = ref({ account: '', password: '' })

async function doLogin() {
  loginError.value = ''
  if (!loginForm.value.account || !loginForm.value.password) {
    loginError.value = '请输入账号和密码'
    return
  }
  loginLoading.value = true
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm.value),
    })
    const data = await res.json()
    if (data.success && data.data?.token) {
      localStorage.setItem('user_auth_token', data.data.token)
      isLoggedIn.value = true
      showLogin.value = false
      loginForm.value = { account: '', password: '' }
    } else {
      loginError.value = data.error || '登录失败'
    }
  } catch (e) {
    loginError.value = '网络错误'
  } finally {
    loginLoading.value = false
  }
}

const parsedDetail = computed(() => {
  if (!product.value?.detail) return []
  const raw = product.value.detail
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
})

const allImages = computed(() => {
  if (!product.value) return []
  const images: string[] = []
  if (product.value.cover) images.push(product.value.cover)
  if (Array.isArray(product.value.images)) images.push(...product.value.images)
  return images.filter(Boolean)
})
const currentImage = computed(() => allImages.value[currentImageIndex.value] || null)

async function fetchProduct() {
  try {
    const res = await $fetch(`/api/mall/products/${route.params.id}`)
    if (res?.success) product.value = res.data
  } catch (e) {
    console.error('商品详情加载失败', e)
  } finally {
    loading.value = false
  }
}

async function addToCart() {
  cartLoading.value = true
  try {
    await authFetch('/api/mall/cart', {
      method: 'POST',
      body: { productId: route.params.id, quantity: quantity.value },
    })
    alert('已加入购物车')
  } catch (e: any) {
    if (e?.status === 401) {
      alert('请先登录')
      return
    }
    alert(e?.data?.error || '添加失败')
  } finally {
    cartLoading.value = false
  }
}

function buyNow() {
  // 先加入购物车然后跳转 checkout（简化处理）
  addToCart().then(() => {
    router.push('/mall/checkout')
  })
}

onMounted(fetchProduct)
</script>
