/**
 * ★ P0-3: Mission Control Service — uses shared DTO, no local types
 *
 * SSOT: shared/dto/mission-control.dto.ts
 * This file only wraps the API call — no type definitions.
 */
import { geoApi } from './api'
import type { MissionControlDTO } from '../../../../../shared/dto/mission-control.dto'

export type MissionControlData = MissionControlDTO

export async function getMissionControl(projectId?: string): Promise<MissionControlData> {
  const params = projectId ? `?projectId=${projectId}` : ''
  const res = await geoApi.get<MissionControlData>(`/workspace/mission-control${params}`)
  return res.data
}
