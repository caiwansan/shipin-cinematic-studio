import { EngineType } from './EngineType'
export class ActionIdBuilder {
  static build(engine: EngineType, objectId: string): string {
    return `action:${engine}:${objectId}`
  }
}
