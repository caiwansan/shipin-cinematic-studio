/**
 * DAG Patch Engine
 * Phase 4 — Execution Control Layer
 *
 * 运行时 DAG 编辑核心操作：
 * - updateNode: 修改节点属性（内容 / 状态 / 元数据）
 * - rewire: 重新连接边（from → oldTo → newTo）
 *
 * 注意：patch 不直接修改 FrozenBlueprint，patch 在 Control Layer 完成后再
 * 由 ReExecutionEngine 调用 freezeBlueprint 产生新的 FrozenBlueprint 实例。
 */

export interface PatchOp {
  nodeId: string
  patch: Record<string, unknown>
}

export interface RewireOp {
  from: string
  oldTo: string
  newTo: string
}

export class DAGPatchEngine {
  /**
   * 对 blueprint 中的指定节点应用 patch（浅合并）
   */
  updateNode(blueprint: any, nodeId: string, patch: Record<string, unknown>): any {
    const node = this.findNode(blueprint, nodeId)
    if (!node) {
      throw new Error(`DAGPatchEngine: node ${nodeId} not found in blueprint`)
    }
    Object.assign(node, patch)
    return blueprint
  }

  /**
   * 重连边：将 from→oldTo 的连接改为 from→newTo
   * 当前实现：寻找 scenes/shots 中的父子关系
   */
  rewire(blueprint: any, from: string, oldTo: string, newTo: string): any {
    const raw = blueprint?.data ?? blueprint

    // Scene → Shot 层级：修改 shot.parentId
    const scene = this.findNode(raw, from)
    if (!scene) {
      throw new Error(`DAGPatchEngine: source node ${from} not found`)
    }

    if (scene.type === 'DIRECTOR') {
      const sceneNodes = raw.scenes || []
      const targetScene = sceneNodes.find((s: any) => s.id === oldTo)
      if (targetScene) {
        // 从 director 的 scenes 数组中 find + replace
        const idx = sceneNodes.indexOf(targetScene)
        const newSceneNode = sceneNodes.find((s: any) => s.id === newTo)
        if (newSceneNode && idx !== -1) {
          sceneNodes[idx] = newSceneNode
        }
      }
    } else if (scene.type === 'SCENE') {
      const shotNodes = scene.shots || []
      const targetShot = shotNodes.find((sh: any) => sh.id === oldTo)
      if (targetShot) {
        const idx = shotNodes.indexOf(targetShot)
        const newShotNode = shotNodes.find((sh: any) => sh.id === newTo)
        if (newShotNode && idx !== -1) {
          shotNodes[idx] = newShotNode
        }
      }
    }

    return blueprint
  }

  /**
   * 在 blueprint 中查找节点（DFS 遍历 director → scenes → shots）
   * 自动解包 FrozenBlueprint（blueprint.data）
   */
  findNode(blueprint: any, id: string): any | undefined {
    const raw = blueprint?.data ?? blueprint
    const all = this.walk(raw)
    return all.find((n: any) => n.id === id)
  }

  /**
   * 展开 blueprint 为扁平节点数组
   * 自动解包 FrozenBlueprint（blueprint.data）
   */
  walk(blueprint: any): any[] {
    const raw = blueprint?.data ?? blueprint
    const nodes: any[] = []

    if (raw.director) {
      nodes.push(raw.director)
    }

    for (const scene of raw.scenes || []) {
      nodes.push(scene)
      for (const shot of scene.shots || []) {
        nodes.push(shot)
      }
    }

    return nodes
  }

  /**
   * 计算两个 blueprint 之间的差异（节点级别）
   */
  diff(a: any, b: any): { updated: string[]; added: string[]; removed: string[] } {
    const nodesA = this.walk(a?.data ?? a)
    const nodesB = this.walk(b?.data ?? b)

    const idsA = new Set(nodesA.map((n: any) => n.id))
    const idsB = new Set(nodesB.map((n: any) => n.id))

    const added = nodesB.filter((n: any) => !idsA.has(n.id)).map((n: any) => n.id)
    const removed = nodesA.filter((n: any) => !idsB.has(n.id)).map((n: any) => n.id)

    const updated: string[] = []
    for (const nodeA of nodesA) {
      const nodeB = nodesB.find((n: any) => n.id === nodeA.id)
      if (nodeB && JSON.stringify(nodeA) !== JSON.stringify(nodeB)) {
        updated.push(nodeA.id)
      }
    }

    return { updated, added, removed }
  }
}
