<!-- ⛔ DEPRECATED · 已退出后台导航（SPRINT-ADMIN-IA-RECRUITMENT-CLEANUP-01）· 页面保留仅供 URL 直链/归档，业务数据归企业招聘工作台，运营数据归数据罗盘 -->
<!-- Admin: 审计中心 -->
<!-- 位置：/admin/recruitment/audit.vue -->
<!-- 职责：AI 员工操作审计日志 — 搜索/筛选/详情 -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">🔍 审计中心</h1>
        <p class="text-xs text-gray-500 mt-1">AI 员工操作审计日志 · Reality Audit 记录</p>
      </div>
      <button @click="fetchData" class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">🔄 刷新</button>
    </div>

    <!-- Search & Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
        <input
          v-model="searchKey"
          @keyup.enter="page = 1; fetchData()"
          placeholder="搜索操作类型、执行者..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterStatus" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部状态</option>
        <option value="success">成功</option>
        <option value="failure">失败</option>
      </select>
      <select v-model="filterAction" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部操作</option>
        <option v-for="a in actionTypes" :key="a" :value="a">{{ a }}</option>
      </select>
      <input v-model="dateFrom" @change="page = 1; fetchData()" type="date" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2" />
      <span class="text-gray-600 text-xs">至</span>
      <input v-model="dateTo" @change="page = 1; fetchData()" type="date" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载中...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      ⚠️ {{ error }} <button @click="fetchData" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <template v-else>
      <!-- Summary -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-white/90">{{ total }}</div>
          <div class="text-[10px] text-gray-500">总记录</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-green-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-green-400">{{ summary.success || 0 }}</div>
          <div class="text-[10px] text-gray-500">成功</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-red-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-red-400">{{ summary.failure || 0 }}</div>
          <div class="text-[10px] text-gray-500">失败</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-yellow-400">¥{{ summary.totalCost?.toFixed(4) || '0.0000' }}</div>
          <div class="text-[10px] text-gray-500">总成本</div>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-[#1A2240]">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-[#0D1328]">
              <th class="text-left py-3 px-4 text-gray-500 font-medium">操作</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">执行者</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">状态</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">耗时</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">成本</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">时间</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="7" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">🔍</div>
                暂无审计记录
              </td>
            </tr>
            <tr v-for="r in list" :key="r.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ r.action }}</div>
                <div v-if="r.target" class="text-gray-600 text-[10px]">{{ r.target }}</div>
              </td>
              <td class="py-3 px-4 text-gray-400">{{ r.actor || '—' }}</td>
              <td class="py-3 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="r.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'">
                  {{ r.status === 'success' ? '成功' : '失败' }}
                </span>
              </td>
              <td class="py-3 px-4 text-center text-gray-400">{{ r.duration != null ? r.duration + 'ms' : '—' }}</td>
              <td class="py-3 px-4 text-center text-gray-400">{{ r.cost != null ? '¥' + r.cost.toFixed(4) : '—' }}</td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(r.createdAt) }}</td>
              <td class="py-3 px-4 text-center">
                <button @click="openDetail(r)" class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none">详情</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between text-xs text-gray-500">
        <span>共 {{ total }} 条 · 第 {{ page }}/{{ totalPages }} 页</span>
        <div class="flex gap-2">
          <button @click="page--; fetchData()" :disabled="page <= 1" class="px-3 py-1.5 bg-[#0D1328] border border-[#1A2240] rounded-lg disabled:opacity-30 cursor-pointer hover:bg-white/5">上一页</button>
          <button @click="page++; fetchData()" :disabled="page >= totalPages" class="px-3 py-1.5 bg-[#0D1328] border border-[#1A2240] rounded-lg disabled:opacity-30 cursor-pointer hover:bg-white/5">下一页</button>
        </div>
      </div>
    </template>

    <!-- Detail Modal -->
    <Teleport to="body">
      <div v-if="detailItem" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="detailItem = null">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 mx-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-white/90">审计详情</h2>
            <button @click="detailItem = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <template v-if="detailItem">
            <div class="space-y-4 text-xs">
              <div class="grid grid-cols-2 gap-4">
                <div><span class="text-gray-500">操作：</span><span class="text-white/70 font-medium">{{ detailItem.action }}</span></div>
                <div><span class="text-gray-500">执行者：</span><span class="text-white/70">{{ detailItem.actor || '—' }}</span></div>
                <div>
                  <span class="text-gray-500">状态：</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="detailItem.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'">
                    {{ detailItem.status === 'success' ? '成功' : '失败' }}
                  </span>
                </div>
                <div><span class="text-gray-500">目标：</span><span class="text-white/70">{{ detailItem.target || '—' }}</span></div>
                <div><span class="text-gray-500">耗时：</span><span class="text-white/70">{{ detailItem.duration != null ? detailItem.duration + 'ms' : '—' }}</span></div>
                <div><span class="text-gray-500">成本：</span><span class="text-white/70">{{ detailItem.cost != null ? '¥' + detailItem.cost.toFixed(4) : '—' }}</span></div>
                <div><span class="text-gray-500">时间：</span><span class="text-white/70">{{ formatTime(detailItem.createdAt) }}</span></div>
                <div><span class="text-gray-500">IP：</span><span class="text-white/70">{{ detailItem.ip || '—' }}</span></div>
              </div>
              <div v-if="detailItem.detail">
                <div class="text-gray-500 mb-1">详细信息</div>
                <div class="text-white/70 leading-relaxed bg-black/20 rounded-lg p-3 whitespace-pre-wrap font-mono text-[10px]">{{ detailItem.detail }}</div>
              </div>
              <div v-if="detailItem.errorMessage">
                <div class="text-gray-500 mb-1">错误信息</div>
                <div class="text-red-400 leading-relaxed bg-red-900/10 rounded-lg p-3 whitespace-pre-wrap text-[10px]">{{ detailItem.errorMessage }}</div>
              </div>
            </div>
          </template>
          <div class="flex justify-end mt-6">
            <button @click="detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer border-none">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 50
const totalPages = ref(0)
const searchKey = ref('')
const filterStatus = ref('')
const filterAction = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const detailItem = ref<any>(null)
const summary = ref<any>({ success: 0, failure: 0, totalCost: 0 })
const actionTypes = ref<string[]>([])

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}

function openDetail(r: any) {
  detailItem.value = r
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (searchKey.value) params.set('keyword', searchKey.value)
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (filterAction.value) params.set('action', filterAction.value)
    if (dateFrom.value) params.set('dateFrom', dateFrom.value)
    if (dateTo.value) params.set('dateTo', dateTo.value)
    const res = await fetch(`/api/admin/recruitment/audit?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    total.value = json.total
    totalPages.value = Math.ceil(json.total / pageSize)
    summary.value = json.summary || {}
    if (json.actionTypes) actionTypes.value = json.actionTypes
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => { fetchData() })
</script>
