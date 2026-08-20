<template>
  <div class="min-h-full" style="background: #070B16">
    <div class="max-w-[1560px] mx-auto px-4 py-4 space-y-3">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 class="text-lg font-bold text-amber-300 tracking-wider">🏮 昆仑茶馆 · 城市代理申请管理</h1>
          <p class="text-xs text-slate-400 mt-1">申请表留言 · 公司信息 · 申请城市 · 联系人与电话</p>
        </div>
        <div class="flex gap-2">
          <button @click="load" class="px-3 py-1.5 rounded-lg text-xs bg-amber-600/20 border border-amber-500/30 text-amber-200 hover:bg-amber-600/30 cursor-pointer">🔄 刷新</button>
          <a href="/admin-identity.html" target="_blank" class="px-3 py-1.5 rounded-lg text-xs bg-slate-800/60 border border-slate-600/40 text-slate-300 hover:text-white no-underline">🔐 会员密钥管理</a>
        </div>
      </div>

      <div v-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
        ⚠️ {{ error }}
        <button @click="load" class="ml-2 underline cursor-pointer">重试</button>
      </div>

      <div v-if="!error" class="bg-slate-900/60 border border-slate-700/40 rounded-xl overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-800/60 text-amber-200/90">
              <th class="px-3 py-2.5 font-semibold">#</th>
              <th class="px-3 py-2.5 font-semibold">公司名称</th>
              <th class="px-3 py-2.5 font-semibold">公司地点</th>
              <th class="px-3 py-2.5 font-semibold">人员规模</th>
              <th class="px-3 py-2.5 font-semibold">申请城市</th>
              <th class="px-3 py-2.5 font-semibold">联系人</th>
              <th class="px-3 py-2.5 font-semibold">联系电话</th>
              <th class="px-3 py-2.5 font-semibold">申请人</th>
              <th class="px-3 py-2.5 font-semibold">提交时间</th>
              <th class="px-3 py-2.5 font-semibold">状态</th>
              <th class="px-3 py-2.5 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(a, i) in applies" :key="a.id" class="border-t border-slate-800/60 hover:bg-slate-800/30">
              <td class="px-3 py-2.5 text-slate-400">{{ i + 1 }}</td>
              <td class="px-3 py-2.5 text-slate-100 font-medium">{{ a.companyName }}</td>
              <td class="px-3 py-2.5 text-slate-300">{{ a.companyLoc }}</td>
              <td class="px-3 py-2.5 text-slate-300">{{ a.companyScale }}</td>
              <td class="px-3 py-2.5">
                <span class="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-200">{{ a.cityName }}</span>
              </td>
              <td class="px-3 py-2.5 text-slate-200">{{ a.contactName }}</td>
              <td class="px-3 py-2.5 text-slate-200">{{ a.contactPhone }}</td>
              <td class="px-3 py-2.5 text-slate-400">{{ a.nickname }}</td>
              <td class="px-3 py-2.5 text-slate-400">{{ fmt(a.createdAt) }}</td>
              <td class="px-3 py-2.5">
                <span :class="tagCls(a.status)">{{ tagTxt(a.status) }}</span>
                <div v-if="a.note" class="text-[10px] text-slate-500 mt-0.5">{{ a.note }}</div>
              </td>
              <td class="px-3 py-2.5">
                <template v-if="a.status === 'pending'">
                  <button @click="setStatus(a, 'approved')" class="px-2.5 py-1 rounded-md text-[11px] bg-emerald-600/25 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/40 cursor-pointer mr-1.5">通过</button>
                  <button @click="setStatus(a, 'rejected')" class="px-2.5 py-1 rounded-md text-[11px] bg-red-600/25 border border-red-500/40 text-red-200 hover:bg-red-600/40 cursor-pointer">拒绝</button>
                </template>
                <span v-else class="text-slate-500 text-[11px]">已处理</span>
              </td>
            </tr>
            <tr v-if="!applies.length && !loading">
              <td colspan="11" class="px-3 py-10 text-center text-slate-500">暂无代理申请</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { onMounted, ref } from 'vue'

const applies = ref<any[]>([])
const error = ref('')
const loading = ref(false)

function tok() {
  return window.localStorage?.getItem('auth_token') || ''
}
function fmt(d: any) {
  if (!d) return ''
  const t = new Date(d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}
function tagTxt(s: string) { return s === 'approved' ? '已通过' : s === 'rejected' ? '已拒绝' : '待审核' }
function tagCls(s: string) {
  if (s === 'approved') return 'px-2 py-0.5 rounded text-[11px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
  if (s === 'rejected') return 'px-2 py-0.5 rounded text-[11px] bg-red-500/15 border border-red-500/30 text-red-200'
  return 'px-2 py-0.5 rounded text-[11px] bg-amber-500/15 border border-amber-500/30 text-amber-200'
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/admin/tea-agent/applies', { headers: { Authorization: `Bearer ${tok()}` } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    applies.value = j.data?.applies || []
  } catch (e: any) {
    error.value = '❌ ' + (e.message || '加载失败') + (res401(e) ? '（请确认已登录后台管理员账号）' : '')
  } finally {
    loading.value = false
  }
}
function res401(e: any) { return /401|未授权|未登录/.test(String(e.message || '')) }
async function setStatus(a: any, status: string) {
  if (!confirm(status === 'approved' ? `通过「${a.companyName}」的城市代理申请？` : `拒绝「${a.companyName}」的申请？`)) return
  try {
    const res = await fetch('/api/admin/tea-agent/applies/' + a.id + '/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ status, note: status === 'approved' ? '已通过，可开通城市' : '未通过，可补充材料' }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    await load()
  } catch (e: any) {
    alert('❌ ' + (e.message || '操作失败'))
  }
}
onMounted(load)
</script>
