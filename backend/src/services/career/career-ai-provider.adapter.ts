/**
 * services/career/career-ai-provider.adapter.ts
 * Sprint-06A: 平台 AI 求职顾问接入适配器
 *
 * 核心职责：
 *   求职管家的「打开即用」AI 功能（简历分析、职业咨询、面试问题生成等）
 *   走 admin-global-config + businessType=career，用户无需配置 Key
 *
 * 调用链：
 *   Career AI Feature → careerAIProvider.callLLM() → executeViaGateway() → LLM
 *
 * 复用：
 *   - executeViaGateway 统一入口
 *   - admin-global-config 管理员配置
 *   - usage_logs Token 统计
 */

import { executeViaGateway } from '../../runtime/runtime-gateway.js';
import type { V2Input, V2Result } from '../../providers/provider.interface.v2.js';

export interface CareerAICallOptions {
  maxTokens?: number;
  temperature?: number;
  userId?: string;
}

/**
 * 平台 AI 求职顾问 — 统一调用入口
 * Sprint-07A.3: businessType=career_advisor 触发平台配置层
 */
export async function callCareerPlatformAI(
  systemPrompt: string,
  userMessage: string,
  options?: CareerAICallOptions
): Promise<string> {
  const input: V2Input = {
    systemPrompt,
    prompt: userMessage,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 4096,
  };

  const result = await executeViaGateway('llm', input, {
    userId: options?.userId,
    businessType: 'career_advisor',
  });

  return result.content || '';
}

/**
 * 简历分析 — AI 平台能力
 */
export async function analyzeResume(
  resumeText: string,
  userId?: string
): Promise<string> {
  const systemPrompt = `你是一位资深的简历分析师。请分析以下简历，提供：
1. 简历的优势和亮点
2. 需要改进的地方
3. 适合的岗位方向
4. 技能标签提取

请用中文回复，结构清晰，建议具体可操作。`;

  return callCareerPlatformAI(systemPrompt, resumeText, { userId, maxTokens: 4096 });
}

/**
 * 职业咨询 — AI 平台能力
 */
export async function careerConsultation(
  userQuestion: string,
  userBackground?: string,
  userId?: string
): Promise<string> {
  const systemPrompt = `你是一位资深的职业顾问。请根据用户的背景和问题，提供专业、实用的职业建议。
建议应包含：问题分析、可行方案、行动步骤、注意事项。

请用中文回复，结构清晰，建议具体可操作。`;

  const prompt = userBackground
    ? `用户背景：${userBackground}\n\n问题：${userQuestion}`
    : userQuestion;

  return callCareerPlatformAI(systemPrompt, prompt, { userId, maxTokens: 4096 });
}

/**
 * 面试问题生成 — AI 平台能力
 */
export async function generateInterviewQuestions(
  jobTitle: string,
  jobDescription?: string,
  userId?: string
): Promise<string> {
  const systemPrompt = `你是一位资深的面试官。请根据以下岗位信息，生成 5-8 个高质量的面试问题。
问题类型应包含：专业技能、行为面试、情景模拟、职业规划。
每个问题后附带评估要点。

请用中文回复。`;

  const prompt = jobDescription
    ? `岗位：${jobTitle}\n\n岗位职责：${jobDescription}`
    : `岗位：${jobTitle}`;

  return callCareerPlatformAI(systemPrompt, prompt, { userId, maxTokens: 4096 });
}

/**
 * 岗位匹配分析 — AI 平台能力
 */
export async function analyzeJobMatch(
  resumeText: string,
  jobDescription: string,
  userId?: string
): Promise<string> {
  const systemPrompt = `你是一位资深的招聘专家。请分析候选人简历与目标岗位的匹配度。
分析维度：
1. 技能匹配度（关键技能是否命中）
2. 经验匹配度（工作年限、行业经验）
3. 学历匹配度
4. 综合评分（1-10 分）
5. 优势与差距分析
6. 面试建议

请用中文回复，结构清晰，评分有理有据。`;

  const prompt = `候选人简历：\n${resumeText}\n\n目标岗位：\n${jobDescription}`;

  return callCareerPlatformAI(systemPrompt, prompt, { userId, maxTokens: 4096 });
}

export const careerAIProvider = {
  callLLM: callCareerPlatformAI,
  analyzeResume,
  careerConsultation,
  generateInterviewQuestions,
  analyzeJobMatch,
};
