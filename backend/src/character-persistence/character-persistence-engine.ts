/**
 * Character Persistence Engine — Full Orchestrator
 * Character Persistence System — 角色一致性系统
 *
 * 总控编排器：身份锁定 → 跨镜头注入 → 漂移检测 → 自动修复 完整链路。
 *
 * 使用方式：
 *   const shots = ["男人走进酒吧", "男人与调酒师交谈", ...]
 *   const identity = createDefaultCharacter("李默", "char_1")
 *   const engine = new CharacterPersistenceEngine()
 *   const result = engine.run(shots, identity)
 */

import { CharacterIdentity } from './character-identity-graph'
import { CrossShotIdentityInjector, IdentityInjectedShot } from './cross-shot-identity-injector'
import { IdentityDriftDetector, DriftReport } from './identity-drift-detector'
import { IdentityStabilizer, StabilizationAction } from './identity-stabilizer'

export interface CharacterPersistenceResult {
  /** 注入身份信息后的镜头列表 */
  injectedShots: IdentityInjectedShot[]
  /** 漂移报告列表（第 i 项对应 shot[i] 与 shot[i-1] 的对比） */
  driftReports: DriftReport[]
  /** 稳定操作列表 */
  stabilizations: StabilizationAction[]
  /** 整体稳定度 */
  overallStability: 'stable' | 'minor_drift' | 'major_drift'
  /** 摘要 */
  summary: string
}

export class CharacterPersistenceEngine {
  constructor(
    private injector: CrossShotIdentityInjector = new CrossShotIdentityInjector(),
    private driftDetector: IdentityDriftDetector = new IdentityDriftDetector(),
    private stabilizer: IdentityStabilizer = new IdentityStabilizer(),
  ) {}

  /**
   * 运行完整角色一致性处理流程
   */
  run(shotDescriptions: string[], identity: CharacterIdentity): CharacterPersistenceResult {
    // Step 1: 跨镜头注入身份信息
    const injectedShots = this.injector.injectShots(shotDescriptions, identity)

    // Step 2: 对每对相邻镜头检测漂移
    const driftReports: DriftReport[] = []
    for (let i = 1; i < shotDescriptions.length; i++) {
      const report = this.driftDetector.detect(
        shotDescriptions[i - 1],
        shotDescriptions[i],
        identity,
      )
      driftReports.push(report)
    }

    // Step 3: 对漂移的镜头执行稳定修复
    const stabilizations: StabilizationAction[] = []
    for (let i = 0; i < shotDescriptions.length; i++) {
      // 第一个镜头无对比，跳过漂移修复
      if (i === 0) {
        stabilizations.push({
          didStabilize: false,
          stabilizedPrompt: shotDescriptions[i],
          actions: [],
          stabilityLevel: 'stable',
        })
        continue
      }

      const report = driftReports[i - 1]
      const action = this.stabilizer.stabilize(shotDescriptions[i], identity, report)
      stabilizations.push(action)
    }

    // Step 4: 计算整体稳定度
    const driftScores = driftReports.map(r => r.overall)
    const avgDrift = driftScores.length > 0
      ? driftScores.reduce((a, b) => a + b, 0) / driftScores.length
      : 0

    const overallStability: CharacterPersistenceResult['overallStability'] =
      avgDrift < 0.2 ? 'stable'
      : avgDrift < 0.4 ? 'minor_drift'
      : 'major_drift'

    // Step 5: 生成摘要
    const summary = [
      `🎭 角色一致性分析: ${identity.name}`,
      `  ├─ 镜头数: ${shotDescriptions.length}`,
      `  ├─ 整体状态: ${overallStability === 'stable' ? '✅ 稳定' : overallStability === 'minor_drift' ? '⚠️ 轻微漂移' : '❌ 显著漂移'}`,
      `  ├─ 平均漂移: ${(avgDrift * 100).toFixed(0)}%`,
      `  ├─ 身份锁定: face=${identity.facialSignature.features[0] || 'N/A'} | outfit=${identity.outfitSchema.colorPalette.join('/')}`,
      `  └─ 执行修复: ${stabilizations.filter(s => s.didStabilize).length} 次`,
    ].join('\n')

    return { injectedShots, driftReports, stabilizations, overallStability, summary }
  }
}
