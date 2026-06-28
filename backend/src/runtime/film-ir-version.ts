/**
 * FilmLanguageIR 版本迁移机制
 * =========================
 * 确保旧项目的 IR 数据可以在 IR Schema 升级时平滑迁移。
 *
 * 原则：
 * - 每个版本对应一个 migrate() 函数
 * - migrate() 接受旧版本 IR，返回新版本 IR
 * - pipeline 在消费 IR 之前，先走 migration chain
 */

import type { FilmLanguageIR } from './film-language-ir.js'

/** 已注册的迁移函数 */
const migrations: Record<string, (ir: any) => any> = {}

/** 注册迁移 */
export function registerMigration(fromVersion: string, toVersion: string, fn: (ir: any) => any): void {
  const key = `${fromVersion}→${toVersion}`
  if (migrations[key]) throw new Error(`Migration ${key} already registered`)
  migrations[key] = fn
}

/** 将旧版本 IR 升级到目标版本 */
export function migrateIR(ir: any, targetVersion: string = '0.1.0'): FilmLanguageIR {
  const currentVersion = ir.metadata?.version || '0.0.0'

  if (currentVersion === targetVersion) {
    return ir as FilmLanguageIR
  }

  // 按照 semver 顺序升级
  // 当前只有 v0.1.0，未来扩展这里
  // 例如 0.1 → 0.2 → 0.3 → 1.0

  let migrated = ir
  const chain = buildMigrationChain(currentVersion, targetVersion)
  for (const step of chain) {
    const key = `${step.from}→${step.to}`
    if (migrations[key]) {
      migrated = migrations[key](migrated)
    } else {
      // 无迁移函数时，直接升级版本号（兼容性降级）
      migrated = {
        ...migrated,
        metadata: { ...migrated.metadata, version: step.to },
      }
    }
  }
  return migrated as FilmLanguageIR
}

/** 构建迁移链 */
function buildMigrationChain(from: string, to: string): Array<{ from: string; to: string }> {
  const chain: Array<{ from: string; to: string }> = []
  const fromParts = from.split('.').map(Number)
  const toParts = to.split('.').map(Number)

  let current = [...fromParts]
  while (compareVersions(current, toParts) < 0) {
    const next = [...current]
    // 优先升 patch
    next[2]++
    if (next[2] > 99) { next[2] = 0; next[1]++ }
    if (next[1] > 99) { next[1] = 0; next[0]++ }
    chain.push({
      from: current.join('.'),
      to: next.join('.'),
    })
    current = next
  }

  return chain
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

// ─── v0.1.0 迁移函数 ───
export function registerDefaultMigrations(): void {
  // 暂无迁移：v0.1.0 是第一个版本
  // 后续如有 v0.2.0：
  // registerMigration('0.1.0', '0.2.0', (ir) => ({ ...ir, ...newField }))
}
