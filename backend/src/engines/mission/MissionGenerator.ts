import { Action } from './models/Action'
import { Mission } from './models/Mission'
import { MissionScoreCalculator } from './MissionScoreCalculator'
import { MissionFactory } from './models/MissionFactory'

export class MissionGenerator {
  /**
   * Current pipeline:
   *   Action[] → Mission[]
   * 
   * Future pipeline:
   *   Action[] → MissionCandidate[] (dedup) → Mission[]
   * 
   * Refer to models/MissionCandidate.ts for the candidate layer interface.
   * Do NOT change this method without considering dedup requirements.
   */
  generate(actions: Action[]): Mission[] {
    return actions.map(action => {
      const { priorityScore, missionPriority } = MissionScoreCalculator.calculate({
        priority: action.priority,
        impactPercentage: action.impact.percentage
      })
      return MissionFactory.createFromAction(action, priorityScore, missionPriority)
    })
  }
}
