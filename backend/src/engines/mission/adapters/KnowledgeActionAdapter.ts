import { Action } from '../models/Action'
import { ActionIdBuilder } from '../models/ActionIdBuilder'
import { EngineType } from '../models/EngineType'

export class KnowledgeActionAdapter {
  adapt(insight: any, objectId: string): Action {
    const impactText = insight.recommendation.estimatedImpact || '+0%'
    const percentage = parseInt(impactText.replace(/[^0-9]/g, '')) || 0

    return {
      id: ActionIdBuilder.build(EngineType.Knowledge, objectId),
      title: insight.recommendation.expectedBenefit,
      reason: insight.recommendation.reason,
      priority: insight.recommendation.priority,
      impact: { percentage, text: impactText },
      actions: [
        { id: `action-item:open:${objectId}`, label: 'Open Knowledge Object', type: 'navigate' }
      ],
      source: {
        engine: EngineType.Knowledge,
        version: '1.0',
        objectId,
        objectType: 'knowledge-object'
      }
    }
  }
}
