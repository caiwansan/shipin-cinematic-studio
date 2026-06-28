// 一次性迁移：为已有三视图的角色补录 face_ref 记录
// 运行: cd /root/shipin-cinematic-studio/backend && npx ts-node -e 'require("./scripts/backfill-face-ref.ts")'

import { PrismaClient } from '@prisma/client'
import * as fs from 'node:fs'
import * as path from 'node:path'

const prisma = new PrismaClient()
const CHAR_DIR = '/root/shipin-cinematic-studio/backend/public/uploads/characters'

async function main() {
  // 获取所有已有的 triple 图角色记录（去重取最新的）
  const triples = await prisma.characterImage.findMany({
    where: { imageUrl: { startsWith: '/uploads/characters/triple_' } },
    orderBy: { createdAt: 'desc' },
  })

  const seen = new Set<string>()
  const faceFiles = fs.readdirSync(CHAR_DIR).filter(f => f.startsWith('face_') && f.endsWith('.png'))

  let inserted = 0
  let missed = 0

  for (const t of triples) {
    const key = `${t.projectId}|${t.characterName}`
    if (seen.has(key)) continue
    seen.add(key)

    // 检查是否已有 face_ref
    const existing = await prisma.characterImage.findFirst({
      where: { projectId: t.projectId, characterName: t.characterName, variant: 'face_ref' },
    })
    if (existing) {
      console.log(`⏭️  ${t.characterName}: 已有 face_ref`)
      continue
    }

    // 角色名中的全角/半角括号统一后再匹配
    const normalizedName = t.characterName
      .replace(/（/g, '(').replace(/）/g, ')')
    // 可能的文件名格式：face_{name}_{uuid}.png
    // 但 triple 服务生成的 safe_name 用 _ 替代了特殊字符
    let matched = ''
    for (const ff of faceFiles) {
      // face_{safeName}_{uuid}.png
      // safeName 中的中文括号被替换为 ()
      const fname = ff.slice(5, -4)  // 去掉 face_ 和 .png
      // uuid 是最后一个下划线后的部分
      const lastUnderscore = fname.lastIndexOf('_')
      if (lastUnderscore < 0) continue
      const fSafeName = fname.slice(0, lastUnderscore)
      
      if (fSafeName === normalizedName) {
        matched = ff
        break
      }
    }

    if (!matched) {
      // 尝试用模糊匹配：normalizedName 包含 fSafeName 或 fSafeName 包含 normalizedName
      for (const ff of faceFiles) {
        const fname = ff.slice(5, -4)
        const lastUnderscore = fname.lastIndexOf('_')
        if (lastUnderscore < 0) continue
        const fSafeName = fname.slice(0, lastUnderscore)
        if (normalizedName.includes(fSafeName) || fSafeName.includes(normalizedName)) {
          // 用最匹配的那个
          if (!matched || fSafeName.length > matched.slice(5, -4).split('_').slice(0, -1).join('_').length) {
            matched = ff
          }
        }
      }
    }

    if (!matched) {
      console.log(`⚠️  ${t.characterName}: 未找到 face_ 文件`)
      missed++
      continue
    }

    const faceUrl = `/uploads/characters/${matched}`

    await prisma.characterImage.create({
      data: {
        projectId: t.projectId,
        characterName: t.characterName,
        variant: 'face_ref',
        imageUrl: faceUrl,
        sortOrder: 1,
      },
    })

    console.log(`✅ ${t.characterName}: ${matched}`)
    inserted++
  }

  console.log(`\n完成: 新增 ${inserted} 条, 缺失 ${missed} 条`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
