<!-- /admin/enterprise/roi-report.vue — Sprint-05 T02 AI Workforce ROI Report（销售武器） -->
<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">AI Workforce ROI Report</h1>
        <p class="text-sm text-gray-400 mt-1">AI 员工价值报表 — 替代多少 HR 重复工时，花多少钱，ROI 几何</p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="days"
          class="bg-[#0D1328] border border-[#1A2240] text-white text-xs rounded-lg px-3 py-2"
          @change="load"
        >
          <option :value="7">近 7 天</option>
          <option :value="30">近 30 天</option>
          <option :value="90">近 90 天</option>
        </select>
        <button class="px-3 py-2 bg-[#1A2240] hover:bg-[#243054] text-gray-300 text-xs rounded-lg" @click="load">刷新</button>
      </div>
    </div>

    <!-- 核心 ROI 卡片 -->
    <div class="grid grid-cols-4 gap-3">
      <div class="bg-gradient-to-br from-indigo-600/20 to-[#0D1328] border border-indigo-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-indigo-300">{{ summary.savedHours ?? 0 }}<span class="text-sm text-gray-400 ml-1">小时</span></div>
        <div class="text-xs text-gray-400 mt-1">⏱️ 节省人工工时（估算）</div>
      </div>
      <div class="bg-gradient-to-br from-green-600/20 to-[#0D1328] border border-green-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-green-400">¥{{ (summary.savedCost ?? 0).toFixed(0) }}</div>
        <div class="text-xs text-gray-400 mt-1">💰 节省人工成本（¥{{ params.hrHourlyRate }}/h 估算）</div>
      </div>
      <div class="bg-gradient-to-br from-yellow-600/20 to-[#0D1328] border border-yellow-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-yellow-400">¥{{ (summary.aiCost ?? 0).toFixed(4) }}</div>
        <div class="text-xs text-gray-400 mt-1">🤖 AI 实际成本</div>
      </div>
      <div class="bg-gradient-to-br from-purple-600/20 to-[#0D1328] border border-purple-500/30 rounded-xl p-4">
        <div class="text-3xl font-bold text-purple-300">{{ summary.roi === null ? '∞' : summary.roi + '×' }}</div>
        <div class="text-xs text-gray-400 mt-1">📈 ROI（节省 / 投入）</div>
      </div>
    </div>

    <!-- 第二行小卡片 -->
    <div class="grid grid-cols-4 gap-3">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-white">{{ summary.taskCount || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">执行任务</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-green-400">{{ summary.successRate || 0 }}%</div>
        <div class="text-xs text-gray-400 mt-1">成功率</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-blue-400">{{ (summary.tokens || 0).toLocaleString() }}</div>
        <div class="text-xs text-gray-400 mt-1">Tokens</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-gray-300">{{ summary.savedMinutes || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">节省分钟数</div>
      </div>
    </div>

    <!-- 按任务类型 ROI -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
      <div class="px-4 py-3 text-sm font-medium text-gray-300 border-b border-[#1A2240]">📋 按任务类型（节省工时排序）</div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-400 border-b border-[#1A2240]">
              <th class="text-left px-4 py-2.5 font-medium">任务类型</th>
              <th class="text-left px-4 py-2.5 font-medium">执行次数</th>
              <th class="text-left px-4 py-2.5 font-medium">成功</th>
              <th class="text-left px-4 py-2.5 font-medium">节省工时</th>
              <th class="text-left px-4 py-2.5 font-medium">节省成本</th>
              <th class="text-left px-4 py-2.5 font-medium">AI 成本</th>
              <th class="text-left px-4 py-2.5 font-medium">Tokens</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in byType" :key="t.taskType" class="border-b border-[#141B36] hover:bg-[#111A38]/50">
              <td class="px-4 py-2.5 text-gray-300">{{ t.taskType }}</td>
              <td class="px-4 py-2.5 text-white">{{ t.count }}</td>
              <td class="px-4 py-2.5 text-green-400">{{ t.succeeded }}</td>
              <td class="px-4 py-2.5 text-indigo-300">{{ t.savedHours }}h</td>
              <td class="px-4 py-2.5 text-green-400">¥{{ t.savedCost.toFixed(0) }}</td>
              <td class="px-4 py-2.5 text-yellow-400/80">¥{{ t.cost.toFixed(4) }}</td>
              <td class="px-4 py-2.5 text-gray-400">{{ t.tokens.toLocaleString() }}</td>
            </tr>
            <tr v-if="!byType.length">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">该时间段暂无 AI 员工执行记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 按企业 ROI -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
      <div class="px-4 py-3 text-sm font-medium text-gray-300 border-b border-[#1A2240]">🏢 按企业（销售弹药：每家省了多少）</div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-400 border-b border-[#1A2240]">
              <th class="text-left px-4 py-2.5 font-medium">企业</th>
              <th class="text-left px-4 py-2.5 font-medium">执行次数</th>
              <th class="text-left px-4 py-2.5 font-medium">成功</th>
              <th class="text-left px-4 py-2.5 font-medium">节省工时</th>
              <th class="text-left px-4 py-2.5 font-medium">节省成本</th>
              <th class="text-left px-4 py-2.5 font-medium">AI 成本</th>
              <th class="text-left px-4 py-2.5 font-medium">Tokens</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in byOrganization" :key="o.organizationId" class="border-b border-[#141B36] hover:bg-[#111A38]/50">
              <td class="px-4 py-2.5 text-gray-300">{{ o.organizationName }}</td>
              <td class="px-4 py-2.5 text-white">{{ o.count }}</td>
              <td class="px-4 py-2.5 text-green-400">{{ o.succeeded }}</td>
              <td class="px-4 py-2.5 text-indigo-300">{{ o.savedHours }}h</td>
              <td class="px-4 py-2.5 text-green-400">¥{{ o.savedCost.toFixed(0) }}</td>
              <td class="px-4 py-2.5 text-yellow-400/80">¥{{ o.cost.toFixed(4) }}</td>
              <td class="px-4 py-2.5 text-gray-400">{{ o.tokens.toLocaleString() }}</td>
            </tr>
            <tr v-if="!byOrganization.length">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">该时间段暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 口径说明（透明化：展示估算依据 + 免责声明） -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4 space-y-2">
      <div class="text-[11px] font-bold text-gray-400">📐 估算口径（透明可审计）</div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-[11px] text-gray-500">
        <div v-for="b in baseTable" :key="b.type" class="flex justify-between">
          <span>{{ b.type }}</span><span class="text-gray-400">{{ b.minutes }}min</span>
        </div>
        <div class="flex justify-between"><span class="text-amber-400/80">HR 时薪</span><span class="text-gray-400">¥{{ params.hrHourlyRate }}/h</span></div>
      </div>
      <div class="text-[11px] text-gray-500 leading-relaxed border-t border-[#1A2240] pt-2">
        公式：节省工时 = 成功任务数 × 标准人工耗时；节省成本 = 工时 × HR 时薪；ROI = 节省成本 ÷ AI 实际成本（∞ = AI 成本为 0 时纯赚）。<br>
        <span class="text-gray-600">⚠️ 节省价值为<b>人力工作价值的估算</b>（替代了多少人工工时），非实际现金节省；实际收益取决于团队如何重新分配这些工时。</span><br>
        数据源：EnterpriseAgentTask 真实执行记录（失败任务不计）。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const days = ref(30)
const summary = ref<any>({})
const params = ref<any>({ hrHourlyRate: 50 })
const byType = ref<any[]>([])
const byOrganization = ref<any[]>([])
const baseTable = [
  { type: 'JD 生成', minutes: 60 },
  { type: '岗位分析', minutes: 45 },
  { type: '面试评估', minutes: 30 },
  { type: '职业规划', minutes: 30 },
  { type: '面试推荐', minutes: 30 },
  { type: '面试出题', minutes: 20 },
  { type: '匹配报告', minutes: 20 },
  { type: '候选筛选', minutes: 15 },
  { type: '简历匹配', minutes: 10 },
  { type: '简历解析', minutes: 8 },
  { type: '回复生成', minutes: 5 },
]

async function load() {
  const res = await fetch(`/api/admin/enterprise/roi-report?days=${days.value}`)
  const d = await res.json()
  summary.value = d.data?.summary || {}
  params.value = d.data?.params || { hrHourlyRate: 50 }
  byType.value = d.data?.byType || []
  byOrganization.value = d.data?.byOrganization || []
}

onMounted(load)
</script>
