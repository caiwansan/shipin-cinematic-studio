/**
 * evidence-cluster.ts — Phase AG-2.3: Evidence Clustering Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * 将 flat UniversalEvidence[] 收敛为 3~6 个语义簇
 *
 * 设计原则：
 *   1. 不上 ML / embedding / reranker
 *   2. 不上 graph edges
 *   3. 不涉及 scoring 重构
 *   4. 只做：flat list → grouped clusters
 *
 * 效果：
 *   从 "17~24 条独立证据"
 *   到 "3~6 个语义块"
 *
 * @phase decision-runtime / ag-2.3
 */

import { UniversalEvidence } from './universal-evidence.js'

// ============================================================
// Evidence Cluster 模型
// ============================================================

export interface EvidenceCluster {
  clusterId: string
  intent: string
  centroid: string     // 代表性标题
  evidenceCount: number
  evidences: UniversalEvidence[]
  confidence: number   // 占比 = 本簇条数 / 总条数
}

// ============================================================
// 簇键映射（轻量规则分类）
// ============================================================

type ClusterKey =
  | 'local_info'        // 地址/电话/位置
  | 'enterprise_info'   // 公司/企业信息
  | 'product_opinion'   // 推荐/对比/评价
  | 'general_reference' // 通用参考
  | 'other'             // 无法分类

function getClusterKey(ev: UniversalEvidence): ClusterKey {
  const text = `${ev.title} ${ev.snippet}`.toLowerCase()

  if (/(地址|电话|营业时间|在哪|怎么去|地铁|公交|位置|门店|路线)/.test(text)) {
    return 'local_info'
  }
  if (/(公司|企业|法人|注册|资质|工商|税务|背景|靠谱|信用)/.test(text)) {
    return 'enterprise_info'
  }
  if (/(推荐|对比|哪个好|值得|优缺点|评测|测评|评价|性价比|好用)/.test(text)) {
    return 'product_opinion'
  }
  if (/(介绍|详细|说明|是什么|定义|功能|原理|作用|分类|种类)/.test(text)) {
    return 'general_reference'
  }
  return 'other'
}

// ============================================================
// 簇意图推断
// ============================================================

const clusterIntentMap: Record<ClusterKey, string> = {
  local_info: 'local',
  enterprise_info: 'enterprise',
  product_opinion: 'product',
  general_reference: 'general',
  other: 'general',
}

// ============================================================
// 聚类入口
// ============================================================

export function clusterEvidence(evidences: UniversalEvidence[]): EvidenceCluster[] {
  // Step 1: 按聚类键分组
  const groups = new Map<ClusterKey, UniversalEvidence[]>()
  for (const ev of evidences) {
    const key = getClusterKey(ev)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(ev)
  }

  // Step 2: 转成 EvidenceCluster[]
  const total = evidences.length || 1
  const clusters: EvidenceCluster[] = []

  for (const [clusterId, list] of groups.entries()) {
    clusters.push({
      clusterId,
      intent: clusterIntentMap[clusterId],
      centroid: list[0]?.title || clusterId,
      evidenceCount: list.length,
      evidences: list,
      confidence: Math.round((list.length / total) * 100) / 100,
    })
  }

  // Step 3: 按 confidence 降序排列
  clusters.sort((a, b) => b.confidence - a.confidence)

  return clusters
}
