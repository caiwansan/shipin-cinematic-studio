import { KnowledgeActionAdapter } from './adapters/KnowledgeActionAdapter'
import { MissionGenerator } from './MissionGenerator'
import { MissionPrioritizer } from './MissionPrioritizer'

// 验证用例
const adapter = new KnowledgeActionAdapter()
const actions = [
  adapter.adapt({
    recommendation: { priority: 'High', estimatedImpact: '+12%', expectedBenefit: 'Increase AI citation coverage', reason: 'Low coverage limits AI scenario matching' }
  }, 'obj-001'),
  adapter.adapt({
    recommendation: { priority: 'Medium', estimatedImpact: '+5%', expectedBenefit: 'Strengthen source authority', reason: 'Authoritative sources increase citation trust' }
  }, 'obj-002'),
  adapter.adapt({
    recommendation: { priority: 'Low', estimatedImpact: '+3%', expectedBenefit: 'Resolve content contradictions', reason: 'Inconsistent entity references reduce AI comprehension' }
  }, 'obj-003')
]

const generator = new MissionGenerator()
const prioritizer = new MissionPrioritizer()
const missions = prioritizer.prioritize(generator.generate(actions))

// 验证
console.assert(missions[0].id === 'mission:knowledge:obj-001', `id mismatch: ${missions[0].id}`)
console.assert(missions[0].priorityScore === 76, `score mismatch: ${missions[0].priorityScore}`)
console.assert(missions[0].priority === 'P0', `priority mismatch: ${missions[0].priority}`)
console.assert(missions[0].impact.percentage === 12, `impact mismatch: ${missions[0].impact.percentage}`)

console.assert(missions[1].id === 'mission:knowledge:obj-002')
console.assert(missions[1].priorityScore === 47, `score mismatch: ${missions[1].priorityScore}`)
console.assert(missions[1].priority === 'P2', `priority mismatch: ${missions[1].priority}`)

console.assert(missions[2].id === 'mission:knowledge:obj-003')
console.assert(missions[2].priorityScore === 16, `score mismatch: ${missions[2].priorityScore}`)
console.assert(missions[2].priority === 'P3')

// 验证排序
console.assert(missions[0].priorityScore > missions[1].priorityScore)
console.assert(missions[1].priorityScore > missions[2].priorityScore)

// 验证 EngineType
console.assert(actions[0].source.engine === 'knowledge')

// 验证 Action ID
console.assert(actions[0].id === 'action:knowledge:obj-001')

// 验证 ActionItem
console.assert(actions[0].actions[0].label === 'Open Knowledge Object')
console.assert(actions[0].actions[0].type === 'navigate')

// 验证 Source Version
console.assert(actions[0].source.version === '1.0')

console.log('All assertions passed.')
