/**
 * domain-classifier.ts — Domain Classifier & Registry
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.1: Business Intelligence Constrained Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件是业务智能层的领域分类与注册中心。
 *
 * 核心原则：
 *   1. 所有领域必须在此枚举，禁止动态创建领域
 *   2. 每个领域只能使用预定义的 evaluation axes，禁止动态生成
 *   3. LLM 不再参与领域分类（deterministic 规则完成）
 *
 * 与 A-1.5 DecisionDomain 的关系：
 *   - A-1.5 DecisionDomain = 认知分解层（Problem → Frame）
 *   - A-3.1 DomainType     = 业务语义层（Frame → 业务映射）
 *   - 值一一对应但互不引用，避免层级耦合
 *
 * @phase decision-runtime
 */

// ============================================================
// 1. 领域类型（固定集合）
// ============================================================

export enum DomainType {
  REAL_ESTATE = 'real_estate',
  LEGAL = 'legal',
  MEDICAL = 'medical',
  EDUCATION = 'education',
  TRAVEL = 'travel',
  FINANCE = 'finance',
  COMMERCE = 'commerce',
  SERVICES = 'services',
  AGRICULTURE = 'agriculture',
  GENERAL = 'general',
}

// ============================================================
// 2. 领域描述符
// ============================================================

export interface DomainDescriptor {
  type: DomainType
  label: string
  description: string
  /** 该领域的核心评估轴（固定，禁止动态生成） */
  axes: DomainAxis[]
  /** 该领域特有的业务标签 */
  tags: string[]
}

export interface DomainAxis {
  name: string
  label: string
  description: string
  /** 默认权重 (0-1) */
  defaultWeight: number
  /** 数据来源类型 */
  dataSource: 'search' | 'evidence' | 'computed'
}

// ============================================================
// 3. 领域注册表（所有领域在此注册）
// ============================================================

const DOMAIN_REGISTRY: Record<DomainType, DomainDescriptor> = {
  // ── 房产 ──
  [DomainType.REAL_ESTATE]: {
    type: DomainType.REAL_ESTATE,
    label: '房产',
    description: '房产购买/租赁/投资决策',
    tags: ['不动产', '居住', '投资'],
    axes: [
      { name: 'credibility', label: '可信度', description: '开发商/中介资质与信誉', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '品牌口碑与市场声誉', defaultWeight: 0.10, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '一站式服务体验与售后保障', defaultWeight: 0.10, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '烂尾/产权纠纷/政策风险（越高越安全）', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '价格与价值匹配度', defaultWeight: 0.15, dataSource: 'computed' },
      { name: 'location', label: '地理位置', description: '交通/商圈/学区/周边配套', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'appreciation_potential', label: '升值潜力', description: '区域发展前景与规划', defaultWeight: 0.15, dataSource: 'search' },
    ],
  },

  // ── 法律 ──
  [DomainType.LEGAL]: {
    type: DomainType.LEGAL,
    label: '法律服务',
    description: '找律师/律师事务所决策',
    tags: ['法律', '诉讼', '咨询'],
    axes: [
      { name: 'credibility', label: '可信度', description: '律所资质与执业许可', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '业界信誉与客户口碑', defaultWeight: 0.10, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '响应速度与沟通效率', defaultWeight: 0.10, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '职业违规/代理风险（越高越安全）', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '收费合理性与服务价值的匹配', defaultWeight: 0.10, dataSource: 'computed' },
      { name: 'expertise', label: '专业能力', description: '特定领域经验与专业深度', defaultWeight: 0.20, dataSource: 'evidence' },
      { name: 'success_rate', label: '胜诉率', description: '类似案件的胜诉或解决成功率', defaultWeight: 0.15, dataSource: 'search' },
    ],
  },

  // ── 医疗 ──
  [DomainType.MEDICAL]: {
    type: DomainType.MEDICAL,
    label: '医疗服务',
    description: '找医院/医生/诊所决策',
    tags: ['医疗', '健康', '诊疗'],
    axes: [
      { name: 'credibility', label: '可信度', description: '医疗机构资质与执业许可', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '患者口碑与公众信任度', defaultWeight: 0.10, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '就医体验与服务流程', defaultWeight: 0.10, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '医疗事故/纠纷记录（越高越安全）', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '医疗费用与疗效匹配度', defaultWeight: 0.10, dataSource: 'computed' },
      { name: 'expertise', label: '专业能力', description: '医生资质/学术水平/临床经验', defaultWeight: 0.20, dataSource: 'evidence' },
      { name: 'equipment', label: '设备水平', description: '医疗设备先进程度', defaultWeight: 0.10, dataSource: 'search' },
    ],
  },

  // ── 教育 ──
  [DomainType.EDUCATION]: {
    type: DomainType.EDUCATION,
    label: '教育服务',
    description: '选学校/培训机构决策',
    tags: ['教育', '培训', '学习'],
    axes: [
      { name: 'credibility', label: '可信度', description: '办学资质与教育许可', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '社会口碑与学生/家长评价', defaultWeight: 0.10, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '教学服务体验', defaultWeight: 0.10, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '经营与合规风险（越高越安全）', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '学费与教育质量匹配度', defaultWeight: 0.10, dataSource: 'computed' },
      { name: 'teaching_quality', label: '教学质量', description: '师资水平与课程设计', defaultWeight: 0.25, dataSource: 'evidence' },
      { name: 'employment_rate', label: '就业率', description: '毕业生就业/升学率', defaultWeight: 0.15, dataSource: 'search' },
    ],
  },

  // ── 旅游 ──
  [DomainType.TRAVEL]: {
    type: DomainType.TRAVEL,
    label: '旅游出行',
    description: '酒店/旅行社/景点决策',
    tags: ['旅游', '出行', '住宿'],
    axes: [
      { name: 'credibility', label: '可信度', description: '资质与经营许可', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '平台评分与用户评价', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '服务水平与响应', defaultWeight: 0.15, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '安全记录与合规性（越高越安全）', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '价格与体验匹配度', defaultWeight: 0.15, dataSource: 'computed' },
      { name: 'accessibility', label: '交通便利性', description: '交通便捷程度', defaultWeight: 0.10, dataSource: 'search' },
      { name: 'experience', label: '用户体验', description: '整体体验评价', defaultWeight: 0.15, dataSource: 'evidence' },
    ],
  },

  // ── 金融 ──
  [DomainType.FINANCE]: {
    type: DomainType.FINANCE,
    label: '金融服务',
    description: '选择金融产品/机构决策',
    tags: ['金融', '投资', '理财'],
    axes: [
      { name: 'credibility', label: '可信度', description: '金融机构资质与监管许可', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '市场声誉与客户评价', defaultWeight: 0.10, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '服务流程与客户体验', defaultWeight: 0.10, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '金融产品风险等级（越高越安全）', defaultWeight: 0.25, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '费率与收益匹配度', defaultWeight: 0.20, dataSource: 'computed' },
      { name: 'accessibility', label: '可及性', description: '网点覆盖与线上服务便利性', defaultWeight: 0.15, dataSource: 'search' },
    ],
  },

  // ── 商业 ──
  [DomainType.COMMERCE]: {
    type: DomainType.COMMERCE,
    label: '商业服务',
    description: '找供应商/合作伙伴决策',
    tags: ['商业', '供应链', 'B2B'],
    axes: [
      { name: 'credibility', label: '可信度', description: '企业资质与工商信息', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '行业口碑与客户评价', defaultWeight: 0.10, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '服务响应与交付质量', defaultWeight: 0.15, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '经营风险与合规性（越高越安全）', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '产品价格与质量匹配度', defaultWeight: 0.15, dataSource: 'computed' },
      { name: 'capacity', label: '产能', description: '生产能力与交付能力', defaultWeight: 0.10, dataSource: 'evidence' },
      { name: 'delivery_reliability', label: '交付可靠性', description: '按时交付与质量稳定性', defaultWeight: 0.10, dataSource: 'evidence' },
    ],
  },

  // ── 生活服务 ──
  [DomainType.SERVICES]: {
    type: DomainType.SERVICES,
    label: '生活服务',
    description: '家政/美容/装修等本地生活服务',
    tags: ['生活', '本地', '服务'],
    axes: [
      { name: 'credibility', label: '可信度', description: '服务资质与经营许可', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '用户评价与口碑', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '服务水平与专业度', defaultWeight: 0.20, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '服务安全与纠纷记录（越高越安全）', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '价格与服务匹配度', defaultWeight: 0.15, dataSource: 'computed' },
      { name: 'accessibility', label: '便利性', description: '位置与服务可及性', defaultWeight: 0.10, dataSource: 'search' },
      { name: 'hygiene', label: '卫生状况', description: '卫生条件与安全标准', defaultWeight: 0.10, dataSource: 'search' },
    ],
  },

  // ── 农业 ──
  [DomainType.AGRICULTURE]: {
    type: DomainType.AGRICULTURE,
    label: '农业服务',
    description: '农资/农机/农产品决策',
    tags: ['农业', '农资', '农产品'],
    axes: [
      { name: 'credibility', label: '可信度', description: '企业资质与产品认证', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '行业口碑与农户评价', defaultWeight: 0.15, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '技术服务与售后支持', defaultWeight: 0.15, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '产品质量与合规风险（越高越安全）', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '价格与产量/品质匹配度', defaultWeight: 0.20, dataSource: 'computed' },
      { name: 'delivery_reliability', label: '交付可靠性', description: '供货稳定性与时效', defaultWeight: 0.10, dataSource: 'evidence' },
    ],
  },

  // ── 通用 ──
  [DomainType.GENERAL]: {
    type: DomainType.GENERAL,
    label: '通用决策',
    description: '无法确定具体领域时的兜底',
    tags: ['通用'],
    axes: [
      { name: 'credibility', label: '可信度', description: '通用可信度评估', defaultWeight: 0.25, dataSource: 'search' },
      { name: 'reputation', label: '声誉', description: '通用声誉评估', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'service_quality', label: '服务质量', description: '通用服务质量评估', defaultWeight: 0.20, dataSource: 'evidence' },
      { name: 'risk', label: '风险', description: '通用风险评估（越高越安全）', defaultWeight: 0.20, dataSource: 'search' },
      { name: 'value_for_money', label: '性价比', description: '通用性价比评估', defaultWeight: 0.15, dataSource: 'computed' },
    ],
  },
}

// ============================================================
// 4. 领域注册表方法（确定性）
// ============================================================

export const domainRegistry = {
  /** 获取所有领域类型 */
  getAllTypes(): DomainType[] {
    return Object.values(DomainType)
  },

  /** 获取领域描述符 */
  getDescriptor(type: DomainType): DomainDescriptor {
    return DOMAIN_REGISTRY[type]
  },

  /** 获取领域的评估轴（只返回名称数组） */
  getAxisNames(type: DomainType): string[] {
    return DOMAIN_REGISTRY[type].axes.map(a => a.name)
  },

  /** 获取领域的完整评估轴定义 */
  getAxes(type: DomainType): DomainAxis[] {
    return [...DOMAIN_REGISTRY[type].axes]
  },

  /** 获取领域的默认权重映射 */
  getDefaultWeights(type: DomainType): Record<string, number> {
    const weights: Record<string, number> = {}
    for (const ax of DOMAIN_REGISTRY[type].axes) {
      weights[ax.name] = ax.defaultWeight
    }
    // 归一化
    const total = Object.values(weights).reduce((s, w) => s + w, 0)
    if (total > 0 && Math.abs(total - 1) > 0.01) {
      for (const key of Object.keys(weights)) {
        weights[key] = Math.round((weights[key] / total) * 1000) / 1000
      }
    }
    return weights
  },

  /** 检查领域是否注册 */
  exists(type: DomainType): boolean {
    return type in DOMAIN_REGISTRY
  },
}
