<!-- Admin: 企业招聘部门 -->
<!-- 位置：/admin/recruitment/departments.vue -->
<!-- 职责：平台所有企业的 AI 招聘部门总览 — 搜索/筛选/详情 -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">🏢 企业招聘部门</h1>
        <p class="text-xs text-gray-500 mt-1">平台所有企业的 AI 招聘部门总览</p>
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
          placeholder="搜索企业名称..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterPlan" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部套餐</option>
        <option value="enterprise">Enterprise</option>
        <option value="pro">Pro</option>
        <option value="basic">Basic</option>
      </select>
      <select v-model="sortBy" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="createdAt">最新创建</option>
        <option value="aiEmployees">AI 员工数</option>
        <option value="conversations">会话数</option>
      </select>
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
          <div class="text-[10px] text-gray-500">企业总数</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-green-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-green-400">{{ totalActiveAgents }}</div>
          <div class="text-[10px] text-gray-500">运行中 AI</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-blue-400">{{ totalConversations }}</div>
          <div class="text-[10px] text-gray-500">总会话</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-purple-400">{{ totalInterviews }}</div>
          <div class="text-[10px] text-gray-500">总面试</div>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-[#1A2240]">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-[#0D1328]">
              <th class="text-left py-3 px-4 text-gray-500 font-medium">企业名称</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">套餐</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">AI 员工</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">运行中</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">Pipeline</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">Conversation</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">Interview</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">Campaign</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">创建时间</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="10" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">🏢</div>
                暂无企业
              </td>
            </tr>
            <tr v-for="dept in list" :key="dept.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ dept.name }}</div>
                <div v-if="dept.owner" class="text-gray-600 text-[10px]">{{ dept.owner }}</div>
              </td>
              <td class="py-3 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="planClass(dept.plan)">{{ dept.plan || '—' }}</span>
              </td>
              <td class="py-3 px-4 text-center text-gray-400">{{ dept.aiEmployees }}</td>
              <td class="py-3 px-4 text-center">
                <span :class="dept.aiActive > 0 ? 'text-green-400 font-medium' : 'text-gray-600'">{{ dept.aiActive }}</span>
              </td>
              <td class="py-3 px-4 text-center text-gray-400">{{ dept.pipelines }}</td>
              <td class="py-3 px-4 text-center text-gray-400">{{ dept.conversations }}</td>
              <td class="py-3 px-4 text-center text-gray-400">{{ dept.interviews }}</td>
              <td class="py-3 px-4 text-center text-gray-400">{{ dept.campaigns }}</td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(dept.createdAt) }}</td>
              <td class="py-3 px-4 text-center">
                <button @click="openDetail(dept)" class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none">详情</button>
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
            <h2 class="text-base font-semibold text-white/90">企业详情</h2>
            <button @click="detailItem = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <template v-if="detailItem">
            <div class="space-y-4 text-xs">
              <div class="flex items-center gap-4 pb-4 border-b border-[#1A2240]">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-xl font-bold">
                  {{ detailItem.name?.charAt(0) || '?' }}
                </div>
                <div>
                  <div class="text-white/90 font-semibold text-sm">{{ detailItem.name }}</div>
                  <div class="text-gray-500">{{ detailItem.owner || '—' }}</div>
                  <div class="mt-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="planClass(detailItem.plan)">{{ detailItem.plan || '—' }}</span>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div class="bg-black/20 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-blue-400">{{ detailItem.aiEmployees }}</div>
                  <div class="text-[10px] text-gray-500">AI 员工</div>
                </div>
                <div class="bg-black/20 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-green-400">{{ detailItem.aiActive }}</div>
                  <div class="text-[10px] text-gray-500">运行中</div>
                </div>
                <div class="bg-black/20 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-yellow-400">{{ detailItem.pipelines }}</div>
                  <div class="text-[10px] text-gray-500">Pipeline</div>
                </div>
                <div class="bg-black/20 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-cyan-400">{{ detailItem.conversations }}</div>
                  <div class="text-[10px] text-gray-500">会话</div>
                </div>
                <div class="bg-black/20 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-purple-400">{{ detailItem.interviews }}</div>
                  <div class="text-[10px] text-gray-500">面试</div>
                </div>
                <div class="bg-black/20 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-orange-400">{{ detailItem.campaigns }}</div>
                  <div class="text-[10px] text-gray-500">Campaign</div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div><span class="text-gray-500">创建时间：</span><span class="text-white/70">{{ formatTime(detailItem.createdAt) }}</span></div>
                <div><span class="text-gray-500">更新时间：</span><span class="text-white/70">{{ formatTime(detailItem.updatedAt) }}</span></div>
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
import { ref, computed, onMounted } from 'vue'

const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = ref(0)
const searchKey = ref('')
const filterPlan = ref('')
const sortBy = ref('createdAt')
const detailItem = ref<any>(null)

const totalActiveAgents = computed(() => list.value.reduce((s, d) => s + (d.aiActive || 0), 0))
const totalConversations = computed(() => list.value.reduce((s, d) => s + (d.conversations || 0), 0))
const totalInterviews = computed(() => list.value.reduce((s, d) => s + (d.interviews || 0), 0))

function planClass(plan: string) {
  return ({ enterprise: 'bg-purple-500/10 text-purple-400', pro: 'bg-blue-500/10 text-blue-400', basic: 'bg-gray-500/10 text-gray-400' } as Record<string, string>)[plan] || 'bg-gray-500/10 text-gray-400'
}

function formatTime(t: string) {
  return new Date(t).toLocaleDateString('zh-CN')
}

function openDetail(d: any) {
  detailItem.value = d
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize), sortBy: sortBy.value })
    if (searchKey.value) params.set('keyword', searchKey.value)
    if (filterPlan.value) params.set('plan', filterPlan.value)
    const res = await fetch(`/api/admin/recruitment/departments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    total.value = json.total
    totalPages.value = Math.ceil(json.total / pageSize)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => { fetchData() })
</script>
