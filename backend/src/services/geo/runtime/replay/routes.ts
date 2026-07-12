import { FastifyInstance } from 'fastify';
import { replayStore } from './store';
import { evidenceIndex } from './evidence-index';

export async function replayRoutes(app: FastifyInstance): Promise<void> {
  // 列表
  app.get('/replay', async (request, reply) => {
    const query = request.query as { limit?: string; offset?: string; provider?: string; snapshot?: string };
    const limit = parseInt(query.limit || '50');
    const offset = parseInt(query.offset || '0');

    let replays;
    if (query.provider) {
      replays = replayStore.listByProvider(query.provider, limit);
    } else if (query.snapshot) {
      replays = replayStore.listBySnapshot(query.snapshot, limit);
    } else {
      replays = replayStore.list(limit, offset);
    }

    return { success: true, data: replays, total: replayStore.count() };
  });

  // 单条详情
  app.get<{ Params: { id: string } }>('/replay/:id', async (request, reply) => {
    const replay = replayStore.get(request.params.id);
    if (!replay) {
      return reply.code(404).send({ success: false, error: 'Replay not found' });
    }
    return { success: true, data: replay };
  });

  // 证据
  app.get<{ Params: { id: string } }>('/replay/:id/evidence', async (request, reply) => {
    const replay = replayStore.get(request.params.id);
    if (!replay) {
      return reply.code(404).send({ success: false, error: 'Replay not found' });
    }
    const evidence = evidenceIndex.getByReplay(request.params.id);
    return { success: true, data: evidence };
  });

  // Diff（比较两个 replay）
  app.get('/replay/diff', async (request, reply) => {
    const query = request.query as { left?: string; right?: string };
    if (!query.left || !query.right) {
      return reply.code(400).send({ success: false, error: 'diff 需要 left 和 right replay ID' });
    }
    const left = replayStore.get(query.left);
    const right = replayStore.get(query.right);
    if (!left || !right) {
      return reply.code(404).send({ success: false, error: 'One or both replays not found' });
    }

    const changes: { field: string; leftValue: any; rightValue: any; delta: number }[] = [];
    changes.push({ field: 'duration', leftValue: left.duration, rightValue: right.duration, delta: right.duration - left.duration });
    changes.push({ field: 'tokenCount', leftValue: left.tokenCount, rightValue: right.tokenCount, delta: right.tokenCount - left.tokenCount });
    changes.push({ field: 'cost', leftValue: left.cost, rightValue: right.cost, delta: Math.round((right.cost - left.cost) * 10000) / 10000 });
    changes.push({ field: 'findingCount', leftValue: left.result.findings.length, rightValue: right.result.findings.length, delta: right.result.findings.length - left.result.findings.length });
    changes.push({ field: 'evidenceCount', leftValue: left.result.evidence.length, rightValue: right.result.evidence.length, delta: right.result.evidence.length - left.result.evidence.length });
    changes.push({ field: 'confidence', leftValue: left.result.confidence, rightValue: right.result.confidence, delta: Math.round((right.result.confidence - left.result.confidence) * 100) / 100 });

    return {
      success: true,
      data: {
        left: { replayId: left.replayId, provider: left.provider, timestamp: left.timestamp },
        right: { replayId: right.replayId, provider: right.provider, timestamp: right.timestamp },
        changes: changes.filter(c => c.delta !== 0),
        same: changes.every(c => c.delta === 0),
      },
    };
  });

  // Export
  app.get<{ Params: { id: string } }>('/replay/:id/export', async (request, reply) => {
    const replay = replayStore.get(request.params.id);
    if (!replay) {
      return reply.code(404).send({ success: false, error: 'Replay not found' });
    }
    return { success: true, data: replay };
  });
}
