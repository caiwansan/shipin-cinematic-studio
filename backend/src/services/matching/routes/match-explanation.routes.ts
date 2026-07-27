// ============================================================
// MatchExplanationRoutes — 匹配解释 API
// 职责：提供匹配结果的人类可读解释
// 红线：不暴露 Candidate 原始数据
// ============================================================

import type { FastifyInstance } from 'fastify';
import { matchExplanationService, ExplanationError } from '../services/match-explanation.service.js';
import { prisma } from '../../../utils/index.js';
import { getEnterpriseContext } from '../../../repositories/recruitment/enterprise-member.repository.js';

export async function matchExplanationRoutes(app: FastifyInstance) {

  // ── 生成/获取匹配解释 ──
  app.get('/job/match/explanation/:resultId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { resultId } = request.params as { resultId: string };
    const query = request.query as any;
    const lang = query.lang || 'zh';
    const maxSuggestions = query.maxSuggestions ? parseInt(query.maxSuggestions) : 3;

    try {
      // 1. 获取当前用户的企业 ID
      const userId = (request.user as any).id;
      const ctx = await getEnterpriseContext(userId);
      if (!ctx) {
        return reply.status(403).send({ error: 'User is not associated with an enterprise' });
      }

      // 2. 验证 resultId 属于该企业
      const matchResult = await prisma.talentMatchResult.findUnique({
        where: { id: resultId },
        include: { jobRequirement: { select: { enterpriseId: true } } },
      });
      if (!matchResult) {
        return reply.status(404).send({ error: 'Match result not found' });
      }
      if (matchResult.jobRequirement?.enterpriseId !== ctx.enterpriseId) {
        return reply.status(404).send({ error: 'Match result not found' });
      }

      // 3. 生成解释
      const explanation = await matchExplanationService.generateExplanation({
        matchResultId: resultId,
        enterpriseId: ctx.enterpriseId,
        language: lang,
        maxSuggestions,
      });

      return explanation;
    } catch (e: any) {
      if (e instanceof ExplanationError) {
        return reply.status(e.statusCode).send({ error: e.message });
      }
      console.error(`[ExplanationRoute] Error: ${e.message}`);
      return reply.status(500).send({ error: 'Explanation generation failed' });
    }
  });

  // ── 生成 Template 解释（无需 LLM，用于测试）──
  app.get('/job/match/explanation/:resultId/template', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { resultId } = request.params as { resultId: string };

    try {
      // 1. 获取当前用户的企业 ID
      const userId = (request.user as any).id;
      const ctx = await getEnterpriseContext(userId);
      if (!ctx) {
        return reply.status(403).send({ error: 'User is not associated with an enterprise' });
      }

      // 2. 验证 resultId 属于该企业
      const matchResult = await prisma.talentMatchResult.findUnique({
        where: { id: resultId },
        include: { jobRequirement: { select: { enterpriseId: true } } },
      });
      if (!matchResult) {
        return reply.status(404).send({ error: 'Match result not found' });
      }
      if (matchResult.jobRequirement?.enterpriseId !== ctx.enterpriseId) {
        return reply.status(404).send({ error: 'Match result not found' });
      }

      // 3. 生成 Template 解释
      const explanation = await matchExplanationService.generateTemplate({
        matchResultId: resultId,
        enterpriseId: ctx.enterpriseId,
      });

      return explanation;
    } catch (e: any) {
      if (e instanceof ExplanationError) {
        return reply.status(e.statusCode).send({ error: e.message });
      }
      console.error(`[ExplanationRoute] Error: ${e.message}`);
      return reply.status(500).send({ error: 'Explanation generation failed' });
    }
  });
}
