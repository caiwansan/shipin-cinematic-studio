/**
 * RenderAdapter Contract — Frozen Architecture
 * 
 * WORKBENCH-HARDENING-01 Phase 2
 * 
 * 所有 Render 实现必须遵守此接口。
 * 生产环境禁止 LocalMockRenderer — 见 factory.ts。
 */

export interface RenderInput {
  traceId: string
  blueprint: any
}

export interface RenderResult {
  videoUrl: string
  duration?: number
  meta?: any
}

export interface RenderAdapter {
  name: string
  render(input: RenderInput): Promise<RenderResult>
}
