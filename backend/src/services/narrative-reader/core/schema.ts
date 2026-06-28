/**
 * schema.ts — Y.1 v0.1 Narrative Reader 类型定义
 *
 * 降级版 schema（经陛下批准的简化方案）：
 * - entities: 实体列表（name + type + weight）
 * - events: 事件列表（text + actors）
 * - 暂不输出: relations, summary_state
 */

export interface Y1Entity {
  name: string
  type: 'person' | 'place' | 'object' | 'organization' | 'concept'
  weight: number  // 0.0 ~ 1.0
}

export interface Y1Event {
  text: string
  actors: string[]
}

export interface Y1Output {
  entities: Y1Entity[]
  events: Y1Event[]
}

export interface ResolvedEntityRef {
  raw: string
  entityId: string
  canonicalName: string
}
