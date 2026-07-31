<!--
  EnterpriseIntelPanel — 企业智能（AI员工 ROI / 套餐额度 / 员工日报）
  Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 T04：原招聘后台 ROI/额度/日报 → 数据罗盘
  数据源：/api/admin/dashboard/roi · /api/admin/dashboard/quotas · /api/admin/dashboard/daily-report
-->
<template>
  <div class="eip space-y-4">
    <!-- Tabs -->
    <div class="flex gap-2">
      <button v-for="t in tabs" :key="t.key" class="px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer border"
        :class="tab === t.key
          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
          : 'bg-white/[0.02] text-gray-500 border-white/[0.06] hover:text-gray-300'"
        @click="switchTab(t.key)">
        {{ t.label }}
      </button>
    </div>

    <!-- ═══ ROI ═══ -->
    <div v-if="tab === 'roi'">
      <div v-if="roiLoading" class="py-8 text-center text-[11px] text-gray-600">加载中...</div>
      <div v-else-if="roiError" class="text-[11px] text-red-400">{{ roiError }}</div>
      <template v-else-if="roi">
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div class="text-[9px] text-gray-500">任务数（近{{ roi.period?.days || 30 }}天）</div>
            <div class="text-lg font-bold text-white/90">{{ roi.summary?.taskCount ?? 0 }}</div>
            <div class="text-[9px] text-gray-500">成功率 {{ roi.summary?.successRate ?? 0 }}%</div>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div class="text-[9px] text-gray-500">AI 成本</div>
            <div class="text-lg font-bold text-white/90">¥{{ (roi.summary?.aiCost ?? 0).toFixed(2) }}</div>
            <div class="text-[9px] text-gray-500">Token {{ formatNum(roi.summary?.tokens ?? 0) }}</div>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div class="text-[9px] text-gray-500">节省工时</div>
            <div class="text-lg font-bold text-green-400">{{ roi.summary?.savedHours ?? 0 }}h</div>
            <div class="text-[9px] text-gray-500">≈ ¥{{ (roi.summary?.savedCost ?? 0).toFixed(0) }}</div>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div class="text-[9px] text-gray-500">ROI 系数</div>
            <div class="text-lg font-bold" :class="roiVal > 0 ? 'text-blue-400' : 'text-gray-500'">
              {{ roiVal === null ? '—' : roiVal + 'x' }}
            </div>
            <div class="text-[9px] text-gray-500">节省成本 / AI成本</div>
          </div>
        </div>

        <!-- 按类型排行 -->
        <div v-if="roi.byType?.length" class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h4 class="text-[11px] font-semibold text-white/70 mb-2">📊 任务类型 ROI 排行</h4>
          <div v-for="t in roi.byType.slice(0, 6)" :key="t.taskType" class="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
            <span class="text-[11px] text-gray-300">{{ t.taskType }}</span>
            <span class="text-[10px] text-gray-500">{{ t.count }}次 · 节省{{ t.savedHours }}h</span>
          </div>
        </div>
        <div v-else class="text-center text-[11px] text-gray-600 py-6">近 {{ roi.period?.days || 30 }} 天暂无任务数据</div>
      </template>
    </div>

    <!-- ═══ 额度 ═══ -->
    <div v-if="tab === 'quotas'">
      <div v-if="quotaLoading" class="py-8 text-center text-[11px] text-gray-600">加载中...</div>
      <div v-else-if="quotaError" class="text-[11px] text-red-400">{{ quotaError }}</div>
      <template v-else-if="quotas.length">
        <div v-for="q in quotas" :key="q.organizationId" class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-2">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] font-semibold text-white/80">{{ q.organizationName || q.organizationId?.slice(0, 8) }}</span>
            <span class="text-[9px] px-2 py-0.5 rounded-full" :class="q.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-white/[0.06] text-gray-500'">
              {{ q.planName || '未订阅' }}
            </span>
          </div>
          <div v-if="q.items?.length" class="space-y-1.5">
            <div v-for="it in q.items" :key="it.capability" class="flex items-center gap-2">
              <span class="text-[10px] text-gray-400 w-24 truncate">{{ it.capability }}</span>
              <div class="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div class="h-full rounded-full" :class="it.level === 'exhausted' ? 'bg-red-500' : it.level === 'warning' ? 'bg-amber-500' : 'bg-blue-500'"
                  :style="{ width: Math.min(it.pct, 100) + '%' }"></div>
              </div>
              <span class="text-[10px] text-gray-500 w-20 text-right">{{ it.used }}/{{ it.limit }}{{ it.unit }}</span>
            </div>
          </div>
          <div v-else class="text-[10px] text-gray-600">无限额度</div>
        </div>
      </template>
      <div v-else class="text-center text-[11px] text-gray-600 py-6">暂无额度数据</div>
    </div>

    <!-- ═══ 日报 ═══ -->
    <div v-if="tab === 'daily'">
      <div v-if="dailyLoading" class="py-8 text-center text-[11px] text-gray-600">加载中...</div>
      <div v-else-if="dailyError" class="text-[11px] text-red-400">{{ dailyError }}</div>
      <template v-else-if="daily">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[11px] text-gray-400">📅 {{ daily.date }}（昨日）· {{ daily.organizationCount || 0 }} 家企业</span>
        </div>
        <div class="grid grid-cols-4 gap-2 mb-3">
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
            <div class="text-base font-bold text-white/90">{{ daily.summary?.tasks ?? 0 }}</div>
            <div class="text-[9px] text-gray-500">任务</div>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
            <div class="text-base font-bold text-green-400">{{ daily.summary?.successRate ?? 0 }}%</div>
            <div class="text-[9px] text-gray-500">成功率</div>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
            <div class="text-base font-bold text-white/90">¥{{ (daily.summary?.aiCost ?? 0).toFixed(2) }}</div>
            <div class="text-[9px] text-gray-500">成本</div>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-center">
            <div class="text-base font-bold text-blue-400">{{ daily.summary?.savedHours ?? 0 }}h</div>
            <div class="text-[9px] text-gray-500">节省</div>
          </div>
        </div>
        <div v-if="daily.byAgent?.length" class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h4 class="text-[11px] font-semibold text-white/70 mb-2">🤖 员工活跃</h4>
          <div v-for="a in daily.byAgent.slice(0, 6)" :key="a.agentId" class="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
            <span class="text-[11px] text-gray-300">{{ a.agentName }}</span>
            <span class="text-[10px] text-gray-500">{{ a.count }}次 · {{ a.successRate }}%</span>
          </div>
        </div>
        <div v-else class="text-center text-[11px] text-gray-600 py-6">昨日暂无任务</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

const tabs = [
  { key: 'roi', label: '📈 AI员工 ROI' },
  { key: 'quotas', label: '🧾 套餐额度' },
  { key: 'daily', label: '📅 员工日报' },
]
const tab = ref('roi')

const roi = ref<any>(null)
const roiLoading = ref(false)
const roiError = ref('')
const quotas = ref<any[]>([])
const quotaLoading = ref(false)
const quotaError = ref('')
const daily = ref<any>(null)
const dailyLoading = ref(false)
const dailyError = ref('')

const roiVal = computed(() => roi.value?.summary?.roi ?? null)

function formatNum(n: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function switchTab(key: string) {
  tab.value = key
  if (key === 'roi' && !roi.value && !roiLoading.value) loadRoi()
  if (key === 'quotas' && quotas.value.length === 0 && !quotaLoading.value) loadQuotas()
  if (key === 'daily' && !daily.value && !dailyLoading.value) loadDaily()
}

async function loadRoi() {
  roiLoading.value = true
  roiError.value = ''
  try {
    const res = await fetch('/api/admin/dashboard/roi?days=30', { headers: authHeaders() })
    const json = await res.json()
    if (json.code !== 0) throw new Error(json.message || '加载失败')
    roi.value = json.data
  } catch (e: any) {
    roiError.value = e.message || '加载失败'
  } finally {
    roiLoading.value = false
  }
}

async function loadQuotas() {
  quotaLoading.value = true
  quotaError.value = ''
  try {
    const res = await fetch('/api/admin/dashboard/quotas', { headers: authHeaders() })
    const json = await res.json()
    if (json.code !== 0) throw new Error(json.message || '加载失败')
    quotas.value = json.data || []
  } catch (e: any) {
    quotaError.value = e.message || '加载失败'
  } finally {
    quotaLoading.value = false
  }
}

async function loadDaily() {
  dailyLoading.value = true
  dailyError.value = ''
  try {
    const res = await fetch('/api/admin/dashboard/daily-report', { headers: authHeaders() })
    const json = await res.json()
    if (json.code !== 0) throw new Error(json.message || '加载失败')
    daily.value = json.data
  } catch (e: any) {
    dailyError.value = e.message || '加载失败'
  } finally {
    dailyLoading.value = false
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

onMounted(loadRoi)
</script>
