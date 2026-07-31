/**
 * routes/provider-management.ts
 * Phase 3.1.2 — Provider Credential Management API
 * 
 * ⚠️ DEPRECATED（SPRINT-KMKI-AUDIT-02）：本模块读写 enterpriseProviderCredential /
 * enterpriseAgentModelBinding —— 这两张表从未在 Prisma schema 中定义（死表 API）。
 * KMKI AI Runtime Principle 唯一权威：/api/enterprise/model-config
 * （OrgModelConfig + ProviderCredential，企业 BYOK，平台不托管 Key）
 * 写端点已 410 拒绝，读端点仅兼容返回空。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProviderCredentialService } from '../services/enterprise/organization/provider-credential.service.js';
import { prisma } from '../utils/index.js';

// Tenant Guard (reuse from agent-runtime pattern)
async function providerAuthGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    const decoded = request.user as any;
    
    if (decoded && decoded.id && decoded.tokenVersion !== undefined) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true },
      });
      if (dbUser && dbUser.tokenVersion !== decoded.tokenVersion) {
        reply.status(401).send({ error: '未授权', message: '账号已在其他设备登录' });
        return;
      }
    }

    const targetOrgId = (request.headers['x-organization-id'] as string) || '';
    if (targetOrgId && decoded?.id) {
      const { getOrganizationIdForUser } = await import('../services/enterprise/organization/identity-bootstrap.service.js');
      const userOrgId = await getOrganizationIdForUser(decoded.id);
      if (userOrgId && userOrgId !== targetOrgId && decoded.role !== 'admin') {
        reply.status(403).send({ error: 'Forbidden', message: '跨组织访问被拒绝' });
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

const credentialService = new ProviderCredentialService(prisma);

export default async function providerManagementRoutes(fastify: FastifyInstance) {

  /**
   * POST /api/provider-management/credentials
   * 创建 Provider 凭证
   */
  fastify.post('/api/provider-management/credentials', { preHandler: providerAuthGuard }, async (_request, reply) => {
    return reply.status(410).send({
      success: false,
      error: '该接口已停用（KMKI AI Runtime Principle）。企业 Key 请使用 PUT /api/enterprise/model-config（企业工作台 → AI模型设置）',
      deprecated: true,
    })
  });

  /**
   * GET /api/provider-management/credentials
   * 列出组织所有 Provider 凭证（不含密钥）
   */
  fastify.get('/api/provider-management/credentials', { preHandler: providerAuthGuard }, async (request, reply) => {
    try {
      const orgId = (request.headers['x-organization-id'] as string) || '';
      const credentials = await credentialService.listCredentials(orgId);
      return reply.send({ success: true, data: credentials });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/provider-management/credentials/:id
   * 吊销 Provider 凭证
   */
  fastify.delete('/api/provider-management/credentials/:id', { preHandler: providerAuthGuard }, async (_request, reply) => {
    return reply.status(410).send({ success: false, error: '该接口已停用，请使用 DELETE /api/enterprise/model-config/:provider', deprecated: true })
  });

  /**
   * POST /api/provider-management/bindings
   * ⚠️ DEPRECATED: 死表 API（enterpriseAgentModelBinding 不存在），410 拒绝
   */
  fastify.post('/api/provider-management/bindings', { preHandler: providerAuthGuard }, async (_request, reply) => {
    return reply.status(410).send({
      success: false,
      error: '该接口已停用（KMKI AI Runtime Principle）。模型选择请使用 /api/enterprise/model-config（企业工作台 → AI模型设置）',
      deprecated: true,
    })
  });

  /**
   * GET /api/provider-management/bindings/:agentId
   * ⚠️ DEPRECATED: 死表 API，仅兼容返回空
   */
  fastify.get('/api/provider-management/bindings/:agentId', { preHandler: providerAuthGuard }, async (_request, reply) => {
    return reply.send({ success: true, data: null, deprecated: true })
  });

  /**
   * GET /api/provider-management/health/:provider
   * Provider 健康检查（使用组织配置的 Key）
   */
  fastify.get('/api/provider-management/health/:provider', { preHandler: providerAuthGuard }, async (request, reply) => {
    try {
      const orgId = (request.headers['x-organization-id'] as string) || '';
      const { provider } = request.params as any;
      
      const credential = await credentialService.getDefaultCredential(orgId, provider);
      
      if (!credential) {
        return reply.send({ 
          success: true, 
          data: { provider, status: 'missing_key', message: '未配置 Provider 凭证' } 
        });
      }

      // 轻量健康检查
      const https = await import('https');
      const http = await import('http');
      
      const baseUrl = credential.baseUrl || getDefaultBaseUrl(provider);
      const url = new URL(baseUrl);
      
      const result = await new Promise<any>((resolve) => {
        const req = (url.protocol === 'https:' ? https : http).request(
          {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + '/models',
            method: 'GET',
            headers: { Authorization: `Bearer ${credential.apiKey}` },
            timeout: 5000,
          },
          (res) => {
            resolve({ statusCode: res.statusCode, ok: res.statusCode === 200 });
          }
        );
        req.on('error', () => resolve({ statusCode: 0, ok: false }));
        req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, ok: false }); });
        req.end();
      });

      const status = result.ok ? 'healthy' : (result.statusCode === 401 ? 'invalid_key' : 'error');
      
      return reply.send({ 
        success: true, 
        data: { provider, model: credential.modelName, status, lastCheck: new Date().toISOString() } 
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/provider-management/usage/:agentId
   * ⚠️ DEPRECATED: 死表 API（enterpriseProviderUsage 不存在）。用量请走数据罗盘 /api/admin/dashboard/ecosystem 或 usage_logs
   */
  fastify.get('/api/provider-management/usage/:agentId', { preHandler: providerAuthGuard }, async (_request, reply) => {
    return reply.status(410).send({ success: false, error: '该接口已停用（死表 API）。用量统计请使用后台数据罗盘', deprecated: true })
  });
}

function getDefaultBaseUrl(provider: string): string {
  const map: Record<string, string> = {
    deepseek: 'https://api.deepseek.com/v1',
    openai: 'https://api.openai.com/v1',
    qwen: 'https://dashscope.aliyuncs.com/v1',
    doubao: 'https://ark.cn-beijing.volces.com/v1',
  };
  return map[provider] || 'https://api.openai.com/v1';
}
