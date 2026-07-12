// ============================================================
// Discovery Golden Dataset — 固定测试样本合集
//
// 每个样本定义：
//   - entityName / entityId（输入）
//   - expectedSignalTypes（期望产生的 Signal 类型集合）
//   - confidenceRange（置信度合理范围）
//   - minEvidenceCount（最少证据数）
//   - validation（自定义校验规则）
//
// 注意：不固定 LLM 输出的文案，只固定结构和语义约束。
// ============================================================

export interface GoldenSample {
  name: string
  entityName: string
  entityId: string
  category: 'global-brand' | 'china-brand' | 'sme' | 'new-brand' | 'non-existent' | 'ambiguous' | 'chinese' | 'english'
  expectedSignalTypes: string[]   // 期望产生的 signal type 列表
  minConfidence: number           // 最低置信度（0~1）
  maxConfidence: number           // 最高置信度（0~1）
  minEvidenceCount: number        // 最少证据数（所有 signal 合计）
  additionalRules?: string[]      // 额外校验规则描述
}

export const GOLDEN_DATASET: GoldenSample[] = [
  // ── 全球知名品牌 ──
  {
    name: 'OpenAI',
    entityName: 'OpenAI',
    entityId: 'golden-openai',
    category: 'global-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.5,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
    additionalRules: ['presence.sources 不应为空', 'knowledge.evidence 应包含至少一条'],
  },
  {
    name: 'Microsoft',
    entityName: 'Microsoft',
    entityId: 'golden-microsoft',
    category: 'global-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.7,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },
  {
    name: 'Nike',
    entityName: 'Nike',
    entityId: 'golden-nike',
    category: 'global-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.5,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },
  {
    name: 'Apple',
    entityName: 'Apple',
    entityId: 'golden-apple',
    category: 'global-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.7,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },
  {
    name: 'Tesla',
    entityName: 'Tesla',
    entityId: 'golden-tesla',
    category: 'global-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.5,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },

  // ── 中国知名品牌 ──
  {
    name: '华为',
    entityName: '华为',
    entityId: 'golden-huawei',
    category: 'china-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.5,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },
  {
    name: '字节跳动',
    entityName: '字节跳动',
    entityId: 'golden-bytedance',
    category: 'china-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.5,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },
  {
    name: '腾讯',
    entityName: '腾讯',
    entityId: 'golden-tencent',
    category: 'china-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.5,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },
  {
    name: '阿里巴巴',
    entityName: '阿里巴巴',
    entityId: 'golden-alibaba',
    category: 'china-brand',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.5,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },

  // ── 中小企业 ──
  {
    name: '本地小餐饮',
    entityName: '老王炒饭',
    entityId: 'golden-wang-rice',
    category: 'sme',
    expectedSignalTypes: ['presence'],
    minConfidence: 0.0,
    maxConfidence: 0.8,
    minEvidenceCount: 0,
  },

  // ── 新创建品牌（预期低置信度） ──
  {
    name: '新创品牌',
    entityName: '星辰科技',
    entityId: 'golden-star-tech',
    category: 'new-brand',
    expectedSignalTypes: ['presence'],
    minConfidence: 0.0,
    maxConfidence: 0.6,
    minEvidenceCount: 0,
  },

  // ── 不存在的品牌（预期缺失） ──
  {
    name: '不存在品牌',
    entityName: 'XYZNotExistBrand2026',
    entityId: 'golden-not-exist',
    category: 'non-existent',
    expectedSignalTypes: ['presence'],
    minConfidence: 0.0,
    maxConfidence: 0.3,
    minEvidenceCount: 0,
  },

  // ── 多义实体 ──
  {
    name: '多义名称',
    entityName: '小米',
    entityId: 'golden-xiaomi',
    category: 'ambiguous',
    expectedSignalTypes: ['presence', 'knowledge'],
    minConfidence: 0.3,
    maxConfidence: 1.0,
    minEvidenceCount: 1,
  },

  // ── 中文实体 ──
  {
    name: '中文品牌',
    entityName: '昆仑镜短剧工作台',
    entityId: 'golden-kunlun',
    category: 'chinese',
    expectedSignalTypes: ['presence'],
    minConfidence: 0.0,
    maxConfidence: 1.0,
    minEvidenceCount: 0,
  },

  // ── 英文实体 ──
  {
    name: '英文品牌',
    entityName: 'FushuTong Tech',
    entityId: 'golden-fushtong',
    category: 'english',
    expectedSignalTypes: ['presence'],
    minConfidence: 0.0,
    maxConfidence: 1.0,
    minEvidenceCount: 0,
  },
]
