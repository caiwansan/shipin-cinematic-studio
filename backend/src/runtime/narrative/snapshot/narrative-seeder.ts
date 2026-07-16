/**
 * narrative-seeder.ts — 从 hdzMemory + hdzChapter 回填 Runtime
 * 
 * 用途：将《剑道》213 章的已有数据导入 Narrative Runtime，
 *       以便 Snapshot Inspector 验证。
 * 
 * ⚠️ 无循环依赖：Seeder 不通过 narrativeRuntime 门面，直接操作 repository
 * 
 * 用法：
 *   npx tsx src/runtime/narrative/snapshot/narrative-seeder.ts  6050d107-b21c-41a2-a900-6582cf540cb9
 */

import { PrismaClient } from '@prisma/client'
import { narrativeRepository } from '../narrative-repository.js'

const prisma = new PrismaClient()

async function main() {
  const projectId = process.argv[2]
  if (!projectId) {
    console.error('用法: npx tsx narrative-seeder.ts <projectId>')
    process.exit(1)
  }

  console.log(`\n═══════════ Narrative Seeder ═══════════`)
  console.log(`  Project: ${projectId}`)
  console.log(`  开始从数据库回填 Runtime...\n`)

  // Step 1: 读取 hdzMemory（7-Truths）
  const memories = await prisma.hdzMemory.findMany({
    where: { projectId },
  })
  console.log(`📦 hdzMemory: ${memories.length} 条`)
  for (const m of memories) {
    const dataRaw = typeof m.data === 'string' ? JSON.parse(m.data) : m.data
    await seedMemory(projectId, m.type, dataRaw)
  }

  // Step 2: 读取 hdzChapter 列表（建 Timeline + Event）
  const chapters = await prisma.hdzChapter.findMany({
    where: { projectId },
    orderBy: { chapterNo: 'asc' },
    select: {
      chapterNo: true,
      title: true,
      summary: true,
      wordCount: true,
      status: true,
    },
  })
  console.log(`📚 hdzChapter: ${chapters.length} 章`)

  // 建立 Timeline
  const timelineEntries = chapters.map(ch => ({
    chapterNo: ch.chapterNo,
    summary: ch.summary || '',
    eventIds: [] as string[],
    storyTime: { timeDescription: `第${ch.chapterNo}章`, isPrecise: false },
  }))
  narrativeRepository.writeJson(projectId, 'timeline', 'entries.json', timelineEntries)
  console.log(`  ✅ Timeline: ${timelineEntries.length} entries`)

  // Step 3: 读取 hdzCharacter
  const characters = await prisma.hdzCharacter.findMany({
    where: { projectId },
  })
  console.log(`👤 hdzCharacter: ${characters.length} 条`)

  const charEntries = characters.map(c => ({
    characterName: c.name,
    role: c.role || 'unknown',
    lifecycle: 'alive',
    currentGoal: '',
    flags: [],
    properties: (c.properties as any) || {},
    arc: (c.arc as any) || null,
  }))
  narrativeRepository.writeJson(projectId, 'character', 'snapshot.json', charEntries)
  console.log(`  ✅ Character: ${charEntries.length} entries`)

  // Step 4: 读取 hdzStyleDna
  const styleDna = await prisma.hdzStyleDna.findFirst({
    where: { projectId },
  })
  if (styleDna) {
    narrativeRepository.writeJson(projectId, 'world', 'world-state.json', {
      worldState: {
        description: `项目风格分析: ${(styleDna as any).sourceText?.slice(0, 200) || '无'}`,
        factions: [],
        originEra: '',
      },
    })
    console.log(`  ✅ StyleDNA → World`)
  }

  // Step 5: Integritiy 自检 — 通过 HTTP API 调用，避免循环依赖
  console.log(`\n🔍 检查 Runtime 数据文件:`)
  const charFile = narrativeRepository.readJson<any[]>(projectId, 'character', 'snapshot.json')
  console.log(`  角色: ${charFile?.length || 0} 条`)
  const eventsFile = narrativeRepository.readJson<any[]>(projectId, 'event', 'snapshot.json')
  console.log(`  事件: ${eventsFile?.length || 0} 条`)
  const timelineFile = narrativeRepository.readJson<any[]>(projectId, 'timeline', 'entries.json')
  console.log(`  时间线: ${timelineFile?.length || 0} 条`)
  const worldFile = narrativeRepository.readJson<any>(projectId, 'world', 'world-state.json')
  console.log(`  世界: ${worldFile ? '✅' : '❌'}`)
  const foreshadowFile = narrativeRepository.readJson<any[]>(projectId, 'foreshadow', 'snapshot.json')
  console.log(`  伏笔: ${foreshadowFile?.length || 0} 条`)

  console.log(`\n✅ Seeder 完成`)
  console.log(`  现在可以运行:`)
  console.log(`  npx tsx inspector.ts inspect ${projectId} 1`)
  console.log(`  npx tsx inspector.ts inspect ${projectId} 43`)
  console.log(`  npx tsx inspector.ts inspect ${projectId} 107`)
  console.log(`  npx tsx inspector.ts inspect ${projectId} 170`)
  console.log(`  npx tsx inspector.ts inspect ${projectId} 213`)

  await prisma.$disconnect()
}

async function seedMemory(projectId: string, type: string, data: any) {
  switch (type) {
    case 'character_matrix':
      if (data?.entities) {
        narrativeRepository.writeJson(projectId, 'character', 'snapshot.json', data.entities.map((e: any) => ({
          characterName: e.name,
          role: 'unknown',
          lifecycle: e.state || 'alive',
          currentGoal: e.goal || '',
          flags: (e.relationship_changes || []).slice(0, 5).map((rc: string) => ({ flag: 'change', value: rc })),
          properties: {},
          arc: null,
        })))
        console.log(`  ✅ character_matrix → Character Runtime`)
      }
      break

    case 'pending_hooks':
      if (data?.hooks) {
        narrativeRepository.writeJson(projectId, 'foreshadow', 'snapshot.json', data.hooks.map((h: any, i: number) => ({
          id: `hook-${i}`,
          description: h.hook || JSON.stringify(h),
          status: 'planted',
          plantedChapterNo: h.chapter_introduced || 1,
          expectedPayoffWindow: undefined,
          resolvedChapterNo: undefined,
          resolution: undefined,
        })))
        console.log(`  ✅ pending_hooks → Foreshadow Runtime (${data.hooks.length} hooks)`)
      }
      break

    case 'location_state':
      if (data?.locations) {
        const factions = data.locations.map((l: any) => ({
          name: l.name,
          type: 'location',
          status: 'active',
        }))
        narrativeRepository.writeJson(projectId, 'world', 'world-state.json', {
          worldState: {
            description: '地点状态（从 location_state 导入）',
            factions,
            originEra: '',
          },
        })
        console.log(`  ✅ location_state → World Runtime (${factions.length} locations)`)
      }
      break

    case 'timeline':
      if (data?.timeline) {
        narrativeRepository.writeJson(projectId, 'timeline', 'entries.json', data.timeline.map((t: any) => ({
          chapterNo: t.chapter,
          summary: t.events || t.storyTime || '',
          eventIds: [],
          storyTime: { timeDescription: t.storyTime || '', isPrecise: false },
        })))
        console.log(`  ✅ timeline → Timeline Runtime (${data.timeline.length} entries)`)
      }
      break

    case 'world_state':
      if (data?.events) {
        // 合并到已有的 world state
        const existing = narrativeRepository.readJson<any>(projectId, 'world', 'world-state.json')
        narrativeRepository.writeJson(projectId, 'world', 'world-state.json', {
          ...existing,
          worldState: {
            description: data.events.slice(0, 500),
            factions: existing?.worldState?.factions || [],
            originEra: existing?.worldState?.originEra || '',
          },
        })
        console.log(`  ✅ world_state → World Runtime`)
      }
      break

    case 'pov_tracker':
      if (data?.records) {
        const events = data.records.map((r: any, i: number) => ({
          id: `pov-event-${i}`,
          title: `视角切换到 ${r.character}`,
          description: `第${r.chapter}章视角切换到${r.character}${r.shiftFrom ? '（从'+r.shiftFrom+'）' : ''}`,
          category: 'internal_conflict',
          chapterNo: r.chapter || 1,
          participants: [{ characterName: r.character, role: 'initiator' }],
          locationName: undefined,
          consequences: [],
          relatedForeshadowIds: [],
        }))
        narrativeRepository.writeJson(projectId, 'event', 'snapshot.json', events)
        console.log(`  ✅ pov_tracker → Event Runtime (${events.length} events)`)
      }
      break

    default:
      console.log(`  ⚠️ 未处理的 memory type: ${type}`)
  }
}

main().catch(err => {
  console.error('❌ Seeder failed:', err)
  process.exit(1)
})
