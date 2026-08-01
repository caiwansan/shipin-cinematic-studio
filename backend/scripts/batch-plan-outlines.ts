/**
 * 百万字测试：批量生成章节大纲（planner 循环，直到 1000 章大纲就绪）
 * 串行执行（planner 依赖现有章节数），每次 25 章
 */
import { PrismaClient } from '@prisma/client'
import { getUserLLMConfig } from '../src/services/hdz/llm.client.js'
import { plannerService } from '../src/services/hdz/planner.service.js'

const prisma = new PrismaClient()
const PROJECT_ID = 'c699d329-a54d-4026-9e29-a4c15339682b'
const USER_ID = '05d00ac2-da4d-4cba-aebe-dd38f505abfc'
const TARGET = 1000

async function main() {
  const cfg = await getUserLLMConfig(USER_ID)
  if (!cfg) throw new Error('无 LLM 配置')

  let round = 0
  while (round < 60) {
    const count = await prisma.hdzChapter.count({ where: { projectId: PROJECT_ID } })
    if (count >= TARGET) { console.log(`✅ 大纲全部就绪: ${count} 章`); break }
    round++
    const task = await prisma.hdzAgentTask.create({
      data: { projectId: PROJECT_ID, agentType: 'planner', status: 'running', input: { mode: 'full' } },
    })
    const t0 = Date.now()
    try {
      // 轮级超时兜底：120s 未完成则视为超时（glm-4-flash 长 JSON 偶发卡死）
      await Promise.race([
        plannerService.execute(
          { userId: USER_ID, projectId: PROJECT_ID, taskId: task.id, agentType: 'planner', mode: 'single' },
          cfg,
        ),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Planner 轮级超时 120s')), 120000)),
      ])
      await prisma.hdzAgentTask.update({ where: { id: task.id }, data: { status: 'completed' } })
      const count2 = await prisma.hdzChapter.count({ where: { projectId: PROJECT_ID } })
      console.log(`[第${round}轮] 大纲 ${count}→${count2} 章 (${((Date.now()-t0)/1000).toFixed(0)}s)`)
    } catch (e: any) {
      await prisma.hdzAgentTask.update({ where: { id: task.id }, data: { status: 'failed', approvalNote: e.message.slice(0, 300) } })
      console.log(`[第${round}轮] ❌ ${e.message.slice(0, 120)}`)
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  console.log('🏁 批量大纲生成结束')
}
main().finally(() => prisma.$disconnect())
