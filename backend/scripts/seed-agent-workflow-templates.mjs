/**
 * scripts/seed-agent-workflow-templates.mjs — AI-CENTER-03A AI 团队协作编排观察层 seed
 *
 * 掌柜指令（2026-08-01）：
 *   AgentWorkflowTemplate = 一个任务需要哪些 AI 员工协作（只展示，不自动执行）
 *   红线：❌ 自动调用 Hermes ❌ 自动创建任务 ❌ 自动消耗 Token ❌ 自动切换模型
 *         只做 ✅ 识别 ✅ 编排建议 ✅ 展示
 *
 * 招聘AI团队（job 场景）：
 *   ① Alice 招聘顾问    — 生成招聘策略（岗位画像 + JD + 渠道建议）
 *   ② Carol 人才分析师  — 搜索匹配人才（渠道候选人 + 技能匹配 + 分析报告）
 *   ③ Bob 面试专家      — 执行面试评价（面试题 + 评估 + 录用建议）
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TEMPLATES = [
  {
    name: '招聘高级前端工程师',
    businessType: 'job',
    taskType: 'hire_frontend_engineer',
    agents: [
      { agentType: 'recruiter', order: 1, task: '生成招聘策略（岗位画像 + JD + 渠道建议）' },
      { agentType: 'talent_analyst', order: 2, task: '搜索匹配人才（渠道候选人 + 技能匹配 + 分析报告）' },
      { agentType: 'interview', order: 3, task: '执行面试评价（面试题 + 评估 + 录用建议）' },
    ],
  },
  {
    name: '招聘高级后端工程师',
    businessType: 'job',
    taskType: 'hire_backend_engineer',
    agents: [
      { agentType: 'recruiter', order: 1, task: '生成招聘策略（岗位画像 + JD + 渠道建议）' },
      { agentType: 'talent_analyst', order: 2, task: '搜索匹配人才（渠道候选人 + 技能匹配 + 分析报告）' },
      { agentType: 'interview', order: 3, task: '执行面试评价（面试题 + 评估 + 录用建议）' },
    ],
  },
  {
    name: '校园招聘管培生',
    businessType: 'job',
    taskType: 'campus_hire_management_trainee',
    agents: [
      { agentType: 'recruiter', order: 1, task: '生成招聘策略（校招画像 + 宣讲计划 + 渠道建议）' },
      { agentType: 'talent_analyst', order: 2, task: '批量筛选简历（应届生匹配 + 潜力分析）' },
      { agentType: 'interview', order: 3, task: '执行面试评价（结构化面试 + 评估 + 录用建议）' },
    ],
  },
]

for (const t of TEMPLATES) {
  const row = {
    name: t.name,
    businessType: t.businessType,
    taskType: t.taskType,
    agents: JSON.stringify(t.agents),
    status: 'active',
  }
  await prisma.agentWorkflowTemplate.upsert({
    where: { id: `wf-${t.taskType}` },
    update: row,
    create: { id: `wf-${t.taskType}`, ...row },
  })
  console.log(`✅ 模板: ${t.name} (${t.taskType}) → ${t.agents.map((a) => a.agentType).join(' → ')}`)
}
await prisma.$disconnect()
console.log('agent_workflow_template seed 完成')
