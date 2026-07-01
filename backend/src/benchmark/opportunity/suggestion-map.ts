/**
 * Suggestion Map — 25 场景优化建议映射
 *
 * P0-T006 — Opportunity Engine (First Edition)
 *
 * 根据场景 ID 返回对应的优化建议。全部 25 个场景覆盖。
 */

/**
 * 25 场景优化建议映射
 */
const SUGGESTION_MAP: Record<string, string> = {
  // ── Brand (5) ──
  'brand-discovery': '补充品牌基本信息，包括创立时间、核心产品、市场定位',
  'brand-comparison': '整理与主要竞品的差异化信息，明确自身优势',
  'brand-trust': '提供资质认证、媒体报道、第三方评价等信任背书',
  'brand-history': '完善品牌发展里程碑、关键成就与文化故事',
  'brand-positioning': '明确品牌的市场定位、目标人群与核心价值主张',

  // ── Product (5) ──
  'product-research': '丰富产品规格、功能亮点与使用场景说明',
  'product-comparison': '制作同类产品客观对比表，突出差异化优势',
  'product-purchase': '提供价格区间、优惠渠道与售后服务说明',
  'product-safety': '展示安全认证、检测报告与合规资质',
  'product-alternative': '整理替代产品清单，帮助用户全面比较选择',

  // ── Hotel/Travel (5) ──
  'hotel-booking': '完善酒店设施、周边交通、房型等基础信息',
  'hotel-location': '详细描述酒店地理位置优势与周边景点距离',
  'hotel-experience': '收集并展示真实住客评价与入住体验分享',
  'hotel-value': '突出性价比分析，对比同档次酒店的差异化服务',
  'hotel-suitability': '说明适合的出行人群类型（商务、亲子、情侣等）',

  // ── E-commerce (5) ──
  'shop-trust': '提供资质证书、用户评价、售后保障等信任信息',
  'shop-quality': '展示商品质检报告、材质细节与实拍图片',
  'shop-service': '完善退换货政策、客服响应时间和物流说明',
  'shop-reputation': '整理店铺评分、好评率与纠纷处理记录',
  'shop-recommendation': '建立商品推荐体系，帮助用户发现合适商品',

  // ── Restaurant (5) ──
  'restaurant-recommendation': '完善推荐菜、招牌菜与必点清单信息',
  'restaurant-cuisine': '详细描述菜系特色、食材来源与烹饪工艺',
  'restaurant-ambiance': '描述餐厅环境风格、座位布局与氛围特点',
  'restaurant-value': '展示人均消费区间、套餐组合与性价比分析',
  'restaurant-suitable': '丰富不同场合的用餐场景描述',
};

/**
 * 获取指定场景的优化建议
 */
export function getSuggestion(scenarioId: string): string {
  return SUGGESTION_MAP[scenarioId] ?? '优化该场景的内容覆盖与信息完整度，提升实体在此场景的曝光表现';
}

/**
 * 获取所有场景 ID
 */
export function getAllScenarioIds(): string[] {
  return Object.keys(SUGGESTION_MAP);
}
