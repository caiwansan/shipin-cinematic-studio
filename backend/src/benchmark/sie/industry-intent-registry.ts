/**
 * SIE — Scenario Intelligence Engine
 * Industry Intent Registry — 行业 → 场景映射配置
 *
 * P2-T002-SIE-03: Industry Intent Registry
 *
 * 配置化维护，避免写死代码。
 * 每条记录：
 * - weight：该匹配的基线置信度（0-1）
 * - scenarios：关联的场景 ID 列表
 * - aliases：行业别称（如 "AI" → "ai", "artificial intelligence"）
 * - parentIndustry：父行业（预留，支持分层）
 *
 * 当前覆盖 5 个基础行业 + AI/SaaS/Finance/Healthcare/Manufacturing 等扩展。
 */

export interface IndustryEntry {
  /** 基线置信度 */
  weight: number;
  /** 关联场景列表 */
  scenarios: IndustryScenarioRef[];
  /** 别名（用于模糊匹配） */
  aliases?: string[];
  /** 父行业（预留） */
  parentIndustry?: string;
}

export interface IndustryScenarioRef {
  /** 场景 ID */
  id: string;
  /** 此场景的附加权重（最终置信度 = weight * scenarioWeight） */
  weight?: number;
  /** 匹配备注 */
  reason?: string;
}

/**
 * 行业意图配置
 */
export const industryIntentRegistry: Record<string, IndustryEntry> = {
  // ── AI / 人工智能 ──
  'AI': {
    weight: 0.65,
    aliases: ['artificial intelligence', 'ai', '人工智能', '智能'],
    scenarios: [
      { id: 'product-research', reason: 'AI 产品技术调研' },
      { id: 'brand-trust', weight: 0.4, reason: 'AI 品牌可信度' },
      { id: 'brand-positioning', reason: 'AI 厂商定位' },
      { id: 'shop-quality', weight: 0.35, reason: 'AI 服务质量' },
    ],
  },
  'SaaS': {
    weight: 0.6,
    aliases: ['saas', '软件即服务', '云服务'],
    scenarios: [
      { id: 'product-research', reason: 'SaaS 产品功能调研' },
      { id: 'brand-comparison', reason: 'SaaS 厂商对比' },
      { id: 'brand-trust', reason: 'SaaS 品牌信誉' },
      { id: 'product-purchase', reason: 'SaaS 选型' },
    ],
  },
  'Technology': {
    weight: 0.55,
    aliases: ['tech', 'technology', '科技', '技术'],
    scenarios: [
      { id: 'product-research', reason: '科技产品调研' },
      { id: 'brand-comparison', reason: '科技品牌对比' },
      { id: 'brand-positioning', reason: '科技企业定位' },
      { id: 'shop-quality', weight: 0.35, reason: '消费电子产品' },
    ],
  },

  // ── 品牌行业 ──
  'brand': {
    weight: 0.7,
    aliases: ['品牌', '品牌营销', 'branding'],
    scenarios: [
      { id: 'brand-discovery', reason: '品牌发现' },
      { id: 'brand-comparison', reason: '品牌对比' },
      { id: 'brand-trust', reason: '品牌可信度' },
      { id: 'brand-history', reason: '品牌历史' },
      { id: 'brand-positioning', reason: '品牌定位' },
    ],
  },
  'marketing': {
    weight: 0.55,
    aliases: ['marketing', '营销', '市场'],
    scenarios: [
      { id: 'brand-discovery', reason: '营销品牌发现' },
      { id: 'brand-positioning', reason: '市场定位' },
    ],
  },

  // ── 电商 ──
  'ecommerce': {
    weight: 0.7,
    aliases: ['电商', '电子商务', 'online shop', '网上商城', 'shopping'],
    scenarios: [
      { id: 'shop-trust', reason: '店铺可信度' },
      { id: 'shop-quality', reason: '商品质量' },
      { id: 'shop-service', reason: '售后服务' },
      { id: 'shop-reputation', reason: '店铺声誉' },
      { id: 'shop-recommendation', reason: '店铺推荐' },
    ],
  },

  // ── 产品 ──
  'product': {
    weight: 0.7,
    aliases: ['产品', '消费电子', '硬件', '消费品'],
    scenarios: [
      { id: 'product-research', reason: '产品调研' },
      { id: 'product-comparison', reason: '产品对比' },
      { id: 'product-purchase', reason: '购买决策' },
      { id: 'product-safety', reason: '产品安全' },
      { id: 'product-alternative', reason: '替代品' },
    ],
  },
  'manufacturing': {
    weight: 0.5,
    aliases: ['manufacturing', '制造', '工业'],
    scenarios: [
      { id: 'product-safety', reason: '制造安全' },
      { id: 'shop-quality', weight: 0.4, reason: '产品质量' },
    ],
  },

  // ── 酒店/旅游 ──
  'hotel': {
    weight: 0.7,
    aliases: ['hotel', '酒店', '旅游', '住宿', '旅行'],
    scenarios: [
      { id: 'hotel-booking', reason: '酒店预订' },
      { id: 'hotel-location', reason: '地理位置' },
      { id: 'hotel-experience', reason: '入住体验' },
      { id: 'hotel-value', reason: '性价比' },
      { id: 'hotel-suitability', reason: '适用人群' },
    ],
  },
  'travel': {
    weight: 0.55,
    aliases: ['travel', '旅行', '出行', 'tourism'],
    scenarios: [
      { id: 'hotel-suitability', reason: '出行住宿' },
      { id: 'hotel-location', reason: '出行位置' },
    ],
  },

  // ── 餐饮 ──
  'restaurant': {
    weight: 0.7,
    aliases: ['restaurant', '餐厅', '餐饮', '美食', 'food'],
    scenarios: [
      { id: 'restaurant-recommendation', reason: '餐厅推荐' },
      { id: 'restaurant-cuisine', reason: '菜系特色' },
      { id: 'restaurant-ambiance', reason: '餐厅环境' },
      { id: 'restaurant-value', reason: '价格价值' },
      { id: 'restaurant-suitable', reason: '适合场合' },
    ],
  },
  'food': {
    weight: 0.5,
    aliases: ['food', '食品', '餐饮', '饮食'],
    scenarios: [
      { id: 'restaurant-cuisine', reason: '食品特色' },
    ],
  },

  // ── 金融/教育/医疗 ──
  'Finance': {
    weight: 0.55,
    aliases: ['finance', '金融', 'fintech', '理财', '银行'],
    scenarios: [
      { id: 'brand-trust', reason: '金融品牌可信度' },
      { id: 'product-purchase', weight: 0.4, reason: '金融产品选择' },
      { id: 'product-comparison', weight: 0.4, reason: '金融产品对比' },
    ],
  },
  'Education': {
    weight: 0.55,
    aliases: ['education', '教育', 'edtech', '在线教育'],
    scenarios: [
      { id: 'product-research', reason: '教育产品调研' },
      { id: 'brand-trust', reason: '教育品牌可信度' },
      { id: 'product-purchase', weight: 0.4, reason: '课程选择' },
    ],
  },
  'Healthcare': {
    weight: 0.5,
    aliases: ['healthcare', '医疗', '健康', 'health'],
    scenarios: [
      { id: 'product-safety', reason: '医疗安全' },
      { id: 'brand-trust', reason: '医疗品牌可信度' },
    ],
  },

  // ── 房地产/汽车 ──
  'RealEstate': {
    weight: 0.5,
    aliases: ['real estate', '房地产', '地产', '房产'],
    scenarios: [
      { id: 'product-research', reason: '房产调研' },
      { id: 'hotel-location', weight: 0.3, reason: '位置评估' },
    ],
  },
  'Automotive': {
    weight: 0.55,
    aliases: ['automotive', '汽车', '车辆', 'auto'],
    scenarios: [
      { id: 'product-comparison', reason: '汽车对比' },
      { id: 'product-safety', reason: '汽车安全' },
      { id: 'product-purchase', weight: 0.4, reason: '购车决策' },
    ],
  },
};

/**
 * 根据行业 ID 获取配置
 */
export function getIndustryEntry(industryId: string): IndustryEntry | undefined {
  const normalized = industryId.trim().toLowerCase();

  // 精确匹配
  if (industryIntentRegistry[normalized]) return industryIntentRegistry[normalized];

  // 别名匹配
  for (const [, entry] of Object.entries(industryIntentRegistry)) {
    if (entry.aliases?.some((a) => a.toLowerCase() === normalized)) {
      return entry;
    }
  }

  return undefined;
}

/**
 * 获取所有已配置的行业 ID
 */
export function getAllIndustryIds(): string[] {
  return Object.keys(industryIntentRegistry);
}
