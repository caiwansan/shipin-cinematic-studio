<template>
  <div class="p-6 space-y-6 text-gray-200">
    <!-- 头部 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-bold">📰 AI 员工工作日报</h1>
        <p class="text-xs text-gray-500 mt-1">每日工作摘要：员工活跃 · 任务产出 · 节省价值 · 成本（销售/老板视角）</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="shift(-1)" class="bg-[#1A2240] hover:bg-[#223056] rounded-lg px-3 py-1.5 text-xs">‹ 前一天</button>
        <input type="date" v-model="date" @change="load" class="bg-[#0D1328] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs" />
        <button @click="shift(1)" class="bg-[#1A2240] hover:bg-[#223056] rounded-lg px-3 py-1.5 text-xs">后一天 ›</button>
        <select v-model="orgId" @change="load" class="bg-[#0D1328] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs">
          <option value="">🌐 全部企业</option>
          <option v-for="o in orgs" :key="o.organizationId" :value="o.organizationId">{{ o.organizationName }}</option>
        </select>
      </div>
    </div>

    <!-- 日报主体 -->
    <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-5">
      <div class="flex items-center justify-between border-b border-[#1A2240] pb-3 mb-4">
        <div class="text-sm font-bold">📋 {{ date }} 工作日报</div>
        <div class="text-[10px] text-gray-600">{{ orgId ? '本企业' : '全部企业' }} · 生成于 {{ (report.generatedAt || '').slice(0, 16).replace('T', ' ') }}</div>
      </div>

      <!-- 员工活跃 -->
      <div class="mb-5">
        <div class="text-xs font-bold text-gray-400 mb-2">🤖 AI 员工今日产出</div>
        <div v-if="report.byAgent?.length" class="space-y-2">
          <div v-for="a in report.byAgent" :key="a.agentId" class="flex items-center gap-3 text-[12px] bg-[#101830] rounded-lg px-3 py-2">
            <span class="w-36 truncate font-medium text-gray-200">{{ a.agentName }}</span>
            <span class="text-gray-400">完成 <b class="text-blue-300">{{ a.succeeded }}</b> / {{ a.count }} 次</span>
            <div class="flex-1 bg-[#1A2240] rounded h-1.5 overflow-hidden">
              <div class="bg-blue-500/70 h-full rounded" :style="{ width: (a.successRate || 0) + '%' }"></div>
            </div>
            <span class="w-12 text-right text-xs" :class="a.successRate >= 80 ? 'text-emerald-400' : 'text-yellow-400'">{{ a.successRate }}%</span>
          </div>
        </div>
        <div v-else class="text-[11px] text-gray-600">当日无任务记录</div>
      </div>

      <!-- 产出明细 -->
      <div class="mb-5">
        <div class="text-xs font-bold text-gray-400 mb-2">📦 产出明细（按任务类型）</div>
        <div v-if="report.byType?.length" class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div v-for="t in report.byType" :key="t.taskType" class="border border-[#1A2240] rounded-lg p-2.5">
            <div class="text-[11px] text-gray-400 truncate">{{ t.taskType }}</div>
            <div class="text-base font-bold mt-0.5">{{ t.count }} 次</div>
            <div class="text-[10px] text-emerald-400/80">≈ {{ t.savedHours }}h</div>
          </div>
        </div>
        <div v-else class="text-[11px] text-gray-600">无</div>
      </div>

      <!-- 总结 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-[#1A2240] pt-4">
        <div>
          <div class="text-[11px] text-gray-500">📊 任务 / 成功率</div>
          <div class="text-lg font-bold">{{ report.summary?.tasks ?? 0 }} <span class="text-xs text-gray-500">/ {{ report.summary?.successRate ?? 0 }}%</span></div>
        </div>
        <div>
          <div class="text-[11px] text-gray-500">⏱️ 预计节省工时</div>
          <div class="text-lg font-bold text-emerald-400">{{ report.summary?.savedHours ?? 0 }}h</div>
        </div>
        <div>
          <div class="text-[11px] text-gray-500">💰 节省人力价值</div>
          <div class="text-lg font-bold text-emerald-400">¥{{ report.summary?.savedCost ?? 0 }}</div>
        </div>
        <div>
          <div class="text-[11px] text-gray-500">🤖 AI 成本 / 健康异常</div>
          <div class="text-lg font-bold">¥{{ report.summary?.aiCost ?? 0 }} <span class="text-xs" :class="(report.summary?.healthIssues || 0) > 0 ? 'text-red-400' : 'text-gray-500'">⚠️{{ report.summary?.healthIssues ?? 0 }}</span></div>
        </div>
      </div>
    </div>

    <div class="text-[10px] text-gray-600 leading-relaxed">
      📐 节省价值 = 成功任务数 × 标准人工耗时（JD 60min / 岗位分析 45min / 面试评估 30min / 筛选 15min / 解析 8min 等）× HR 时薪 ¥50/h，为人力工作价值估算，非现金节省。
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const date = ref(today())
const orgId = ref('')
const orgs = ref<any[]>([])
const report = ref<any>({})

function today(): string {
  const d = new Date(Date.now() - 86400000) // 默认昨日（日报）
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shift(delta: number) {
  const d = new Date(`${date.value}T00:00:00+08:00`)
  d.setDate(d.getDate() + delta)
  date.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  load()
}

async function loadOrgs() {
  const res = await fetch(`/api/admin/enterprise/roi-report?days=90`)
  const d = await res.json()
  orgs.value = d.data?.byOrganization || []
}

async function load() {
  const q = orgId.value ? `&organizationId=${orgId.value}` : ''
  const res = await fetch(`/api/admin/enterprise/daily-report?date=${date.value}${q}`)
  const d = await res.json()
  report.value = d.data || {}
}

onMounted(async () => {
  await loadOrgs()
  await load()
})
</script>
