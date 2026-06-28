/**
 * axis-definitions.ts — P1.3 Evaluation Geometry: 7 评估轴定义
 *
 * 7个正交评估轴，作为候选结果的评价维度。
 * 每个轴有: name, weight, range, direction(高好/低好)
 */

export interface EvaluationAxis {
  name: string
  label: string
  description: string
  weight: number       // 权重 [0,1], 用于非几何降级
  min: number          // 最低值
  max: number          // 最高值
  direction: 'higher_is_better' | 'lower_is_better'
  source: 'search' | 'evidence' | 'computed'
}

export const EVALUATION_AXES: EvaluationAxis[] = [
  {
    name: 'relevance',
    label: '相关性',
    description: '候选结果与原始查询的语义相关度',
    weight: 0.25,
    min: 0,
    max: 1,
    direction: 'higher_is_better',
    source: 'search',
  },
  {
    name: 'authority',
    label: '权威度',
    description: '信息来源的可靠性与权威等级',
    weight: 0.15,
    min: 0,
    max: 1,
    direction: 'higher_is_better',
    source: 'evidence',
  },
  {
    name: 'recency',
    label: '时效性',
    description: '信息的更新及时程度',
    weight: 0.10,
    min: 0,
    max: 1,
    direction: 'higher_is_better',
    source: 'evidence',
  },
  {
    name: 'completeness',
    label: '完整度',
    description: '候选结果覆盖查询的完整程度',
    weight: 0.20,
    min: 0,
    max: 1,
    direction: 'higher_is_better',
    source: 'evidence',
  },
  {
    name: 'consensus',
    label: '一致度',
    description: '多个来源对该信息的认同程度',
    weight: 0.10,
    min: 0,
    max: 1,
    direction: 'higher_is_better',
    source: 'computed',
  },
  {
    name: 'diversity',
    label: '多样性',
    description: '候选提供的差异化视角程度',
    weight: 0.10,
    min: 0,
    max: 1,
    direction: 'higher_is_better',
    source: 'computed',
  },
  {
    name: 'risk',
    label: '风险度',
    description: '信息的不确定性与潜在风险',
    weight: 0.10,
    min: 0,
    max: 1,
    direction: 'lower_is_better',
    source: 'computed',
  },
]

export function getAxis(name: string): EvaluationAxis | undefined {
  return EVALUATION_AXES.find(a => a.name === name)
}

export function getAxisNames(): string[] {
  return EVALUATION_AXES.map(a => a.name)
}

export function getDefaultVector(): number[] {
  return EVALUATION_AXES.map(() => 0)
}
