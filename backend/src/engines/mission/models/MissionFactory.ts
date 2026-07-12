import { Mission } from './Mission'
import { MissionPriority } from './MissionPriority'
import { Action } from './Action'
import { MissionIdBuilder } from './MissionIdBuilder'
import { ActionItem } from './ActionItem'

/**
 * MissionFactory only handles object creation.
 * Does NOT: sort, score, merge, or dedup.
 */
export class MissionFactory {
  static createFromAction(
    action: Action,
    priorityScore: number,
    missionPriority: MissionPriority
  ): Mission {
    return {
      id: MissionIdBuilder.build({ engine: action.source.engine, objectId: action.source.objectId }),
      title: action.title,
      reason: action.reason,
      priority: missionPriority,
      priorityScore,
      impact: { ...action.impact },
      actions: action.actions.map((a: ActionItem) => ({ ...a })),
      source: { ...action.source }
    }
  }
}
