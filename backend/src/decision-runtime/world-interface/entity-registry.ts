/**
 * entity-registry.ts — Phase A-4 Decision World Interface Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * EntityRegistry — 实体注册表
 * ═══════════════════════════════════════════════════════════════
 *
 * 功能：
 *   定义每个领域中可存在的"实体类型"及其"可观测属性"。
 *
 * 这不是数据仓库，而是"实体类型的元模型"——
 * 它告诉系统：在某个领域，世界上存在哪些种类的事物，
 * 每个事物有哪些可采集的属性。
 *
 * 宪法规则：
 *   1. 实体类型是编译时常量（需代码变更才可增加）
 *   2. 每种实体类型的 attributes 是固定集合
 *   3. 新增实体类型必须在 Registry 中注册
 *
 * @phase decision-runtime
 */

import type { DomainType } from '../business-intelligence/domain-classifier.js'

// ============================================================
// 1. 实体属性定义
// ============================================================

export interface EntityAttributeDef {
  /** 属性名 */
  name: string
  /** 属性类型 */
  type: 'number' | 'string' | 'boolean' | 'enum'
  /** 枚举值列表（type=enum 时必填） */
  enumValues?: string[]
  /** 是否必填 */
  required: boolean
  /** 描述 */
  description: string
  /** 单位（数值类型时） */
  unit?: string
}

// ============================================================
// 2. 实体类型定义
// ============================================================

export interface EntityTypeDef {
  /** 实体类型名称 */
  typeName: string
  /** 所属领域 */
  domain: DomainType
  /** 可观测属性列表 */
  attributes: EntityAttributeDef[]
  /** 典型数据源 */
  typicalSources: string[]
  /** 实体描述 */
  description: string
}

// ============================================================
// 3. 实体注册表
// ============================================================

export interface EntityRegistry {
  /**
   * 获取某个领域的实体类型定义列表
   */
  getTypesForDomain(domain: DomainType): EntityTypeDef[]

  /**
   * 根据实体类型名获取定义
   */
  getType(typeName: string): EntityTypeDef | undefined

  /**
   * 注册新的实体类型
   */
  register(typeDef: EntityTypeDef): void

  /**
   * 列出所有注册的实体类型
   */
  listAll(): EntityTypeDef[]
}

// ============================================================
// 4. 默认实体类型注册
// ============================================================

function buildDefaultTypes(): EntityTypeDef[] {
  return [
    // ── 房地产 ──
    {
      typeName: 'residential_property',
      domain: 'REAL_ESTATE' as DomainType,
      description: '住宅房产',
      attributes: [
        { name: 'price', type: 'number', required: true, description: '价格', unit: '万元' },
        { name: 'area', type: 'number', required: true, description: '面积', unit: 'm²' },
        { name: 'bedrooms', type: 'number', required: true, description: '卧室数' },
        { name: 'location', type: 'string', required: true, description: '位置' },
        { name: 'propertyType', type: 'enum', required: true, description: '房产类型', enumValues: ['商品房', '二手房', '公寓', '别墅', '经适房'] },
        { name: 'yearBuilt', type: 'number', required: false, description: '建造年份' },
        { name: 'hasElevator', type: 'boolean', required: false, description: '有电梯' },
        { name: 'subwayDistance', type: 'number', required: false, description: '距地铁', unit: '米' },
      ],
      typicalSources: ['链家', '贝壳', '安居客', '房天下'],
    },
    {
      typeName: 'school_district',
      domain: 'REAL_ESTATE' as DomainType,
      description: '学区',
      attributes: [
        { name: 'schoolName', type: 'string', required: true, description: '学校名' },
        { name: 'schoolLevel', type: 'enum', required: true, description: '学校等级', enumValues: ['市级', '区级', '省级'] },
        { name: 'distance', type: 'number', required: false, description: '距离', unit: '米' },
      ],
      typicalSources: ['教育局官网', '贝壳', '链家'],
    },
    // ── 法律 ──
    {
      typeName: 'law_firm',
      domain: 'LEGAL' as DomainType,
      description: '律师事务所',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '名称' },
        { name: 'yearEstablished', type: 'number', required: false, description: '成立年份' },
        { name: 'lawyerCount', type: 'number', required: false, description: '律师人数' },
        { name: 'specialization', type: 'string', required: false, description: '专业方向' },
        { name: 'successRate', type: 'number', required: false, description: '胜诉率' },
      ],
      typicalSources: ['司法局', '律师协会', '中国裁判文书网'],
    },
    {
      typeName: 'lawyer',
      domain: 'LEGAL' as DomainType,
      description: '律师',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '姓名' },
        { name: 'yearsExperience', type: 'number', required: false, description: '从业年限' },
        { name: 'licenseNumber', type: 'string', required: false, description: '执业证号' },
        { name: 'specialization', type: 'string', required: false, description: '专长领域' },
        { name: 'rating', type: 'number', required: false, description: '评分' },
      ],
      typicalSources: ['司法局', '律师协会'],
    },
    // ── 医疗 ──
    {
      typeName: 'hospital',
      domain: 'MEDICAL' as DomainType,
      description: '医院',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '名称' },
        { name: 'hospitalLevel', type: 'enum', required: true, description: '医院等级', enumValues: ['三级甲等', '三级乙等', '二级甲等', '二级乙等', '一级', '社区'] },
        { name: 'departmentCount', type: 'number', required: false, description: '科室数' },
        { name: 'bedCount', type: 'number', required: false, description: '床位数' },
        { name: 'rating', type: 'number', required: false, description: '评分' },
      ],
      typicalSources: ['卫健委', '好大夫在线', '医院官网'],
    },
    {
      typeName: 'doctor',
      domain: 'MEDICAL' as DomainType,
      description: '医生',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '姓名' },
        { name: 'title', type: 'enum', required: true, description: '职称', enumValues: ['主任医师', '副主任医师', '主治医师', '住院医师'] },
        { name: 'specialization', type: 'string', required: false, description: '专科' },
        { name: 'yearsExperience', type: 'number', required: false, description: '从业年限' },
        { name: 'rating', type: 'number', required: false, description: '患者评分' },
      ],
      typicalSources: ['卫健委', '好大夫在线', '医院官网'],
    },
    // ── 教育 ──
    {
      typeName: 'school',
      domain: 'EDUCATION' as DomainType,
      description: '学校',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '名称' },
        { name: 'schoolType', type: 'enum', required: true, description: '学校类型', enumValues: ['小学', '初中', '高中', '大学', '幼儿园', '职业'] },
        { name: 'schoolLevel', type: 'enum', required: false, description: '办学层次', enumValues: ['985', '211', '省重点', '市重点', '普通'] },
        { name: 'studentCount', type: 'number', required: false, description: '学生数' },
        { name: 'teacherCount', type: 'number', required: false, description: '教师数' },
        { name: 'rating', type: 'number', required: false, description: '评分' },
        { name: 'employmentRate', type: 'number', required: false, description: '就业率' },
      ],
      typicalSources: ['教育部', '学校官网', '知乎'],
    },
    // ── 旅游 ──
    {
      typeName: 'hotel',
      domain: 'TRAVEL' as DomainType,
      description: '酒店',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '名称' },
        { name: 'starLevel', type: 'number', required: false, description: '星级' },
        { name: 'pricePerNight', type: 'number', required: false, description: '每晚价格', unit: '元' },
        { name: 'rating', type: 'number', required: false, description: '评分' },
        { name: 'location', type: 'string', required: false, description: '位置' },
      ],
      typicalSources: ['携程', '飞猪', '美团', '去哪儿'],
    },
    {
      typeName: 'attraction',
      domain: 'TRAVEL' as DomainType,
      description: '景点',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '名称' },
        { name: 'rating', type: 'number', required: false, description: '评分' },
        { name: 'entryFee', type: 'number', required: false, description: '门票', unit: '元' },
        { name: 'recommendedDuration', type: 'number', required: false, description: '建议游玩', unit: '小时' },
      ],
      typicalSources: ['携程', '马蜂窝', '飞猪'],
    },
    // ── 金融 ──
    {
      typeName: 'financial_product',
      domain: 'FINANCE' as DomainType,
      description: '金融产品',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '名称' },
        { name: 'productType', type: 'enum', required: true, description: '产品类型', enumValues: ['存款', '理财', '基金', '保险', '贷款'] },
        { name: 'annualReturn', type: 'number', required: false, description: '年化收益率' },
        { name: 'riskLevel', type: 'enum', required: false, description: '风险等级', enumValues: ['低', '中低', '中', '中高', '高'] },
        { name: 'minInvestment', type: 'number', required: false, description: '起投金额', unit: '元' },
      ],
      typicalSources: ['央行', '银行官网', '基金公司', '蚂蚁财富'],
    },
    // ── 商业/服务 ──
    {
      typeName: 'restaurant',
      domain: 'COMMERCE' as DomainType,
      description: '餐厅',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '名称' },
        { name: 'cuisineType', type: 'string', required: false, description: '菜系' },
        { name: 'rating', type: 'number', required: false, description: '评分' },
        { name: 'avgCost', type: 'number', required: false, description: '人均', unit: '元' },
        { name: 'location', type: 'string', required: false, description: '位置' },
        { name: 'hygieneGrade', type: 'enum', required: false, description: '卫生等级', enumValues: ['A', 'B', 'C'] },
      ],
      typicalSources: ['大众点评', '美团', '饿了么', '市场监管局'],
    },
    {
      typeName: 'service_provider',
      domain: 'SERVICES' as DomainType,
      description: '服务提供商',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '名称' },
        { name: 'serviceType', type: 'string', required: false, description: '服务类型' },
        { name: 'rating', type: 'number', required: false, description: '评分' },
        { name: 'price', type: 'number', required: false, description: '价格', unit: '元' },
      ],
      typicalSources: ['大众点评', '美团'],
    },
    // ── 农业 ──
    {
      typeName: 'agricultural_product',
      domain: 'AGRICULTURE' as DomainType,
      description: '农产品',
      attributes: [
        { name: 'name', type: 'string', required: true, description: '品名' },
        { name: 'wholesalePrice', type: 'number', required: false, description: '批发价', unit: '元/kg' },
        { name: 'retailPrice', type: 'number', required: false, description: '零售价', unit: '元/kg' },
        { name: 'season', type: 'string', required: false, description: '产季' },
        { name: 'origin', type: 'string', required: false, description: '产地' },
      ],
      typicalSources: ['国家统计局', '批发市场', '农业局'],
    },
  ]
}

// ============================================================
// 5. 默认实现
// ============================================================

export function createEntityRegistry(): EntityRegistry {
  const types = buildDefaultTypes()
  const typeMap = new Map<string, EntityTypeDef>()

  for (const t of types) {
    typeMap.set(t.typeName, t)
  }

  function getTypesForDomain(domain: DomainType): EntityTypeDef[] {
    return types.filter(t => t.domain === domain)
  }

  function getType(typeName: string): EntityTypeDef | undefined {
    return typeMap.get(typeName)
  }

  function register(typeDef: EntityTypeDef): void {
    types.push(typeDef)
    typeMap.set(typeDef.typeName, typeDef)
  }

  function listAll(): EntityTypeDef[] {
    return [...types]
  }

  return { getTypesForDomain, getType, register, listAll }
}

/** 单例 */
export const entityRegistry = createEntityRegistry()
