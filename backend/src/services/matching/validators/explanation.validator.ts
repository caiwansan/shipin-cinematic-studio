// ============================================================
// ExplanationValidator — LLM 输出校验
// 职责：验证 Explanation 的 evidence 约束、结构完整性
// 红线：每条 claim 必须有有效 evidenceIds
// ============================================================

export interface EvidenceItem {
  evidenceType: string;
  claim: string;
  sourceType: string;
  sourceId: string;
  confidence: number;
}

export interface ExplanationClaim {
  claim: string;
  evidenceIds: string[];
  category?: string;
  severity?: string;
  mitigable?: boolean;
}

export interface ExplanationOutput {
  matchResultId: string;
  generatedAt: string;
  modelUsed: string;
  explanationVersion: string;
  summary: string;
  strengths: ExplanationClaim[];
  gaps: ExplanationClaim[];
  interviewSuggestions: ExplanationClaim[];
  riskWarnings: ExplanationClaim[];
  confidence: number;
  fallback?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  filtered: {
    strengths: number;
    gaps: number;
    interviewSuggestions: number;
    riskWarnings: number;
  };
}

/**
 * 校验 Explanation 输出
 * 1. 结构完整性
 * 2. 每条 claim 必须有有效 evidenceIds
 * 3. summary 长度限制
 * 4. 数组长度限制
 */
export function validateExplanation(
  output: ExplanationOutput,
  evidenceList: EvidenceItem[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const filtered = { strengths: 0, gaps: 0, interviewSuggestions: 0, riskWarnings: 0 };

  const validIds = new Set(evidenceList.map((e) => e.sourceId));

  // ── 1. 基础结构检查 ──
  if (!output.summary) {
    errors.push('summary 不能为空');
  } else if (output.summary.length > 200) {
    warnings.push(`summary 过长 (${output.summary.length} 字)，建议 <=100 字`);
  }

  if (!output.matchResultId) {
    errors.push('matchResultId 不能为空');
  }

  // ── 2. strengths 校验 ──
  if (!Array.isArray(output.strengths)) {
    errors.push('strengths 必须是数组');
    output.strengths = [];
  } else if (output.strengths.length > 5) {
    warnings.push(`strengths 超过 5 条 (${output.strengths.length})，截断`);
    output.strengths = output.strengths.slice(0, 5);
  }
  output.strengths = output.strengths.filter((s) => {
    if (!isValidClaim(s, validIds)) {
      filtered.strengths++;
      return false;
    }
    return true;
  });

  // ── 3. gaps 校验 ──
  if (!Array.isArray(output.gaps)) {
    errors.push('gaps 必须是数组');
    output.gaps = [];
  } else if (output.gaps.length > 5) {
    warnings.push(`gaps 超过 5 条 (${output.gaps.length})，截断`);
    output.gaps = output.gaps.slice(0, 5);
  }
  output.gaps = output.gaps.filter((g) => {
    if (!isValidClaim(g, validIds)) {
      filtered.gaps++;
      return false;
    }
    return true;
  });

  // ── 4. interviewSuggestions 校验 ──
  if (!Array.isArray(output.interviewSuggestions)) {
    errors.push('interviewSuggestions 必须是数组');
    output.interviewSuggestions = [];
  } else if (output.interviewSuggestions.length > 5) {
    warnings.push(`interviewSuggestions 超过 5 条 (${output.interviewSuggestions.length})，截断`);
    output.interviewSuggestions = output.interviewSuggestions.slice(0, 5);
  }
  output.interviewSuggestions = output.interviewSuggestions.filter((s) => {
    if (!isValidClaim(s, validIds)) {
      filtered.interviewSuggestions++;
      return false;
    }
    return true;
  });

  // ── 5. riskWarnings 校验 ──
  if (!Array.isArray(output.riskWarnings)) {
    output.riskWarnings = [];
  }
  output.riskWarnings = output.riskWarnings.filter((r) => {
    if (!isValidClaim(r, validIds)) {
      filtered.riskWarnings++;
      return false;
    }
    return true;
  });

  // ── 6. confidence 检查 ──
  if (output.confidence < 0.5) {
    warnings.push(`Explanation 置信度较低 (${output.confidence})，证据可能不足`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    filtered,
  };
}

/**
 * 检查单条 claim 是否有效
 * 条件：
 * 1. claim 文本非空
 * 2. evidenceIds 非空数组
 * 3. 所有 evidenceIds 在有效集合中
 */
function isValidClaim(
  claim: ExplanationClaim,
  validIds: Set<string>,
): boolean {
  if (!claim.claim || typeof claim.claim !== 'string' || claim.claim.trim().length === 0) {
    return false;
  }

  if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) {
    return false;
  }

  // 所有 evidenceIds 必须有效
  return claim.evidenceIds.every((id) => validIds.has(id));
}

/**
 * 生成 Template Fallback Explanation
 * 当 LLM 失败或验证全部失败时使用
 */
export function generateTemplateExplanation(params: {
  matchResultId: string;
  score: number;
  breakdown: { skill: number; experience: number; education: number; career: number };
  matchedSkills: Array<{ name: string; required: boolean }>;
  missingSkills: Array<{ name: string; required: boolean }>;
  riskFlags: Array<{ type: string; severity: string; detail: string }>;
  evidenceList: EvidenceItem[];
}): ExplanationOutput {
  const { score, breakdown, matchedSkills, missingSkills, riskFlags, evidenceList } = params;

  const evidenceIds = evidenceList.map((e) => e.sourceId);

  // 自动归纳 strengths
  const strengths: ExplanationClaim[] = [];
  if (breakdown.skill >= 70) {
    const skillNames = matchedSkills.filter((s) => s.required).map((s) => s.name);
    if (skillNames.length > 0) {
      strengths.push({
        claim: `核心技能匹配：${skillNames.slice(0, 3).join('、')}`,
        evidenceIds: evidenceIds.slice(0, 2),
        category: 'skill',
      });
    }
  }
  if (breakdown.experience >= 70) {
    strengths.push({
      claim: `工作经验符合岗位要求`,
      evidenceIds: evidenceIds.slice(0, 1),
      category: 'experience',
    });
  }

  // 自动归纳 gaps
  const gaps: ExplanationClaim[] = [];
  for (const ms of missingSkills.filter((s) => s.required).slice(0, 3)) {
    gaps.push({
      claim: `缺少技能：${ms.name}`,
      evidenceIds: evidenceIds.slice(0, 1),
      severity: 'medium',
      mitigable: true,
    });
  }

  // 自动归纳风险
  const riskWarnings: ExplanationClaim[] = riskFlags.map((rf) => ({
    claim: rf.detail,
    evidenceIds: evidenceIds.slice(0, 1),
    category: rf.type,
  }));

  // 生成 summary
  let summary: string;
  if (score >= 80) {
    summary = `候选人与岗位高度匹配（${score}分），建议推进面试环节。`;
  } else if (score >= 60) {
    summary = `候选人基本匹配岗位（${score}分），部分维度有待验证。`;
  } else if (score >= 40) {
    summary = `候选人匹配度一般（${score}分），存在明显差距。`;
  } else {
    summary = `候选人与岗位匹配度较低（${score}分），不建议推进。`;
  }

  return {
    matchResultId: params.matchResultId,
    generatedAt: new Date().toISOString(),
    modelUsed: 'template-fallback',
    explanationVersion: 'v1',
    summary,
    strengths,
    gaps,
    interviewSuggestions: [],
    riskWarnings,
    confidence: 0.5,
    fallback: true,
  };
}
