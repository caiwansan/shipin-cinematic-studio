<template>
  <div class="min-h-full" style="background: #070B16">
    <div class="max-w-[860px] mx-auto px-4 py-4 space-y-4">
      <div>
        <h1 class="text-lg font-bold text-amber-300 tracking-wider">🏮 昆仑茶馆 · API 密钥配置</h1>
        <p class="text-xs text-slate-400 mt-1">高德地图等第三方服务密钥统一在此配置（密钥加密存储，留空表示不修改）</p>
      </div>

      <div v-if="err" class="rounded-xl bg-red-900/20 border border-red-800/40 p-3 text-xs text-red-300">{{ err }}</div>
      <div v-if="saved" class="rounded-xl bg-emerald-900/20 border border-emerald-700/40 p-3 text-xs text-emerald-300">✅ 已保存</div>

      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4 space-y-3">
        <h2 class="text-sm font-bold text-amber-300">🗺 高德地图</h2>

        <div>
          <label class="text-xs text-slate-400 block mb-1">JS API Key（客户端渲染地图用）<span v-if="cfg.hasAmapKey" class="text-emerald-400 ml-1">✓ 已配置</span></label>
          <input v-model="cfg.amapKey" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" placeholder="高德 JS API key">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">JS API 安全密钥 securityJsCode</label>
          <input v-model="cfg.amapSecurityJsCode" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" placeholder="高德 securityJsCode">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Web 服务 Key（服务端搜索/地理编码用）<span v-if="cfg.hasAmapWebKey" class="text-emerald-400 ml-1">✓ 已配置</span></label>
          <input v-model="cfg.amapWebKey" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" placeholder="高德 Web 服务 key">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Web 服务私钥（签名用）</label>
          <input v-model="cfg.amapWebSecret" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" placeholder="高德 Web 服务签名私钥">
        </div>

        <div class="flex gap-2 pt-1">
          <button @click="save" class="px-4 py-2 rounded-lg text-xs bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold cursor-pointer">💾 保存配置</button>
          <button @click="load" class="px-4 py-2 rounded-lg text-xs border border-slate-600 text-slate-300 hover:text-white cursor-pointer">↻ 重新加载</button>
        </div>
        <div class="text-[11px] text-slate-500 leading-relaxed">说明：①JS API key 用于桌面端/手机端地图渲染（客户端可见属正常） ②Web 服务密钥仅存服务器（IP 白名单） ③保存后桌面端最长 6 小时自动同步新配置</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

definePageMeta({ layout: 'admin-aigc' })

const cfg = reactive({ amapKey: '', amapSecurityJsCode: '', amapWebKey: '', amapWebSecret: '', hasAmapKey: false, hasAmapWebKey: false })
const err = ref('')
const saved = ref(false)

function tok() { return window.localStorage?.getItem('auth_token') || '' }
async function load() {
  err.value = ''
  saved.value = false
  try {
    const res = await fetch('/api/admin/tea/config', { headers: { Authorization: `Bearer ${tok()}` } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    cfg.amapKey = j.data?.amapKey || ''
    cfg.amapSecurityJsCode = j.data?.amapSecurityJsCode || ''
    cfg.amapWebKey = j.data?.amapWebKey || ''
    cfg.amapWebSecret = ''
    cfg.hasAmapKey = !!j.data?.hasAmapKey
    cfg.hasAmapWebKey = !!j.data?.hasAmapWebKey
  } catch (e: any) { err.value = '❌ ' + (e.message || '加载失败') }
}
async function save() {
  err.value = ''
  saved.value = false
  try {
    const res = await fetch('/api/admin/tea/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ amapKey: cfg.amapKey, amapSecurityJsCode: cfg.amapSecurityJsCode, amapWebKey: cfg.amapWebKey, amapWebSecret: cfg.amapWebSecret }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    saved.value = true
    setTimeout(() => { saved.value = false }, 2500)
    await load()
  } catch (e: any) { err.value = '❌ ' + (e.message || '保存失败') }
}
onMounted(load)
</script>
