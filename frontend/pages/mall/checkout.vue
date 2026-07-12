<template>
  <div class="min-h-screen bg-[#050A15]">
    <div class="bg-gradient-to-b from-[#0A1628] to-[#050A15] py-4">
      <div class="max-w-4xl mx-auto px-4">
        <NuxtLink to="/mall/cart" class="text-sm text-gray-400 hover:text-white">← 返回购物车</NuxtLink>
        <h1 class="text-xl font-bold text-white mt-2">📋 确认订单</h1>
      </div>
    </div>

    <div v-if="submitting" class="text-center py-20 text-gray-400">提交中...</div>

    <div v-else class="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
      <!-- ===== 地址选择 ===== -->
      <section class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">📍 收货地址</h2>
        <div v-if="addresses.length === 0" class="text-sm text-gray-500">
          暂无地址，<button @click="showAddressForm = true" class="text-indigo-400 hover:text-indigo-300">去添加</button>
        </div>
        <div v-else class="space-y-2">
          <div v-for="addr in addresses" :key="addr.id"
            class="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition"
            :class="selectedAddressId === addr.id ? 'bg-indigo-600/10 border border-indigo-500/50' : 'bg-[#0A1628] border border-transparent hover:border-[#1A2D4A]'"
            @click="selectedAddressId = addr.id">
            <input type="radio" :checked="selectedAddressId === addr.id" class="mt-0.5 accent-indigo-500" />
            <div class="flex-1">
              <div class="text-sm text-white">
                {{ addr.name }} <span class="text-gray-500 ml-2">{{ addr.phone }}</span>
                <span v-if="addr.isDefault" class="ml-2 text-[10px] bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded">默认</span>
              </div>
              <div class="text-xs text-gray-400 mt-0.5">{{ addr.province }} {{ addr.city }} {{ addr.district }} {{ addr.detail }}</div>
            </div>
            <button @click.stop="selectedAddressId = addr.id" class="text-indigo-400 text-xs hover:text-indigo-300">选择</button>
          </div>
        </div>
        <button @click="showAddressForm = true" class="mt-2 text-sm text-indigo-400 hover:text-indigo-300">+ 新增地址</button>
      </section>

      <!-- ===== 商品确认列表 ===== -->
      <section class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">📦 商品确认</h2>
        <div v-for="item in checkoutItems" :key="item.productId" class="flex items-center gap-4 py-3 border-b border-[#1A2D4A] last:border-0">
          <div class="w-16 h-16 shrink-0 bg-[#13233E] rounded-lg overflow-hidden flex items-center justify-center">
            <img v-if="item.cover" :src="item.cover" :alt="item.name" class="w-full h-full object-cover" />
            <span v-else class="text-xl text-gray-600">📦</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-white truncate">{{ item.name }}</div>
            <div class="text-xs text-gray-500 mt-0.5">x{{ item.quantity }}</div>
          </div>
          <div class="text-sm font-bold text-red-400 shrink-0">¥{{ (item.price * item.quantity).toFixed(2) }}</div>
        </div>
        <div class="text-right text-sm text-gray-400 mt-3">
          商品总额：<span class="text-white font-medium">¥{{ rawTotal.toFixed(2) }}</span>
        </div>
      </section>

      <!-- ===== 优惠券选择 ===== -->
      <section class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">🎫 优惠券</h2>
        <div v-if="myCoupons.length === 0" class="text-sm text-gray-500">暂无可用优惠券</div>
        <div v-else class="space-y-2">
          <div v-for="uc in myCoupons" :key="uc.id"
            class="flex items-center justify-between p-3 rounded-lg bg-[#0A1628] cursor-pointer transition hover:border-indigo-500/50 border border-transparent"
            :class="selectedCouponId === uc.id ? 'border-indigo-500/50' : ''"
            @click="selectedCouponId = selectedCouponId === uc.id ? null : uc.id">
            <div>
              <div class="text-sm text-white">{{ uc.coupon.name }}</div>
              <div class="text-xs text-gray-500">
                <template v-if="uc.coupon.type === 'fixed'">满{{ uc.coupon.minAmount }}减{{ uc.coupon.value }}元</template>
                <template v-else-if="uc.coupon.type === 'discount'">{{ uc.coupon.value }}折</template>
                <template v-else-if="uc.coupon.type === 'full_reduce'">满{{ uc.coupon.minAmount }}减{{ uc.coupon.value }}元</template>
              </div>
            </div>
            <span v-if="selectedCouponId === uc.id" class="text-indigo-400 text-xs">已选 ✓</span>
          </div>
        </div>
      </section>

      <!-- ===== 备注 ===== -->
      <section class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">📝 备注</h2>
        <textarea v-model="remark" placeholder="选填：备注信息..."
          class="w-full bg-[#0A1628] border border-[#1A2D4A] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500" rows="2"></textarea>
      </section>

      <!-- ===== 价格明细 ===== -->
      <section class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">💰 价格明细</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between text-gray-400">
            <span>商品总额</span>
            <span>¥{{ rawTotal.toFixed(2) }}</span>
          </div>
          <div v-if="discountAmount > 0" class="flex justify-between text-green-400">
            <span>优惠券减免</span>
            <span>-¥{{ discountAmount.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-white font-semibold text-base border-t border-[#1A2D4A] pt-2 mt-2">
            <span>应付总额</span>
            <span class="text-red-400">¥{{ payAmount.toFixed(2) }}</span>
          </div>
        </div>
      </section>

      <!-- ===== 提交按钮 ===== -->
      <button @click="submitOrder" :disabled="!selectedAddressId || submitting"
        class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg text-sm font-medium transition">
        {{ submitting ? '提交中...' : '提交订单' }}
      </button>
    </div>

    <!-- ===== 新增地址弹窗 ===== -->
    <div v-if="showAddressForm" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" @click.self="showAddressForm = false">
      <div class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <h2 class="text-base font-semibold text-white mb-4">新增收货地址</h2>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">收件人 *</label>
            <input v-model="addrForm.name" class="w-full bg-[#0A1628] border border-[#1A2D4A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">手机号 *</label>
            <input v-model="addrForm.phone" class="w-full bg-[#0A1628] border border-[#1A2D4A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">省市区 *</label>
            <RegionPicker @change="onRegionChange" />
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">详细地址 *</label>
            <input v-model="addrForm.detail" class="w-full bg-[#0A1628] border border-[#1A2D4A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="addrForm.isDefault" class="accent-indigo-500" />
            <span class="text-xs text-gray-400">设为默认地址</span>
          </label>
        </div>
        <div class="flex gap-3 mt-5">
          <button @click="showAddressForm = false" class="flex-1 border border-[#1A2D4A] text-gray-400 py-2 rounded-lg text-sm hover:text-white">取消</button>
          <button @click="saveAddress" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken } from '~/utils/token-cache'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import RegionPicker from '~/components/RegionPicker.vue'

const router = useRouter()
const addresses = ref<any[]>([])
const checkoutItems = ref<any[]>([])
const myCoupons = ref<any[]>([])
const selectedAddressId = ref<string | null>(null)
const selectedCouponId = ref<string | null>(null)
const remark = ref('')
const submitting = ref(false)
const showAddressForm = ref(false)

const addrForm = ref({ name: '', phone: '', province: '', city: '', district: '', detail: '', isDefault: false })
const regionData = ref<any>(null)

function onRegionChange(data: any) {
  regionData.value = data
  if (data) {
    addrForm.value.province = data.provinceName || ''
    addrForm.value.city = data.cityName || ''
    addrForm.value.district = data.districtName || ''
  }
}

const rawTotal = computed(() => checkoutItems.value.reduce((s, i) => s + i.price * i.quantity, 0))

const discountAmount = computed(() => {
  if (!selectedCouponId.value) return 0
  const uc = myCoupons.value.find(c => c.id === selectedCouponId.value)
  if (!uc) return 0
  const coupon = uc.coupon
  const total = rawTotal.value
  if (total < coupon.minAmount) return 0
  if (coupon.type === 'fixed') return Math.min(coupon.value, total)
  if (coupon.type === 'discount') return total * (coupon.value / 100)
  if (coupon.type === 'full_reduce') return coupon.value
  return 0
})

const payAmount = computed(() => Math.max(0, rawTotal.value - discountAmount.value))

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` }
}

async function authFetch(url: string, opts?: any) {
  return $fetch(url, {
    ...opts,
    headers: { ...authHeaders(), ...opts?.headers },
  })
}

async function fetchData() {
  try {
    const [addrRes, couponRes] = await Promise.all([
      authFetch('/api/mall/addresses').catch(() => ({ success: false, data: [] })),
      authFetch('/api/mall/coupons/my').catch(() => ({ success: false, data: [] })),
    ])
    if (addrRes?.success) {
      addresses.value = addrRes.data || []
      if (addresses.value.length > 0 && !selectedAddressId.value) {
        const def = addresses.value.find(a => a.isDefault)
        selectedAddressId.value = def?.id || addresses.value[0].id
      }
    }
    if (couponRes?.success) myCoupons.value = (couponRes.data || []).filter((uc: any) => !uc.usedAt)
  } catch (e) { console.error(e) }
}

async function saveAddress() {
  if (!addrForm.value.name || !addrForm.value.phone || !addrForm.value.province || !addrForm.value.city || !addrForm.value.detail) {
    alert('请填写完整地址信息')
    return
  }
  try {
    const res = await authFetch('/api/mall/addresses', {
      method: 'POST',
      body: addrForm.value,
    })
    if (res?.success) {
      addresses.value.unshift(res.data)
      if (res.data.isDefault) {
        addresses.value.forEach(a => a.isDefault = a.id === res.data.id)
      }
      selectedAddressId.value = res.data.id
      showAddressForm.value = false
      addrForm.value = { name: '', phone: '', province: '', city: '', district: '', detail: '', isDefault: false }
      regionData.value = null
    }
  } catch (e: any) { alert(e?.data?.error || '保存失败') }
}

async function submitOrder() {
  if (!selectedAddressId.value) { alert('请选择收货地址'); return }
  if (checkoutItems.value.length === 0) { alert('请选择商品'); return }
  submitting.value = true
  try {
    const body: any = {
      items: checkoutItems.value.map(i => ({ productId: i.productId, quantity: i.quantity })),
      addressId: selectedAddressId.value,
      remark: remark.value || undefined,
    }
    if (selectedCouponId.value) body.couponId = selectedCouponId.value

    const res = await authFetch('/api/mall/orders/create', {
      method: 'POST',
      body,
    })
    if (res?.success) {
      sessionStorage.removeItem('checkout_items')
      router.push(`/mall/pay/${res.data.orderNo}`)
    }
  } catch (e: any) {
    alert(e?.data?.error || '提交订单失败')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const token = getToken()
  if (!token) {
    alert('请先登录')
    router.push('/mall')
    return
  }
  try {
    const cached = sessionStorage.getItem('checkout_items')
    if (cached) {
      const items = JSON.parse(cached)
      const details = await Promise.all(
        items.map(async (item: any) => {
          try {
            const r: any = await $fetch(`/api/mall/products/${item.productId}`)
            if (r?.success) return { ...r.data, quantity: item.quantity, productId: item.productId }
          } catch { return null }
          return null
        })
      )
      checkoutItems.value = details.filter(Boolean)
    }
  } catch { }
  if (checkoutItems.value.length === 0) {
    alert('购物车为空')
    router.push('/mall/cart')
    return
  }
  fetchData()
})
</script>
