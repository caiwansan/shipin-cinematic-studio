/**
 * scripts/aes-v3/graph-baseline.ts — 依赖图基准线
 *
 * 用 madge 生成完整 import 图后做拓扑哈希。
 * 用途：检测依赖图的非预期变化（新引入的循环依赖、意外跨层引用）。
 *
 * 注意：与 AST baseline 不相等，且不需要相等。
 * 这是两个独立维度的结构基线。
 */

import madge from 'madge'
import path from 'path'
import { sha256, normalize } from './hash-utils.js'

const SRC_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../../src')

export async function computeGraphBaseline(): Promise<{ hash: string; nodeCount: number }> {
  const graph = await madge(SRC_DIR, {
    includeNpm: false,
    fileExtensions: ['ts'],
    tsConfig: path.resolve(SRC_DIR, '../tsconfig.json'),
  })

  const deps = graph.obj()

  // 仅保留三层架构目录的节点
  const filtered: Record<string, string[]> = {}
  for (const [file, imports] of Object.entries(deps)) {
    const n = file.replace(/\\/g, '/')
    // 包含三层目录即可
    if (!n.includes('workflow') && !n.includes('observation') && !n.includes('execution')) continue
    filtered[file] = imports.sort()
  }

  const hash = sha256(normalize(filtered))
  const nodeCount = Object.keys(filtered).length

  return { hash, nodeCount }
}
