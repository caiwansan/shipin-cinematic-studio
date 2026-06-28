/**
 * Scene Graph Composer
 * Phase 8 — Autonomous Director Layer
 *
 * 自动 DAG 构建器：将故事板转换为可执行的 DAG blueprint。
 *
 * 转换策略：
 *   - 每个 scene 转为 DAG 节点，附 shots 子节点
 *   - 自动建立场景间的渲染依赖边（RENDER_DEP）
 *   - 为每个 scene 分配 timeline order
 *   - 可选：根据风格注入额外依赖（如 cinematic 需要更多 shot 间依赖）
 */

import { Storyboard } from './storyboard-generator'

export interface SceneGraphNode {
  id: string
  name: string
  type: 'SCENE' | 'SHOT'
  order: number
  shots?: SceneGraphNode[]
  /** 策略提示（后续可被 Intelligence Layer 优化） */
  strategy: string
}

export interface BlueprintDAG {
  director: { id: string; type: string; name: string }
  scenes: SceneGraphNode[]
}

export class SceneGraphComposer {
  /**
   * 将故事板转换为可执行的 DAG blueprint
   */
  compose(storyboard: Storyboard): BlueprintDAG {
    const scenes: SceneGraphNode[] = storyboard.scenes.map((sbScene, idx) => ({
      id: sbScene.id,
      name: sbScene.name,
      type: 'SCENE' as const,
      order: idx,
      strategy: 'autonomous',
      shots: sbScene.shotTypes.map((shotType, shotIdx) => ({
        id: `${sbScene.id}_shot_${shotIdx + 1}`,
        name: `${shotType} #${shotIdx + 1}`,
        type: 'SHOT' as const,
        order: shotIdx,
        strategy: `autonomous_${shotType}`,
      })),
    }))

    return {
      director: {
        id: 'director_auto',
        type: 'DIRECTOR',
        name: `Autonomous Director [${storyboard.style}]`,
      },
      scenes,
    }
  }
}
