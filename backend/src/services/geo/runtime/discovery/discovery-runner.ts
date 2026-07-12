/**
 * GEO Discovery Runner — 串联 ExecutionEngine + Replay Runtime
 *
 * 职责：
 * 1. 从 Knowledge Hub Context Runtime 获取发现上下文
 * 2. 基于上下文构建 Provider Prompt 并交由 ExecutionEngine 执行
 * 3. 从 ExecutionEngine 的 traces 池中获取最新 ExecutionTrace
 * 4. 通过 createReplayRecord() 创建 Replay 记录并持久化
 * 5. 同时索引证据到 EvidenceIndex
 *
 * 每次 runDiscovery() 必产生一条 Replay 记录
 *
 * GEO-RC3 Epic B2: 扩展为 Replay → Evaluate → Candidate 自动链路
 *   在 Replay 完成后自动调用 evaluateReplay() 进行评测，
 *   再通过 generateCandidate() 决定是否创建 Learning Candidate。
 *
 * R-004: Uses legacy ExecutionEngine from deleted provider/ dir.
 *         Kept for backward compatibility — consumers will be migrated
 *         to UnifiedAIGateway in a future sprint.
 */

import { executionEngine } from './legacy-execution-engine';
import { createReplayRecord } from '../replay/recorder';
import { replayStore } from '../replay/store';
import { evidenceIndex } from '../replay/evidence-index';
import { getDiscoveryContext } from './context-runtime';
import { evaluateReplay } from '../../provider/benchmark/runtime/evaluation-engine';
import { generateCandidate } from '../../knowledge-learning/candidate/generator';
import type { ProviderContext, ExecutionTrace } from '../legacy-types';

// ─── Types ────────────────────────────────────────────────────────

export interface DiscoveryOptions {
  provider?: string;
  model?: string;
  brandId?: string;
  includeProducts?: boolean;
  includeArticles?: boolean;
  executeOptions?: Record<string, any>;
}

export interface DiscoveryResult {
  result: any;
  replayId: string;
  trace: ExecutionTrace;
  evaluation?: any;
  candidateGenerated?: boolean;
  candidateId?: string;
}

// ─── Runner ───────────────────────────────────────────────────────

export async function runDiscovery(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const providerName = options.provider || 'deepseek';
  const modelName = options.model;

  const context = await getDiscoveryContext();

  const providerContext: ProviderContext = {
    snapshotVersion: context.packageVersion,
    snapshotHash: context.snapshotHash,
    brandContext: context.brands.length > 0 ? context.brands[0] : {},
    requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };

  const brandName =
    (providerContext.brandContext as any)?.name ||
    (Array.isArray(context.brands) && context.brands.length > 0
      ? (context.brands[0] as any)?.name
      : undefined) ||
    '未知';

  const prompt = `请分析以下品牌在 AI 平台中的可见度表现：

品牌名称: ${brandName}
行业: AI / 人工智能
产品数量: ${context.knowledgeCount}
实体数量: ${context.entityCount}
上下文版本: ${context.snapshotHash}
知识包版本: ${context.packageVersion}
`;

  const baseExecuteOptions = modelName ? { model: modelName } : {};
  const mergedOptions = options.executeOptions
    ? { ...baseExecuteOptions, ...options.executeOptions }
    : baseExecuteOptions;
  const finalExecuteOptions = Object.keys(mergedOptions).length > 0 ? mergedOptions as any : undefined;
  const result = await executionEngine.execute(providerName, providerContext, prompt, finalExecuteOptions);

  const traces = executionEngine.listTraces();
  const latestTrace = traces.length > 0 ? traces[traces.length - 1] : null;

  if (latestTrace) {
    latestTrace.promptVersion = 'v1.0.0';

    const replay = createReplayRecord(latestTrace, result);
    replayStore.save(replay);
    evidenceIndex.indexFromReplay(replay.replayId, replay.snapshotVersion, replay);

    let candidateGenerated = false;
    let candidateId: string | undefined;
    try {
      const evaluationReport = await evaluateReplay(replay);
      const candidate = generateCandidate(replay.replayId, {
        overall: evaluationReport.scores.overall,
        band: evaluationReport.band,
        confidence: result.confidence,
        evidenceScore: evaluationReport.scores.evidence,
        gaps: evaluationReport.gaps,
      });
      if (candidate) {
        candidateGenerated = true;
        candidateId = candidate.candidateId;
      }
      return {
        result,
        replayId: replay.replayId,
        trace: latestTrace,
        evaluation: {
          reportId: evaluationReport.reportId,
          overall: evaluationReport.scores.overall,
          band: evaluationReport.band,
          gapCount: evaluationReport.gaps.length,
        },
        candidateGenerated,
        candidateId,
      };
    } catch (err: any) {
      console.warn(`[DiscoveryRunner] Auto-evaluation skipped: ${err.message}`);
      return {
        result,
        replayId: replay.replayId,
        trace: latestTrace,
        candidateGenerated: false,
      };
    }
  }

  return {
    result,
    replayId: '',
    trace: undefined as unknown as ExecutionTrace,
  };
}

export async function listRecentReplays(limit: number = 20): Promise<any> {
  return replayStore.list(limit);
}
