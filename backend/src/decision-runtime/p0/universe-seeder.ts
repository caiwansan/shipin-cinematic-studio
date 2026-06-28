/**
 * universe-seeder.ts — Phase U-0 Universe Seeding Engine
 *
 * ============================================================
 * 把 U-0 seeds 编译为 ProofKernel 并注入 frozen universe。
 *
 * 职责：
 *   1. 接收 U0Seed[]
 *   2. 编译为 ProofKernel（含 FrameInvariant）
 *   3. 通过 FreezePipeline 冻结为 SemanticAnchor
 *   4. 构建 FrozenUniverseRef
 *   5. 重新初始化 ShadowExecutor
 *
 * 铁律：
 *   - 编译过程是确定性的（相同 seeds → 相同 ProofKernel）
 *   - 注入后不可修改（必须重建 universe）
 *   - 不调用任何 AI/LLM
 * ============================================================
 */

import { U0Seed, matchSeeds, getSeedStats } from './u0-seed-schema.js'
import { FreezePipeline, freezePipeline } from '../proofs/b46/freeze-pipeline.js'
import { FrozenUniverseRef } from '../invocation/d1-invocation-engine.js'
import { SemanticAnchor } from '../proofs/b46/semantic-anchor.js'
import type { ProofKernel, ProofStep, WitnessNode } from '../proofs/b1/proof-kernel.js'

// FrameInvariant 类型定义（避免 ts 路径解析问题）
interface SeedFrameInvariant {
  signature: string
  equivalenceClass: string | null
  frameId: string
  lineage: {
    requirement: string
    world: string
    evidence: string[]
    scoring: string
  }
  constraints: Record<string, any>
  confidence: number
  provable: boolean
  stable: boolean
  causalSpan: { start: number; end: number }
}

export interface SeededUniverse {
  universe: FrozenUniverseRef
  anchors: SemanticAnchor[]
  proofCount: number
  seedCount: number
}

/**
 * UniverseSeeder — 种子注入引擎
 */
export class UniverseSeeder {
  /**
   * seed(seeds): 将 U-0 seeds 编译为 ProofKernel 并冻结
   *
   * 步骤：
   *   1. 每个 seed → ProofKernel
   *   2. FreezePipeline.freezeAll()
   *   3. 构建 FrozenUniverseRef
   *   4. 返回不可变 universe
   */
  seed(seeds: U0Seed[]): SeededUniverse {
    const proofs = seeds.map((seed, index) => this.compileProof(seed, index))
    const anchors = freezePipeline.freezeAll(proofs)
    const anchor = anchors[0] ?? this.createEmptyAnchor()
    const universe = new FrozenUniverseRef(anchor, proofs)
    return { universe, anchors, proofCount: proofs.length, seedCount: seeds.length }
  }

  /**
   * compileProof: 单个 seed → ProofKernel
   *
   * 每个 seed 生成为一个独立的 proof，signature 从 id 派生。
   */
  private compileProof(seed: U0Seed, index: number): ProofKernel {
    const signature = this.hashSeedId(seed.id)

    const frameInvariant: SeedFrameInvariant = {
      signature,
      equivalenceClass: seed.domain,
      frameId: `p0-seed-${seed.id}`,
      lineage: {
        requirement: seed.id,
        world: seed.domain,
        evidence: seed.evidenceTemplates,
        scoring: `confidence:${seed.confidenceRule.fullConfidence}`,
      },
      constraints: {
        forbiddenPatterns: seed.forbiddenPatterns ?? [],
        minMatchRequired: seed.confidenceRule.minMatchCount,
      },
      confidence: seed.confidenceRule.fullConfidence,
      provable: true,
      stable: true,
      causalSpan: { start: 0, end: 0 },
    }

    return {
      frameInvariant: frameInvariant as any,
      witness: {
        requirement: { eventType: seed.id, agent: 'u0-seeder', stepIndex: 0, payloadKeys: seed.queryPatterns, provable: true },
        world: { eventType: seed.domain, agent: 'u0-seeder', stepIndex: 0, payloadKeys: ['seed-domain'], provable: true },
        evidence: seed.evidenceTemplates.map((e, i) => ({
          eventType: `evidence-${i}`,
          agent: 'u0-seeder',
          stepIndex: i,
          payloadKeys: [e],
          provable: true,
        })),
        scoring: { eventType: 'confidence', agent: 'u0-seeder', stepIndex: 0, payloadKeys: [String(seed.confidenceRule.fullConfidence)], provable: true },
        recommendation: { eventType: 'decision', agent: 'u0-seeder', stepIndex: 0, payloadKeys: [seed.decisionTemplate], provable: true },
        report: null,
      },
      proofSteps: [
        {
          index: 0,
          from: seed.id,
          to: seed.domain,
          rule: 'requirement_derived' as any,
          confidence: seed.confidenceRule.fullConfidence,
          stepType: 'derive',
          inboundDegree: 0,
          outboundDegree: 1,
        },
      ],
      createdAt: Date.now(),
    }
  }

  /**
   * hashSeedId: 从 seed id 派生签名
   */
  private hashSeedId(id: string): string {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash |= 0
    }
    return `SEED-${Math.abs(hash).toString(16).padStart(8, '0')}`
  }

  /**
   * createEmptyAnchor: 无法冻结时创建空锚
   */
  private createEmptyAnchor(): SemanticAnchor {
    const dummyProof = this.compileProof({
      id: 'empty',
      domain: 'system',
      queryPatterns: [],
      evidenceTemplates: ['系统启动占位'],
      decisionTemplate: 'System initialized — no seeds loaded',
      confidenceRule: { minMatchCount: 0, fullConfidence: 0, partialConfidence: 0 },
      tags: ['system'],
    }, 0)
    return freezePipeline.freeze(dummyProof)
  }

  /**
   * rebuild: 重建 universe（添加/更新 seeds 时调用）
   */
  rebuild(existingSeeds: U0Seed[], additionalSeeds: U0Seed[]): SeededUniverse {
    const merged = this.mergeSeeds(existingSeeds, additionalSeeds)
    return this.seed(merged)
  }

  private mergeSeeds(existing: U0Seed[], additional: U0Seed[]): U0Seed[] {
    const map = new Map<string, U0Seed>()
    for (const s of existing) map.set(s.id, s)
    for (const s of additional) map.set(s.id, s)
    return Array.from(map.values())
  }
}

/** 单例 */
export const universeSeeder = new UniverseSeeder()

/**
 * matchQueryToSeeds(query): 在线匹配
 * 返回匹配的种子名和置信度
 */
export function matchQueryToSeeds(query: string): {
  matchedId: string | null
  matchScore: number
  confidence: number
} {
  const matches = matchSeeds(query)
  if (matches.length === 0) {
    return { matchedId: null, matchScore: 0, confidence: 0 }
  }
  const best = matches[0]
  return {
    matchedId: best.seed.id,
    matchScore: best.score,
    confidence: best.score >= 0.3 ? best.seed.confidenceRule.fullConfidence : best.seed.confidenceRule.partialConfidence,
  }
}
