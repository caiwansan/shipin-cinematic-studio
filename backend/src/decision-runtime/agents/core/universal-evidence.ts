/**
 * UniversalEvidence — Phase AG-2.1 极简证据标准
 *
 * 所有 search source 的输出必须统一为此格式。
 * 铁律：
 *   1. 禁止在此结构上增加字段
 *   2. 禁止 enrichment / transformation
 *   3. scorer 只能读取 title 和 snippet
 *
 * @phase decision-runtime / ag-2.1
 */

export interface UniversalEvidence {
  sourceType: 'web' | 'poi' | 'enterprise' | 'vertical'
  title: string
  snippet: string
  url?: string
}
