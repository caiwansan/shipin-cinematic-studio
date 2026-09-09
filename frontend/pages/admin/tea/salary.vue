<template>
  <div class="min-h-full" style="background: #070B16">
    <div class="max-w-[1560px] mx-auto px-4 py-4 space-y-4">
      <div>
        <h1 class="text-lg font-bold text-amber-300 tracking-wider">💰 昆仑茶馆 · 城市社区薪资管理</h1>
        <p class="text-xs text-slate-400 mt-1">薪资由管理员发放，仅对城市社区的创始人/管理员/议员有效，普通群管理员和群主无效</p>
      </div>

      <div v-if="err" class="rounded-xl bg-red-900/20 border border-red-800/40 p-3 text-xs text-red-300">{{ err }}</div>
      <div v-if="saved" class="rounded-xl bg-emerald-900/20 border border-emerald-700/40 p-3 text-xs text-emerald-300">✅ 已保存</div>

      <!-- 薪资配置 -->
      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4 space-y-3">
        <h2 class="text-sm font-bold text-amber-300">⚙️ 薪资配置（工分/日）</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label class="text-xs text-slate-400 block mb-1">创始人每日工分</label>
            <input v-model.number="cfg.founderAmount" type="number" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono">
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">管理员每日工分</label>
            <input v-model.number="cfg.adminAmount" type="number" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono">
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">议员每日工分</label>
            <input v-model.number="cfg.mpAmount" type="number" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono">
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">在线时长要求（秒）</label>
            <input v-model.number="cfg.onlineRequiredSeconds" type="number" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono">
          </div>
        </div>
        <div class="flex gap-2 pt-1">
          <button @click="saveConfig" class="px-4 py-2 rounded-lg text-xs bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold cursor-pointer">💾 保存配置</button>
          <button @click="loadConfig" class="px-4 py-2 rounded-lg text-xs border border-slate-600 text-slate-300 hover:text-white cursor-pointer">↻ 重新加载</button>
        </div>
      </div>

      <!-- 成员列表 -->
      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h2 class="text-sm font-bold text-amber-300">👥 城市成员薪资发放</h2>
          <div class="flex gap-2 items-center">
            <select v-model="cityId" class="bg-black/40 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
              <option value="">全部城市</option>
              <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <button @click="loadMembers" class="px-3 py-1.5 rounded-lg text-xs bg-amber-600/20 border border-amber-500/30 text-amber-200 hover:bg-amber-600/30 cursor-pointer">🔄 刷新</button>
          </div>
        </div>

        <div v-if="!members.length" class="text-xs text-slate-500 py-4 text-center">暂无成员</div>
        <table v-else class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-800/60 text-amber-200/90">
              <th class="px-3 py-2.5 font-semibold">#</th>
              <th class="px-3 py-2.5 font-semibold">用户</th>
              <th class="px-3 py-2.5 font-semibold">角色</th>
              <th class="px-3 py-2.5 font-semibold">城市</th>
              <th class="px-3 py-2.5 font-semibold">工分</th>
              <th class="px-3 py-2.5 font-semibold">茶票</th>
              <th class="px-3 py-2.5 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, i) in members" :key="m.uid + m.cityId" class="border-t border-slate-800/60 hover:bg-slate-800/30">
              <td class="px-3 py-2.5 text-slate-400">{{ i + 1 }}</td>
              <td class="px-3 py-2.5 text-slate-100 font-medium">{{ m.nickname }}</td>
              <td class="px-3 py-2.5">
                <span class="px-2 py-0.5 rounded text-[11px]" :class="m.role === 'founder' ? 'bg-emerald-500/15 text-emerald-300' : m.role === 'admin' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-500/15 text-slate-300'">
                  {{ m.role === 'founder' ? '创始人' : m.role === 'admin' ? '管理员' : '议员' }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-slate-300">{{ m.cityName }}</td>
              <td class="px-3 py-2.5 text-slate-200 font-mono">{{ m.gongfen }}</td>
              <td class="px-3 py-2.5 text-slate-200 font-mono">{{ m.chapiao }}</td>
              <td class="px-3 py-2.5">
                <button @click="grant(m)" class="px-2.5 py-1 rounded-md text-[11px] bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/50 cursor-pointer">发放</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

definePageMeta({ layout: 'admin-aigc' })

const cfg = reactive({ founderAmount: 200, adminAmount: 100, mpAmount: 50, onlineRequiredSeconds: 7200 })
const members = ref<any[]>([])
const cities = ref<any[]>([])
const cityId = ref('')
const err = ref('')
const saved = ref(false)

function tok() { return window.localStorage?.getItem('auth_token') || '' }
async function api(path: string, opts: any = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
  return j
}

async function loadConfig() {
  try {
    const j = await api('/api/admin/tea/salary/config')
    Object.assign(cfg, j.data)
  } catch (e: any) { err.value = e.message }
}

async function saveConfig() {
  err.value = ''; saved.value = false
  try {
    await api('/api/admin/tea/salary/config', { method: 'PUT', body: JSON.stringify(cfg) })
    saved.value = true
  } catch (e: any) { err.value = e.message }
}

async function loadMembers() {
  err.value = ''
  try {
    const j = await api('/api/admin/tea/salary/members' + (cityId.value ? '?cityId=' + cityId.value : ''))
    members.value = j.data.members
    cities.value = j.data.cities
  } catch (e: any) { err.value = e.message }
}

async function grant(m: any) {
  if (!confirm(`确认发放 ${m.nickname}（${m.role === 'founder' ? '创始人' : m.role === 'admin' ? '管理员' : '议员'}）当日薪资？`)) return
  try {
    const j = await api('/api/admin/tea/salary/grant', { method: 'POST', body: JSON.stringify({ uid: m.uid, cityId: m.cityId }) })
    alert(`已发放 ${j.data.amount} 工分`)
    loadMembers()
  } catch (e: any) { err.value = e.message }
}

onMounted(async () => {
  await loadConfig()
  await loadMembers()
})
</script>
