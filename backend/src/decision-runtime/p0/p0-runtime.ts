/**
 * p0-runtime.ts — Phase P-0 Runtime（组合层，不含逻辑）
 *
 * ============================================================
 * P-0 组合层。
 * 只组合，不包含业务逻辑。
 *
 * 组装链路：
 *   PolicyGuard → ShadowExecutor → TraceSink
 * ============================================================
 */

import { P0Gateway, P0Request, P0Response } from './p0-gateway.js'
import { E0PolicyGuard } from './policy-guard.js'
import { ShadowExecutor } from './shadow-executor.js'
import { TraceSink } from './trace-sink.js'
import { FrozenUniverseRef } from '../invocation/d1-invocation-engine.js'
import { ScopeRegistry } from '../invocation/e0-boundary-audit.js'
import { Baseline } from '../invocation/d35-normalization.js'
import { SemanticAnchor } from '../proofs/b46/semantic-anchor.js'
import type { ProofKernel } from '../proofs/b1/proof-kernel.js'

export interface P0RuntimeOptions {
  scopeRegistry: ScopeRegistry
  universe: FrozenUniverseRef
  anchor: SemanticAnchor
  proofs: ProofKernel[]
  baseline?: Baseline
}

/**
 * P0Runtime: P-0 完整组合
 *
 * 初始化后调用 handleRequest() 即可处理外部请求。
 */
export class P0Runtime {
  public readonly gateway: P0Gateway
  public readonly guard: E0PolicyGuard
  public readonly shadow: ShadowExecutor
  public readonly sink: TraceSink

  constructor(opts: P0RuntimeOptions) {
    this.guard = new E0PolicyGuard(opts.scopeRegistry)
    this.shadow = new ShadowExecutor(opts.universe, opts.anchor, opts.proofs)
    this.sink = new TraceSink(undefined, opts.baseline)
    this.gateway = new P0Gateway(this.guard, this.shadow, this.sink)
  }

  /**
   * handleRequest: 对外唯一接口
   */
  handleRequest(req: P0Request): P0Response {
    return this.gateway.handle(req)
  }
}

export type { P0Request, P0Response } from './p0-gateway.js'
