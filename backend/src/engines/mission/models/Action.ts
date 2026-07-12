import { EngineType } from './EngineType'
import { ActionPriority } from './ActionPriority'
import { ActionItem } from './ActionItem'

export interface Action {
  id: string
  title: string
  reason: string
  priority: ActionPriority
  impact: {
    percentage: number
    text: string
  }
  actions: ActionItem[]
  source: {
    engine: EngineType
    version: string
    objectId: string
    objectType: string
  }
}
