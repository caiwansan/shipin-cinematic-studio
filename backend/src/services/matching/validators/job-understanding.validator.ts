// ============================================================
// JobUnderstandingValidator — JD 提取结果校验
// 职责：验证 LLM 输出的结构化要求是否符合 Schema
// 红线：不修改分数、不判断候选人与否匹配
// ============================================================

export interface ExtractedSkill {
  name: string;
  level?: 'expert' | 'proficient' | 'intermediate' | 'beginner';
  yearsRequired?: number;
}

export interface ExtractedRequirement {
  requiredSkills: ExtractedSkill[];
  preferredSkills: ExtractedSkill[];
  experienceMin: number;
  experienceMax?: number;
  educationMin?: string;
  preferredMajors?: string[];
  industries: string[];
  employmentType?: string;
  remoteOption?: 'onsite' | 'hybrid' | 'remote';
  weights?: {
    skill: number;
    experience: number;
    education: number;
    career: number;
  };
  extractionConfidence: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized: ExtractedRequirement | null;
}

const VALID_EDUCATION = ['high_school', 'associate', 'bachelor', 'master', 'doctorate'];
const VALID_EMPLOYMENT = ['full_time', 'part_time', 'contract', 'internship'];
const VALID_REMOTE = ['onsite', 'hybrid', 'remote'];
const VALID_LEVELS = ['expert', 'proficient', 'intermediate', 'beginner'];

/**
 * 校验 + 标准化 LLM 提取结果
 */
export function validateAndNormalize(input: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['LLM 输出不是有效 JSON 对象'], warnings: [], normalized: null };
  }

  // ── 1. requiredSkills ──
  let requiredSkills: ExtractedSkill[] = [];
  if (!Array.isArray(input.requiredSkills)) {
    errors.push('requiredSkills 必须是数组');
  } else if (input.requiredSkills.length === 0) {
    errors.push('requiredSkills 不能为空（JD 必须包含至少一项必需技能）');
  } else {
    requiredSkills = input.requiredSkills
      .filter((s: any) => s && typeof s.name === 'string' && s.name.trim().length > 0)
      .map((s: any) => normalizeSkill(s))
      .filter(Boolean);
    if (requiredSkills.length === 0) {
      errors.push('requiredSkills 中无有效技能（所有项 name 为空）');
    }
    if (requiredSkills.length !== input.requiredSkills.length) {
      warnings.push(`requiredSkills 过滤了 ${input.requiredSkills.length - requiredSkills.length} 个无效项`);
    }
  }

  // ── 2. preferredSkills ──
  let preferredSkills: ExtractedSkill[] = [];
  if (input.preferredSkills !== undefined && input.preferredSkills !== null) {
    if (!Array.isArray(input.preferredSkills)) {
      warnings.push('preferredSkills 不是数组，忽略');
    } else {
      preferredSkills = input.preferredSkills
        .filter((s: any) => s && typeof s.name === 'string' && s.name.trim().length > 0)
        .map((s: any) => normalizeSkill(s))
        .filter(Boolean);
    }
  }

  // ── 3. experienceMin ──
  let experienceMin = 0;
  if (input.experienceMin !== undefined && input.experienceMin !== null) {
    const n = Number(input.experienceMin);
    if (isNaN(n) || n < 0) {
      warnings.push(`experienceMin 无效 (${input.experienceMin})，设为 0`);
      experienceMin = 0;
    } else {
      experienceMin = Math.floor(n);
    }
  }

  // ── 4. experienceMax ──
  let experienceMax: number | undefined;
  if (input.experienceMax !== undefined && input.experienceMax !== null) {
    const n = Number(input.experienceMax);
    if (isNaN(n) || n < 0) {
      warnings.push(`experienceMax 无效 (${input.experienceMax})，忽略`);
    } else {
      experienceMax = Math.floor(n);
      if (experienceMax < experienceMin) {
        warnings.push(`experienceMax (${experienceMax}) < experienceMin (${experienceMin})，设为 experienceMin`);
        experienceMax = experienceMin;
      }
    }
  }

  // ── 5. educationMin ──
  let educationMin: string | undefined;
  if (input.educationMin) {
    const val = String(input.educationMin).toLowerCase();
    if (VALID_EDUCATION.includes(val)) {
      educationMin = val;
    } else {
      // 尝试映射中文
      const mapped = mapEducation(val);
      if (mapped) {
        educationMin = mapped;
      } else {
        warnings.push(`educationMin 不在枚举内 (${input.educationMin})，忽略`);
      }
    }
  }

  // ── 6. preferredMajors ──
  let preferredMajors: string[] | undefined;
  const rawPreferredMajors = input.preferredMajors;
  if (Array.isArray(rawPreferredMajors)) {
    preferredMajors = rawPreferredMajors.filter((m: any) => typeof m === 'string' && m.trim().length > 0);
    if (preferredMajors.length === 0) preferredMajors = undefined;
  } else if (rawPreferredMajors !== undefined && rawPreferredMajors !== null) {
    warnings.push('preferredMajors 不是数组，忽略');
  }

  // ── 7. industries ──
  let industries: string[] = [];
  if (Array.isArray(input.industries)) {
    industries = input.industries.filter((i: any) => typeof i === 'string' && i.trim().length > 0);
  } else if (input.industries) {
    warnings.push('industries 不是数组，忽略');
  }

  // ── 8. employmentType ──
  let employmentType: string | undefined;
  if (input.employmentType) {
    const val = String(input.employmentType).toLowerCase();
    if (VALID_EMPLOYMENT.includes(val)) {
      employmentType = val;
    } else {
      warnings.push(`employmentType 不在枚举内 (${input.employmentType})，忽略`);
    }
  }

  // ── 9. remoteOption ──
  let remoteOption: 'onsite' | 'hybrid' | 'remote' | undefined;
  if (input.remoteOption) {
    const val = String(input.remoteOption).toLowerCase();
    if (VALID_REMOTE.includes(val)) {
      remoteOption = val as 'onsite' | 'hybrid' | 'remote';
    } else {
      warnings.push(`remoteOption 不在枚举内 (${input.remoteOption})，忽略`);
    }
  }

  // ── 10. weights ──
  let weights: { skill: number; experience: number; education: number; career: number } | undefined;
  if (input.weights && typeof input.weights === 'object') {
    const w = input.weights;
    const skill = Number(w.skill) || 40;
    const experience = Number(w.experience) || 30;
    const education = Number(w.education) || 15;
    const career = Number(w.career) || 15;
    const total = skill + experience + education + career;
    if (total !== 100) {
      weights = { skill: 40, experience: 30, education: 15, career: 15 };
      warnings.push(`weights 总和 ${total} ≠ 100，使用默认值`);
    } else {
      weights = { skill, experience, education, career };
    }
  } else {
    weights = { skill: 40, experience: 30, education: 15, career: 15 };
  }

  // ── 11. extractionConfidence ──
  let extractionConfidence = 0.8;
  if (input.extractionConfidence !== undefined && input.extractionConfidence !== null) {
    const c = Number(input.extractionConfidence);
    if (!isNaN(c) && c >= 0 && c <= 1) {
      extractionConfidence = c;
    }
  }

  const normalized: ExtractedRequirement = {
    requiredSkills,
    preferredSkills,
    experienceMin,
    experienceMax,
    educationMin,
    preferredMajors,
    industries,
    employmentType,
    remoteOption,
    weights,
    extractionConfidence,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized,
  };
}

/**
 * 标准化单个技能项
 */
function normalizeSkill(s: any): ExtractedSkill | null {
  if (!s || typeof s.name !== 'string') return null;
  const name = s.name.trim();
  if (name.length === 0) return null;

  const result: ExtractedSkill = { name };

  if (s.level) {
    const level = String(s.level).toLowerCase();
    if (VALID_LEVELS.includes(level)) {
      result.level = level as any;
    }
  }

  if (s.yearsRequired !== undefined && s.yearsRequired !== null) {
    const y = Number(s.yearsRequired);
    if (!isNaN(y) && y >= 0) {
      result.yearsRequired = Math.floor(y);
    }
  }

  return result;
}

/**
 * 中文学历 → 英文枚举
 */
function mapEducation(val: string): string | undefined {
  const map: Record<string, string> = {
    '高中': 'high_school',
    '中专': 'high_school',
    '大专': 'associate',
    '专科': 'associate',
    '本科': 'bachelor',
    '学士': 'bachelor',
    '硕士': 'master',
    '研究生': 'master',
    '博士': 'doctorate',
  };
  return map[val];
}
