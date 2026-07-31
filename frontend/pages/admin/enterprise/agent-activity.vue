<!-- /admin/enterprise/agent-activity.vue — Sprint-RECRUITMENT-REALITY-04 T02 Agent Activity Center -->
<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">Agent Activity Center</h1>
        <p class="text-sm text-gray-400 mt-1">AI 员工执行历史 — 客户视角：我的 AI 员工今天干了什么</p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="days"
          class="bg-[#0D1328] border border-[#1A2240] text-white text-xs rounded-lg px-3 py-2"
          @change="load"
        >
          <option :value="1">近 1 天</option>
          <option :value="7">近 7 天</option>
          <option :value="30">近 30 天</option>
          <option :value="90">近 90 天</option>
        </select>
        <button class="px-3 py-2 bg-[#1A2240] hover:bg-[#243054] text-gray-300 text-xs rounded-lg" @click="load">刷新</button>
      </div>
    </div>

    <!-- 汇总卡片 -->
    <div class="grid grid-cols-6 gap-3">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-white">{{ summary.total || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">执行任务</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-green-400">{{ summary.successRate || 0 }}%</div>
        <div class="text-xs text-gray-400 mt-1">成功率</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-blue-400">{{ (summary.totalTokens || 0).toLocaleString() }}</div>
        <div class="text-xs text-gray-400 mt-1">Tokens</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-yellow-400">¥{{ (summary.totalCost || 0).toFixed(4) }}</div>
        <div class="text-xs text-gray-400 mt-1">总成本</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-purple-400">{{ summary.activeAgents || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">活跃 AI 员工</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-gray-300">{{ summary.avgDurationMs || 0 }}ms</div>
        <div class="text-xs text-gray-400 mt-1">平均耗时</div>
      </div>
    </div>

    <!-- 按 AI 员工聚合 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
      <div class="text-sm font-medium text-gray-300 mb-3">🤖 按 AI 员工</div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div v-for="a in byAgent" :key="a.agentInstanceId" class="bg-[#111A38]/60 border border-[#1A2240] rounded-lg p-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-gray-300">{{ a.agentInstanceId?.slice(0, 8) }}</span>
            <span class="text-[10px" :class="a.successRate >= 80 ? 'text-green-400' : a.successRate >= 50 ? 'text-yellow-400' : 'text-red-400'">
              成功率 {{ a.successRate }}%
            </span>
          </div>
          <div class="mt-2 text-xs text-gray-400">
            {{ a.taskCount }} 次执行 · {{ a.tokens.toLocaleString() }} tokens · ¥{{ a.cost.toFixed(4) }}
          </div>
          <div class="mt-1.5 flex flex-wrap gap-1">
            <span v-for="t in a.taskTypes" :key="t" class="px-1.5 py-0.5 bg-[#1A2240] text-gray-300 rounded text-[10px]">{{ t }}</span>
          </div>
          <div class="mt-1.5 text-[10px] text-gray-500">最后活跃: {{ a.lastTaskAt ? new Date(a.lastTaskAt).toLocaleString('zh-CN') : '-' }}</div>
        </div>
      </div>
    </div>

    <!-- 按任务类型 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
      <div class="text-sm font-medium text-gray-300 mb-3">📋 按任务类型</div>
      <div class="flex flex-wrap gap-2">
        <span v-for="t in byType" :key="t.taskType" class="px-2.5 py-1 bg-[#111A38] border border-[#1A2240] rounded-lg text-xs text-gray-300">
          {{ t.taskType }} × {{ t.count }} <span class="text-gray-500">(¥{{ t.cost.toFixed(4) }})</span>
        </span>
      </div>
    </div>

    <!-- 执行流 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
      <div class="px-4 py-3 text-sm font-medium text-gray-300 border-b border-[#1A2240]">📜 执行记录</div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-400 border-b border-[#1A2240]">
              <th class="text-left px-4 py-2.5 font-medium">时间</th>
              <th class="text-left px-4 py-2.5 font-medium">企业</th>
              <th class="text-left px-4 py-2.5 font-medium">任务</th>
              <th class="text-left px-4 py-2.5 font-medium">状态</th>
              <th class="text-left px-4 py-2.5 font-medium">输入</th>
              <th class="text-left px-4 py-2.5 font-medium">Tokens</th>
              <th class="text-left px-4 py-2.5 font-medium">成本</th>
              <th class="text-left px-4 py-2.5 font-medium">耗时</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tasks" :key="t.id" class="border-b border-[#141B36] hover:bg-[#111A38]/50">
              <td class="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                {{ new Date(t.startedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}
              </td>
              <td class="px-4 py-2.5 text-gray-300 max-w-[120px] truncate">{{ t.organizationName || t.organizationId?.slice(0, 8) || '-' }}</td>
              <td class="px-4 py-2.5 text-gray-300">{{ t.taskType }}</td>
              <td class="px-4 py-2.5">
                <span :class="t.status === 'failed' ? 'text-red-400' : 'text-green-400'">
                  {{ t.status === 'failed' ? '❌' : '✅' }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-gray-400 max-w-[200px] truncate" :title="t.inputSummary || ''">{{ t.inputSummary || '-' }}</td>
              <td class="px-4 py-2.5 text-gray-300">{{ t.tokens?.toLocaleString() }}</td>
              <td class="px-4 py-2.5 text-yellow-400/80">¥{{ t.cost?.toFixed(4) }}</td>
              <td class="px-4 py-2.5 text-gray-400">{{ t.durationMs ? t.durationMs + 'ms' : '-' }}</td>
            </tr>
            <tr v-if="!tasks.length">
              <td colspan="8" class="px-4 py-8 text-center text-gray-500">该时间段暂无 AI 员工执行记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const days = ref(7)
const summary = ref<any>({})
const byAgent = ref<any[]>([])
const byType = ref<any[]>([])
const tasks = ref<any[]>([])

async function load() {
  const res = await fetch(`/api/admin/enterprise/agent-activity?days=${days.value}`)
  const d = await res.json()
  summary.value = d.data?.summary || {}
  byAgent.value = d.data?.byAgent || []
  byType.value = d.data?.byType || []
  tasks.value = d.data?.tasks || []
}

onMounted(load)
</script>
