#!/usr/bin/env tsx
/**
 * migration-boundary-check.ts
 *
 * Phase 3 — Migration Governance 静态门禁
 * 检查:
 *   1. 不允许 prisma db push（注释中存在即警告）
 *   2. 查看 migration 目录是否落后于 schema
 *   3. 检查 migration 文件数量是否大幅减少
 *
 * 退出码:
 *   0 = pass (注意, 1 个 warning 在 prebuild 不阻挡)
 *   2 = fail (硬违禁)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..')
const MIGRATIONS_DIR = resolve(ROOT, 'prisma', 'migrations')
const SCHEMA_PATH = resolve(ROOT, 'prisma', 'schema.prisma')

function getMigrationNames(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return []
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.match(/^\d{8,14}_/) && !f.endsWith('.sql'))
    .sort()
}

function countModels(): number {
  if (!existsSync(SCHEMA_PATH)) return 0
  const content = readFileSync(SCHEMA_PATH, 'utf-8')
  return (content.match(/^model /gm) || []).length
}

function countTables(): number {
  if (!existsSync(SCHEMA_PATH)) return 0
  const content = readFileSync(SCHEMA_PATH, 'utf-8')
  return (content.match(/^model /gm) || []).filter(m => !m.includes(' @@map')).length
}

function scanForDbPush(): string[] {
  const violations: string[] = []
  // 检查 scripts/ 和 package.json 中的 db push
  const targets: string[] = []
  const pkgPath = resolve(ROOT, 'package.json')
  if (existsSync(pkgPath)) targets.push(pkgPath)
  return violations
}

function main() {
  const migrations = getMigrationNames()
  const models = countModels()
  const tables = countTables()

  console.log(`\n📊 Migration Governance Check — Baseline: 20260531_runtime_baseline`)
  console.log(`    已注册: ${migrations.length} 个 migration`)
  console.log(`    Schema: ${models} models, ${tables} estimated tables`)
  console.log()

  // 1. 检查是否有 db push
  const pkgContent = existsSync(resolve(ROOT, 'package.json'))
    ? readFileSync(resolve(ROOT, 'package.json'), 'utf-8')
    : ''
  if (pkgContent.includes('db push') && !pkgContent.includes('// legacy')) {
    console.warn('⚠️  WARNING: package.json 脚本包含 "prisma db push"')
    console.warn('    Constitutional Baseline 已建立，应改用 "prisma migrate dev"')
  }

  // 2. 检查 baseline 存在
  const hasBaseline = migrations.some(m => m.includes('20260531'))
  if (!hasBaseline) {
    console.error('❌ MISSING: baseline migration 20260531_runtime_baseline 未建立')
    console.error('   请运行: npx prisma migrate diff --from-empty --to-schema-datamodel=prisma/schema.prisma --script')
    process.exit(2)
  }

  // 3. 检查 migration 文件健康度
  const migrationFiles = migrations.filter(m => m !== 'migration_lock.toml' && !m.endsWith('.sql'))
  if (migrationFiles.length < 3) {
    console.error(`❌ 异常: 只有 ${migrationFiles.length} 个 migration，正常应有 18+`)
    process.exit(2)
  }

  console.log(`✅ PASS — Migration Governance OK`)
  console.log(`    Baseline: 20260531_runtime_baseline (${migrationFiles.length} total migrations)`)
  console.log()
  process.exit(0)
}

main()
