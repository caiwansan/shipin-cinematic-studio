// ─────────────────────────────────────────────────
// Issue Registry — 预定义 Issue kinds
// A1.1 — FROZEN
// ─────────────────────────────────────────────────

export interface IssueKindDef {
  kindId: string
  kind: import('./types').IssueKind
  defaultSeverity: number
  description: string
  category: string
  defaultConfidence: number
}

// 11 种预定义 Issue kind
export const ISSUE_REGISTRY: Record<string, IssueKindDef> = {
  missing_schema: {
    kindId: 'missing_schema',
    kind: 'schema',
    defaultSeverity: 8,
    description: 'Schema 缺失，AI 系统无法正确解析品牌信息',
    category: 'schema',
    defaultConfidence: 0.85,
  },
  incomplete_schema: {
    kindId: 'incomplete_schema',
    kind: 'schema',
    defaultSeverity: 6,
    description: 'Schema 信息不完整（缺少关键字段如 name/description/logo）',
    category: 'schema',
    defaultConfidence: 0.8,
  },
  low_coverage: {
    kindId: 'low_coverage',
    kind: 'content',
    defaultSeverity: 7,
    description: 'Knowledge Coverage 不足，AI 系统缺乏足够的品牌知识',
    category: 'content',
    defaultConfidence: 0.75,
  },
  factual_conflict: {
    kindId: 'factual_conflict',
    kind: 'content',
    defaultSeverity: 9,
    description: '事实性冲突，多个来源描述不一致',
    category: 'content',
    defaultConfidence: 0.7,
  },
  outdated_content: {
    kindId: 'outdated_content',
    kind: 'content',
    defaultSeverity: 5,
    description: '内容过期，AI 参考的信息已过时',
    category: 'content',
    defaultConfidence: 0.65,
  },
  authority_gap: {
    kindId: 'authority_gap',
    kind: 'authority',
    defaultSeverity: 6,
    description: '权威来源不足，缺乏高价值引用来源',
    category: 'authority',
    defaultConfidence: 0.8,
  },
  visibility_drop: {
    kindId: 'visibility_drop',
    kind: 'technical',
    defaultSeverity: 7,
    description: 'Visibility 分数近期显著下降',
    category: 'technical',
    defaultConfidence: 0.9,
  },
  citation_missing: {
    kindId: 'citation_missing',
    kind: 'content',
    defaultSeverity: 4,
    description: '引用缺失，AI 在条文中未正确标注信息来源',
    category: 'content',
    defaultConfidence: 0.7,
  },
  schema_error: {
    kindId: 'schema_error',
    kind: 'technical',
    defaultSeverity: 5,
    description: 'Schema 格式错误，无法被标准解析器正确识别',
    category: 'technical',
    defaultConfidence: 0.85,
  },
  content_duplicate: {
    kindId: 'content_duplicate',
    kind: 'content',
    defaultSeverity: 3,
    description: '内容重复，AI 同一信息被反复记录',
    category: 'content',
    defaultConfidence: 0.75,
  },
  branding_inconsistency: {
    kindId: 'branding_inconsistency',
    kind: 'technical',
    defaultSeverity: 6,
    description: '品牌表述不一致，名称/描述在不同来源不一致',
    category: 'technical',
    defaultConfidence: 0.7,
  },
}

export function getIssueKindDef(kindId: string): IssueKindDef | undefined {
  return ISSUE_REGISTRY[kindId]
}

export function getAllKindIds(): string[] {
  return Object.keys(ISSUE_REGISTRY)
}
