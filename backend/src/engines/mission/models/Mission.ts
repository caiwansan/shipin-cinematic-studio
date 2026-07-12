import { MissionPriority } from './MissionPriority'
import { ActionItem } from './ActionItem'

export interface Mission {
  id: string
  title: string
  reason: string
  priority: MissionPriority
  priorityScore: number
  impact: { percentage: number; text: string }
  actions: ActionItem[]
  source: {
    engine: string
    version: string
    objectId: string
    objectType: string
  }
}
