<template>
  <div class="min-h-full" style="background: #070B16">
    <div class="max-w-[860px] mx-auto px-4 py-4 space-y-4">
      <div>
        <h1 class="text-lg font-bold text-amber-300 tracking-wider">🏮 昆仑茶馆 · 社区管理员设置</h1>
        <p class="text-xs text-slate-400 mt-1">公共社区管理员：可删帖、禁言用户；城市/宗亲管理员另有城市治理体系</p>
      </div>

      <div v-if="err" class="rounded-xl bg-red-900/20 border border-red-800/40 p-3 text-xs text-red-300">{{ err }}</div>

      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4">
        <h2 class="text-sm font-bold text-amber-300 mb-2">添加管理员</h2>
        <div class="flex gap-2">
          <input v-model="newUid" class="flex-1 bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" placeholder="用户 UID（如 0ba5bf98-7005-4019-a431-6a0fb4b2d28d）">
          <button @click="addAdmin" class="px-4 py-2 rounded-lg text-xs bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold cursor-pointer">＋ 添加</button>
        </div>
        <div class="text-[11px] text-slate-500 mt-1.5">提示：在用户列表中复制目标用户 ID；管理员拥有公共社区删帖/禁言权限</div>
      </div>

      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4">
        <h2 class="text-sm font-bold text-amber-300 mb-2">当前管理员（{{ admins.length }}）</h2>
        <div v-if="!admins.length" class="text-xs text-slate-500 py-4 text-center">暂无管理员</div>
        <div v-for="a in admins" :key="a.uid" class="flex items-center justify-between gap-2 py-2 border-b border-slate-800/60 last:border-0">
          <div class="min-w-0">
            <span class="text-sm text-slate-100 font-medium">{{ a.nickname }}</span>
            <span class="text-[11px] text-slate-500 ml-2 font-mono">{{ a.uid }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] text-slate-500">{{ a.phone || '' }} · {{ fmt(a.createdAt) }}</span>
            <button @click="removeAdmin(a)" class="px-2.5 py-1 rounded-md text-[11px] bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 cursor-pointer">移除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

definePageMeta({ layout: 'admin-aigc' })

const admins = ref<any[]>([])
const newUid = ref('')
const err = ref('')

function tok() { return window.localStorage?.getItem('auth_token') || '' }
function fmt(d: any) {
  if (!d) return ''
  const t = new Date(d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
async function load() {
  err.value = ''
  try {
    const res = await fetch('/api/admin/tea/admins', { headers: { Authorization: `Bearer ${tok()}` } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    admins.value = j.data?.admins || []
  } catch (e: any) { err.value = '❌ ' + (e.message || '加载失败') }
}
async function addAdmin() {
  const uid = newUid.value.trim()
  if (!uid) { err.value = '请输入用户 UID'; return }
  try {
    const res = await fetch('/api/admin/tea/admins/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ targetUid: uid }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    newUid.value = ''
    await load()
  } catch (e: any) { err.value = '❌ ' + (e.message || '添加失败') }
}
async function removeAdmin(a: any) {
  if (!confirm(`移除管理员「${a.nickname}」？`)) return
  try {
    const res = await fetch('/api/admin/tea/admins/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ targetUid: a.uid }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    await load()
  } catch (e: any) { err.value = '❌ ' + (e.message || '移除失败') }
}
onMounted(load)
</script>
