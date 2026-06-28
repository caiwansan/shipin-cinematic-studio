import { RenderJob, JobState } from "./job-types"

/**
 * 纯状态机（无副作用）
 * 只负责状态迁移
 */
export class JobStateMachine {
  transition(job: RenderJob, next: JobState): RenderJob {
    return {
      ...job,
      state: next,
      updatedAt: Date.now(),
    }
  }
}
