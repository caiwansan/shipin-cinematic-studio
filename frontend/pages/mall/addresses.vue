<template>
  <div class="min-h-screen bg-[#050A15]">
    <div class="bg-gradient-to-b from-[#0A1628] to-[#050A15] py-4">
      <div class="max-w-4xl mx-auto px-4">
        <NuxtLink to="/mall" class="text-sm text-gray-400 hover:text-white">← 返回商城</NuxtLink>
        <h1 class="text-xl font-bold text-white mt-2">📍 地址管理</h1>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-4 py-4">
      <!-- 未登录 -->
      <div v-if="!isLoggedIn" class="text-center py-20">
        <p class="text-gray-400 text-lg mb-4">请先登录后管理地址</p>
        <button @click="goLogin" class="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">去登录</button>
      </div>

      <template v-else>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-white">共 {{ addresses.length }} 个地址</h2>
          <button @click="openAddForm" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg transition">+ 新增地址</button>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="text-center py-12 text-gray-400">加载中...</div>

        <!-- 空状态 -->
        <div v-else-if="addresses.length === 0" class="text-center py-20 text-gray-500">暂无地址，点击上方按钮添加</div>

        <!-- 地址列表 -->
        <div v-else class="space-y-4">
          <div v-for="addr in addresses" :key="addr.id"
            class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4 hover:border-indigo-500/30 transition">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-white">{{ addr.name }}</span>
                  <span class="text-xs text-gray-500">{{ addr.phone }}</span>
                  <span v-if="addr.isDefault" class="text-[10px] bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded">默认</span>
                </div>
                <div class="text-xs text-gray-400 mt-1">{{ addr.province }} {{ addr.city }} {{ addr.district }} {{ addr.detail }}</div>
              </div>
              <div class="flex items-center gap-2 shrink-0 ml-4">
                <button v-if="!addr.isDefault" @click="setDefault(addr.id)" class="text-xs text-indigo-400 hover:text-indigo-300">设为默认</button>
                <button @click="openEditForm(addr)" class="text-xs text-gray-400 hover:text-white">✏️ 编辑</button>
                <button @click="deleteAddress(addr.id)" class="text-xs text-gray-500 hover:text-red-400">🗑️ 删除</button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ===== 新增/编辑弹窗 ===== -->
    <div v-if="showForm" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" @click.self="showForm = false">
      <div class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-6 w-full max-w-md">
        <h2 class="text-base font-semibold text-white mb-4">{{ editingId ? '编辑地址' : '新增地址' }}</h2>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-400 block mb-1">收件人 *</label>
            <input v-model="form.name" class="w-full bg-[#0A1628] border border-[#1A2D4A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">手机号 *</label>
            <input v-model="form.phone" class="w-full bg-[#0A1628] border border-[#1A2D4A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">省市区 *</label>
            <RegionPicker @change="onRegionChange" />
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">详细地址 *</label>
            <input v-model="form.detail" class="w-full bg-[#0A1628] border border-[#1A2D4A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="form.isDefault" class="accent-indigo-500" />
            <span class="text-xs text-gray-400">设为默认地址</span>
          </label>
        </div>
        <div class="flex gap-3 mt-5">
          <button @click="showForm = false" class="flex-1 border border-[#1A2D4A] text-gray-400 py-2 rounded-lg text-sm hover:text-white">取消</button>
          <button @click="saveAddress" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken } from '~/utils/token-cache'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import RegionPicker from '~/components/RegionPicker.vue'

function authHeaders() { return { Authorization: `Bearer ${getToken()}` } }
function authFetch(url: string, opts?: any) {
  return $fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } })
}

const router = useRouter()
const isLoggedIn = ref(false)
const loading = ref(true)
const addresses = ref<any[]>([])
const showForm = ref(false)
const editingId = ref<string | null>(null)
const form = ref({ name: '', phone: '', province: '', city: '', district: '', detail: '', isDefault: false })

function onRegionChange(data: any) {
  if (data) {
    form.value.province = data.provinceName || ''
    form.value.city = data.cityName || ''
    form.value.district = data.districtName || ''
  }
}

function checkLogin() {
  const token = getToken()
  isLoggedIn.value = !!token
}

async function fetchAddresses() {
  if (!isLoggedIn.value) { loading.value = false; return }
  loading.value = true
  try {
    const res = await authFetch('/api/mall/addresses')
    if (res?.success) addresses.value = res.data || []
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function openAddForm() {
  editingId.value = null
  form.value = { name: '', phone: '', province: '', city: '', district: '', detail: '', isDefault: false }
  showForm.value = true
}

function openEditForm(addr: any) {
  editingId.value = addr.id
  form.value = {
    name: addr.name,
    phone: addr.phone,
    province: addr.province,
    city: addr.city,
    district: addr.district,
    detail: addr.detail,
    isDefault: addr.isDefault,
  }
  showForm.value = true
}

async function saveAddress() {
  if (!form.value.name || !form.value.phone || !form.value.province || !form.value.city || !form.value.detail) {
    alert('请填写完整地址信息')
    return
  }
  try {
    let res
    if (editingId.value) {
      res = await authFetch(`/api/mall/addresses/${editingId.value}`, {
        method: 'PUT',
        body: form.value,
      })
    } else {
      res = await authFetch('/api/mall/addresses', {
        method: 'POST',
        body: form.value,
      })
    }
    if (res?.success) {
      showForm.value = false
      fetchAddresses()
    }
  } catch (e: any) { alert(e?.data?.error || '保存失败') }
}

async function setDefault(id: string) {
  try {
    await $fetch(`/api/mall/addresses/${id}`, {
      method: 'PUT',
      body: { isDefault: true },
    })
    fetchAddresses()
  } catch (e: any) { alert(e?.data?.error || '设置失败') }
}

async function deleteAddress(id: string) {
  if (!confirm('确定删除该地址？')) return
  try {
    const res = await authFetch(`/api/mall/addresses/${id}`, { method: 'DELETE' })
    if (res?.success) fetchAddresses()
  } catch (e: any) { alert(e?.data?.error || '删除失败') }
}

function goLogin() { router.push('/director-os/aigc/login') }

onMounted(() => { checkLogin(); fetchAddresses() })
</script>
