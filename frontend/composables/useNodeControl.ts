/**
 * useNodeControl — Control Layer UI Binding Hook
 * Phase 4 — Execution Control Layer
 *
 * 前端操纵 DAG 执行的控制接口：
 * - retryNode: 局部重跑子树
 * - patchNode: 运行时节点补丁
 */

export interface RetryNodeResult {
  success: boolean
  traceId: string
  nodeId: string
  jobId?: string
  affectedNodes?: string[]
  error?: string
}

export interface PatchNodeResult {
  success: boolean
  traceId: string
  nodeId: string
  patchApplied: boolean
  error?: string
}

export function useNodeControl(apiBase = '/api/workbench') {
  async function retryNode(traceId: string, nodeId: string): Promise<RetryNodeResult> {
    const res = await fetch(`${apiBase}/retry-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traceId, nodeId }),
    })
    const data = await res.json()
    return data.payload as RetryNodeResult
  }

  async function patchNode(
    traceId: string,
    nodeId: string,
    patch: Record<string, unknown>,
  ): Promise<PatchNodeResult> {
    const res = await fetch(`${apiBase}/patch-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traceId, nodeId, patch }),
    })
    const data = await res.json()
    return data.payload as PatchNodeResult
  }

  return { retryNode, patchNode }
}
