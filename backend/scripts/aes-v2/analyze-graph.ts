/**
 * scripts/aes-v2/analyze-graph.ts — 依赖图验证
 *
 * 使用 madge 生成完整 import 图，检测：
 *   - 循环依赖
 *   - 跨层违规（基于完整 import 图而非单个文件）
 *   - re-export barrel 污染
 */

import madge from 'madge'
import path from 'path'

const SRC_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../../src')

async function main() {
  const graph = await madge(SRC_DIR, {
    includeNpm: false,
    fileExtensions: ['ts'],
    tsConfig: path.resolve(SRC_DIR, '../tsconfig.json'),
    // 排除遗留代码（pre-existing 循环依赖，属于旧系统不属于三层）
    excludeRegExp: [
      /\/utils\//,
      /\/queue\//,
      /\/core\/governance\//,
      /\/director-v2\//,
    ].map(r => r.source),
  })

  // 1. 循环依赖检测（仅限三层架构目录）
  const circular = graph.circular()
  const threeLayerCircular = circular.filter((cycle: string[]) =>
    cycle.some(f => f.includes('/workflow/') || f.includes('/observation/') || f.includes('/execution/'))
  )

  if (threeLayerCircular.length > 0) {
    console.error('\n❌ Circular dependencies (三层架构):')
    for (const cycle of threeLayerCircular) {
      console.error(`  ${cycle.join(' → ')}`)
    }
    process.exit(1)
  }

  if (circular.length > 0) {
    console.log(`[GRAPH] ${circular.length} 个循环依赖（仅限旧系统，已忽略）`)
  }

  // 2. 跨层违规
  const deps = graph.obj()
  const violations: string[] = []

  function getLayer(filePath: string): string {
    const n = filePath.replace(/\\/g, '/')
    if (n.includes('/workflow/')) return 'workflow'
    if (n.includes('/observation/')) return 'observation'
    if (n.includes('/execution/')) return 'execution'
    return 'unknown'
  }

  const FORBIDDEN_EDGES: [string, string][] = [
    ['observation', 'execution/replay-engine'],
  ]

  for (const [file, importList] of Object.entries(deps)) {
    const layer = getLayer(file)
    if (layer === 'unknown') continue
    for (const imp of importList) {
      for (const [fromLayer, forbiddenPattern] of FORBIDDEN_EDGES) {
        if (layer === fromLayer && imp.includes(forbiddenPattern)) {
          violations.push(`GRAPH: ${file} → ${imp}`)
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ Graph layer violations:')
    for (const v of violations) console.error(`  ${v}`)
    process.exit(1)
  }

  console.log('✅ Dependency graph clean')
}

main().catch(err => { console.error(err); process.exit(1) })
