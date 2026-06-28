/**
 * r11/ui/adapters/replay-view.adapter.ts
 *
 * Replay View Adapter — 执行轨迹渲染数据投影
 *
 * 职责：把 ReplayViewState 转为 step-by-step 渲染数据。
 * 纯被动投影——不标记 divergence（Phase 4），不判断异常。
 */

import type { ReplayViewState, ReplayStepVM } from "../view-models/replay.vm";

export interface ReplayStepRender {
  step: number;
  nodeId: string;
  nodeType: string;
  incomingFrom: string[];
  outgoingTo: string[];
  /** Human-readable label */
  label: string;
}

export interface ReplayRenderData {
  domain: string;
  iteration: number;
  totalSteps: number;
  deterministic: boolean;
  traceHash: string;
  steps: ReplayStepRender[];
}

export class ReplayViewAdapter {
  /**
   * Project ReplayViewState to render data.
   */
  project(state: ReplayViewState): ReplayRenderData {
    const steps: ReplayStepRender[] = state.trace.steps.map((s: ReplayStepVM) => ({
      step: s.step,
      nodeId: s.nodeId,
      nodeType: s.nodeType,
      incomingFrom: s.incomingFrom,
      outgoingTo: s.outgoingTo,
      label: `Step ${s.step}: ${s.nodeId} (${s.nodeType})`,
    }));

    return {
      domain: state.domain,
      iteration: state.iteration,
      totalSteps: state.totalSteps,
      deterministic: state.deterministic,
      traceHash: state.traceHash,
      steps,
    };
  }

  /**
   * Project multiple traces for comparison.
   */
  projectAll(states: ReplayViewState[]): ReplayRenderData[] {
    return states.map((s) => this.project(s));
  }
}
