/**
 * backfill-imageprompt.ts
 * 
 * ⭐ 数据迁移：将所有已有项目的 videoSegments[i].imagePrompt 
 *    从 frameDesign[i].firstFrame.imagePrompt 填充。
 * 
 * 运行：npx tsx scripts/backfill-imageprompt.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, executionResults: true },
  })

  let updated = 0
  let alreadyFine = 0
  let noFrameDesign = 0
  let skipNoMatch = 0

  for (const proj of projects) {
    const er = typeof proj.executionResults === 'string'
      ? JSON.parse(proj.executionResults)
      : proj.executionResults

    if (!er) continue

    const videoSegments: any[] = er.videoSegments || []
    const frameDesign: any[] = er.frameDesign || []
    const plotBlueprint = er.plotBlueprint || {}

    if (!frameDesign.length) {
      noFrameDesign++
      continue
    }

    let changed = false

    // 桥接：从 frameDesign 填充 imagePrompt 到 videoSegments
    const mergedSegments = videoSegments.map((seg: any, i: number) => {
      const fd = frameDesign[i]
      if (!fd?.firstFrame?.imagePrompt) return seg
      if (seg.imagePrompt && seg.imagePrompt === fd.firstFrame.imagePrompt) return seg // 已有且一致
      
      changed = true
      return {
        ...seg,
        imagePrompt: fd.firstFrame.imagePrompt,
        firstFrame: fd.firstFrame,
        lastFrame: fd.lastFrame,
      }
    })

    // 如果 videoSegments 为空但 frameDesign 有数据，也用 frameDesign 构建
    let finalSegments = mergedSegments
    if (!finalSegments.length && frameDesign.length) {
      finalSegments = frameDesign.map((fd: any, i: number) => ({
        segmentId: fd.segmentId || `seg_${i}`,
        title: `段落 ${i + 1}`,
        imagePrompt: fd.firstFrame?.imagePrompt || '',
        firstFrame: fd.firstFrame,
        lastFrame: fd.lastFrame,
      }))
      changed = true
    }

    if (changed) {
      er.videoSegments = finalSegments
      // 同时也补 plotBlueprint.scenes[].script（如果能从 rawScript 推）
      if (!plotBlueprint.scenes?.some((s: any) => s.script?.length > 20) && er.rawScript) {
        console.log(`  📖 project ${proj.id}: 有 rawScript (${er.rawScript.length}字) 但 scenes[].script 为空，已标记（需重新拆解）`)
      }

      await prisma.project.update({
        where: { id: proj.id },
        data: { executionResults: er },
      })
      updated++
      console.log(`  ✅ project ${proj.id} (${proj.name || '?'}): ${videoSegments.length} segs → ${finalSegments.length} segs (${changed ? '填充 imagePrompt' : ''})`)
    } else {
      alreadyFine++
    }
  }

  console.log(`\n📊 统计:`)
  console.log(`  总计项目: ${projects.length}`)
  console.log(`  已更新: ${updated}`)
  console.log(`  已有数据无需更新: ${alreadyFine}`)
  console.log(`  无 frameDesign: ${noFrameDesign}`)
  console.log(`  跳过（不匹配）: ${skipNoMatch}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
