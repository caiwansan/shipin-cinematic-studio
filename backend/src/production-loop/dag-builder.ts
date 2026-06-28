import { ExecutionTimeline, TimelineNode } from "./timeline-types"

export class DAGBuilder {
  build(traceId: string, blueprint: any): ExecutionTimeline {
    const nodes: Record<string, TimelineNode> = {}

    const directorId = `director_${traceId}`
    nodes[directorId] = {
      id: directorId,
      type: "DIRECTOR",
      traceId,
      payload: blueprint.director,
      status: "DONE",
    }

    blueprint.scenes?.forEach((scene: any, i: number) => {
      const sceneId = `scene_${traceId}_${i}`
      nodes[sceneId] = {
        id: sceneId,
        type: "SCENE",
        traceId,
        parentId: directorId,
        payload: scene,
        status: "DONE",
      }

      scene.shots?.forEach((shot: any, j: number) => {
        const shotId = `shot_${traceId}_${i}_${j}`
        nodes[shotId] = {
          id: shotId,
          type: "SHOT",
          traceId,
          parentId: sceneId,
          payload: shot,
          status: "DONE",
        }
      })
    })

    return { traceId, nodes }
  }
}
