import { FrozenBlueprint } from "./blueprint-freeze"

export interface RenderInput {
  traceId: string
  blueprint: FrozenBlueprint
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

/* Mock implementation */
export class LocalMockRenderer implements RenderAdapter {
  name = "local-mock"

  async render(input: RenderInput): Promise<RenderResult> {
    return {
      videoUrl: `https://mock.video/${input.traceId}.mp4`,
      duration: 3,
      meta: {
        mode: "mock",
        blueprintId: input.blueprint.blueprintId,
      },
    }
  }
}
