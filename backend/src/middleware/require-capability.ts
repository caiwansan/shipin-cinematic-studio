/**
 * middleware/require-capability.ts — Capability 权限校验中间件
 * 
 * 责任链（P1 Frozen）：
 *   Request → requireAuth → requireTenant → requireCapability → Business Handler
 * 
 * 架构规则：
 * - Business Logic 禁止自行判断套餐等级
 * - CapabilityRepository 只关心"有没有"，不关心"为什么有"
 * 
 * 规范来源：P1-Capability-Model-v1.0（FROZEN）
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { CapabilityRepository } from '../repositories/recruitment/capability.repository.js';
import { getEnterpriseContext } from '../repositories/recruitment/enterprise-member.repository.js';
import { prisma } from '../utils/index.js';

/**
 * Capability 拒绝错误
 */
export class CapabilityDeniedError extends Error {
  public readonly statusCode = 403;
  constructor(public readonly capability: string) {
    super(`Capability denied: ${capability}`);
    this.name = 'CapabilityDeniedError';
  }
}

/**
 * 从 request 获取 tenantId
 * 优先从 JWT payload 获取，其次从 OrgMember 关联获取
 */
async function resolveTenantId(request: FastifyRequest): Promise<string | null> {
  // 1. 尝试从 JWT payload 直接获取
  const user = request.user as any;
  if (user?.tenantId) return user.tenantId;
  if (user?.enterpriseId) return user.enterpriseId;

  // 2. 通过 OrgMember 关联获取
  if (user?.id) {
    const ctx = await getEnterpriseContext(user.id);
    if (ctx?.enterpriseId) return ctx.enterpriseId;
  }

  return null;
}

/**
 * requireCapability 中间件工厂
 * @param capability 需要的 Capability 代码
 */
export function requireCapability(capability: string) {
  const repo = new CapabilityRepository(prisma);

  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // 1. 确认用户已认证（requireAuth 应已先执行）
    const user = request.user as any;
    if (!user?.id) {
      reply.status(401).send({ error: '未认证', message: '请先登录' });
      return;
    }

    // 2. 解析 tenantId
    const tenantId = await resolveTenantId(request);
    if (!tenantId) {
      // 无企业上下文 → 检查是否是 Constitution 免费能力（不需要租户）
      reply.status(403).send({
        capability,
        error: '无企业上下文',
        message: '请先加入或创建一个企业',
      });
      return;
    }

    // 3. 检查 Capability
    const result = await repo.hasCapability(tenantId, capability);
    if (!result.granted) {
      reply.status(403).send({
        capability,
        error: '能力未授权',
        message: '当前套餐不支持此功能，请升级套餐',
        upgradeUrl: '/workspace/enterprise/billing',
      });
      return;
    }

    // 4. 记录使用情况（异步，不阻塞请求）
    repo.recordUsage({
      tenantId,
      capability,
      source: `${request.method} ${request.url}`,
      sourceId: user.id,
    }).catch(() => {}); // 静默失败，不影响业务

    // 5. 将 capability 信息挂载到 request 供后续使用
    (request as any).capabilityContext = {
      tenantId,
      capability,
      planId: result.planId,
      limits: result.limits,
    };
  };
}

/**
 * requireTenant 中间件
 * 确保请求携带有效的企业上下文
 */
export async function requireTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.user as any;
  if (!user?.id) {
    reply.status(401).send({ error: '未认证', message: '请先登录' });
    return;
  }

  const tenantId = await resolveTenantId(request);
  if (!tenantId) {
    reply.status(403).send({
      error: '无企业上下文',
      message: '请先加入或创建一个企业',
    });
    return;
  }

  (request as any).tenantId = tenantId;
  (request as any).enterpriseContext = await getEnterpriseContext(user.id);
}
