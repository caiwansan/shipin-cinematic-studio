// ============================================================
// JobUnderstandingService — JD 结构化引擎
// 职责：将非结构化 JD → 结构化 JobRequirementProfile
// 红线：LLM 只提取，不决策；不修改 Candidate Domain；不生成 Match Score
// ============================================================

import { prisma } from '../../../utils/index.js';
import { modelRouter } from '../../enterprise/model-router.service.js';
import { callLLM, parseLLMJson, type LLMConfig } from '../../hdz/llm.client.js';
import { jobRequirementRepository } from '../repositories/job-requirement.repository.js';
import {
  validateAndNormalize,
  type ExtractedRequirement,
  type ValidationResult,
} from '../validators/job-understanding.validator.js';

// ── 输入类型 ──

export interface JobUnderstandingInput {
  enterpriseId: string;
  jobTitle: string;
  jobDescription: string;
  department?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType?: string;
  language?: 'zh' | 'en';
}

// ── 输出类型 ──

export interface JobUnderstandingResult {
  id: string;
  status: string;
  extracted: {
    requiredSkills: any[];
    preferredSkills: any[];
    experienceMin: number;
    experienceMax?: number;
    educationMin?: string;
    preferredMajors?: string[];
    industries: string[];
    employmentType?: string;
    remoteOption?: string;
    weights?: any;
  };
  extractionConfidence: number;
  modelUsed: string;
  warnings: string[];
  createdAt: string;
}

// ── Singleton ──

export const jobUnderstandingService = {
  /**
   * 主入口：从 JD 提取结构化要求并持久化
   */
  async extractAndSave(input: JobUnderstandingInput): Promise<JobUnderstandingResult> {
    // 1. 输入校验
    validateInput(input);

    // 2. 技能标准化（从 Skill 词表）
    const skillNormalizer = await createSkillNormalizer();

    // 3. 通过 Model Router 获取 LLM 配置
    const llmConfig = await resolveLLMConfig(input.enterpriseId);
    if (!llmConfig) {
      throw new JobUnderstandingError('LLM 未配置，无法解析 JD', 503);
    }

    // 4. LLM 提取
    let extracted: ExtractedRequirement;
    let modelUsed = 'unknown';
    let warnings: string[] = [];

    try {
      const rawOutput = await callLLM(llmConfig, buildSystemPrompt(input.language), buildUserPrompt(input), {
        maxTokens: 2048,
        temperature: 0.2,
      });

      const parsed = parseLLMJson(rawOutput);
      modelUsed = `${llmConfig.provider}/${llmConfig.modelName}`;

      // 5. 校验 + 标准化
      const validation: ValidationResult = validateAndNormalize(parsed);
      if (!validation.valid) {
        throw new JobUnderstandingError(
          `JD 解析结果校验失败: ${validation.errors.join('; ')}`,
          422,
        );
      }
      warnings = validation.warnings;
      extracted = normalizeSkillNames(validation.normalized!, skillNormalizer);
    } catch (e: any) {
      if (e instanceof JobUnderstandingError) throw e;

      // 重试一次
      console.warn(`[JobUnderstanding] LLM 提取失败，重试: ${e.message}`);
      try {
        const rawOutput = await callLLM(llmConfig, buildSystemPrompt(input.language), buildUserPrompt(input), {
          maxTokens: 2048,
          temperature: 0.1, // 更低温度
        });
        const parsed = parseLLMJson(rawOutput);
        modelUsed = `${llmConfig.provider}/${llmConfig.modelName}`;
        const validation = validateAndNormalize(parsed);
        if (!validation.valid) {
          throw new JobUnderstandingError(
            `JD 解析结果校验失败（重试）: ${validation.errors.join('; ')}`,
            422,
          );
        }
        warnings = validation.warnings;
        extracted = normalizeSkillNames(validation.normalized!, skillNormalizer);
      } catch (retryErr: any) {
        if (retryErr instanceof JobUnderstandingError) throw retryErr;
        throw new JobUnderstandingError(`JD 解析失败: ${retryErr.message}`, 502);
      }
    }

    // 6. 持久化
    const profile = await jobRequirementRepository.create({
      enterpriseId: input.enterpriseId,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription ?? null,
      requiredSkills: extracted.requiredSkills as any,
      preferredSkills: (extracted.preferredSkills || []) as any,
      experienceMin: extracted.experienceMin,
      experienceMax: extracted.experienceMax ?? null,
      educationMin: extracted.educationMin ?? null,
      preferredMajors: extracted.preferredMajors || [],
      industries: extracted.industries,
      employmentType: extracted.employmentType ?? null,
      location: input.location ?? null,
      remoteOption: extracted.remoteOption ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      weights: extracted.weights as any,
    });

    return {
      id: profile.id,
      status: 'ai_extracted',
      extracted: {
        requiredSkills: profile.requiredSkills,
        preferredSkills: profile.preferredSkills,
        experienceMin: profile.experienceMin,
        experienceMax: profile.experienceMax || undefined,
        educationMin: profile.educationMin || undefined,
        preferredMajors: profile.preferredMajors,
        industries: profile.industries,
        employmentType: profile.employmentType || undefined,
        remoteOption: profile.remoteOption || undefined,
        weights: profile.weights,
      },
      extractionConfidence: extracted.extractionConfidence,
      modelUsed,
      warnings,
      createdAt: profile.createdAt ?? new Date().toISOString(),
    };
  },

  /**
   * 校验模式：只提取不持久化
   */
  async extractOnly(input: Partial<JobUnderstandingInput> & { jobTitle: string; jobDescription: string }): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    extracted: ExtractedRequirement | null;
  }> {
    if (!input.jobTitle || input.jobTitle.trim().length === 0) {
      throw new JobUnderstandingError('jobTitle 不能为空', 400);
    }
    if (!input.jobDescription || input.jobDescription.trim().length < 50) {
      throw new JobUnderstandingError('jobDescription 至少需要 50 字符', 400);
    }

    const llmConfig = await resolveLLMConfig(input.enterpriseId ?? '');
    if (!llmConfig) {
      throw new JobUnderstandingError('LLM 未配置，无法解析 JD', 503);
    }

    const skillNormalizer = await createSkillNormalizer();

    const rawOutput = await callLLM(llmConfig, buildSystemPrompt(input.language), buildUserPrompt(input), {
      maxTokens: 2048,
      temperature: 0.2,
    });

    const parsed = parseLLMJson(rawOutput);
    const validation = validateAndNormalize(parsed);

    return {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      extracted: normalizeSkillNames(validation.normalized, skillNormalizer),
    };
  },

  /**
   * 获取技能词表（前端辅助）
   */
  async getSkillVocabulary(): Promise<Array<{ name: string; category: string | null; aliases: string[] }>> {
    const skills = await prisma.skill.findMany({
      select: { name: true, category: true, aliases: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return skills;
  },
};

// ── 内部函数 ──

function validateInput(input: JobUnderstandingInput): void {
  if (!input.jobTitle || input.jobTitle.trim().length === 0) {
    throw new JobUnderstandingError('jobTitle 不能为空', 400);
  }
  if (input.jobTitle.length > 100) {
    throw new JobUnderstandingError('jobTitle 过长（<= 100 字符）', 400);
  }
  if (!input.jobDescription || input.jobDescription.trim().length < 50) {
    throw new JobUnderstandingError('jobDescription 至少需要 50 字符', 400);
  }
  if (!input.enterpriseId) {
    throw new JobUnderstandingError('enterpriseId 不能为空', 400);
  }
}

async function resolveLLMConfig(enterpriseId: string): Promise<LLMConfig | null> {
  if (!enterpriseId) return null;
  try {
    const routeResult = await modelRouter.resolve({
      tenantId: enterpriseId,
      agentType: 'talent_matching',
      taskType: 'explanation',
    });
    if (!routeResult) return null;
    return modelRouter.toLLMConfig(routeResult);
  } catch (e: any) {
    console.warn(`[JobUnderstanding] Model Router failed: ${e.message}`);
    return null;
  }
}

type SkillNormalizer = (name: string) => string;

async function createSkillNormalizer(): Promise<SkillNormalizer> {
  const skills = await prisma.skill.findMany({
    select: { name: true, aliases: true },
  });

  // 构建查找表：alias → canonical name
  const aliasMap = new Map<string, string>();
  for (const skill of skills) {
    // name 自身也是查找键
    aliasMap.set(skill.name.toLowerCase(), skill.name);
    for (const alias of skill.aliases) {
      aliasMap.set(alias.toLowerCase(), skill.name);
    }
  }

  return (name: string): string => {
    const key = name.toLowerCase().trim();
    // 精确匹配
    if (aliasMap.has(key)) return aliasMap.get(key)!;
    // 包含匹配：找最短的 canonical name 包含输入
    let bestMatch: string | null = null;
    for (const [alias, canonical] of aliasMap) {
      if (alias.includes(key) || key.includes(alias)) {
        if (!bestMatch || canonical.length < bestMatch.length) {
          bestMatch = canonical;
        }
      }
    }
    return bestMatch || name; // 找不到就保留原始名称
  };
}

function normalizeSkillNames(
  extracted: ExtractedRequirement | null,
  normalizer: SkillNormalizer,
): ExtractedRequirement {
  if (!extracted) return extracted!;
  return {
    ...extracted,
    requiredSkills: extracted.requiredSkills.map((s) => ({
      ...s,
      name: normalizer(s.name),
    })),
    preferredSkills: (extracted.preferredSkills || []).map((s) => ({
      ...s,
      name: normalizer(s.name),
    })),
  };
}

function buildSystemPrompt(language?: 'zh' | 'en'): string {
  const lang = language || 'zh';
  if (lang === 'en') {
    return `You are a senior HR expert. Extract structured job requirements from JD text.

## Rules
1. Only extract explicitly mentioned requirements from the JD. No fabrication.
2. Use standard skill names (e.g., "JavaScript" not "JS").
3. Extract experience years as numbers. Conservative estimates for vague phrases.
4. Extract only explicitly stated minimum education.
5. Extract only explicitly mentioned industries.
6. If a field is absent in the JD, do not fabricate it.

## Output Format
Strictly JSON, no extra text:
{
  "requiredSkills": [{ "name": "skill", "level": "expert|proficient|intermediate|beginner", "yearsRequired": 3 }],
  "preferredSkills": [{ "name": "skill", "level": "expert|proficient|intermediate|beginner" }],
  "experienceMin": 3,
  "experienceMax": 5,
  "educationMin": "bachelor",
  "preferredMajors": ["Computer Science"],
  "industries": ["Internet"],
  "employmentType": "full_time",
  "remoteOption": "hybrid",
  "weights": { "skill": 40, "experience": 30, "education": 15, "career": 15 },
  "extractionConfidence": 0.9
}`;
  }

  return `你是一名资深 HR 专家。从 JD 文本中提取结构化的岗位要求。

## 规则
1. 只提取 JD 中明确提及的要求，禁止臆测
2. 技能名称使用标准技术名词（如 "JavaScript" 而非 "JS"）
3. 经验年限：明确数字提取，模糊表述保守估计
4. 学历要求：只提取明确标注的最低学历
5. 行业：只提取明确提及的行业
6. 如果 JD 中某项信息不存在，不要编造

## 输出格式
严格按照 JSON 格式输出，不要包含任何额外文本：
{
  "requiredSkills": [{ "name": "技能名", "level": "expert|proficient|intermediate|beginner", "yearsRequired": 3 }],
  "preferredSkills": [{ "name": "技能名", "level": "expert|proficient|intermediate|beginner" }],
  "experienceMin": 3,
  "experienceMax": 5,
  "educationMin": "bachelor",
  "preferredMajors": ["计算机科学"],
  "industries": ["互联网"],
  "employmentType": "full_time",
  "remoteOption": "hybrid",
  "weights": { "skill": 40, "experience": 30, "education": 15, "career": 15 },
  "extractionConfidence": 0.9
}

## 枚举值说明
- level: expert(精通) | proficient(熟练) | intermediate(一般) | beginner(了解)
- educationMin: high_school | associate | bachelor | master | doctorate
- employmentType: full_time | part_time | contract | internship
- remoteOption: onsite | hybrid | remote`;
}

function buildUserPrompt(input: JobUnderstandingInput | any): string {
  const parts: string[] = [];

  parts.push('## 职位名称');
  parts.push(input.jobTitle);
  parts.push('');

  parts.push('## JD 文本');
  parts.push(input.jobDescription);
  parts.push('');

  const extras: string[] = [];
  if (input.department) extras.push(`- 部门：${input.department}`);
  if (input.location) extras.push(`- 工作地点：${input.location}`);
  if (input.salaryMin || input.salaryMax) {
    extras.push(`- 薪资范围：${input.salaryMin || '?'} - ${input.salaryMax || '?'}`);
  }
  if (input.employmentType) extras.push(`- 雇佣类型：${input.employmentType}`);

  if (extras.length > 0) {
    parts.push('## 补充信息');
    parts.push(...extras);
    parts.push('');
  }

  parts.push('请从以上 JD 中提取岗位要求，按 JSON 格式输出。');
  return parts.join('\n');
}

// ── 自定义错误 ──

export class JobUnderstandingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'JobUnderstandingError';
    this.statusCode = statusCode;
  }
}
