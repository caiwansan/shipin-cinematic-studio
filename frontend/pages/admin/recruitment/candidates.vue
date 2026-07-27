<!-- Admin: 候选人池管理 -->
<!-- 位置：/admin/recruitment/candidates.vue -->
<!-- 职责：全平台候选人列表 — 搜索/筛选/详情/只读管理 + 运营统计面板（P5-ADMIN-02） -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">👤 候选人池</h1>
        <p class="text-xs text-gray-500 mt-1">平台候选人池（只读）· 保持平台中立</p>
      </div>
      <button @click="fetchData" class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">🔄 刷新</button>
    </div>

    <!-- P5-ADMIN-02: 运营统计面板 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
        <div class="text-lg font-bold text-white/90">{{ stats.total ?? '—' }}</div>
        <div class="text-[10px] text-gray-500">候选人总数</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-purple-800/30 rounded-xl p-3 text-center">
        <div class="text-lg font-bold text-purple-400">{{ stats.withProfile ?? '—' }}</div>
        <div class="text-[10px] text-gray-500">已建 Talent Profile</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-green-800/30 rounded-xl p-3 text-center">
        <div class="text-lg font-bold text-green-400">{{ stats.withMatches ?? '—' }}</div>
        <div class="text-[10px] text-gray-500">有匹配记录</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-blue-800/30 rounded-xl p-3 text-center">
        <div class="text-lg font-bold text-blue-400">{{ total }}</div>
        <div class="text-[10px] text-gray-500">当前筛选结果</div>
      </div>
    </div>

    <!-- Top Skills -->
    <div v-if="stats.topSkills?.length" class="bg-[#0D1328]/40 border border-[#1A2240] rounded-xl p-3">
      <div class="text-[10px] text-gray-500 mb-2">🔥 热门技能</div>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="s in stats.topSkills" :key="s.skill" class="px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-400 text-[10px]">
          {{ s.skill }} <span class="text-gray-500">×{{ s.count }}</span>
        </span>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
        <input
          v-model="searchKey"
          @keyup.enter="page = 1; fetchData()"
          placeholder="搜索姓名、城市、技能..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterQuality" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部质量</option>
        <option value="high">高质量 (≥70)</option>
        <option value="medium">中等 (50-69)</option>
        <option value="low">待提升 (&lt;50)</option>
      </select>
      <select v-model="sortBy" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="createdAt">最新创建</option>
        <option value="qualityScore">质量分排序</option>
        <option value="experienceYears">经验排序</option>
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
      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-[#1A2240]">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-[#0D1328]">
              <th class="text-left py-3 px-4 text-gray-500 font-medium">姓名</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">城市</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">经验</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">期望薪资</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">质量分</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">匹配</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">技能标签</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">创建时间</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="9" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">👤</div>
                暂无候选人
              </td>
            </tr>
            <tr v-for="c in list" :key="c.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ c.name || '—' }}</div>
                <div v-if="c.email" class="text-gray-600 text-[10px]">{{ c.email }}</div>
              </td>
              <td class="py-3 px-4 text-gray-400">{{ c.city || '—' }}</td>
              <td class="py-3 px-4 text-center text-gray-400">{{ c.experienceYears != null ? c.experienceYears + ' 年' : '—' }}</td>
              <td class="py-3 px-4 text-gray-400">{{ c.expectedSalary || '—' }}</td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-1">
                  <div class="w-8 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div class="h-full rounded-full" :class="qualityBarClass(c.qualityScore)" :style="{ width: (c.qualityScore || 0) + '%' }"></div>
                  </div>
                  <span :class="qualityTextClass(c.qualityScore)" class="font-medium">{{ c.qualityScore != null ? c.qualityScore : '—' }}</span>
                </div>
              </td>
              <td class="py-3 px-4 text-center">
                <span v-if="c.matchCount > 0" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400">{{ c.matchCount }} 匹配</span>
                <span v-else class="text-gray-600 text-[10px]">—</span>
              </td>
              <td class="py-3 px-4">
                <div class="flex flex-wrap gap-1">
                  <span v-for="s in (c.skills || []).slice(0, 3)" :key="s" class="px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-400 text-[10px]">{{ s }}</span>
                  <span v-if="(c.skills || []).length > 3" class="text-gray-600 text-[10px]">+{{ c.skills.length - 3 }}</span>
                </div>
              </td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(c.createdAt) }}</td>
              <td class="py-3 px-4 text-center">
                <button @click="navigateTo(`/admin/recruitment/candidates/${c.id}`)" class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none">详情</button>
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
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 mx-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-white/90">候选人详情</h2>
            <button @click="detailItem = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>

          <!-- 加载中 -->
          <div v-if="detailLoading" class="flex items-center justify-center py-12 text-gray-500 text-sm">
            <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
            加载详情...
          </div>

          <template v-else-if="detailItem">
            <div class="space-y-4 text-xs">
              <!-- 头像区 -->
              <div class="flex items-center gap-4 pb-4 border-b border-[#1A2240]">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                  {{ detailItem.name?.charAt(0) || '?' }}
                </div>
                <div>
                  <div class="text-white/90 font-semibold text-sm">{{ detailItem.name || '—' }}</div>
                  <div class="text-gray-500">{{ detailItem.city || '未知城市' }} · {{ detailItem.experienceYears != null ? detailItem.experienceYears + ' 年经验' : '经验未知' }}</div>
                  <div v-if="detailItem.completeness != null" class="mt-1">
                    <span class="text-[10px] text-gray-500">档案完整度</span>
                    <span class="ml-1 text-[10px] font-medium" :class="detailItem.completeness >= 80 ? 'text-green-400' : detailItem.completeness >= 50 ? 'text-yellow-400' : 'text-red-400'">{{ detailItem.completeness }}%</span>
                  </div>
                </div>
                <div class="ml-auto text-right">
                  <div class="text-2xl font-bold" :class="qualityTextClass(detailItem.qualityScore)">{{ detailItem.qualityScore ?? '—' }}</div>
                  <div class="text-gray-500 text-[10px]">质量分</div>
                </div>
              </div>

              <!-- 基本信息 -->
              <div class="grid grid-cols-2 gap-4">
                <div><span class="text-gray-500">邮箱：</span><span class="text-white/70">{{ detailItem.email || '—' }}</span></div>
                <div><span class="text-gray-500">电话：</span><span class="text-white/70">{{ detailItem.phone || '—' }}</span></div>
                <div><span class="text-gray-500">期望薪资：</span><span class="text-white/70">{{ detailItem.expectedSalary || detailItem.salaryExpectation || '—' }}</span></div>
                <div><span class="text-gray-500">学历：</span><span class="text-white/70">{{ detailItem.education || '—' }}</span></div>
                <div><span class="text-gray-500">职业目标：</span><span class="text-white/70">{{ detailItem.careerGoal || '—' }}</span></div>
                <div><span class="text-gray-500">创建时间：</span><span class="text-white/70">{{ formatTime(detailItem.createdAt) }}</span></div>
              </div>

              <!-- 技能标签 -->
              <div v-if="detailItem.skills?.length">
                <div class="text-gray-500 mb-1">技能标签</div>
                <div class="flex flex-wrap gap-1">
                  <span v-for="s in detailItem.skills" :key="s" class="px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-400 text-[10px]">{{ s }}</span>
                </div>
              </div>

              <!-- 个人总结 -->
              <div v-if="detailItem.summary">
                <div class="text-gray-500 mb-1">个人总结</div>
                <div class="text-white/70 leading-relaxed bg-black/20 rounded-lg p-3">{{ detailItem.summary }}</div>
              </div>

              <!-- Talent Profile -->
              <div v-if="detailItem.talentProfile" class="pt-3 border-t border-[#1A2240]">
                <div class="text-gray-500 mb-2 font-medium">📋 Talent Profile</div>
                <div class="grid grid-cols-2 gap-3 bg-black/20 rounded-lg p-3">
                  <div><span class="text-gray-500">职级：</span><span class="text-white/70">{{ detailItem.talentProfile.careerLevel || '—' }}</span></div>
                  <div><span class="text-gray-500">匹配次数：</span><span class="text-white/70">{{ detailItem.talentProfile.matchCount || 0 }}</span></div>
                  <div><span class="text-gray-500">最后匹配：</span><span class="text-white/70">{{ detailItem.talentProfile.lastMatchedAt ? formatTime(detailItem.talentProfile.lastMatchedAt) : '—' }}</span></div>
                  <div><span class="text-gray-500">薪资范围：</span><span class="text-white/70">{{ detailItem.talentProfile.salaryMin != null || detailItem.talentProfile.salaryMax != null ? `${detailItem.talentProfile.salaryMin ?? '?'}-${detailItem.talentProfile.salaryMax ?? '?'}K` : '—' }}</span></div>
                </div>
                <div v-if="detailItem.talentProfile.strengths?.length" class="mt-2">
                  <span class="text-gray-500 text-[10px]">优势：</span>
                  <span v-for="s in detailItem.talentProfile.strengths" :key="s" class="ml-1 px-1.5 py-0.5 rounded bg-green-600/10 text-green-400 text-[10px]">{{ s }}</span>
                </div>
                <div v-if="detailItem.talentProfile.risks?.length" class="mt-1">
                  <span class="text-gray-500 text-[10px]">风险：</span>
                  <span v-for="r in detailItem.talentProfile.risks" :key="r" class="ml-1 px-1.5 py-0.5 rounded bg-red-600/10 text-red-400 text-[10px]">{{ r }}</span>
                </div>
                <div v-if="detailItem.talentProfile.projects" class="mt-2">
                  <div class="text-gray-500 text-[10px] mb-1">项目经历</div>
                  <div class="text-white/70 bg-black/20 rounded p-2 text-[10px] leading-relaxed">{{ detailItem.talentProfile.projects }}</div>
                </div>
              </div>

              <!-- 匹配记录 -->
              <div v-if="detailItem.matches?.length" class="pt-3 border-t border-[#1A2240]">
                <div class="text-gray-500 mb-2 font-medium">🔗 匹配记录 ({{ detailItem.matchCount }})</div>
                <div class="space-y-2">
                  <div v-for="m in detailItem.matches" :key="m.id" class="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
                    <div>
                      <div class="text-white/70 text-[11px]">{{ m.job?.title || '—' }}</div>
                      <div class="text-gray-500 text-[10px]">{{ formatTime(m.createdAt) }}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-medium" :class="m.matchScore >= 70 ? 'text-green-400' : m.matchScore >= 50 ? 'text-yellow-400' : 'text-red-400'">{{ m.matchScore }}分</span>
                      <span class="px-1.5 py-0.5 rounded text-[9px]" :class="matchStatusClass(m.status)">{{ m.status }}</span>
                    </div>
                  </div>
                </div>
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
const pageSize = 20
const totalPages = ref(0)
const searchKey = ref('')
const filterQuality = ref('')
const sortBy = ref('createdAt')
const detailItem = ref<any>(null)
const detailLoading = ref(false)
const stats = ref<any>({})

function qualityTextClass(score: number | null) {
  if (score == null) return 'text-gray-400'
  if (score >= 70) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}
function qualityBarClass(score: number | null) {
  if (score == null) return 'bg-gray-600'
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}
function matchStatusClass(s: string) {
  return ({ matched: 'bg-green-500/10 text-green-400', pending: 'bg-yellow-500/10 text-yellow-400', rejected: 'bg-red-500/10 text-red-400' } as Record<string, string>)[s] || 'bg-gray-500/10 text-gray-400'
}
function formatTime(t: string) {
  if (!t) return '—'
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

async function openDetail(c: any) {
  detailItem.value = c
  detailLoading.value = true
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/candidates/${c.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      detailItem.value = json
    }
  } catch (e: any) {
    error.value = '加载详情失败：' + e.message
  } finally {
    detailLoading.value = false
  }
}

async function fetchStats() {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/admin/recruitment/candidates/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      stats.value = await res.json()
    }
  } catch (e: any) {
    // stats 非阻塞
  }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize), sortBy: sortBy.value })
    if (searchKey.value) params.set('keyword', searchKey.value)
    if (filterQuality.value) params.set('quality', filterQuality.value)
    const res = await fetch(`/api/admin/recruitment/candidates?${params}`, {
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

onMounted(() => { fetchData(); fetchStats() })
</script>
