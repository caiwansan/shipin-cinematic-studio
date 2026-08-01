<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">💎 AI 员工价值中心</h3>
      <span class="text-[9px] text-gray-600">真实执行结果 · 禁估算</span>
    </div>

    <div class="flex-1 space-y-2 overflow-y-auto pr-1" style="max-height: 220px">
      <template v-if="workspaces.length === 0">
        <div class="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-4 text-center">
          <p class="text-[10px] text-gray-500">暂无 AI 员工产生业务结果</p>
          <p class="text-[9px] text-gray-600 mt-1">运行 AI 任务后自动登记（agent_outcome）</p>
        </div>
      </template>

      <div v-for="ws in workspaces" :key="ws.workspace" class="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
        <div class="flex items-center gap-1.5 mb-1.5">
          <span class="text-[10px] font-semibold text-white/80">{{ workspaceLabel(ws.workspace) }}</span>
          <span class="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{{ ws.types.length }} 类结果</span>
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1">
          <div v-for="t in ws.types" :key="t.outcomeType" class="flex items-center justify-between">
            <span class="text-[9px] text-gray-400">{{ outcomeLabel(ws.workspace, t.outcomeType) }}</span>
            <span class="text-[11px] font-bold text-emerald-400 font-mono">{{ t.count }}</span>
          </div>
        </div>
        <div v-if="cost(ws.workspace) > 0" class="mt-1.5 pt-1.5 border-t border-white/[0.05] flex items-center justify-between">
          <span class="text-[8px] text-gray-500">真实调用成本</span>
          <span class="text-[9px] font-mono text-amber-400">${{ cost(ws.workspace).toFixed(4) }}</span>
        </div>
      </div>
    </div>

    <div class="mt-2 pt-2 border-t border-white/[0.05] shrink-0">
      <p class="text-[8px] text-gray-600 leading-relaxed">
        ⚠️ ROI 待企业价值参数（如 HR 小时成本）配置后启用 —— 当前仅展示真实结果与真实成本，禁止估算
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data?: any }>()

const LABELS: Record<string, Record<string, string>> = {
  recruitment: {
    CANDIDATE_RECEIVED: '候选人接收',
    EVALUATION_GENERATED: 'AI 评价',
    CANDIDATE_SCREENED: '进入筛选',
    INTERVIEW_CREATED: '面试创建',
    HIRING_RECOMMENDATION: '录用建议',
    CANDIDATE_RANKED: '候选人排名',
    TALENT_REPORT_CREATED: '人才报告',
  },
  career: {
    RESUME_OPTIMIZED: '简历优化',
    CAREER_PLAN_CREATED: '职业规划',
    INTERVIEW_SIMULATION_COMPLETED: '模拟面试',
    JOB_MATCH_GENERATED: '岗位匹配',
    SKILL_GAP_ANALYZED: '技能差距分析',
    SALARY_GUIDE_GENERATED: '薪资谈判指南',
    CAREER_TASK_COMPLETED: '自治任务完成',
  },
  shortdrama: {
    SCRIPT_ANALYZED: '剧本分析',
    CHARACTER_CREATED: '角色创建',
    STORYBOARD_GENERATED: '分镜生成',
    VIDEO_RENDER_COMPLETED: '视频渲染完成',
  },
}

const WS_LABELS: Record<string, string> = { recruitment: '💼 招聘 AI 员工', career: '🤝 求职管家', shortdrama: '🎬 短剧 AI 导演' }

const workspaces = computed(() => (props.data?.outcomes || []).map((ws: any) => ({
  workspace: ws.workspace,
  types: (ws.types || []).sort((a: any, b: any) => b.count - a.count),
})))
const costs = computed(() => props.data?.costs || {})

const workspaceLabel = (ws: string) => WS_LABELS[ws] || ws
const outcomeLabel = (ws: string, t: string) => LABELS[ws]?.[t] || t
const cost = (ws: string) => Number(costs.value[ws]?.cost || 0)
</script>
