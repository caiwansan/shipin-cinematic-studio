/**
 * StubRenderAdapter — 生产环境 Render 未就绪时的 FAIL FAST 实现
 * 
 * 原则：宁可明确返回失败，也不能返回假成功。
 * 
 * 当独立 GPU / FFmpeg / COS 链路未配置时，
 * 此 adapter 直接抛出 RENDER_SERVICE_UNAVAILABLE。
 */

import type { RenderAdapter, RenderInput, RenderResult } from './render-adapter'

export class StubRenderAdapter implements RenderAdapter {
  name = 'stub-render'

  async render(_input: RenderInput): Promise<RenderResult> {
    throw new Error(
      'RENDER_SERVICE_UNAVAILABLE: 渲染服务未上线。请配置 GPU Provider 后重试。'
    )
  }
}
