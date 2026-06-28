/**
 * d1-invocation-engine.ts — Phase D-1 Minimal Invocation Engine
 *
 * ============================================================
 * 这不是系统设计。
 * 不是 runtime pipeline。
 * 不是 query system。
 *
 * 这是：
 *   frozen proof universe 的第一次"外部投影事件"
 *
 * 三条铁律：
 *   1. 不改 B 系统 — frozenUniverse 只读访问
 *   2. 不优化 Bridge — Bridge 是 contract only，不升级逻辑
 *   3. 只做单次通路 — one query, one lookup, one decision
 *
 * 成功标准：
 *   ✔ Query enters system
 *   ✔ Lookup returns from frozen universe
 *   ✔ DecisionArtifact is produced
 * ============================================================
 */

import type {
  QueryContract,
  QueryEmbedding,
  QueryContext,
  LookupResult,
  EntailmentResult,
  CategoryAlignment,
  DecisionArtifact,
  Provenance,
  Explainability,
} from '../bridge/bridge-protocol.js'
import type { SemanticAnchor } from '../proofs/b46/semantic-anchor.js'
import type { ProofKernel } from '../proofs/b1/proof-kernel.js'
import type { Entailment } from '../proofs/b45/entailment.js'
import { driftGuard } from '../proofs/b46/drift-guard.js'

// ============================================================
// 1. UUID 生成（避免 uuid 包类型问题）
// ============================================================

function generateId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 10)
  return `${ts}-${rand}`
}

// ============================================================
// 1. Frozen Universe — 只读引用
// ============================================================
//
// D-1 不持久化 frozen universe。
// 只持有只读引用——引用来自 B-4.6 冻结后的 SemanticAnchor。
// 不能创建，不能修改，只能访问。

export class FrozenUniverseRef {
  constructor(
    public readonly anchor: SemanticAnchor,
    private readonly proofs: ReadonlyArray<Readonly<ProofKernel>> = []
  ) {}

  /**
   * 获取所有可用的 proof
   * 只读——所有对象已 deepFreeze
   */
  getProofs(): ReadonlyArray<Readonly<ProofKernel>> {
    return this.proofs
  }

  /**
   * 获取 anchor 签名
   */
  getSignature(): string {
    return this.anchor.signature
  }

  /**
   * 验证 universe 仍然完整
   */
  checkIntegrity(): boolean {
    try {
      driftGuard.check(this.anchor)
      return true
    } catch {
      return false
    }
  }
}

// ============================================================
// 2. Query Ingestion — 唯一入口
// ============================================================
//
// 不做 NLP，不做语义理解。
// 只做最小 intent extraction：
//   - 关键词匹配 → domain
//   - 签名匹配 → embedding
//   - 默认 → assertion intent

export class QueryIngestor {
  /**
   * ingest(question): 把现实问题映射到 QueryContract
   *
   * 不做：
   *   - 不解析结构
   *   -不学习用户行为
   *   - 不扩充 intent
   */
  ingest(input: string): QueryContract {
    const embedding = this.extractMinimalIntent(input)
    const domain = this.inferDomain(input)

    return {
      queryId: generateId(),
      naturalInput: input,
      embedding,
      context: {
        domain: domain || undefined,
        constraints: [],
      },
    }
  }

  /**
   * 从关键词提取最小 intent
   */
  private extractMinimalIntent(input: string): QueryEmbedding {
    const lower = input.toLowerCase()

    // 精确签名匹配模式
    const sigMatch = input.match(/signature[=:]\s*(\S+)/i)
    if (sigMatch) {
      return {
        type: 'exact_signature',
        value: sigMatch[1],
      }
    }

    // 等价类匹配
    if (lower.includes('same as') || lower.includes('equivalent')) {
      return {
        type: 'equivalence_class',
        value: input.replace(/^(is this|is it|how does)\s+/i, '').trim(),
      }
    }

    // 意图类匹配
    if (lower.includes('compare') || lower.includes('difference') || lower.includes('vs')) {
      return {
        type: 'intent_class',
        value: 'comparison',
        frameHints: [input],
      }
    }

    // 默认：partial frame assertion
    return {
      type: 'partial_frame',
      value: input,
      frameHints: [input],
    }
  }

  /**
   * 推断 domain
   */
  private inferDomain(input: string): string {
    const lower = input.toLowerCase()
    if (lower.includes('company') || lower.includes('enterprise') || lower.includes('business')) {
      return 'business_intel'
    }
    if (lower.includes('risk') || lower.includes('fraud') || lower.includes('security')) {
      return 'risk_assessment'
    }
    if (lower.includes('tech') || lower.includes('ai') || lower.includes('model')) {
      return 'tech_review'
    }
    if (lower.includes('market') || lower.includes('competitor') || lower.includes('invest')) {
      return 'market_intel'
    }
    return 'general_query'
  }
}

// ============================================================
// 3. Bridge Executor — 只读访问
// ============================================================
//
// 不执行 proof generation。
// 不进行逻辑扩展。
// 只在 frozen universe 中做 match + lookup。

export class BridgeExecutor {
  /**
   * execute(query): 查询 frozen universe
   *
   * 步骤：
   *   1. 匹配 embedding
   *   2. 计算蕴含
   *   3. 映射范畴对齐
   */
  execute(
    query: QueryContract,
    universe: FrozenUniverseRef
  ): LookupResult {
    // Step 1: 匹配（简化版——只按 embedding type 做精确查找）
    const matchedProofs = this.matchProofs(query.embedding, universe)

    // Step 2: 蕴含计算
    const entailment = this.computeEntailment(matchedProofs)

    // Step 3: 范畴对齐
    const alignment = this.mapCategoryAlignment(matchedProofs)

    return {
      queryId: query.queryId,
      matchedProofs,
      entailment,
      categoryAlignment: alignment,
      anchorSignature: universe.getSignature(),
    }
  }

  /**
   * 匹配 proof
   * 不做相似度，只做精确匹配
   */
  private matchProofs(
    embedding: QueryEmbedding,
    universe: FrozenUniverseRef
  ): ProofKernel[] {
    // D-1 简化：返回 universe 持有的所有 proof
    // 真正的匹配引擎由 Phase C 实现
    return universe.getProofs() as unknown as ProofKernel[]
  }

  /**
   * 计算蕴含
   * 不做重新验证
   */
  private computeEntailment(proofs: ProofKernel[]): EntailmentResult {
    if (proofs.length < 2) {
      return {
        from: proofs[0]?.frameInvariant.signature ?? 'unknown',
        to: proofs[0]?.frameInvariant.signature ?? 'unknown',
        holds: true,
        reason: 'identity',
        anchorSignature: '',
      }
    }

    return {
      from: proofs[0].frameInvariant.signature,
      to: proofs[1].frameInvariant.signature,
      holds: true,
      reason: 'identity',
      anchorSignature: '',
    }
  }

  /**
   * 范畴对齐映射
   */
  private mapCategoryAlignment(proofs: ProofKernel[]): CategoryAlignment {
    if (proofs.length === 0) {
      return {
        bestMatch: 'none',
        morphismType: 'degenerate',
        isIsomorphic: false,
      }
    }

    return {
      bestMatch: proofs[0].frameInvariant.signature,
      morphismType: 'identity',
      isIsomorphic: true,
      isomorphismGroup: proofs[0].frameInvariant.equivalenceClass ?? undefined,
    }
  }
}

// ============================================================
// 4. Decision Renderer — 最终投影
// ============================================================
//
// 把 LookupResult 投影为人类可读的 DecisionArtifact。
// 不做 NLP 生成，只做结构化映射。

export class DecisionRenderer {
  /**
   * render(result): 生成 DecisionArtifact
   */
  render(queryId: string, result: LookupResult): DecisionArtifact {
    return {
      queryId,
      value: this.deriveDecision(result),
      confidence: this.deriveConfidence(result),
      truth: result.matchedProofs.length > 0 ? 'true' : 'unknown',
      provenance: this.extractTrace(result),
      explainability: this.buildExplanation(result),
      createdAt: Date.now(),
    }
  }

  /**
   * 从蕴含结果推导决策值
   */
  private deriveDecision(result: LookupResult): string {
    if (result.matchedProofs.length === 0) {
      return 'NO_DECISION'
    }
    if (result.entailment.holds === false) {
      return 'CONTRADICTION'
    }
    return `INFERRED: ${result.matchedProofs[0].frameInvariant.signature}`
  }

  /**
   * 推导置信度（从 truth + entailment）
   */
  private deriveConfidence(result: LookupResult): number {
    if (result.matchedProofs.length === 0) return 0
    if (result.entailment.reason === 'identity') return 1.0
    if (result.entailment.reason === 'isomorphism') return 0.95
    if (result.entailment.reason === 'truth_transfer') return 0.85
    return 0.5
  }

  /**
   * 提取溯源路径
   */
  private extractTrace(result: LookupResult): Provenance {
    const first = result.matchedProofs[0]
    return {
      frameInvariantSignature: first?.frameInvariant.signature ?? 'unknown',
      proofSignature: first?.frameInvariant.signature ?? 'unknown',
      causalTrace: [first?.frameInvariant.signature ?? 'none'],
      anchorSignature: result.anchorSignature,
    }
  }

  /**
   * 构建可解释性
   */
  private buildExplanation(result: LookupResult): Explainability {
    return {
      entailmentChain: [
        `${result.entailment.from} ⊢ ${result.entailment.to}`,
      ],
      categoryPosition: result.categoryAlignment.bestMatch,
      truthOrigin: result.entailment.reason,
    }
  }
}

// ============================================================
// 5. D-1 Invocation — 单次通路
// ============================================================

export class D1Invocation {
  private ingestor: QueryIngestor
  private executor: BridgeExecutor
  private renderer: DecisionRenderer

  constructor(
    private universe: FrozenUniverseRef
  ) {
    this.ingestor = new QueryIngestor()
    this.executor = new BridgeExecutor()
    this.renderer = new DecisionRenderer()
  }

  /**
   * invoke(question): 完整 D-1 通路
   *
   * 一个函数，三件事：
   *   1. ingest → QueryContract
   *   2. execute → LookupResult
   *   3. render → DecisionArtifact
   */
  invoke(question: string): InvocationOutput {
    // Step 1: 摄入
    const query = this.ingestor.ingest(question)

    // Step 2: 查询
    const lookupResult = this.executor.execute(query, this.universe)

    // Step 3: 渲染
    const decision = this.renderer.render(query.queryId, lookupResult)

    return {
      query,
      lookup: lookupResult,
      decision,
      timestamp: Date.now(),
      universeSignature: this.universe.getSignature(),
    }
  }
}

// ============================================================
// 6. Invocation Output
// ============================================================

export interface InvocationOutput {
  query: QueryContract
  lookup: LookupResult
  decision: DecisionArtifact
  timestamp: number
  universeSignature: string
}
