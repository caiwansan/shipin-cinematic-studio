// ============================================================
// MatchExplanationService — AI 解释层
// 职责：将 P4-01 的 MatchResult + Evidence 转化为人类可读文本
// 红线：LLM 只生成表达，不参与计算；每条 claim 必须绑定 evidenceIds
// ============================================================

import { prisma } from '../../../utils/index.js';
import { modelRouter } from '../../enterprise/model-router.service.js';
import { callLLM, parseLLMJson, type LLMConfig } from '../../hdz/llm.client.js';
import {
  validateExplanation,
  generateTemplateExplanation,
  type EvidenceItem,
  type ExplanationOutput,
} from '../validators/explanation.validator.js';

// ── 输入类型 ──

export interface ExplanationRequest {
  matchResultId: string;
  enterpriseId: string;
  language?: 'zh' | 'en';
  maxSuggestions?: number;
}

// ── 匹配结果加载数据 ──

interface MatchResultData {
  id: string;
  score: number;
  breakdown: { skill: number; experience: number; education: number; career: number };
  matchedSkills: any[];
  missingSkills: any[];
  skillGap: any[];
  riskFlags: any[];
  jobTitle: string;
}

// ── Singleton ──

export const matchExplanationService = {
  /**
   * 主入口：生成匹配解释
   * 流程：加载数据 → 路由 LLM → 构建 Prompt → 调用 LLM → 校验 → 返回
   */
  async generateExplanation(request: ExplanationRequest): Promise<ExplanationOutput> {
    const { matchResultId, enterpriseId } = request;

    // 1. 加载 MatchResult + Evidence（不直接读 Candidate Domain）
    const { matchResult, evidenceList } = await loadMatchData(matchResultId);
    if (!matchResult) {
      throw new ExplanationError('Match result not found', 404);
    }

    // 2. 通过 Model Router 获取 LLM 配置
    const llmConfig = await resolveLLMConfig(enterpriseId);
    if (!llmConfig) {
      // Fallback: 无 LLM 配置，返回 Template
      return generateTemplateExplanation({
        matchResultId,
        score: matchResult.score,
        breakdown: matchResult.breakdown,
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills,
        riskFlags: matchResult.riskFlags,
        evidenceList,
      });
    }

    try {
      // 3. 构建 Prompt
      const { systemPrompt, userPrompt } = buildPrompts(matchResult, evidenceList, request);

      // 4. 调用 LLM
      const rawOutput = await callLLM(llmConfig, systemPrompt, userPrompt, {
        maxTokens: 2048,
        temperature: 0.3, // 低温度，提高确定性
      });

      // 5. 解析 JSON
      const parsed = parseLLMJson(rawOutput);

      // 6. 组装输出
      const output: ExplanationOutput = {
        matchResultId,
        generatedAt: new Date().toISOString(),
        modelUsed: `${llmConfig.provider}/${llmConfig.modelName}`,
        explanationVersion: 'v1',
        summary: parsed.summary || '',
        strengths: parsed.strengths || [],
        gaps: parsed.gaps || [],
        interviewSuggestions: parsed.interviewSuggestions || [],
        riskWarnings: parsed.riskWarnings || [],
        confidence: parsed.confidence ?? 0.8,
        fallback: false,
      };

      // 7. 校验 Evidence 约束
      const validation = validateExplanation(output, evidenceList);
      if (!validation.valid) {
        console.warn(`[Explanation] Validation errors: ${validation.errors.join('; ')}`);
      }
      if (validation.warnings.length > 0) {
        console.warn(`[Explanation] Validation warnings: ${validation.warnings.join('; ')}`);
      }

      // 8. 如果过滤后为空，降级到 Template
      if (
        output.strengths.length === 0 &&
        output.gaps.length === 0 &&
        output.interviewSuggestions.length === 0
      ) {
        console.warn('[Explanation] LLM output empty after validation, using template fallback');
        return generateTemplateExplanation({
          matchResultId,
          score: matchResult.score,
          breakdown: matchResult.breakdown,
          matchedSkills: matchResult.matchedSkills,
          missingSkills: matchResult.missingSkills,
          riskFlags: matchResult.riskFlags,
          evidenceList,
        });
      }

      return output;
    } catch (e: any) {
      console.error(`[Explanation] LLM call failed: ${e.message}, using template fallback`);
      // Fallback: LLM 失败，返回 Template
      return generateTemplateExplanation({
        matchResultId,
        score: matchResult.score,
        breakdown: matchResult.breakdown,
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills,
        riskFlags: matchResult.riskFlags,
        evidenceList,
      });
    }
  },

  /**
   * 生成 Template Explanation（无需 LLM）
   * 用于测试或 LLM 不可用场景
   */
  async generateTemplate(request: ExplanationRequest): Promise<ExplanationOutput> {
    const { matchResultId } = request;
    const { matchResult, evidenceList } = await loadMatchData(matchResultId);
    if (!matchResult) {
      throw new ExplanationError('Match result not found', 404);
    }
    return generateTemplateExplanation({
      matchResultId,
      score: matchResult.score,
      breakdown: matchResult.breakdown,
      matchedSkills: matchResult.matchedSkills,
      missingSkills: matchResult.missingSkills,
      riskFlags: matchResult.riskFlags,
      evidenceList,
    });
  },
};

// ── 内部函数 ──

/**
 * 加载 MatchResult + Evidence
 * 数据源：P4-01 的 Computed Output（不读 P3 Candidate Domain）
 */
async function loadMatchData(matchResultId: string): Promise<{
  matchResult: MatchResultData | null;
  evidenceList: EvidenceItem[];
}> {
  const matchResult = await prisma.talentMatchResult.findUnique({
    where: { id: matchResultId },
    include: {
      jobRequirement: { select: { jobTitle: true } },
    },
  });

  if (!matchResult) {
    return { matchResult: null, evidenceList: [] };
  }

  const evidenceRecords = await prisma.matchEvidence.findMany({
    where: { matchResultId },
    orderBy: { confidence: 'desc' },
  });

  const evidenceList: EvidenceItem[] = evidenceRecords.map((e: any) => ({
    evidenceType: e.evidenceType,
    claim: e.claim,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    confidence: e.confidence,
  }));

  return {
    matchResult: {
      id: matchResult.id,
      score: matchResult.score,
      breakdown: matchResult.breakdown as { skill: number; experience: number; education: number; career: number },
      matchedSkills: (matchResult.matchedSkills as any[]) || [],
      missingSkills: (matchResult.missingSkills as any[]) || [],
      skillGap: (matchResult.skillGap as any[]) || [],
      riskFlags: (matchResult.riskFlags as any[]) || [],
      jobTitle: matchResult.jobRequirement?.jobTitle || '岗位',
    },
    evidenceList,
  };
}

/**
 * 通过 Model Router 获取 LLM 配置
 */
async function resolveLLMConfig(enterpriseId: string): Promise<LLMConfig | null> {
  try {
    const routeResult = await modelRouter.resolve({
      tenantId: enterpriseId,
      agentType: 'talent_matching',
      taskType: 'explanation',
    });

    if (!routeResult) return null;

    return modelRouter.toLLMConfig(routeResult);
  } catch (e: any) {
    console.warn(`[Explanation] Model Router failed: ${e.message}`);
    return null;
  }
}

/**
 * 构建 LLM Prompt
 */
function buildPrompts(
  matchResult: MatchResultData,
  evidenceList: EvidenceItem[],
  request: ExplanationRequest,
): { systemPrompt: string; userPrompt: string } {
  const lang = request.language || 'zh';
  const maxSuggestions = request.maxSuggestions || 3;

  const systemPrompt = lang === 'zh'
    ? `你是一名资深招聘专家。你的职责是根据匹配结果和证据链，为 HR 生成简洁、准确的候选人评估摘要。

## 规则
1. 所有结论必须基于提供的证据，禁止编造
2. 每条结论必须引用对应的 evidence sourceId
3. 保持客观中立，不带主观偏见
4. 简洁明了，每条结论不超过 50 字
5. 如果证据不足，明确标注"证据不足"
6. 不修改任何分数或排名

## 输出格式
严格按照以下 JSON 格式输出，不要包含任何额外文本或 markdown 代码块：
{
  "summary": "1-2 句总结（<=100 字）",
  "strengths": [{ "claim": "优势描述", "evidenceIds": ["sourceId1"], "category": "skill|experience|education|career" }],
  "gaps": [{ "claim": "差距描述", "evidenceIds": ["sourceId1"], "severity": "low|medium|high", "mitigable": true|false }],
  "interviewSuggestions": [{ "claim": "面试建议", "evidenceIds": ["sourceId1"] }],
  "riskWarnings": [{ "claim": "风险提示", "evidenceIds": ["sourceId1"] }],
  "confidence": 0.9
}`
    : `You are a senior recruitment expert. Generate a concise candidate evaluation summary based on match results and evidence.

## Rules
1. All conclusions must be based on provided evidence. No fabrication.
2. Each conclusion must reference evidence sourceId.
3. Stay objective and neutral.
4. Keep each conclusion under 30 words.
5. Mark "insufficient evidence" when applicable.
6. Do NOT modify any scores or rankings.

## Output Format
Output strictly in JSON, no extra text or markdown:
{
  "summary": "1-2 sentence summary",
  "strengths": [{ "claim": "strength description", "evidenceIds": ["sourceId1"], "category": "skill|experience|education|career" }],
  "gaps": [{ "claim": "gap description", "evidenceIds": ["sourceId1"], "severity": "low|medium|high", "mitigable": true|false }],
  "interviewSuggestions": [{ "claim": "interview suggestion", "evidenceIds": ["sourceId1"] }],
  "riskWarnings": [{ "claim": "risk warning", "evidenceIds": ["sourceId1"] }],
  "confidence": 0.9
}`;

  const userPrompt = `## 岗位信息
- 职位：${matchResult.jobTitle}
- 综合匹配分：${matchResult.score}/100

## 维度分数
- 技能匹配：${matchResult.breakdown.skill}/100
- 经验匹配：${matchResult.breakdown.experience}/100
- 教育匹配：${matchResult.breakdown.education}/100
- 职业匹配：${matchResult.breakdown.career}/100

## 技能匹配情况
### 已匹配技能
${formatMatchedSkills(matchResult.matchedSkills)}

### 缺失技能
${formatMissingSkills(matchResult.missingSkills)}

## 证据链
${formatEvidence(evidenceList)}

## 风险标记
${formatRiskFlags(matchResult.riskFlags)}

---

请生成：
1. 1-2 句总结（<=100 字）
2. 优势列表（≤5 条，每条引用 evidence）
3. 差距列表（≤5 条，每条引用 evidence）
4. 面试建议（≤${maxSuggestions} 条）
5. 风险提示（如有）`;

  return { systemPrompt, userPrompt };
}

// ── 格式化辅助 ──

function formatMatchedSkills(skills: any[]): string {
  if (!skills || skills.length === 0) return '无';
  return skills
    .map((s, i) => `  ${i + 1}. ${s.name || s.skillName || '未知'} [${s.required ? '必需' : '加分'}] (置信度: ${(s.confidence * 100).toFixed(0)}%)`)
    .join('\n');
}

function formatMissingSkills(skills: any[]): string {
  if (!skills || skills.length === 0) return '无';
  return skills
    .map((s, i) => `  ${i + 1}. ${s.name || s.skillName || '未知'} [${s.required ? '必需' : '加分'}]`)
    .join('\n');
}

function formatEvidence(evidenceList: EvidenceItem[]): string {
  if (evidenceList.length === 0) return '无';
  return evidenceList
    .map((e, i) => `  ${i + 1}. [${e.sourceId}] ${e.claim} (置信度: ${(e.confidence * 100).toFixed(0)}%)`)
    .join('\n');
}

function formatRiskFlags(riskFlags: any[]): string {
  if (!riskFlags || riskFlags.length === 0) return '无';
  return riskFlags
    .map((r, i) => `  ${i + 1}. [${r.severity || 'unknown'}] ${r.detail || r.type || '未知风险'}`)
    .join('\n');
}

// ── 自定义错误 ──

export class ExplanationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ExplanationError';
    this.statusCode = statusCode;
  }
}
