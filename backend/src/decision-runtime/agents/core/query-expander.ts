/**
 * query-expander.ts — Phase AG-2.2.1: Query Expansion + Utility Filter
 *
 * ═══════════════════════════════════════════════════════════════
 * 改造内容：
 *   1. 新增 Query Pruning Layer（信息增益过滤）
 *   2. local expansion 精简为 4 条（不跑泛化推荐）
 *   3. 禁止 high-redundancy variants（base 和 variant 重叠 > 70% 时丢弃）
 *
 * @phase decision-runtime / ag-2.2.1
 */

import { ExpansionPolicy } from './intent-router.js'

/**
 * 查询增益过滤
 * 如果 variant 相对于 base query 的信息增量太低 → 丢弃
 */
function shouldKeepQuery(base: string, variant: string): boolean {
  // 完全相同 → 丢弃
  if (base === variant) return false

  const baseChars = new Set(base)
  const variantChars = new Set(variant)

  // 计算字符重叠率
  let overlapCount = 0
  for (const ch of variantChars) {
    if (baseChars.has(ch)) overlapCount++
  }

  const overlap = variantChars.size > 0 ? overlapCount / variantChars.size : 0

  // 如果重叠率 ≥ 70%，说明信息增量太低
  if (overlap >= 0.7) return false

  return true
}

/**
 * 构建所有模板（内部函数，不导出）
 */
function buildAllTemplates(query: string, policy: ExpansionPolicy): string[] {
  const base = [
    query,
    `${query} 详细`,
    `${query} 评价`,
    `${query} 怎么样`,
    `${query} 推荐`,
  ]

  // local 类：精简为 4 条，只加地址/电话/联系方式
  // 不跑泛化推荐，防止无意义 variant
  const local = [
    `${query} 地址`,
    `${query} 电话`,
    `${query} 联系方式`,
  ]

  const enterprise = [
    `${query} 公司信息`,
    `${query} 可信度`,
    `${query} 背景`,
  ]

  const product = [
    `${query} 对比`,
    `${query} 优缺点`,
    `${query} 值不值得买`,
  ]

  let result: string[] = []
  if (policy.includeBase) result.push(...base)
  if (policy.includeLocal) result.push(...local)
  if (policy.includeEnterprise) result.push(...enterprise)
  if (policy.includeProduct) result.push(...product)

  return result
}

/**
 * Query Expansion 主入口
 *   policy = 意图表达（语义层）
 *   maxQueries = 系统预算（控制层）
 *   pruning = 信息增益过滤（防冗余）
 */
export function expandQuery(query: string, policy: ExpansionPolicy): string[] {
  // Step 1: 按 policy 组合模板
  const raw = buildAllTemplates(query, policy)

  // Step 2: 信息增益过滤（去冗余）
  const filtered = raw.filter(v => shouldKeepQuery(query, v))

  // Step 3: 去重 + 按预算裁剪
  return Array.from(new Set(filtered)).slice(0, policy.maxQueries)
}
