/**
 * scripts/seed-ai-agent-profiles.mjs — AI-CENTER-02C AI 员工模型画像
 *
 * 掌柜定稿（2026-08-01）：
 *   Alice 招聘顾问   → job 场景权重 + 中文/推理/成本 → DeepSeek 92.7
 *   Bob 面试专家     → 推理/质量优先（结构化分析·评价能力）→ GPT/Claude
 *   Carol 人才分析师 → 中文/数据分析/成本优先 → DeepSeek
 *   AI职业助理       → 中文/质量/推理均衡
 *   AI猎聘顾问(talent_agent) → 归入 recruiter 画像（同一岗位族，不伪造新画像）
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const PROFILES = [
  {
    agentType: 'recruiter',
    roleName: '招聘顾问',
    workspace: 'job',
    preferredCapabilities: { chinese: 35, reasoning: 30, quality: 20, cost: 15, speed: 0, coding: 0 },
    avoidCapabilities: {},
    costPreference: 'balanced',
    reasonNotes: ['中文招聘理解优秀', '推理能力优秀', '生成质量强', '成本优势'],
  },
  {
    agentType: 'interview',
    roleName: '面试专家',
    workspace: 'job',
    preferredCapabilities: { reasoning: 40, quality: 40, chinese: 20, cost: 0, speed: 0, coding: 0 },
    avoidCapabilities: { coding: 1 },
    costPreference: 'quality_priority',
    reasonNotes: ['推理能力优秀（结构化面试分析）', '生成质量强（面试评估报告）', '中文能力良好'],
  },
  {
    agentType: 'talent_analyst',
    roleName: '人才分析师',
    workspace: 'job',
    preferredCapabilities: { chinese: 35, reasoning: 25, quality: 20, cost: 20, speed: 0, coding: 0 },
    avoidCapabilities: {},
    costPreference: 'cost_priority',
    reasonNotes: ['中文能力优秀（中文简历理解）', '数据分析推理强', '成本优势（批量分析场景）'],
  },
  {
    agentType: 'career_advisor',
    roleName: '职业助理',
    workspace: 'job',
    preferredCapabilities: { chinese: 35, quality: 25, reasoning: 25, cost: 15, speed: 0, coding: 0 },
    avoidCapabilities: {},
    costPreference: 'balanced',
    reasonNotes: ['中文能力优秀（职业建议）', '生成质量强（求职方案）', '推理能力优秀'],
  },
]

for (const p of PROFILES) {
  const row = {
    roleName: p.roleName,
    workspace: p.workspace,
    preferredCapabilities: JSON.stringify(p.preferredCapabilities),
    avoidCapabilities: JSON.stringify(p.avoidCapabilities),
    costPreference: p.costPreference,
    reasonNotes: JSON.stringify(p.reasonNotes),
    status: 'active',
  }
  await prisma.agentAiProfile.upsert({
    where: { agentType: p.agentType },
    update: row,
    create: { agentType: p.agentType, ...row },
  })
  console.log(`✅ 画像: ${p.agentType} (${p.roleName})`)
}
await prisma.$disconnect()
console.log('agent_ai_profile seed 完成')
