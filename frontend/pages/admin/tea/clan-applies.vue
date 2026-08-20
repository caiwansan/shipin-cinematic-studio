<template>
  <div class="min-h-full" style="background: #070B16">
    <div class="max-w-[1560px] mx-auto px-4 py-4 space-y-3">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 class="text-lg font-bold text-amber-300 tracking-wider">🏮 昆仑茶馆 · 宗亲群开通申请管理</h1>
          <p class="text-xs text-slate-400 mt-1">宗亲群聊开通申请 · 通过后自动建群并任命申请人为族长</p>
        </div>
        <button @click="load" class="px-3 py-1.5 rounded-lg text-xs bg-amber-600/20 border border-amber-500/30 text-amber-200 hover:bg-amber-600/30 cursor-pointer">🔄 刷新</button>
      </div>

      <!-- 分区: 申请 / 已开通群 -->
      <div class="flex gap-2 flex-wrap">
        <button @click="view='apply'" :class="view==='apply'?'px-3 py-1.5 rounded-lg text-xs bg-amber-600/40 border border-amber-500/50 text-amber-100':'px-3 py-1.5 rounded-lg text-xs bg-slate-800/60 border border-slate-600/40 text-slate-300 hover:text-white'">📋 开通申请</button>
        <button @click="view='groups'" :class="view==='groups'?'px-3 py-1.5 rounded-lg text-xs bg-amber-600/40 border border-amber-500/50 text-amber-100':'px-3 py-1.5 rounded-lg text-xs bg-slate-800/60 border border-slate-600/40 text-slate-300 hover:text-white'">👥 已开通宗亲群管理</button>
      </div>

      <div v-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
        ⚠️ {{ error }}
        <button @click="load" class="ml-2 underline cursor-pointer">重试</button>
      </div>

      <div v-if="!error && view==='apply'" class="bg-slate-900/60 border border-slate-700/40 rounded-xl overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-800/60 text-amber-200/90">
              <th class="px-3 py-2.5 font-semibold">#</th>
              <th class="px-3 py-2.5 font-semibold">宗亲群名称</th>
              <th class="px-3 py-2.5 font-semibold">申请人</th>
              <th class="px-3 py-2.5 font-semibold">提交时间</th>
              <th class="px-3 py-2.5 font-semibold">状态</th>
              <th class="px-3 py-2.5 font-semibold">备注</th>
              <th class="px-3 py-2.5 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(a, i) in applies" :key="a.id" class="border-t border-slate-800/60 hover:bg-slate-800/30">
              <td class="px-3 py-2.5 text-slate-400">{{ i + 1 }}</td>
              <td class="px-3 py-2.5">
                <span class="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-200">{{ a.groupName }}</span>
              </td>
              <td class="px-3 py-2.5 text-slate-300">{{ a.nickname }}</td>
              <td class="px-3 py-2.5 text-slate-400">{{ fmt(a.createdAt) }}</td>
              <td class="px-3 py-2.5"><span :class="tagCls(a.status)">{{ tagTxt(a.status) }}</span></td>
              <td class="px-3 py-2.5 text-slate-400">{{ a.note }}</td>
              <td class="px-3 py-2.5">
                <div v-if="a.status === 'pending'" class="flex gap-2">
                  <button @click="setStatus(a, 'approved')" class="px-2.5 py-1 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-600/30 cursor-pointer">✅ 通过并建群</button>
                  <button @click="setStatus(a, 'rejected')" class="px-2.5 py-1 rounded bg-red-600/20 border border-red-500/30 text-red-200 hover:bg-red-600/30 cursor-pointer">⛔ 拒绝</button>
                </div>
                <span v-else class="text-slate-500 text-[11px]">已处理</span>
              </td>
            </tr>
            <tr v-if="!applies.length && !loading">
              <td colspan="7" class="px-3 py-10 text-center text-slate-500">暂无宗亲群开通申请</td>
            </tr>
          </tbody>
        </table>
      </div>
    <!-- 已开通宗亲群管理 -->
    <div v-if="!error && view==='groups'" class="bg-slate-900/60 border border-slate-700/40 rounded-xl overflow-hidden">
      <div class="px-4 py-3 text-sm text-amber-200/90">已开通宗亲群（{{ groups.length }}）</div>
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="bg-slate-800/60 text-amber-200/90">
            <th class="px-3 py-2.5 font-semibold">群名称</th>
            <th class="px-3 py-2.5 font-semibold">群主</th>
            <th class="px-3 py-2.5 font-semibold">成员数</th>
            <th class="px-3 py-2.5 font-semibold">状态</th>
            <th class="px-3 py-2.5 font-semibold">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in groups" :key="g.id" class="border-t border-slate-800/60 hover:bg-slate-800/30">
            <td class="px-3 py-2.5 text-slate-100 font-medium">{{ g.name }}</td>
            <td class="px-3 py-2.5 text-slate-300">{{ g.ownerName }}</td>
            <td class="px-3 py-2.5 text-slate-300">{{ g.memberCount }}</td>
            <td class="px-3 py-2.5"><span :class="g.status==='active'?'px-2 py-0.5 rounded text-[11px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-200':'px-2 py-0.5 rounded text-[11px] bg-slate-600/20 border border-slate-600/30 text-slate-300'">{{ g.status==='active'?'正常':'已解散' }}</span></td>
            <td class="px-3 py-2.5">
              <button v-if="g.status==='active'" @click="dissolve(g)" class="px-2.5 py-1 rounded bg-red-600/20 border border-red-500/30 text-red-200 hover:bg-red-600/30 cursor-pointer">⛔ 解散群</button>
              <span v-else class="text-slate-500 text-[11px]">已解散</span>
            </td>
          </tr>
          <tr v-if="!groups.length && !loading">
            <td colspan="5" class="px-3 py-10 text-center text-slate-500">暂无已开通宗亲群</td>
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
const groups = ref<any[]>([])
const view = ref('apply')
const error = ref('')
const loading = ref(false)

function tok() { return window.localStorage?.getItem('auth_token') || '' }
function fmt(d: any) {
  if (!d) return ''
  const n = Number(d)
  const t = n > 10000000000 ? new Date(n) : new Date(n * 1000)
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
    const res = await fetch('/api/admin/tea-clan/applies', { headers: { Authorization: `Bearer ${tok()}` } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    applies.value = j.data?.applies || []
  } catch (e: any) {
    error.value = '❌ ' + (e.message || '加载失败')
  } finally { loading.value = false }
}
async function setStatus(a: any, status: string) {
  if (!confirm(status === 'approved' ? `通过并创建宗亲群「${a.groupName}」？申请人将成为族长。` : `拒绝「${a.groupName}」的申请？`)) return
  try {
    const res = await fetch('/api/admin/tea-clan/applies/' + a.id + '/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ status, note: status === 'approved' ? '已通过，宗亲群已创建' : '未通过，可补充信息' }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    await load()
  } catch (e: any) { alert('❌ ' + (e.message || '操作失败')) }
}
async function loadGroups() {
  try {
    const res = await fetch('/api/admin/tea-clan/groups', { headers: { Authorization: `Bearer ${tok()}` } })
    const j = await res.json().catch(() => ({}))
    if (res.ok) groups.value = j.data?.groups || []
  } catch { groups.value = [] }
}
async function dissolve(g: any) {
  if (!confirm(`确定解散宗亲群「${g.name}」？群成员、族谱、帖子将被清除，不可恢复。`)) return
  try {
    const res = await fetch('/api/admin/tea-clan/groups/' + g.id + '/dissolve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok()}` },
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    await loadGroups()
  } catch (e: any) { alert('❌ ' + (e.message || '解散失败')) }
}
onMounted(() => { load(); loadGroups() })
</script>
