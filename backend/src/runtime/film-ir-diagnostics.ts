/**
 * FilmIR Diagnostics v0.1
 * =======================
 * 统一的诊断对象：Validator 输出 + Agent 修复依据 + 前端展示
 *
 * 原则：
 * - 所有模块（Validator / SceneGraph / Capability / Compiler）共用同一诊断格式
 * - 前端直接展示 healthScore
 * - Agent 按 problemType 分类修复
 */

export type ProblemSeverity = 'error' | 'warning' | 'info'
export type ProblemCategory =
  | 'camera'
  | 'scene'
  | 'character'
  | 'lighting'
  | 'action'
  | 'constraint'
  | 'reference'
  | 'continuity'
  | 'physics'
  | 'composition'
  | 'metadata'
  | 'general'

export interface FilmIRProblem {
  id: string
  severity: ProblemSeverity
  category: ProblemCategory
  field: string             // 问题字段路径，如 "camera.shotType"
  message: string
  autoFixable: boolean
  autoFix?: string          // autoFix 建议值
}

export interface FilmIRDiagnostics {
  problems: FilmIRProblem[]
  score: {
    overall: number         // 总体评分 0-1
    byCategory: Record<ProblemCategory, number>
  }
  summary: {
    errors: number
    warnings: number
    infos: number
    autoFixes: number
  }
}

/** 生成空诊断 */
export function emptyDiagnostics(): FilmIRDiagnostics {
  return {
    problems: [],
    score: { overall: 1, byCategory: {} as any },
    summary: { errors: 0, warnings: 0, infos: 0, autoFixes: 0 },
  }
}

/** 聚合问题列表 → 诊断结果 */
export function aggregateDiagnostics(problems: FilmIRProblem[]): FilmIRDiagnostics {
  const errors = problems.filter(p => p.severity === 'error').length
  const warnings = problems.filter(p => p.severity === 'warning').length
  const infos = problems.filter(p => p.severity === 'info').length
  const autoFixes = problems.filter(p => p.autoFixable).length

  // 按分类评分：无问题 = 1，warning 扣 0.15，error 扣 0.4
  const categories = [...new Set(problems.map(p => p.category))]
  const byCategory: Record<string, number> = {}
  for (const cat of categories) {
    const group = problems.filter(p => p.category === cat)
    const err = group.filter(p => p.severity === 'error').length
    const warn = group.filter(p => p.severity === 'warning').length
    byCategory[cat] = Math.max(0, 1 - err * 0.4 - warn * 0.15)
  }

  const overall = categories.length > 0
    ? Object.values(byCategory).reduce((a, b) => a + b, 0) / categories.length
    : 1

  return {
    problems,
    score: { overall, byCategory: byCategory as any },
    summary: { errors, warnings, infos, autoFixes },
  }
}
