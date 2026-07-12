import { FastifyInstance } from 'fastify';
import { evaluateReplay } from './evaluation-engine';
import { replayStore } from '../../../runtime/replay/store';
import { goldenDataset } from '../../../runtime/golden/dataset-loader';
import * as path from 'path';

export async function benchmarkRoutes(app: FastifyInstance): Promise<void> {
  // 初始化 Dataset（懒加载）
  let datasetLoaded = false;
  async function ensureDataset() {
    if (datasetLoaded) return;

    // 尝试多个路径，兼容 dev（tsx）和 dist 部署
    // 优先加载 v1.1（校准版），回退到 v1
    const cwd = process.cwd();
    const paths = [
      // v1.1 校准版
      path.resolve(cwd, 'datasets/v1/golden-v1.1.json'),
      path.resolve(cwd, '../datasets/v1/golden-v1.1.json'),
      path.resolve(cwd, 'src/services/geo/provider/benchmark/golden/golden-v1.json'),
      path.resolve(cwd, 'dist/services/geo/provider/benchmark/golden/golden-v1.json'),
      path.resolve(__dirname, '../../golden/golden-v1.json'),
      path.resolve(__dirname, '../../../provider/benchmark/golden/golden-v1.json'),
      path.resolve(__dirname, '../../../../golden-v1.json'),
    ];
    for (const p of paths) {
      try {
        await goldenDataset.loadFromFile(p);
        datasetLoaded = true;
        console.log(`[benchmark] Dataset loaded from ${p}`);
        return;
      } catch (e) {
        // try next
      }
    }
    // Fallback: 如果文件不存在，创建模拟数据
    if (!datasetLoaded) {
      goldenDataset.setEntries([
        { id: 'g001', industry: 'AI', scenario: 'brand_recognition', expectedBand: 'Excellent', intent: 'general_qa', expectedFindings: 3, expectedConfidence: 0.8 },
        { id: 'g002', industry: 'AI', scenario: 'competitor_discovery', expectedBand: 'Good', intent: 'competitor_analysis', expectedFindings: 2, expectedConfidence: 0.6 },
      ]);
      datasetLoaded = true;
      console.log('[benchmark] Dataset fallback: 使用模拟数据');
    }
  }

  // POST /benchmark/evaluate — 评估单个 Replay
  app.post('/benchmark/evaluate', async (request, reply) => {
    try {
      await ensureDataset();
      const body = request.body as { replayId?: string };
      const replayId = body?.replayId;

      let replay;
      if (replayId) {
        replay = replayStore.get(replayId);
      } else {
        // 自动获取最新的 Replay
        const recent = replayStore.list(1);
        replay = recent.length > 0 ? replayStore.get(recent[0].replayId) : null;
      }

      if (!replay) {
        return reply.code(404).send({ success: false, error: '无可评估的 Replay。请先执行 Discovery 扫描。' });
      }

      const report = await evaluateReplay(replay);

      return {
        success: true,
        data: {
          reportId: report.reportId,
          replayId: report.replayId,
          overall: report.scores.overall,
          band: report.band,
          gaps: report.gaps.length,
          scores: report.scores,
          topGaps: report.gaps.slice(0, 5),
          calibrationCandidates: report.calibrationCandidates.slice(0, 3),
        },
      };
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // POST /benchmark/evaluate/batch — 批量评估
  app.post('/benchmark/evaluate/batch', async (request, reply) => {
    try {
      await ensureDataset();
      const body = (request.body as { limit?: number }) || {};
      const limit = body.limit || 10;
      const replays = replayStore.list(limit);

      if (replays.length === 0) {
        return { success: true, data: { total: 0, evaluated: 0, skipped: 0, reports: [] } };
      }

      const reports: any[] = [];
      let skipped = 0;

      for (const summary of replays) {
        const replay = replayStore.get(summary.replayId);
        if (replay) {
          try {
            const report = await evaluateReplay(replay);
            reports.push({
              reportId: report.reportId,
              replayId: report.replayId,
              overall: report.scores.overall,
              band: report.band,
              gapCount: report.gaps.length,
            });
          } catch {
            skipped++;
          }
        } else {
          skipped++;
        }
      }

      const averageOverall = reports.length > 0
        ? Math.round(reports.reduce((s, r) => s + r.overall, 0) / reports.length)
        : 0;

      return {
        success: true,
        data: {
          total: replays.length,
          evaluated: reports.length,
          skipped,
          reports,
          summary: {
            averageOverall,
            totalGaps: reports.reduce((s, r) => s + r.gapCount, 0),
          },
        },
      };
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // GET /benchmark/result/:id — 完整评估报告
  app.get<{ Params: { id: string } }>('/benchmark/result/:id', async (request, reply) => {
    try {
      await ensureDataset();
      const replay = replayStore.get(request.params.id);
      if (!replay) {
        return reply.code(404).send({ success: false, error: 'Replay 不存在' });
      }
      const report = await evaluateReplay(replay);
      return { success: true, data: report };
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // GET /benchmark/report/:id — 导出评估报告（Markdown 格式）
  app.get<{ Params: { id: string } }>('/benchmark/report/:id', async (request, reply) => {
    try {
      await ensureDataset();
      const replay = replayStore.get(request.params.id);
      if (!replay) {
        return reply.code(404).send({ success: false, error: 'Replay 不存在' });
      }
      const report = await evaluateReplay(replay);

      const md = [
        `# 评测报告 — ${report.reportId}`,
        ``,
        `**总体评分**: ${report.scores.overall}/100 (**${report.band}**)`,
        `**Replay**: ${report.replayId}`,
        `**Provider**: ${report.raw.replay.provider}`,
        `**评估时间**: ${report.evaluatedAt}`,
        ``,
        `## 多维评分`,
        `| 维度 | 分数 | 权重 |`,
        `|------|------|------|`,
        ...report.scores.dimensions.map(d => `| ${d.category} | ${d.score}/100 | ${d.weight} |`),
        ``,
        `## 差距分析`,
        `| 类型 | 描述 | 严重程度 |`,
        `|------|------|----------|`,
        ...(report.gaps.length > 0 ? report.gaps.map(g => `| ${g.type} | ${g.description} | ${g.severity} |`) : ['| - | 无发现 | - |']),
        ``,
        `## 校准建议`,
        ...report.calibrationCandidates.map(c => `- **${c.severity}**: ${c.recommendation} (${c.suggestedAction})`),
        ``,
      ].join('\n');

      reply.header('Content-Type', 'text/markdown; charset=utf-8');
      return reply.send(md);
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });
}
