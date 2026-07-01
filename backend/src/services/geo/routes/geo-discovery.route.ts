/**
 * GEO Discovery Route — REST API
 *
 * P0-T005 — AI Discovery Lab MVP
 * P0-T007 — Action Plan Engine — 新增 Action Plan 端点
 * P0-T008 — Verification Engine MVP — 新增 Verify 端点
 *
 * GET  /api/v1/geo/discovery/report       — 实体发现评估报告
 * GET  /api/v1/geo/discovery/action-plan  — 实体行动方案列表
 * GET  /api/v1/geo/discovery/verify       — 实体验证报告
 */

import { FastifyInstance } from 'fastify';
import { discoveryService } from '../../../benchmark/discovery/discovery-service';
import { opportunityService } from '../../../benchmark/opportunity';
import { mockScanner } from '../../../benchmark/discovery/mock-scanner';
import { scenarioMatcher } from '../../../benchmark/sie/scenario-matcher';
import { scenarioStore } from '../../../benchmark/scenario/scenario-store';
import { actionPlanService } from '../../../benchmark/action-plan/action-plan-service';
import { verificationService } from '../../../benchmark/verification/verification-service';

export default async function geoDiscoveryRoutes(fastify: FastifyInstance) {
  // GET /api/v1/geo/discovery/report — 实体发现评估报告
  fastify.get('/api/v1/geo/discovery/report', async (request, reply) => {
    const { entity } = request.query as { entity?: string };

    if (!entity || entity.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: '缺少 entity 参数',
      });
    }

    try {
      const report = await discoveryService.evaluateEntity(entity.trim());
      return {
        success: true,
        data: report,
      };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || '发现评估失败',
      });
    }
  });

  // GET /api/v1/geo/discovery/action-plan — 实体行动方案列表
  fastify.get('/api/v1/geo/discovery/action-plan', async (request, reply) => {
    const { entity } = request.query as { entity?: string };

    if (!entity || entity.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: '缺少 entity 参数',
      });
    }

    try {
      const entityName = entity.trim();

      // Step 1: SIE 匹配 — 获取 Top-K 场景
      const allScenarios = scenarioStore.listScenarios();
      const matchResults = scenarioMatcher.matchTopK(entityName, allScenarios.length);

      const matchConfidences = new Map<string, number>();
      const matchedIntentCounts = new Map<string, number>();

      for (const result of matchResults) {
        if (result.scenarioId && result.matched) {
          matchConfidences.set(result.scenarioId, result.confidence);
          matchedIntentCounts.set(
            result.scenarioId,
            result.confidence > 0.8 ? 4 : result.confidence > 0.5 ? 2 : 1,
          );
        }
      }

      // Step 2: Mock 发现扫描
      const { scenarios } = mockScanner.scan(entityName, matchConfidences);

      // Step 3: 生成 Opportunities
      const opportunities = opportunityService.generateOpportunities(
        scenarios,
        matchConfidences,
        matchedIntentCounts,
      );

      // Step 4: 生成 Action Plans
      const actionPlans = actionPlanService.generatePlans(
        opportunities,
        entityName,
      );

      // Step 5: 计算 summary
      const totalImpact = actionPlans.reduce((sum, ap) => sum + ap.estimatedImpact, 0);
      const highCount = actionPlans.filter((ap) => ap.priority === 'high').length;
      const mediumCount = actionPlans.filter((ap) => ap.priority === 'medium').length;

      return {
        success: true,
        data: {
          entityName,
          totalActionPlans: actionPlans.length,
          totalEstimatedImpact: totalImpact,
          summary: `为 ${entityName} 生成 ${actionPlans.length} 个行动方案，预计可提升 ADI ${totalImpact} 分（其中高优先级 ${highCount} 个，中优先级 ${mediumCount} 个）`,
          actionPlans,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || '行动方案生成失败',
      });
    }
  });

  // GET /api/v1/geo/discovery/verify — 实体验证报告
  fastify.get('/api/v1/geo/discovery/verify', async (request, reply) => {
    const { entity } = request.query as { entity?: string };

    if (!entity || entity.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: '缺少 entity 参数',
      });
    }

    try {
      const report = await verificationService.verify(entity.trim());
      return {
        success: true,
        data: report,
      };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || '验证执行失败',
      });
    }
  });
}
