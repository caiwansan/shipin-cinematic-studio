export class MissionIdBuilder {
  static build(input: { engine: string; objectId: string }): string {
    return `mission:${input.engine}:${input.objectId}`
  }
}
