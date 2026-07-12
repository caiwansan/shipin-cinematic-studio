import { getMissionControl } from '../../src/services/geo/workspace/mission-control'
import { buildTimelineEvents, timelineStore } from '../../src/services/geo/workspace/timeline'

;(async () => {
  timelineStore.recordBatch(buildTimelineEvents({
    executionId: 'disco-demo-002',
    execution: { projectId: 'proj-demo', entityId: 'e-demo', timestamp: new Date().toISOString(), replayCount: 0, lastReplayAt: null },
    result: {
      entity: { name: '星辰智能科技' },
      metadata: {
        signals: [
          { id: 's1', type: 'presence', provider: 'deepseek', confidence: 0.55, evidence: [{ summary: '部分可见', source: 'deepseek', confidence: 0.55 }], timestamp: new Date().toISOString(), cost: { tokensIn: 100, tokensOut: 50, latencyMs: 700 } },
          { id: 's2', type: 'knowledge', provider: 'deepseek', confidence: 0.38, evidence: [{ summary: '知识覆盖较低', source: 'deepseek', confidence: 0.38 }], timestamp: new Date().toISOString(), cost: { tokensIn: 50, tokensOut: 30, latencyMs: 400 } },
        ],
        latencyMs: 1100, providers: [{ name: 'deepseek', latencyMs: 700 }],
      },
    },
    diagnostics: { stages: [], errors: [] },
  }))

  const control = await getMissionControl()
  console.log('=== Mission Control (with Timeline) ===')
  console.log('Entity:', control.entityName)
  console.log('AI Visibility:', control.aiVisibility)
  console.log('')
  console.log('Recent Activity:', control.recentActivity?.length || 0, 'events')
  for (const e of (control.recentActivity || []).slice(0, 5)) {
    console.log(`  ${e.level === 'warning' ? '⚠' : '●'} ${e.title}`)
    console.log(`      ${e.detail}`)
  }
  console.log('')
  console.log('Actionable:', control.actionableItems?.length || 0, 'items')
  for (const a of (control.actionableItems || [])) {
    console.log(`  ⚡ ${a.title} → ${a.route}`)
  }
  console.log('')
  console.log('✅ RC-W1-B verified')
})()
