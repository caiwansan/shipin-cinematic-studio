/**
 * v1_3/integration-runner.ts
 *
 * v1.3 Temporal Dynamics — Σ(t) 时序积分器
 *
 * 迭代演化 engine：
 * 1. 应用 dΣ/dt 一步演化
 * 2. 检测相变
 * 3. 记录演化轨迹
 *
 * 每一 time step = 一次"外源注入事件 + 内源松弛 + 熵响应"的完整耦合。
 */

import type { SystemInstance } from "../v1_1/system-instance";
import { DynamicsEquation, type DynamicsConfig, type EvolutionSnapshot } from "./dynamics-equation";
import { BasinDriftField } from "./basin-drift-field";
import { MutationFlux } from "./mutation-flux";
import { PhaseTransitionDetector, type PhaseTransitionEvent } from "./phase-transition";

export interface IntegrationResult {
  /** 完整演化轨迹 */
  snapshots: EvolutionSnapshot[];
  /** 总步数 */
  totalSteps: number;
  /** 最终 Σ 结构 */
  finalState: {
    families: Map<string, SystemInstance[]>;
    structuralEnergy: number;
    mutationFlux: number;
    phase: string;
  };
  /** 相变历史 */
  transitions: PhaseTransitionEvent[];
  /** 是否进入稳定状态 */
  isStable: boolean;
}

export class IntegrationRunner {
  private dynamics: DynamicsEquation;
  private drift: BasinDriftField;
  private flux: MutationFlux;
  private phaseTransition: PhaseTransitionDetector;

  constructor(config?: Partial<DynamicsConfig>) {
    this.dynamics = new DynamicsEquation(config);
    this.drift = new BasinDriftField();
    this.flux = new MutationFlux();
    this.phaseTransition = new PhaseTransitionDetector();
  }

  /**
   * 从初始 Σ 开始逐 time step 演化。
   *
   * 每次 iteration:
   * 1. 注入外部系统（可选）
   * 2. 计算一步 dΣ/dt
   * 3. 检测相变
   * 4. 记录 snapshot
   * 5. 更新 family 结构（如果发生相变）
   */
  integrate(
    initialSystems: SystemInstance[],
    initialFamilies: Map<string, SystemInstance[]>,
    steps: number,
    externalInjections: SystemInstance[][] = []
  ): IntegrationResult {
    const snapshots: EvolutionSnapshot[] = [];
    const transitions: PhaseTransitionEvent[] = [];

    let currentSystems = [...initialSystems];
    let currentFamilies = this.cloneFamilies(initialFamilies);

    for (let step = 0; step < steps; step++) {
      // 注入外源系统
      if (step < externalInjections.length && externalInjections[step].length > 0) {
        const injected = externalInjections[step];
        currentSystems.push(...injected);

        // drift field 累积
        const driftResult = this.drift.compute(currentFamilies, injected);
        for (const [familyId, drift] of driftResult.drifts) {
          if (drift.driftIntensity > 0.01) {
            // 漂移导致 family 结构变形——简化为投影变化
            //（完整实现需要更新 family members 的 trajectory）
          }
        }
      }

      // 计算一步演化
      const stepResult = this.dynamics.step(currentSystems, currentFamilies);

      // 计算通量
      const fluxResult = this.flux.compute(currentSystems, currentFamilies);

      // 检测相变
      const detectedTransitions = this.phaseTransition.detect(
        currentSystems,
        currentFamilies
      );
      transitions.push(...detectedTransitions.filter((t) => t.type !== "NONE"));

      // 记录 snapshot
      const snapshot: EvolutionSnapshot = {
        step,
        time: step * (this.dynamics as any).config?.dt ?? 0.1,
        result: stepResult,
      };
      snapshots.push(snapshot);

      // 如果检测到相变，更新 family 结构
      for (const transition of detectedTransitions) {
        if (transition.type !== "NONE") {
          currentFamilies = this.applyTransition(
            currentFamilies,
            transition,
            currentSystems
          );
        }
      }

      // 稳定检测：连续 5 步变化极小
      if (this.checkStability(snapshots)) {
        break;
      }
    }

    // 最终状态
    const finalFlux = this.flux.compute(currentSystems, currentFamilies);
    const finalEnergy = this.computeTotalEnergy(currentSystems, currentFamilies);

    return {
      snapshots,
      totalSteps: snapshots.length,
      finalState: {
        families: currentFamilies,
        structuralEnergy: finalEnergy,
        mutationFlux: finalFlux.totalFlux,
        phase: finalFlux.phase,
      },
      transitions,
      isStable: this.checkStability(snapshots),
    };
  }

  private cloneFamilies(
    families: Map<string, SystemInstance[]>
  ): Map<string, SystemInstance[]> {
    const clone = new Map<string, SystemInstance[]>();
    for (const [key, val] of families) {
      clone.set(key, [...val]);
    }
    return clone;
  }

  private applyTransition(
    families: Map<string, SystemInstance[]>,
    transition: PhaseTransitionEvent,
    systems: SystemInstance[]
  ): Map<string, SystemInstance[]> {
    const updated = this.cloneFamilies(families);

    switch (transition.type) {
      case "MERGE": {
        // 合并涉及的 family
        let mergedMembers: SystemInstance[] = [];
        for (const fid of transition.involvedFamilies) {
          const members = updated.get(fid) ?? [];
          mergedMembers.push(...members);
          updated.delete(fid);
        }
        updated.set(transition.suggestedStructure, mergedMembers);
        break;
      }
      case "SPLIT": {
        // 将 family 拆分（按均值距离二分）
        const fid = transition.involvedFamilies[0];
        const members = updated.get(fid) ?? [];
        updated.delete(fid);

        if (members.length >= 2) {
          const half = Math.ceil(members.length / 2);
          updated.set(`${fid}_A`, members.slice(0, half));
          updated.set(`${fid}_B`, members.slice(half));
        }
        break;
      }
      case "EMERGE": {
        // 将孤立系统作为新 family 的原型
        const trajectory = transition.suggestedStructure.replace("NewFamily_from_", "");
        const newSystem = systems.find((s) => s.id === trajectory);
        if (newSystem) {
          updated.set(`NewFamily_${trajectory}`, [newSystem]);
        }
        break;
      }
      case "COLLAPSE": {
        for (const fid of transition.involvedFamilies) {
          updated.delete(fid);
        }
        break;
      }
    }

    return updated;
  }

  private checkStability(snapshots: EvolutionSnapshot[]): boolean {
    if (snapshots.length < 5) return false;

    const recent = snapshots.slice(-5);
    const changes = recent.map((s) => s.result.totalDelta);
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

    return avgChange < 0.01;
  }

  private computeTotalEnergy(
    systems: SystemInstance[],
    families: Map<string, SystemInstance[]>
  ): number {
    const detector = new PhaseTransitionDetector();
    const events = detector.detect(systems, families);
    return events.reduce((max, e) => Math.max(max, e.structuralEnergy), 0);
  }
}
