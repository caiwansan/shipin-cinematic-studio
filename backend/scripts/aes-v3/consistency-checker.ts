/**
 * scripts/aes-v3/consistency-checker.ts — 跨层一致性验证（修正版）
 *
 * v3 的正确语义不是"AST == Graph == Runtime"（这在数学上就不成立），
 * 而是：
 *
 *   1. AST baseline: 三层 import 结构未意外变化
 *   2. Graph baseline: 依赖图拓扑未意外变化
 *   3. 层边界规则：v2 已保证（AES 不重复做）
 *   4. 报告：输出两个基线用于人工评审
 *
 * 这个 checker 只做基线计算和偏离检测。
 * 基准线存储在 .aes-baseline.json 中。
 */

import fs from 'fs'
import path from 'path'
import { computeASTBaseline } from './ast-baseline.js'
import { computeGraphBaseline } from './graph-baseline.js'

const BASELINE_FILE = path.resolve(new URL('.', import.meta.url).pathname, '../../.aes-baseline.json')

interface BaselineData {
  ast: { hash: string; fileCount: number }
  graph: { hash: string; nodeCount: number }
  timestamp: string
}

export async function checkConsistency(): Promise<boolean> {
  const ast = computeASTBaseline()
  const graph = await computeGraphBaseline()

  // 读取已有 baseline
  let existing: BaselineData | null = null
  try {
    existing = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'))
  } catch {
    // 首次运行，写入 baseline
    const baseline: BaselineData = { ast, graph, timestamp: new Date().toISOString() }
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2))
    console.log('[AES-v3] ✅ 首次架构基线已建立')
    console.log(`  AST: ${ast.hash} (${ast.fileCount} files)`)
    console.log(`  Graph: ${graph.hash} (${graph.nodeCount} nodes)`)
    return true
  }

  // 与 baseline 对比
  const astChanged = existing.ast.hash !== ast.hash
  const graphChanged = existing.graph.hash !== graph.hash

  if (astChanged || graphChanged) {
    console.warn('\n⚠️  [AES-v3] 架构基线已发生偏离:')
    if (astChanged) {
      console.warn(`  AST: ${existing.ast.hash} → ${ast.hash}`)
      console.warn(`       ${existing.ast.fileCount} files → ${ast.fileCount} files`)
    }
    if (graphChanged) {
      console.warn(`  Graph: ${existing.graph.hash} → ${graph.hash}`)
      console.warn(`        ${existing.graph.nodeCount} nodes → ${graph.nodeCount} nodes`)
    }
    console.warn('  如需确认变更意图，运行: npm run aes:baseline-update')
    return false
  }

  console.log('[AES-v3] ✅ 架构基线一致')
  console.log(`  AST: ${ast.hash} (${ast.fileCount} files)`)
  console.log(`  Graph: ${graph.hash} (${graph.nodeCount} nodes)`)
  return true
}
