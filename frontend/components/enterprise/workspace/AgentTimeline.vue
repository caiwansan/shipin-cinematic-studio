<template>
  <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-white">工作记录</h4>
      <span class="text-[10px] text-gray-500">{{ tasks.length }} 条记录</span>
    </div>

    <!-- Timeline -->
    <div v-if="tasks.length > 0" class="space-y-0">
      <div v-for="(task, idx) in tasks" :key="task.id" class="relative pl-6 pb-4 last:pb-0">
        <!-- Timeline line -->
        <div v-if="idx < tasks.length - 1" class="absolute left-[9px] top-4 bottom-0 w-px bg-[#1A2240]" />

        <!-- Dot -->
        <div
          :class="dotClass(task.status)"
          class="absolute left-0 top-1.5 w-[18px] h-[18px] rounded-full flex items-center justify-center"
        >
          <span class="text-[10px]">{{ dotIcon(task.status) }}</span>
        </div>

        <!-- Content -->
        <div class="bg-[#060A18] rounded-lg p-3 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs text-white font-medium">{{ taskTypeLabel(task.taskType) }}</span>
            <span class="text-[10px] text-gray-600">{{ formatTime(task.startedAt) }}</span>
          </div>
          <p v-if="task.outputSummary" class="text-[11px] text-gray-400 line-clamp-2">
            {{ task.outputSummary }}
          </p>
          <div class="flex items-center gap-3 text-[10px] text-gray-500">
            <span v-if="task.durationMs" class="flex items-center gap-0.5">
              ⚡ {{ formatDuration(task.durationMs) }}
            </span>
            <span v-if="task.tokenInput" class="flex items-center gap-0.5">
              📝 {{ task.tokenInput + task.tokenOutput }}
            </span>
            <span v-if="task.cost" class="flex items-center gap-0.5">
              💰 ¥{{ task.cost.toFixed(4) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="py-8 text-center">
      <div class="text-2xl mb-2">📋</div>
      <div class="text-xs text-gray-500">暂无工作记录</div>
      <div class="text-[10px] text-gray-600 mt-1">AI 员工执行任务后将自动记录</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tasks: { type: Array, default: () => [] }
})

function dotClass(status) {
  if (status === 'success' || status === 'completed') return 'bg-green-500/10 border border-green-500/30'
  if (status === 'failed') return 'bg-red-500/10 border border-red-500/30'
  if (status === 'running') return 'bg-blue-500/10 border border-blue-500/30'
  return 'bg-gray-500/10 border border-gray-500/30'
}

function dotIcon(status) {
  if (status === 'success' || status === 'completed') return '✓'
  if (status === 'failed') return '✗'
  if (status === 'running') return '◌'
  return '•'
}

function taskTypeLabel(type) {
  const labels = {
    content_generation: '内容生成',
    customer_analysis: '客户分析',
    market_research: '市场调研',
    report_generation: '报告生成',
    lead_scoring: '线索评分',
    sales_followup: '销售跟进',
    customer_service: '客户服务',
    data_analysis: '数据分析',
    social_media: '社媒运营',
    strategy_planning: '策略规划',
    manual_task: '手动任务'
  }
  return labels[type] || type || '任务'
}

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diffMs = now - d
  if (diffMs < 60000) return '刚刚'
  if (diffMs < 3600000) return Math.floor(diffMs / 60000) + ' 分钟前'
  if (diffMs < 86400000) return Math.floor(diffMs / 3600000) + ' 小时前'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms) {
  if (ms < 1000) return ms + 'ms'
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's'
  return Math.floor(ms / 60000) + 'm'
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
