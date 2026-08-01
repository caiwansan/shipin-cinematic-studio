<!--
  pages/admin/ai-providers.vue — AI模型供应商管理（AI Provider Center 后台）
  掌柜指令 2026-08-01：管理员维护所有模型入口（官方链接 + 推广链接 + 推荐等级）
-->
<template>
  <div class="min-h-full p-4" style="background: #070B16">
    <div class="max-w-[1400px] mx-auto space-y-4">
      <!-- ═══ 头部 ═══ -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-lg font-semibold text-white">🧠 AI模型供应商管理</h1>
          <p class="text-xs text-gray-500 mt-1">模型生态入口目录：官方注册 / 充值 / 教程 / 推广链接（BYOK，不保存用户 Key）</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-gray-500">共 {{ providers.length }} 家</span>
          <button @click="openCreate"
            class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition cursor-pointer border-none">＋ 新增供应商</button>
        </div>
      </div>

      <!-- ═══ 统计 ═══ -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div class="text-[11px] text-gray-500">全部</div>
          <div class="text-2xl font-semibold text-white mt-1">{{ providers.length }}</div>
        </div>
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div class="text-[11px] text-gray-500">启用中</div>
          <div class="text-2xl font-semibold text-emerald-400 mt-1">{{ providers.filter(p => p.status === 'active').length }}</div>
        </div>
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div class="text-[11px] text-gray-500">国产</div>
          <div class="text-2xl font-semibold text-red-300 mt-1">{{ providers.filter(p => p.category === 'domestic').length }}</div>
        </div>
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div class="text-[11px] text-gray-500">海外</div>
          <div class="text-2xl font-semibold text-blue-300 mt-1">{{ providers.filter(p => p.category === 'overseas').length }}</div>
        </div>
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div class="text-[11px] text-gray-500">启用推广链接</div>
          <div class="text-2xl font-semibold text-amber-300 mt-1">{{ providers.filter(p => p.affiliateEnabled && p.affiliateUrl).length }}</div>
        </div>
      </div>

      <div v-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">⚠️ {{ error }}</div>

      <!-- ═══ 列表 ═══ -->
      <div class="rounded-xl border border-white/[0.06] bg-[#0A0F1E]/60 overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-white/[0.06] text-gray-500">
              <th class="px-4 py-3 font-medium">供应商</th>
              <th class="px-4 py-3 font-medium">分类</th>
              <th class="px-4 py-3 font-medium">国家</th>
              <th class="px-4 py-3 font-medium">标签</th>
              <th class="px-4 py-3 font-medium">推荐</th>
              <th class="px-4 py-3 font-medium">推广链接</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in sortedProviders" :key="p.id" class="border-b border-white/[0.04] hover:bg-white/[0.02]">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white border border-white/10 shrink-0"
                    :style="{ background: `linear-gradient(135deg, ${brandColors(p.code)[0]}, ${brandColors(p.code)[1]})` }">
                    {{ p.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="text-white font-medium">{{ p.name }}</div>
                    <div class="text-[10px] text-gray-600">code: {{ p.code }} · sort: {{ p.sort }}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="text-[10px] px-2 py-0.5 rounded-md border"
                  :class="p.category === 'domestic' ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'">
                  {{ p.category === 'domestic' ? '国产' : '海外' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-400">{{ p.country || '—' }}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1 max-w-[220px]">
                  <span v-for="t in (p.tags || []).slice(0, 3)" :key="t" class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300">{{ t }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="text-amber-400 text-[11px]">{{ '★'.repeat(p.recommended) }}<span class="text-white/10">{{ '★'.repeat(5 - p.recommended) }}</span></span>
              </td>
              <td class="px-4 py-3">
                <span v-if="p.affiliateEnabled && p.affiliateUrl" class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20" title="前台注册按钮将优先使用推广链接">✅ 已启用</span>
                <span v-else class="text-[10px] text-gray-600">—</span>
              </td>
              <td class="px-4 py-3">
                <button @click="toggle(p)" class="text-[10px] px-2 py-1 rounded-full border cursor-pointer transition"
                  :class="p.status === 'active' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/25 hover:bg-gray-500/20'">
                  {{ p.status === 'active' ? '● 启用' : '○ 停用' }}
                </button>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <button @click="openEdit(p)" class="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer bg-transparent border-none">编辑</button>
                  <button @click="remove(p)" class="text-[11px] text-red-400/70 hover:text-red-400 cursor-pointer bg-transparent border-none">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ═══ 新增/编辑弹窗 ═══ -->
      <div v-if="dialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="dialog = false">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-[680px] max-h-[90vh] overflow-y-auto shadow-2xl">
          <div class="flex items-center justify-between px-6 py-4 border-b border-[#1A2240] sticky top-0 bg-[#0D1328]">
            <h2 class="text-sm font-semibold text-white">{{ editing ? '编辑供应商' : '新增供应商' }}</h2>
            <button @click="dialog = false" class="text-gray-500 hover:text-white text-lg leading-none cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <div class="p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">名称 *</label>
                <input v-model="form.name" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="DeepSeek" />
              </div>
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">Code *（唯一标识，如 deepseek）</label>
                <input v-model="form.code" :disabled="!!editing" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" placeholder="deepseek" />
              </div>
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">分类</label>
                <select v-model="form.category" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="domestic">国产</option>
                  <option value="overseas">海外</option>
                </select>
              </div>
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">国家/地区</label>
                <input v-model="form.country" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="中国 / 美国" />
              </div>
            </div>
            <div>
              <label class="text-[11px] text-gray-500 block mb-1.5">简介</label>
              <textarea v-model="form.description" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="模型简介，将展示在前台卡片"></textarea>
            </div>
            <div>
              <label class="text-[11px] text-gray-500 block mb-1.5">能力标签（逗号分隔）</label>
              <input v-model="tagsText" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="推理, 代码, Agent" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">官网</label>
                <input v-model="form.officialWebsite" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://" />
              </div>
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">注册链接</label>
                <input v-model="form.registerUrl" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://" />
              </div>
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">充值入口</label>
                <input v-model="form.billingUrl" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://" />
              </div>
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">配置教程</label>
                <input v-model="form.documentationUrl" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://" />
              </div>
            </div>

            <!-- 推广链接（affiliate） -->
            <div class="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs text-amber-300 font-medium">🎯 官方推广注册链接（affiliate）</div>
                  <div class="text-[10px] text-gray-500 mt-0.5">启用后，前台「立即注册」按钮优先跳转推广链接；未启用则使用官方注册链接</div>
                </div>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="form.affiliateEnabled" class="accent-amber-500" />
                  <span class="text-[11px] text-gray-400">启用</span>
                </label>
              </div>
              <input v-model="form.affiliateUrl" class="w-full bg-[#0B1020] border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-amber-500" placeholder="推广注册链接，如 https://deepseek.com/?ref=kunlun" />
              <input v-model="form.affiliateDescription" class="w-full bg-[#0B1020] border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-amber-500" placeholder="推广说明（可选），如：通过推荐链接注册享 10 元额度" />
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">推荐等级（1-5）</label>
                <input v-model.number="form.recommended" type="number" min="1" max="5" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">排序（小在前）</label>
                <input v-model.number="form.sort" type="number" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="text-[11px] text-gray-500 block mb-1.5">状态</label>
                <select v-model="form.status" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1A2240]">
            <button @click="dialog = false" class="text-xs text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-[#1A2240] transition cursor-pointer bg-transparent">取消</button>
            <button @click="save" :disabled="saving" class="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition cursor-pointer border-none">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })

const providers = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const tagsText = ref('')

const form = reactive({
  code: '', name: '', logo: '', description: '', category: 'domestic', country: '',
  officialWebsite: '', registerUrl: '', billingUrl: '', documentationUrl: '',
  affiliateUrl: '', affiliateEnabled: false, affiliateDescription: '',
  recommended: 3, sort: 0, status: 'active',
})

const sortedProviders = computed(() =>
  [...providers.value].sort((a, b) => (a.sort || 0) - (b.sort || 0) || (b.recommended || 0) - (a.recommended || 0))
)

function brandColors(code: string): [string, string] {
  const map: Record<string, [string, string]> = {
    deepseek: ['#4D6BFE', '#1E3A8A'], zhipu: ['#3859FF', '#6D28D9'], volcengine: ['#3370FF', '#00B4D8'],
    aliyun: ['#FF6A00', '#FF8E53'], moonshot: ['#7C3AED', '#312E81'], tencent: ['#0052D9', '#00C8FF'],
    baidu: ['#2932E1', '#4B5BFF'], iflytek: ['#1B7EFF', '#00A3FF'], meituan: ['#FFC300', '#FF8C00'],
    openai: ['#10A37F', '#0D5C46'], google: ['#4285F4', '#EA4335'], anthropic: ['#D97757', '#7C2D12'],
    meta: ['#0866FF', '#0047B3'],
  }
  return map[code] || ['#4F46E5', '#1E40AF']
}

function authHeaders(json = false) {
  const token = getToken()
  const h: Record<string, string> = {}
  if (token) h.Authorization = `Bearer ${token}`
  if (json) h['Content-Type'] = 'application/json'
  return h
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res: any = await fetch('/api/ai-provider-directory', { headers: authHeaders() }).then(r => r.json())
    // 后台列表需要包含停用项 → 走 admin 全量接口（同表，不过滤 status）
    const adminRes: any = await fetch('/api/admin/ai-provider-directory?all=1', { headers: authHeaders() }).then(r => r.json().catch(() => null))
    if (adminRes?.code === 0 && Array.isArray(adminRes.data)) {
      providers.value = adminRes.data
    } else if (res?.code === 0) {
      providers.value = res.data
    } else {
      error.value = '加载失败'
    }
  } finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { code: '', name: '', logo: '', description: '', category: 'domestic', country: '', officialWebsite: '', registerUrl: '', billingUrl: '', documentationUrl: '', affiliateUrl: '', affiliateEnabled: false, affiliateDescription: '', recommended: 3, sort: 0, status: 'active' })
  tagsText.value = ''
  dialog.value = true
}

function openEdit(p: any) {
  editing.value = p
  Object.assign(form, {
    code: p.code, name: p.name, logo: p.logo || '', description: p.description || '', category: p.category || 'domestic',
    country: p.country || '', officialWebsite: p.officialWebsite || '', registerUrl: p.registerUrl || '',
    billingUrl: p.billingUrl || '', documentationUrl: p.documentationUrl || '', affiliateUrl: p.affiliateUrl || '',
    affiliateEnabled: !!p.affiliateEnabled, affiliateDescription: p.affiliateDescription || '',
    recommended: p.recommended || 3, sort: p.sort || 0, status: p.status || 'active',
  })
  tagsText.value = (p.tags || []).join(', ')
  dialog.value = true
}

async function save() {
  if (!form.name || !form.code) { alert('名称与 Code 必填'); return }
  saving.value = true
  try {
    const payload = {
      ...form,
      tags: tagsText.value.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean),
      affiliateEnabled: !!form.affiliateEnabled,
    }
    const url = editing.value
      ? `/api/admin/ai-provider-directory/${editing.value.id}`
      : '/api/admin/ai-provider-directory'
    const res: any = await fetch(url, {
      method: editing.value ? 'PUT' : 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    }).then(r => r.json())
    if (res?.code === 0) {
      dialog.value = false
      await load()
    } else {
      alert(res?.error || '保存失败')
    }
  } finally { saving.value = false }
}

async function toggle(p: any) {
  await fetch(`/api/admin/ai-provider-directory/${p.id}/toggle`, { method: 'PATCH', headers: authHeaders() }).then(r => r.json())
  await load()
}

async function remove(p: any) {
  if (!confirm(`确认删除「${p.name}」？此操作不可恢复`)) return
  await fetch(`/api/admin/ai-provider-directory/${p.id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json())
  await load()
}

onMounted(load)
</script>
