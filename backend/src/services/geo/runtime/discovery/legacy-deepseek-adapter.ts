/**
 * Legacy DeepSeek Provider Adapter — preserved for discovery runner
 * R-004: Moved out of provider/ dir to allow cleanup of geo/runtime/provider/
 *
 * Original file from geo/runtime/provider/deepseek-adapter.ts
 * Kept as-is for backward compatibility of the discovery pipeline.
 */

import type { ProviderAdapter, ProviderContext, ExecuteOptions, StructuredResult } from './discovery-types';
import { unifiedAIGateway } from '../../../unified-ai-gateway.js';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class DeepSeekProvider implements ProviderAdapter {
  readonly name = 'deepseek';
  readonly model: string;
  private defaultBaseUrl: string;

  constructor(model: string = 'deepseek-v4-flash') {
    this.model = model;
    this.defaultBaseUrl = 'https://api.deepseek.com';
  }

  async execute(
    context: ProviderContext,
    prompt: string,
    options?: ExecuteOptions
  ): Promise<StructuredResult> {
    const startTime = Date.now();

    const apiKey = options?.apiKey || ''
    const baseUrl = (options?.baseURL || this.defaultBaseUrl).replace(/\/v1\/?$/, '')
    const model = options?.model || this.model

    if (!apiKey) {
      throw new Error(
        `[DeepSeekProvider] API Key 未配置。请通过 ExecuteOptions.apiKey 传入。` +
        `（provider=${this.name}, model=${model}）`
      )
    }

    const systemPrompt = `你是一个 GEO (Generative Engine Optimization) 分析专家。

你的任务是分析指定品牌的 AI 可见度表现（AI Visibility）。

分析维度：
1. 品牌在 AI 回答中的出现频率和准确性
2. 品牌核心价值主张是否被准确传达
3. AI 对品牌产品的推荐质量
4. 竞争对手在相同查询中的表现
5. 品牌知识图谱覆盖情况

输出格式必须为 JSON，包含以下字段：
{
  "summary": "整体分析摘要",
  "findings": [
    {
      "id": "finding-1",
      "type": "visibility | sentiment | recommendation | competitor",
      "description": "发现描述",
      "severity": "high | medium | low",
      "confidence": 0-1
    }
  ],
  "evidence": [
    {
      "source": "来源说明",
      "content": "证据内容",
      "confidence": 0-1
    }
  ],
  "citations": ["引用的信息来源"],
  "confidence": 0-1
}

分析必须基于事实，不要捏造数据。return ONLY valid JSON, no markdown code block.`;

    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    try {
      const { content } = await unifiedAIGateway.callLLM({
        provider: 'deepseek',
        model,
        messages,
        apiKey,
        baseUrl: baseUrl + '/v1',
        temperature: options?.temperature ?? 0.3,
        maxTokens: options?.maxTokens ?? 2048,
        signal: options?.timeout
          ? AbortSignal.timeout(Math.min(options.timeout, 30000))
          : AbortSignal.timeout(30000),
      });
      const endTime = Date.now();

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { summary: '响应解析失败，返回原始文本', findings: [], evidence: [], citations: [], confidence: 0 };
      }

      const totalTokens = Math.round(content.length / 4);

      return {
        summary: parsed.summary || `DeepSeek ${model} 分析完成`,
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        citations: Array.isArray(parsed.citations) ? parsed.citations : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        metrics: {
          duration: endTime - startTime,
          tokenCount: totalTokens,
          cost: this.estimateCost(totalTokens, content.length),
          cacheHit: false,
        },
        providerMetadata: {
          provider: 'deepseek',
          model,
          snapshotVersion: context.snapshotVersion,
          timestamp: new Date().toISOString(),
          traceId: context.requestId,
        },
        rawResponse: content,
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('fetch') || err.message?.includes('network')) {
        throw err;
      }
      throw err;
    }
  }

  private estimateCost(promptTokens: number, outputLength: number): number {
    const inputCost = (promptTokens / 1_000_000) * 1;
    const outputCost = (outputLength / 1_000_000) * 2;
    return Math.round((inputCost + outputCost) * 100) / 100;
  }
}
