/**
 * scripts/aes-v2/index.ts — AES v2 统一入口
 *
 * 执行顺序：
 *   1. AST Dependency Analyzer（ts-morph）
 *   2. Dependency Graph Analyzer（madge）
 *   3. tsc compile (标准)
 *
 * 调用方式：npx tsx scripts/aes-v2/index.ts
 */

import { execSync } from 'child_process'
import path from 'path'

const SCRIPTS_DIR = new URL('.', import.meta.url).pathname

function run(name: string, cmd: string): boolean {
  console.log(`\n[${name}] 检查中...`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(SCRIPTS_DIR, '..') })
    console.log(`[${name}] ✅ 通过`)
    return true
  } catch {
    console.error(`[${name}] ❌ 失败`)
    return false
  }
}

console.log('═══════════════════════════════════════')
console.log('  OpenClaw Architecture Enforcement v2')
console.log('═══════════════════════════════════════')

const results = [
  run('AST Layer', `npx tsx ${SCRIPTS_DIR}/analyze-ast.ts`),
  run('Dependency Graph', `npx tsx ${SCRIPTS_DIR}/analyze-graph.ts`),
]

const allPass = results.every(Boolean)
console.log(`\n${allPass ? '✅' : '❌'} AES v2: ${results.filter(Boolean).length}/${results.length} 通过`)

process.exit(allPass ? 0 : 1)
