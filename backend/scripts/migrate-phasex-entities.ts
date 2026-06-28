/**
 * scripts/migrate-phasex-entities.ts
 *
 * 将已有 HdzCharacter → EntityRegistry + WorldState 迁移
 * 用于 Phase X 回放前的一键初始化
 */
import { prisma } from '../src/utils/index.js'
import {
  migrateAllCharacters,
} from '../src/services/hdz/entity-registry.service.js'
import {
  migrateCharactersToWorldState,
} from '../src/services/hdz/world-state.service.js'

async function main() {
  const projectId = process.argv[2]
  if (!projectId) {
    console.error('用法: npx tsx scripts/migrate-phasex-entities.ts <projectId>')
    process.exit(1)
  }

  console.log(`[迁移] 开始项目 ${projectId}`)

  // 1. 检查已有角色
  const chars = await prisma.hdzCharacter.findMany({ where: { projectId } })
  console.log(`  角色数量: ${chars.length}`)

  // 2. 注册到 EntityRegistry
  const regCount = await migrateAllCharacters(projectId)
  console.log(`  已注册到 EntityRegistry: ${regCount}`)

  // 3. 初始化 WorldState
  const wsCount = await migrateCharactersToWorldState(projectId)
  console.log(`  已初始化 WorldState: ${wsCount}`)

  // 4. 验证
  const entities = await prisma.entityRegistry.findMany({ where: { projectId } })
  console.log(`\n[迁移完成] EntityRegistry: ${entities.length} 条记录`)
  console.log(`Sample:`, JSON.stringify(entities.slice(0, 3).map(e => ({ id: e.id.slice(0, 8), name: e.name, type: e.entityType }))))
}

main().catch(err => {
  console.error('[迁移] 失败:', err)
  process.exit(1)
})
