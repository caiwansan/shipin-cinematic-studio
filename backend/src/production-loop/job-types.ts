import { FrozenBlueprint } from "./blueprint-freeze"
import { RenderResult } from "./render-adapter"

export type JobState =
  | "PENDING"
  | "DISPATCHED"
  | "RUNNING"
  | "POSTPROCESS"
  | "DONE"
  | "FAILED"

export interface RenderJob {
  id: string
  traceId: string
  state: JobState
  blueprint: FrozenBlueprint
  result?: RenderResult
  error?: string
  updatedAt: number
}
