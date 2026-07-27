/**
 * MockRenderAdapter — 仅允许 test/dev
 * 
 * 与原 LocalMockRenderer 等价，但：
 * 1. 名称明确为 Mock
 * 2. 由 RenderAdapterFactory 控制实例化
 * 3. 生产环境禁止（factory 不返回此实现）
 */

import type { RenderAdapter, RenderInput, RenderResult } from './render-adapter'

export class MockRenderAdapter implements RenderAdapter {
  name = 'mock-render'

  async render(input: RenderInput): Promise<RenderResult> {
    return {
      videoUrl: `https://mock.video/${input.traceId}.mp4`,
      duration: 3,
      meta: {
        mode: 'mock',
        blueprintId: input.blueprint?.blueprintId,
      },
    }
  }
}
