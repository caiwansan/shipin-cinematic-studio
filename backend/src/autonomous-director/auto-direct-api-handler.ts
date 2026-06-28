/**
 * Autonomous Director API Handler
 * Phase 8 — Autonomous Director Layer
 */

import { AutonomousDirector, AutonomousDirectorInput, AutonomousDirectorOutput } from './autonomous-director'

const director = new AutonomousDirector()

export interface AutoDirectRequest {
  goal: string
  /** 可选覆盖参数 */
  style?: string
  duration?: string
  mood?: string
}

/**
 * 自治导演 API
 * POST /api/workbench/auto-direct
 */
export async function handleAutoDirect(req: AutoDirectRequest) {
  try {
    const input: AutonomousDirectorInput = {
      goal: req.goal,
      overrides: {
        ...(req.style ? { style: req.style as any } : {}),
        ...(req.duration ? { duration: req.duration as any } : {}),
        ...(req.mood ? { mood: req.mood as any } : {}),
      },
    }

    const result = director.run(input)
    return { success: true, result }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
