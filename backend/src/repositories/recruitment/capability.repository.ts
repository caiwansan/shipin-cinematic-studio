/**
 * CapabilityRepository — 权限能力查询
 * 
 * 架构规则（P1 Frozen）：
 * - 只关心"有没有这个 Capability"，不关心"为什么有"
 * - 不判断套餐名称（Free/Pro/Team），只处理 Capability 与授权结果
 * - 未来赠送/活动/管理员授权/Enterprise License 只需新增 CapabilityGrant 来源
 * 
 * 规范来源：P1-Capability-Model-v1.0（FROZEN）
 */

import { PrismaClient } from '@prisma/client';

export interface CapabilityCheckResult {
  granted: boolean;
  planId?: string;
  limits?: Record<string, number> | null;
}

export interface GrantedCapability {
  capability: string;
  planId: string;
  limits?: Record<string, number> | null;
}

export class CapabilityRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * 检查租户是否拥有指定 Capability
   * 自动选择当前 active 的 Subscription
   */
  async hasCapability(tenantId: string, capability: string): Promise<CapabilityCheckResult> {
    const grant = await this.findGrant(tenantId, capability);
    if (!grant) {
      return { granted: false };
    }
    return {
      granted: true,
      planId: grant.planId,
      limits: grant.limits,
    };
  }

  /**
   * 获取租户的所有已授权 Capability 列表
   */
  async getGrantedCapabilities(tenantId: string): Promise<GrantedCapability[]> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: 'active',
      },
      include: {
        plan: {
          include: {
            grants: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription?.plan?.grants) {
      return [];
    }

    return subscription.plan.grants.map((grant) => ({
      capability: grant.capability,
      planId: grant.planId,
      limits: grant.limits ? JSON.parse(grant.limits) : null,
    }));
  }

  /**
   * 记录 Capability 使用情况（第一版只记录，不限流）
   */
  async recordUsage(params: {
    tenantId: string;
    capability: string;
    amount?: number;
    unit?: string;
    source?: string;
    sourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.usageRecord.create({
      data: {
        tenantId: params.tenantId,
        resourceType: 'capability',
        amount: params.amount ?? 1,
        unit: params.unit ?? 'count',
        capability: params.capability,
        source: params.source ?? 'api',
        sourceId: params.sourceId ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  }

  /**
   * 获取剩余配额（预留接口，第一版返回无限）
   * 后续接入配额策略时实现
   */
  async getRemainingQuota(tenantId: string, capability: string): Promise<number | null> {
    const check = await this.hasCapability(tenantId, capability);
    if (!check.granted) {
      return 0;
    }
    if (!check.limits?.maxCount) {
      return null; // null = 无限
    }
    // 第一版不实现精确计数，返回 null（无限）
    // 后续：查询 UsageRecord 统计当月用量
    return null;
  }

  /**
   * 内部方法：查找 CapabilityGrant
   */
  private async findGrant(
    tenantId: string,
    capability: string
  ): Promise<{ planId: string; limits: Record<string, number> | null } | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: 'active',
      },
      include: {
        plan: {
          include: {
            grants: {
              where: { capability },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const grant = subscription?.plan?.grants?.[0];
    if (!grant) {
      return null;
    }

    return {
      planId: grant.planId,
      limits: grant.limits ? JSON.parse(grant.limits) : null,
    };
  }
}
