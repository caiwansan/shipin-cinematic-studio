<template>
  <div class="p-6 space-y-6 text-gray-200">
    <!-- 头部 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-bold">📊 企业试运营面板</h1>
        <p class="text-xs text-gray-500 mt-1">老板视角：AI 员工健康 · 价值 · 使用 · 成本（数据源：真实执行记录）</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="orgId" @change="loadAll" class="bg-[#0D1328] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs">
          <option value="">🌐 全部企业</option>
          <option v-for="o in orgs" :key="o.organizationId" :value="o.organizationId">{{ o.organizationName }}</option>
        </select>
        <select v-model="days" @change="loadAll" class="bg-[#0D1328] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs">
          <option :value="7">近 7 天</option>
          <option :value="30">近 30 天</option>
          <option :value="90">近 90 天</option>
        </select>
      </div>
    </div>

    <!-- 价值大卡 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="text-[11px] text-gray-500">⏱️ 节省工时（估算）</div>
        <div class="text-2xl font-bold mt-1">{{ summary.savedHours ?? 0 }}h</div>
        <div class="text-[10px] text-gray-600 mt-1">{{ summary.taskCount ?? 0 }} 个成功任务</div>
      </div>
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="text-[11px] text-gray-500">💰 节省人力价值（估算）</div>
        <div class="text-2xl font-bold text-emerald-400 mt-1">¥{{ summary.savedCost ?? 0 }}</div>
        <div class="text-[10px] text-gray-600 mt-1">成功率 {{ summary.successRate ?? 0 }}%</div>
      </div>
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="text-[11px] text-gray-500">🤖 AI 实际成本</div>
        <div class="text-2xl font-bold mt-1">¥{{ summary.aiCost ?? 0 }}</div>
        <div class="text-[10px] text-gray-600 mt-1">{{ summary.tokens ?? 0 }} tokens</div>
      </div>
      <div class="bg-gradient-to-br from-amber-500/15 to-transparent border border-amber-500/30 rounded-xl p-4">
        <div class="text-[11px] text-amber-400/80">🏆 ROI</div>
        <div class="text-2xl font-bold text-amber-400 mt-1">{{ summary.roi != null ? summary.roi + '×' : '∞' }}</div>
        <div class="text-[10px] text-gray-600 mt-1">节省价值 ÷ AI 成本</div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 模型健康 -->
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs font-bold text-gray-400 mb-3">🩺 AI 员工模型健康</div>
        <div class="grid grid-cols-5 gap-2 text-center">
          <div class="bg-emerald-500/10 rounded-lg py-2"><div class="text-lg font-bold text-emerald-400">{{ healthSummary.ok }}</div><div class="text-[10px] text-gray-500">正常</div></div>
          <div class="bg-red-500/10 rounded-lg py-2"><div class="text-lg font-bold text-red-400">{{ healthSummary.failed }}</div><div class="text-[10px] text-gray-500">失败</div></div>
          <div class="bg-orange-500/10 rounded-lg py-2"><div class="text-lg font-bold text-orange-400">{{ healthSummary.decryptError }}</div><div class="text-[10px] text-gray-500">密钥异常</div></div>
          <div class="bg-yellow-500/10 rounded-lg py-2"><div class="text-lg font-bold text-yellow-400">{{ healthSummary.untested }}</div><div class="text-[10px] text-gray-500">未检测</div></div>
          <div class="bg-gray-500/10 rounded-lg py-2"><div class="text-lg font-bold text-gray-400">{{ healthSummary.disabled }}</div><div class="text-[10px] text-gray-500">停用</div></div>
        </div>
        <div v-if="healthSummary.failed + healthSummary.decryptError > 0" class="mt-3 text-[11px] text-red-400/80 bg-red-500/10 rounded-lg px-3 py-2">
          ⚠️ {{ healthSummary.failed + healthSummary.decryptError }} 个模型配置异常 → 已自动阻断执行，请到「模型健康中心」处理
        </div>
        <div class="mt-3 text-[11px] text-gray-600">执行前自动检查，异常配置不会静默 fallback 到其它 key（身份隔离保护）</div>
      </div>

      <!-- 使用趋势 -->
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs font-bold text-gray-400 mb-3">📈 每日任务趋势（近 {{ days }} 天）</div>
        <div class="flex items-end gap-1 h-28 overflow-x-auto">
          <div v-for="d in byDay" :key="d.day" class="flex flex-col items-center justify-end flex-1 min-w-[14px]">
            <div class="text-[9px] text-gray-500 mb-0.5">{{ d.count }}</div>
            <div class="w-full bg-blue-500/60 rounded-t" :style="{ height: barHeight(d.count) }"></div>
            <div class="text-[8px] text-gray-600 mt-0.5">{{ d.day.slice(5) }}</div>
          </div>
        </div>
        <div v-if="!byDay.length" class="text-[11px] text-gray-600 mt-4">暂无任务数据</div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 任务类型分布 -->
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs font-bold text-gray-400 mb-3">📋 任务类型分布（{{ orgId ? '本企业' : '全部企业' }}）</div>
        <div v-if="byType.length" class="space-y-2">
          <div v-for="t in byType.slice(0, 8)" :key="t.taskType" class="flex items-center gap-2 text-[11px]">
            <span class="w-32 truncate text-gray-400">{{ t.taskType }}</span>
            <div class="flex-1 bg-[#1A2240] rounded h-2 overflow-hidden">
              <div class="bg-blue-500/70 h-full rounded" :style="{ width: typePct(t.count) + '%' }"></div>
            </div>
            <span class="w-8 text-right text-gray-300">{{ t.count }}</span>
            <span class="w-16 text-right text-emerald-400/80">{{ t.savedHours }}h</span>
          </div>
        </div>
        <div v-else class="text-[11px] text-gray-600">暂无数据</div>
      </div>

      <!-- 员工活跃 top -->
      <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs font-bold text-gray-400 mb-3">🤖 AI 员工活跃榜</div>
        <div v-if="byAgent.length" class="space-y-2">
          <div v-for="a in byAgent.slice(0, 8)" :key="a.agentId" class="flex items-center gap-2 text-[11px]">
            <span class="w-28 truncate text-gray-300">{{ a.agentName || a.agentId.slice(0, 10) }}</span>
            <div class="flex-1 bg-[#1A2240] rounded h-2 overflow-hidden">
              <div class="bg-purple-500/70 h-full rounded" :style="{ width: agentPct(a.count) + '%' }"></div>
            </div>
            <span class="w-8 text-right text-gray-300">{{ a.count }}次</span>
            <span class="w-10 text-right text-gray-500">{{ a.successRate ?? 0 }}%</span>
          </div>
        </div>
        <div v-else class="text-[11px] text-gray-600">暂无数据</div>
      </div>
    </div>

    <!-- 配额总览 -->
    <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
      <div class="text-xs font-bold text-gray-400 mb-3">⏳ 配额总览（{{ quotaOrgName }} · 观察模式：超额仅告警不阻断）</div>
      <div v-if="quotaItems.length" class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="q in quotaItems" :key="q.capability" class="border border-[#1A2240] rounded-lg p-3">
          <div class="text-[11px] text-gray-400">{{ q.capability }}</div>
          <div class="text-sm font-bold mt-1" :class="q.level === 'exhausted' ? 'text-red-400' : q.level === 'warning' ? 'text-yellow-400' : 'text-gray-200'">
            {{ q.used }}<span class="text-gray-500 text-xs"> / {{ q.limit ?? '∞' }} {{ q.unit }}</span>
          </div>
          <div class="mt-1.5 bg-[#1A2240] rounded h-1.5 overflow-hidden">
            <div class="h-full rounded" :class="q.level === 'exhausted' ? 'bg-red-500' : q.level === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'"
              :style="{ width: Math.min(q.pct, 100) + '%' }"></div>
          </div>
          <div class="text-[10px] text-gray-600 mt-1">{{ q.pct }}%</div>
        </div>
      </div>
      <div v-else class="text-[11px] text-gray-600">{{ orgId ? '该企业暂无配额配置' : '👆 选择企业查看配额' }}</div>
    </div>

    <div class="text-[10px] text-gray-600 leading-relaxed">
      📐 节省价值 = 成功任务数 × 标准人工耗时（JD 60min / 岗位分析 45min / 面试评估 30min / 筛选 15min / 解析 8min 等）× HR 时薪 ¥{{ params.hrHourlyRate }}/h。<br>
      ⚠️ 为<b>人力工作价值估算</b>，非现金节省。数据源：EnterpriseAgentTask 真实执行记录。
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const days = ref(30)
const orgId = ref('')
const summary = ref<any>({})
const params = ref<any>({ hrHourlyRate: 50 })
const byType = ref<any[]>([])
const byAgent = ref<any[]>([])
const byDay = ref<any[]>([])
const byOrganization = ref<any[]>([])
const orgs = ref<any[]>([])
const healthSummary = ref<any>({ total: 0, ok: 0, failed: 0, decryptError: 0, disabled: 0, untested: 0 })
const quotaItems = ref<any[]>([])
const quotaOrgName = ref('')

const orgsMap = new Map<string, string>()

async function loadOrgs() {
  const res = await fetch(`/api/admin/enterprise/roi-report?days=90`)
  const d = await res.json()
  orgs.value = d.data?.byOrganization || []
  orgs.value.forEach((o: any) => orgsMap.set(o.organizationId, o.organizationName))
}

async function loadHealth() {
  const res = await fetch(`/api/admin/llm/health`)
  const d = await res.json()
  healthSummary.value = d.summary || healthSummary.value
}

async function loadRoi() {
  const q = orgId.value ? `&organizationId=${orgId.value}` : ''
  const res = await fetch(`/api/admin/enterprise/roi-report?days=${days.value}${q}`)
  const d = await res.json()
  summary.value = d.data?.summary || {}
  params.value = d.data?.params || { hrHourlyRate: 50 }
  byType.value = d.data?.byType || []
}

async function loadActivity() {
  const q = orgId.value ? `&organizationId=${orgId.value}` : ''
  const res = await fetch(`/api/admin/enterprise/agent-activity?days=${days.value}${q}`)
  const d = await res.json()
  byDay.value = d.data?.byDay || []
  byAgent.value = d.data?.byAgent || []
}

async function loadQuota() {
  if (!orgId.value) { quotaItems.value = []; quotaOrgName.value = ''; return }
  const res = await fetch(`/api/admin/enterprise/quotas/${orgId.value}`)
  const d = await res.json()
  quotaItems.value = d.data?.items || []
  quotaOrgName.value = orgsMap.get(orgId.value) || orgId.value.slice(0, 8)
}

async function loadAll() {
  await Promise.all([loadRoi(), loadActivity(), loadQuota()])
}

function barHeight(c: number): string {
  const max = Math.max(...byDay.value.map((d) => d.count), 1)
  return Math.max((c / max) * 100, 4) + '%'
}
function typePct(c: number): number {
  const max = Math.max(...byType.value.map((t) => t.count), 1)
  return (c / max) * 100
}
function agentPct(c: number): number {
  const max = Math.max(...byAgent.value.map((a) => a.count), 1)
  return (c / max) * 100
}

onMounted(async () => {
  await Promise.all([loadOrgs(), loadHealth()])
  await loadAll()
})
</script>
