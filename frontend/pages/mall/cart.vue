<template>
  <div class="min-h-screen bg-[#050A15]">
    <div class="bg-gradient-to-b from-[#0A1628] to-[#050A15] py-4">
      <div class="max-w-6xl mx-auto px-4">
        <NuxtLink to="/mall" class="text-sm text-gray-400 hover:text-white">← 返回商城</NuxtLink>
        <h1 class="text-xl font-bold text-white mt-2">🛒 我的购物车</h1>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-4 pb-12 mt-4">
      <!-- 未登录 -->
      <div v-if="!isLoggedIn" class="text-center py-20">
        <p class="text-gray-400 text-lg mb-4">请先登录后查看购物车</p>
        <button @click="goLogin" class="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">去登录</button>
      </div>

      <!-- 加载中 -->
      <div v-else-if="loading" class="text-center py-20 text-gray-400">加载中...</div>

      <!-- 空购物车 -->
      <div v-else-if="cartItems.length === 0" class="text-center py-20">
        <span class="text-5xl">🛒</span>
        <p class="text-gray-400 mt-4">购物车空空如也</p>
        <NuxtLink to="/mall" class="inline-block mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">去逛逛</NuxtLink>
      </div>

      <!-- 购物车列表 -->
      <div v-else class="space-y-4">
        <!-- 全选 -->
        <div class="flex items-center gap-3 bg-[#0D1B33] rounded-xl border border-[#1A2D4A] px-4 py-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" class="w-4 h-4 accent-indigo-500" />
            <span class="text-sm text-gray-300">全选</span>
          </label>
          <span class="text-sm text-gray-500 ml-auto">共 {{ cartItems.length }} 件</span>
        </div>

        <!-- 商品卡片 -->
        <div v-for="item in cartItems" :key="item.id"
          class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4 flex items-center gap-4">
          <input type="checkbox" :checked="selectedIds.has(item.id)" @change="toggleItem(item.id)" class="w-4 h-4 accent-indigo-500 shrink-0" />
          <NuxtLink :to="`/mall/product/${item.product.id}`" class="w-20 h-20 shrink-0 bg-[#13233E] rounded-lg overflow-hidden flex items-center justify-center">
            <img v-if="item.product.cover" :src="item.product.cover" :alt="item.product.name" class="w-full h-full object-cover" />
            <span v-else class="text-2xl text-gray-600">📦</span>
          </NuxtLink>
          <div class="flex-1 min-w-0">
            <NuxtLink :to="`/mall/product/${item.product.id}`" class="text-sm font-medium text-white truncate block hover:text-indigo-400">{{ item.product.name }}</NuxtLink>
            <div class="text-sm font-bold text-red-400 mt-1">¥{{ item.product.price.toFixed(2) }}</div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="updateQuantity(item.id, item.quantity - 1)" class="w-7 h-7 rounded border border-[#1A2D4A] text-gray-400 hover:border-indigo-500 text-sm">−</button>
            <span class="w-8 text-center text-sm text-white">{{ item.quantity }}</span>
            <button @click="updateQuantity(item.id, item.quantity + 1)" class="w-7 h-7 rounded border border-[#1A2D4A] text-gray-400 hover:border-indigo-500 text-sm">+</button>
          </div>
          <div class="text-sm font-bold text-white w-20 text-right">¥{{ (item.product.price * item.quantity).toFixed(2) }}</div>
          <button @click="removeItem(item.id)" class="text-gray-500 hover:text-red-400 text-sm ml-2">🗑️</button>
        </div>

        <!-- 底部栏 -->
        <div class="sticky bottom-0 bg-[#0A1628]/95 backdrop-blur border border-[#1A2D4A] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span class="text-sm text-gray-400">已选 {{ selectedCount }} 件</span>
            <span class="text-lg font-bold text-red-400 ml-4">合计：¥{{ totalAmount.toFixed(2) }}</span>
          </div>
          <button @click="goCheckout" :disabled="selectedCount === 0"
            class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-lg text-sm transition">
            去结算
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken } from '~/utils/token-cache'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

function authHeaders() { return { Authorization: `Bearer ${getToken()}` } }
function authFetch(url: string, opts?: any) {
  return $fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } })
}

const router = useRouter()
const isLoggedIn = ref(false)
const loading = ref(true)
const cartItems = ref<any[]>([])
const selectedIds = ref<Set<string>>(new Set())

const allSelected = computed(() => cartItems.value.length > 0 && selectedIds.value.size === cartItems.value.length)
const selectedCount = computed(() => selectedIds.value.size)
const totalAmount = computed(() => {
  return cartItems.value
    .filter(item => selectedIds.value.has(item.id))
    .reduce((sum, item) => sum + item.product.price * item.quantity, 0)
})

function checkLogin() {
  const token = getToken()
  isLoggedIn.value = !!token
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value.clear()
  } else {
    cartItems.value.forEach(item => selectedIds.value.add(item.id))
  }
}
function toggleItem(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

async function fetchCart() {
  if (!isLoggedIn.value) { loading.value = false; return }
  loading.value = true
  try {
    const res = await authFetch('/api/mall/cart')
    if (res?.success) {
      cartItems.value = res.data || []
      cartItems.value.forEach(item => selectedIds.value.add(item.id))
    }
  } catch (e) { console.error('购物车加载失败', e) }
  finally { loading.value = false }
}

async function updateQuantity(itemId: string, qty: number) {
  if (qty <= 0) return removeItem(itemId)
  try {
    await authFetch(`/api/mall/cart/${itemId}`, {
      method: 'PUT',
      body: { quantity: qty },
    })
    const item = cartItems.value.find(i => i.id === itemId)
    if (item) item.quantity = qty
  } catch (e: any) { alert(e?.data?.error || '更新失败') }
}

async function removeItem(itemId: string) {
  try {
    await authFetch(`/api/mall/cart/${itemId}`, { method: 'DELETE' })
    cartItems.value = cartItems.value.filter(i => i.id !== itemId)
    selectedIds.value.delete(itemId)
  } catch (e: any) { alert(e?.data?.error || '删除失败') }
}

function goLogin() {
  router.push('/director-os/aigc/login')
}

function goCheckout() {
  const selected = cartItems.value.filter(item => selectedIds.value.has(item.id))
  // 保存选中的商品到 sessionStorage
  sessionStorage.setItem('checkout_items', JSON.stringify(selected.map(i => ({ productId: i.product.id, quantity: i.quantity }))))
  router.push('/mall/checkout')
}

onMounted(() => { checkLogin(); fetchCart() })
</script>
