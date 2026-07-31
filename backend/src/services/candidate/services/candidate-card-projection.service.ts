// ============================================================
// CandidateCardProjectionService — 人才卡片投影服务
// 职责：从 Career Profile + Skill Graph 在读取时计算 Card 内容
// 设计原则：DP-P3-02 Card = Projection，不存储完整职业事实
//
// 核心逻辑：
//   1. 从 Career Profile 读取基本信息
//   2. 从 Skill Graph 计算技能标签
//   3. 从 Work Experience 计算工作年限
//   4. 根据 visibility + hiddenFields 过滤输出
// ============================================================

import { prisma } from '../../../utils/index.js';
import { candidateCardRepository } from '../repositories/candidate-card.repository.js';

export interface CardVisibilityContext {
  /** 查看者身份：owner（自己）、enterprise（企业）、public（匿名） */
  viewer: 'owner' | 'enterprise' | 'public';
  /** 查看者是否有权限查看完整信息 */
  hasFullAccess?: boolean;
}

export interface ProjectedCard {
  id: string;
  profileId: string;
  headline: string | null;
  summary: string | null;
  skillTags: string[];
  yearsExperience: number;
  currentCity: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  openToOpportunity: boolean;
  visibility: string;
  aiSummary: string | null;
  aiSummaryAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  // 可见性标记：哪些字段对当前查看者可见
  _visibleFields: string[];
  _hiddenFields: string[];
}

export interface CardSummary {
  totalYears: number;
  topSkills: string[];
  currentRole: string | null;
  educationLevel: string | null;
  careerHighlights: string[];
}

/**
 * 计算工作年限（从最早的工作经历开始）
 */
function calculateYearsExperience(workExperiences: any[]): number {
  if (!workExperiences || workExperiences.length === 0) return 0;

  let earliest: Date | null = null;
  for (const exp of workExperiences) {
    if (exp.startDate) {
      const start = new Date(exp.startDate);
      if (!earliest || start < earliest) {
        earliest = start;
      }
    }
  }

  if (!earliest) return 0;

  const now = new Date();
  const diffMs = now.getTime() - earliest.getTime();
  const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  return Math.max(0, years);
}

/**
 * 提取当前职位（最近一条未结束的工作经历）
 */
function extractCurrentRole(workExperiences: any[]): { company: string | null; title: string | null; city: string | null } {
  if (!workExperiences || workExperiences.length === 0) {
    return { company: null, title: null, city: null };
  }

  // 按开始时间倒序，找第一条未结束（或最近结束）的
  const sorted = [...workExperiences].sort((a, b) => {
    const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
    return bStart - aStart;
  });

  const current = sorted[0];
  return {
    company: current.company || null,
    title: current.title || null,
    city: current.location || null,
  };
}

/**
 * 提取最高学历
 */
function extractHighestEducation(educations: any[]): string | null {
  if (!educations || educations.length === 0) return null;

  const degreeOrder: Record<string, number> = {
    '博士': 5,
    '硕士': 4,
    '本科': 3,
    '大专': 2,
    '高中': 1,
  };

  let highest: any = null;
  let highestRank = 0;

  for (const edu of educations) {
    const rank = degreeOrder[edu.degree || ''] || 0;
    if (rank > highestRank) {
      highestRank = rank;
      highest = edu;
    }
  }

  return highest ? `${highest.school} · ${highest.degree}` : null;
}

/**
 * 生成技能标签（取置信度最高的前 10 个）
 */
function extractSkillTags(candidateSkills: any[]): string[] {
  if (!candidateSkills || candidateSkills.length === 0) return [];

  return candidateSkills
    .filter((cs: any) => cs.confidence === undefined || Number(cs.confidence) >= 0.5)
    .sort((a: any, b: any) => {
      const aConf = Number(a.confidence) || 0;
      const bConf = Number(b.confidence) || 0;
      return bConf - aConf;
    })
    .slice(0, 10)
    .map((cs: any) => cs.skill?.name || cs.skillName || '')
    .filter(Boolean);
}

/**
 * 根据可见性规则过滤字段
 */
function applyVisibilityFilter(
  card: Record<string, any>,
  hiddenFields: string[],
  context: CardVisibilityContext
): { visibleCard: Record<string, any>; visibleFields: string[]; hiddenFields: string[] } {
  const allFields = [
    'headline', 'summary', 'skillTags', 'yearsExperience',
    'currentCity', 'currentCompany', 'currentTitle',
    'aiSummary', 'viewCount',
  ];

  const visibleFields: string[] = [];
  const actuallyHidden: string[] = [];
  const result: Record<string, any> = {};

  for (const field of allFields) {
    const isHidden = hiddenFields.includes(field);
    const isOwner = context.viewer === 'owner';

    // Owner 始终可见所有字段
    if (isOwner) {
      result[field] = card[field];
      visibleFields.push(field);
    }
    // 非 owner 且被隐藏
    else if (isHidden) {
      actuallyHidden.push(field);
      result[field] = null;
    }
    // 非 owner 且未隐藏
    else {
      result[field] = card[field];
      visibleFields.push(field);
    }
  }

  // 保留系统字段
  result.id = card.id;
  result.profileId = card.profileId;
  result.openToOpportunity = card.openToOpportunity;
  result.visibility = card.visibility;
  result.viewCount = card.viewCount;
  result.lastViewedAt = card.lastViewedAt;

  return { visibleCard: result, visibleFields, hiddenFields: actuallyHidden };
}

// ============================================================
// 公开接口
// ============================================================

export const candidateCardProjectionService = {
  /**
   * 投影 Card：从 Career Profile + 关联数据计算完整 Card
   * 这是核心方法——所有 Card 读取都走这里
   */
  async projectCard(profileId: string): Promise<{
    profile: any;
    workExperiences: any[];
    educations: any[];
    candidateSkills: any[];
    card: any;
  }> {
    // 1. 读取 Career Profile
    const profile = await prisma.careerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new Error(`Career Profile not found: ${profileId}`);
    }

    // 2. 读取关联数据
    const [workExperiences, educations, candidateSkills] = await Promise.all([
      prisma.workExperience.findMany({
        where: { profileId },
        orderBy: { startDate: 'desc' },
      }),
      prisma.education.findMany({
        where: { profileId },
        orderBy: { startDate: 'desc' },
      }),
      prisma.candidateSkill.findMany({
        where: { profileId },
        include: { skill: true },
        orderBy: { confidence: 'desc' },
      }),
    ]);

    // 3. 读取或创建 Card
    let card = await prisma.candidateCard.findUnique({
      where: { profileId },
    });

    if (!card) {
      card = await prisma.candidateCard.create({
        data: {
          profileId,
          visibility: 'private',
          skillTags: [],
          hiddenFields: [],
        },
      });
    }

    // 4. Sprint-10D T05: 仅复制，不计算
    // 直接从 CareerProfile 读取 SSOT 字段，不通过 workExperience 自算
    const yearsExperience = profile.yearsExperience || 0;
    const currentRole = {
      company: profile.headline ? null : (workExperiences[0]?.company || null),
      title: (workExperiences[0]?.title || null),
      city: (workExperiences[0]?.location || null),
    };
    const skillTags = extractSkillTags(candidateSkills);

    // 5. 自动同步计算值到 Card（仅更新计算字段，不覆盖用户自定义字段）
    const shouldUpdateCard =
      card.yearsExperience !== yearsExperience ||
      JSON.stringify(card.skillTags) !== JSON.stringify(skillTags) ||
      card.currentCompany !== currentRole.company ||
      card.currentTitle !== currentRole.title ||
      card.currentCity !== currentRole.city ||
      card.headline !== profile.headline ||
      card.openToOpportunity !== profile.openToOpportunity;

    if (shouldUpdateCard) {
      card = await prisma.candidateCard.update({
        where: { profileId },
        data: {
          yearsExperience,
          skillTags,
          currentCompany: currentRole.company,
          currentTitle: currentRole.title,
          currentCity: currentRole.city,
          headline: profile.headline,
          openToOpportunity: profile.openToOpportunity,
        },
      });
    }

    return { profile, workExperiences, educations, candidateSkills, card };
  },

  /**
   * 获取 Card（带可见性过滤）
   */
  async getCard(profileId: string, context: CardVisibilityContext): Promise<ProjectedCard> {
    const { card } = await this.projectCard(profileId);

    const { visibleCard, visibleFields, hiddenFields: actuallyHidden } = applyVisibilityFilter(
      card as Record<string, any>,
      card.hiddenFields || [],
      context,
    );

    return {
      ...visibleCard,
      _visibleFields: visibleFields,
      _hiddenFields: actuallyHidden,
    } as ProjectedCard;
  },

  /**
   * 生成 Card 摘要（供 AI 使用）
   */
  async generateSummary(profileId: string): Promise<CardSummary> {
    const { profile, workExperiences, educations, candidateSkills } = await this.projectCard(profileId);

    // Sprint-10D T05: 从 Profile 读取 SSOT 值，不通过 workExperience 自算
    const totalYears = profile.yearsExperience || calculateYearsExperience(workExperiences);
    const currentRole = extractCurrentRole(workExperiences);
    const educationLevel = extractHighestEducation(educations);

    // Top skills（置信度 >= 0.7）
    const topSkills = (candidateSkills || [])
      .filter((cs: any) => Number(cs.confidence) >= 0.7)
      .slice(0, 5)
      .map((cs: any) => cs.skill?.name || '')
      .filter(Boolean);

    // Career highlights：从工作经历中提取关键信息
    const careerHighlights: string[] = [];
    if (currentRole.title && currentRole.company) {
      careerHighlights.push(`现任 ${currentRole.company} ${currentRole.title}`);
    }
    if (totalYears > 0) {
      careerHighlights.push(`${totalYears} 年工作经验`);
    }
    if (educationLevel) {
      careerHighlights.push(educationLevel);
    }

    return {
      totalYears,
      topSkills,
      currentRole: currentRole.title ? `${currentRole.title} @ ${currentRole.company}` : null,
      educationLevel,
      careerHighlights,
    };
  },

  /**
   * 记录浏览（企业查看 Card 时调用）
   */
  async recordView(profileId: string): Promise<void> {
    await candidateCardRepository.recordView(profileId);
  },

  /**
   * 刷新 Card 投影（Career Profile 变更后调用）
   */
  async refreshProjection(profileId: string): Promise<void> {
    // 重新触发投影计算
    await this.projectCard(profileId);
  },
};
