// Enterprise Profile Service — 企业资料服务
// 管理企业身份、行业信息、品牌语调
// 这是 AI 数字部门的 Context 底座

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface CreateEnterpriseProfileInput {
  organizationId: string;
  industry?: string;
  businessSummary?: string;
  targetCustomer?: string;
  brandVoice?: string;
  website?: string;
  location?: string;
}

export interface UpdateEnterpriseProfileInput {
  industry?: string;
  businessSummary?: string;
  targetCustomer?: string;
  brandVoice?: string;
  website?: string;
  location?: string;
  onboardingStep?: number;
  onboardingDone?: boolean;
}

export class EnterpriseProfileService {

  /**
   * 获取或创建企业资料
   */
  async getOrCreate(organizationId: string) {
    let profile = await prisma.enterpriseProfile.findUnique({
      where: { organizationId },
      include: { organization: true },
    });

    if (!profile) {
      profile = await prisma.enterpriseProfile.create({
        data: { organizationId },
        include: { organization: true },
      });
    }

    return profile;
  }

  /**
   * 获取企业资料（含统计信息）
   */
  async getWithStats(organizationId: string) {
    const profile = await this.getOrCreate(organizationId);

    const [aiProviderCount, channelCount, agentCount] = await Promise.all([
      prisma.aIProviderConfig.count({
        where: { organizationId, enabled: true }
      }),
      prisma.enterpriseChannelAccount.count({
        where: { organizationId }
      }),
      prisma.enterpriseAgentProfile.count({
        where: { organizationId }
      })
    ]);

    return {
      ...profile,
      stats: {
        aiProviderCount,
        channelCount,
        agentCount,
      }
    };
  }

  /**
   * 创建或更新企业资料
   */
  async upsert(data: CreateEnterpriseProfileInput & UpdateEnterpriseProfileInput) {
    const { organizationId, ...rest } = data;

    return prisma.enterpriseProfile.upsert({
      where: { organizationId },
      create: { organizationId, ...rest },
      update: rest,
      include: { organization: true }
    });
  }

  /**
   * 更新企业资料
   */
  async update(organizationId: string, data: UpdateEnterpriseProfileInput) {
    return prisma.enterpriseProfile.update({
      where: { organizationId },
      data,
    });
  }

  /**
   * 推进 Onboarding 步骤
   */
  async advanceOnboarding(organizationId: string, step: number) {
    return prisma.enterpriseProfile.update({
      where: { organizationId },
      data: {
        onboardingStep: step,
        onboardingDone: step >= 6,
      }
    });
  }

  /**
   * 检查企业是否完成必需的初始化步骤
   */
  async getReadiness(organizationId: string) {
    const profile = await this.getOrCreate(organizationId);
    const [aiProviders, channels, agents] = await Promise.all([
      prisma.aIProviderConfig.count({ where: { organizationId, enabled: true } }),
      prisma.enterpriseChannelAccount.count({ where: { organizationId } }),
      prisma.enterpriseAgentProfile.count({ where: { organizationId } })
    ]);

    return {
      profile,
      readiness: {
        hasProfile: !!profile.industry && !!profile.businessSummary,
        hasAiProvider: aiProviders > 0,
        hasChannel: channels > 0,
        hasAgent: agents > 0,
        onboardingStep: profile.onboardingStep,
        onboardingDone: profile.onboardingDone,
        completionPercent: Math.round(
          ([!!profile.industry && !!profile.businessSummary, aiProviders > 0, channels > 0, agents > 0]
            .filter(Boolean).length / 4) * 100
        )
      }
    };
  }

  /**
   * 获取企业 AI Context — 汇总企业资料供 AI 理解
   */
  async getAiContext(organizationId: string) {
    const profile = await prisma.enterpriseProfile.findUnique({
      where: { organizationId },
      include: {
        organization: {
          select: { name: true, plan: true }
        }
      }
    });

    if (!profile) return null;

    return {
      companyName: profile.organization?.name,
      industry: profile.industry,
      business: profile.businessSummary,
      targetCustomer: profile.targetCustomer,
      brandVoice: profile.brandVoice,
      website: profile.website,
      location: profile.location,
      plan: profile.organization?.plan,
    };
  }
}

export const enterpriseProfileService = new EnterpriseProfileService();
