/**
 * routes/provider-management.ts
 * Phase 3.1.2 — Provider Credential Management API
 * 
 * 企业数字部门控制台 → API Key 配置接口
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
  fastify.post('/api/provider-management/credentials', { preHandler: providerAuthGuard }, async (request, reply) => {
    try {
      const orgId = (request.headers['x-organization-id'] as string) || '';
      const { provider, modelName, apiKey, baseUrl, isDefault } = request.body as any;
      const userId = (request.user as any)?.id || '';

      if (!provider || !modelName || !apiKey) {
        return reply.status(400).send({ success: false, error: 'Missing required fields' });
      }

      // 验证 API Key 格式
      if (!apiKey.startsWith('sk-') && apiKey.length < 10) {
        return reply.status(400).send({ success: false, error: 'API Key 格式错误' });
      }

      const result = await credentialService.createCredential({
        organizationId: orgId,
        provider,
        modelName,
        apiKey,
        baseUrl,
        isDefault,
        createdBy: userId,
      });

      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
        return reply.status(409).send({ success: false, error: '该 Provider + Model 组合已存在，如需更换 API Key 请先吊销旧凭证' });
      }
      // Hide internal error details in production
      const message = error.message?.includes('prisma') || error.message?.includes('invocation') 
        ? '创建失败，请检查输入' 
        : (error.message || '创建失败');
      request.log.error('Provider credential create error:', error);
      return reply.status(400).send({ success: false, error: message });
    }
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
  fastify.delete('/api/provider-management/credentials/:id', { preHandler: providerAuthGuard }, async (request, reply) => {
    try {
      const orgId = (request.headers['x-organization-id'] as string) || '';
      const { id } = request.params as any;
      const success = await credentialService.revokeCredential(id, orgId);
      return reply.send({ success, message: success ? 'Credential revoked' : 'Not found' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/provider-management/bindings
   * 绑定 Agent ↔ Model
   */
  fastify.post('/api/provider-management/bindings', { preHandler: providerAuthGuard }, async (request, reply) => {
    try {
      const orgId = (request.headers['x-organization-id'] as string) || '';
      const { agentId, credentialId, provider, modelName, reasoningMode } = request.body as any;

      if (!agentId || !credentialId || !provider || !modelName) {
        return reply.status(400).send({ success: false, error: 'Missing required fields' });
      }

      const result = await credentialService.bindAgentModel({
        organizationId: orgId,
        agentId,
        credentialId,
        provider,
        modelName,
        reasoningMode,
      });

      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/provider-management/bindings/:agentId
   * 获取 Agent 的 Model 绑定
   */
  fastify.get('/api/provider-management/bindings/:agentId', { preHandler: providerAuthGuard }, async (request, reply) => {
    try {
      const { agentId } = request.params as any;
      const binding = await credentialService.getAgentBinding(agentId);
      return reply.send({ success: true, data: binding });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
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
   * Agent 使用量统计
   */
  fastify.get('/api/provider-management/usage/:agentId', { preHandler: providerAuthGuard }, async (request, reply) => {
    try {
      const orgId = (request.headers['x-organization-id'] as string) || '';
      const { agentId } = request.params as any;

      const usage = await prisma.enterpriseProviderUsage.groupBy({
        by: ['provider', 'modelName', 'callType'],
        where: { organizationId: orgId, agentId },
        _sum: { tokenInput: true, tokenOutput: true, cost: true },
        _count: { id: true },
      });

      return reply.send({ success: true, data: usage });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
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
