/**
 * Temporal Consistency Engine — Full Orchestrator
 * Temporal Consistency Engine — 时间连续性引擎
 *
 * 总控编排器：将镜头链构建 → 连续性追踪 → 过渡注入 编织为完整链路。
 *
 * 使用方式：
 *   const shots = [cinematicShot1, cinematicShot2, ...]
 *   const engine = new TemporalConsistencyEngine()
 *   const result = engine.run(shots)
 *
 * result 包含：
 *   - links: 每个镜头的完整连续性追踪
 *   - injected: 注入过渡提示后的 prompt
 *   - averageContinuity: 整条链的连续性评分
 *   - weakLinks: 需要人工关注的断裂点
 */

import { CinematicShot } from '../cinematic-compiler/cinematic-dsl-schema'
import { SceneChainBuilder, ChainLink, SceneChain } from './scene-chain-builder'
import { TemporalPromptInjector, InjectedShot } from './temporal-prompt-injector'

export interface TemporalResult {
  /** 镜头链 */
  chain: SceneChain
  /** 注入过渡提示后的结果 */
  injected: InjectedShot[]
  /** 平均连续性分数 */
  averageContinuity: number
  /** 薄弱环节（continuity < 0.4 的镜头） */
  weakLinks: ChainLink[]
  /** 摘要 */
  summary: string
}

export class TemporalConsistencyEngine {
  constructor(
    private chainBuilder: SceneChainBuilder = new SceneChainBuilder(),
    private injector: TemporalPromptInjector = new TemporalPromptInjector(),
  ) {}

  /**
   * 运行完整的时间连续性处理流程
   */
  run(shots: CinematicShot[]): TemporalResult {
    // Step 1: 构建镜头链
    const chain = this.chainBuilder.build(shots)

    // Step 2: 注入过渡提示
    const injected = this.injector.inject(chain.links)

    // Step 3: 识别薄弱环节
    const weakLinks = chain.links.filter(l => l.continuityScore < 0.4)

    // Step 4: 生成摘要
    const summary = this.generateSummary(chain, weakLinks.length)

    return {
      chain,
      injected,
      averageContinuity: chain.averageContinuity,
      weakLinks,
      summary,
    }
  }

  private generateSummary(chain: SceneChain, weakCount: number): string {
    const continuityLabel = chain.averageContinuity >= 0.7
      ? '优秀'
      : chain.averageContinuity >= 0.5
        ? '一般'
        : '需优化'

    return [
      `🎬 镜头连续性分析: ${continuityLabel}`,
      `  ├─ 镜头数: ${chain.links.length}`,
      `  ├─ 平均连续性: ${(chain.averageContinuity * 100).toFixed(0)}%`,
      `  ├─ 注入过渡提示: ${chain.transitionHintCount} 次`,
      `  └─ 薄弱环节: ${weakCount} 处`,
    ].join('\n')
  }
}
