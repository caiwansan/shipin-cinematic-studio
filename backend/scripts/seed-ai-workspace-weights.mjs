/**
 * scripts/seed-ai-workspace-weights.mjs
 * 昆仑镜 Workspace AI 推荐权重（AI-CENTER-02B）
 * workspace_ai_weight 表 upsert by workspace，可重复执行
 *
 * 权重语义：六维百分比（和为 100），recommendScore = Σ(capabilityScore × weight%)
 * 掌柜 2026-08-01 定稿：第一批 4 个 Workspace 权重
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const weights = [
  {
    workspace: 'job', // 招聘：中文简历理解 / 面试分析 / 企业报告
    weightConfig: { chinese: 35, reasoning: 30, quality: 20, cost: 15, speed: 0, coding: 0 },
    enabled: true,
  },
  {
    workspace: 'shortdrama', // 短剧：剧情创作 / 角色设计 / 批量生成
    weightConfig: { quality: 35, chinese: 25, reasoning: 20, cost: 20, speed: 0, coding: 0 },
    enabled: true,
  },
  {
    workspace: 'novel', // 小说：中文创作 / 内容质量 / 成本
    weightConfig: { chinese: 35, quality: 30, cost: 20, reasoning: 15, speed: 0, coding: 0 },
    enabled: true,
  },
  {
    workspace: 'coding', // 代码：代码能力 / 推理 / 速度
    weightConfig: { coding: 40, reasoning: 30, speed: 15, cost: 15, chinese: 0, quality: 0 },
    enabled: true,
  },
]

for (const w of weights) {
  await prisma.workspaceAiWeight.upsert({
    where: { workspace: w.workspace },
    update: { weightConfig: w.weightConfig, enabled: w.enabled },
    create: w,
  })
  console.log(`✅ workspace=${w.workspace} weight=${JSON.stringify(w.weightConfig)}`)
}

await prisma.$disconnect()
