/**
 * Autonomous Director — Full Orchestrator
 * Phase 8 — Autonomous Director Layer
 *
 * 自治导演总控：将目标解析 → 故事板生成 → DAG 构建 → 执行规划
 * 编织为完整的自治闭环。
 *
 * 这一层让系统从"执行用户指令"变为"理解目标并自主生成执行方案"。
 * 核心变化：输入从 blueprint → goal（目标字符串）
 */

import { GoalInterpreter, DirectorIntent } from './goal-interpreter'
import { StoryboardGenerator, Storyboard } from './storyboard-generator'
import { SceneGraphComposer, BlueprintDAG } from './scene-graph-composer'
import { AutonomousPlanner, AutonomousPlan } from './autonomous-planner'

export interface AutonomousDirectorInput {
  /** 自然语言目标 */
  goal: string
  /** 可选：覆盖自动解析的参数 */
  overrides?: Partial<DirectorIntent>
}

export interface AutonomousDirectorOutput {
  goal: string
  intent: DirectorIntent
  storyboard: Storyboard
  blueprint: BlueprintDAG
  plan: AutonomousPlan
  trace: string[]
}

export class AutonomousDirector {
  constructor(
    private goalInterpreter: GoalInterpreter = new GoalInterpreter(),
    private storyboardGen: StoryboardGenerator = new StoryboardGenerator(),
    private graphComposer: SceneGraphComposer = new SceneGraphComposer(),
    private planner: AutonomousPlanner = new AutonomousPlanner(),
  ) {}

  /**
   * 运行一次完整的自治导演闭环
   * goal → intent → storyboard → blueprint → plan
   */
  run(input: AutonomousDirectorInput): AutonomousDirectorOutput {
    const trace: string[] = []

    // Step 1: 解析目标
    const intent = input.overrides
      ? { ...this.goalInterpreter.parse(input.goal), ...input.overrides }
      : this.goalInterpreter.parse(input.goal)
    trace.push(`🎯 目标解析: ${intent.intent} | ${intent.style} | ${intent.duration} | ${intent.mood}`)

    // Step 2: 生成故事板
    const storyboard = this.storyboardGen.generate(intent)
    trace.push(`📋 故事板生成: ${storyboard.scenes.length} 场景, ${storyboard.totalShots} 镜头`)

    for (const s of storyboard.scenes) {
      trace.push(`  ├─ ${s.id}: ${s.name} (${s.shots} 镜头, ${s.narrativeBeat})`)
    }

    // Step 3: 构建 DAG
    const blueprint = this.graphComposer.compose(storyboard)
    trace.push(`🌐 DAG 构建: ${blueprint.scenes.length} 场景节点 + ${storyboard.totalShots} 镜头子节点`)

    // Step 4: 执行规划
    const plan = this.planner.plan(blueprint)
    trace.push(`📊 执行规划: ${plan.items.length} 节点, 可并行化 ${plan.totalEstimate.parallelizable}%`)

    return {
      goal: input.goal,
      intent,
      storyboard,
      blueprint,
      plan,
      trace,
    }
  }
}
