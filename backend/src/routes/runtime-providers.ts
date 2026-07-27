/**
 * routes/runtime-providers.ts
 * Runtime Provider Health Check API
 *
 * Sprint 2.2.4 Patch-A
 * 目的：提前发现 Provider 配置问题，避免 Agent 执行时才发现不可用
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../utils/index.js';
import { ProviderCredentialResolverImpl } from '../agent-runtime/gateway/credential-resolver.service.js';

/**
 * Phase 3.1.1 P0-4: Tenant Guard for Provider Routes
 */
async function providerTenantGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    const decoded = request.user as any;
    
    // 单设备登录检查
    if (decoded && decoded.id && decoded.tokenVersion !== undefined) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true },
      });
      if (dbUser && dbUser.tokenVersion !== decoded.tokenVersion) {
        reply.status(401).send({ error: '未授权', message: '账号已在其他设备登录，请重新登录' });
        return;
      }
    }

    // Tenant 隔离检查
    const targetOrgId = (request.headers['x-organization-id'] as string) || '';
    if (targetOrgId && decoded?.id) {
      const { getOrganizationIdForUser } = await import('../services/enterprise/organization/identity-bootstrap.service.js');
      const userOrgId = await getOrganizationIdForUser(decoded.id);
      
      if (userOrgId && userOrgId !== targetOrgId && decoded.role !== 'admin') {
        reply.status(403).send({ 
          error: 'Forbidden', 
          message: '跨组织访问被拒绝'
        });
        return;
      }
    }
  } catch (err: any) {
    if (!reply.sent) {
      reply.status(401).send({ error: '未授权', message: 'token 无效或已过期' });
    }
    return;
  }
}

interface ProviderHealth {
  provider: string;
  model: string;
  status: 'healthy' | 'invalid_key' | 'missing_key' | 'quota_exceeded' | 'unknown';
  lastCheck: string;
  message?: string;
}

export default async function runtimeProviderRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/runtime/providers/health
   * Provider 健康检查
   */
  fastify.get('/api/runtime/providers/health', { preHandler: providerTenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const organizationId = request.headers['x-organization-id'] as string;
      if (!organizationId) {
        return reply.status(400).send({ success: false, error: 'Missing X-Organization-Id header' });
      }

      // Phase 3.1.3-A: 使用 Credential Resolver 读取 Provider
      const resolver = new ProviderCredentialResolverImpl(prisma);
      const credentials = await (prisma as any).enterpriseProviderCredential.findMany({
        where: { organizationId, status: 'active' },
        select: { id: true, provider: true, modelName: true },
      });

      if (!credentials || credentials.length === 0) {
        return reply.send({
          success: true,
          data: {
            overall: 'no_providers',
            providers: [],
            message: '未配置任何 Provider，请先在企业控制台 → AI Runtime 中配置',
          },
        });
      }

      const healthChecks: ProviderHealth[] = [];

      for (const cred of credentials) {
        const health = await resolver.healthCheck(organizationId, cred.provider);
        healthChecks.push({
          provider: cred.provider,
          model: cred.modelName,
          status: health.status,
          lastCheck: new Date().toISOString(),
          message: health.message,
        });
      }

      const hasUnhealthy = healthChecks.some(h => h.status !== 'healthy');

      return reply.send({
        success: true,
        data: {
          overall: hasUnhealthy ? 'degraded' : 'healthy',
          providers: healthChecks,
          lastChecked: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/runtime/providers/health/:provider
   * 单个 Provider 健康检查
   */
  fastify.get('/api/runtime/providers/health/:provider', { preHandler: providerTenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const organizationId = request.headers['x-organization-id'] as string;
      const { provider: providerName } = request.params as any;

      if (!organizationId) {
        return reply.status(400).send({ success: false, error: 'Missing X-Organization-Id header' });
      }

      // Phase 3.1.3-A: 使用 Credential Resolver
      const resolver = new ProviderCredentialResolverImpl(prisma);
      const cred = await (prisma as any).enterpriseProviderCredential.findFirst({
        where: { organizationId, provider: providerName, status: 'active' },
        select: { id: true, provider: true, modelName: true },
      });

      if (!cred) {
        return reply.status(404).send({ success: false, error: 'Provider not found' });
      }

      const health = await resolver.healthCheck(organizationId, providerName);

      return reply.send({ 
        success: true, 
        data: {
          provider: cred.provider,
          model: cred.modelName,
          status: health.status,
          lastCheck: new Date().toISOString(),
          message: health.message,
        }
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
}

// Phase 3.1.3-A: 旧的健康检查逻辑已迁移到 ProviderCredentialResolverImpl
