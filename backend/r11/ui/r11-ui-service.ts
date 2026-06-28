/**
 * r11/ui/r11-ui-service.ts
 *
 * Phase 3A + 3B — R11 Observability Console Service
 *
 * 统一视觉投影层入口 + 时间维稳定性监控。
 *
 * 三层职责：
 *   1. Structure View — 系统结构显微镜
 *   2. Diff Timeline — 系统时间显微镜
 *   3. Replay Inspector — 系统行为显微镜
 *   4. Drift Monitor — 系统稳定性显微镜（时间维 overlay）
 *
 * 铁律（不可违反）：
 *   - PASSIVE: 不做任何计算，只投影已有数据
 *   - DERIVED: 所有数据来自 R11 ExecutionGraph / DiffResult / ReplayTrace
 *   - NON-INTERPRETING: 禁止标注"重要/异常/bug"
 */

import { R11Service } from "../r11-service";
import { isR10Enabled } from "../../r10/r10-config";

import { StructureViewModel, type StructureViewState, type ViewMode } from "./view-models/structure.vm";
import { TimelineViewModel, type TimelineViewState } from "./view-models/timeline.vm";
import { ReplayViewModel, type ReplayViewState } from "./view-models/replay.vm";

import { GraphViewAdapter, type GraphRenderData } from "./adapters/graph-view.adapter";
import { DiffViewAdapter, type DiffRenderData } from "./adapters/diff-view.adapter";
import { ReplayViewAdapter, type ReplayRenderData } from "./adapters/replay-view.adapter";

import { FidelityTest, type FidelityReport } from "../test/fidelity-test";

// Phase 3B — Drift
import { DriftRegistry } from "../drift/drift-registry";
import { DriftDetector } from "../drift/drift-detector";
import { AdapterRegressionMonitor, type RegressionResult } from "../drift/adapter-regression-monitor";
import type { DriftRecord, DriftDelta, DriftReport } from "../drift/types";

// Phase 4 — Stability
import { R11StabilityService } from "../stability/r11-stability-service";

// Phase 5 — Causal
import { CausalTracer, type CausalInput } from "../causal/causal-tracer";
import { CausalGraphBuilder } from "../causal/causal-graph-builder";

export class R11UIService {
  private r11: R11Service;
  private structureVM = new StructureViewModel();
  private timelineVM = new TimelineViewModel();
  private replayVM = new ReplayViewModel();

  private graphAdapter = new GraphViewAdapter();
  private diffAdapter = new DiffViewAdapter();
  private replayAdapter = new ReplayViewAdapter();

  // Phase 3B — Drift internals
  private driftRegistry = new DriftRegistry();
  private driftDetector = new DriftDetector();
  private regressionMonitor = new AdapterRegressionMonitor();

  // Phase 4 — Stability
  readonly stability = new R11StabilityService();

  // Phase 5 — Causal
  private causalTracer = new CausalTracer();
  private causalGraphBuilder = new CausalGraphBuilder();
  private causalReports: import("../causal/causal-types").CausalReport[] = [];

  constructor(r11: R11Service) {
    this.r11 = r11;
  }

  /**
   * Check if R11 UI is active.
   */
  isActive(): boolean {
    return isR10Enabled();
  }

  // ─── Structure View ────────────────────────────────────────

  /**
   * Get graph render data for a domain.
   * Returns null if inactive.
   */
  getGraphView(domain: string, rawGraph: any, viewMode: ViewMode = "normalized", fidelity?: FidelityReport): GraphRenderData | null {
    if (!this.isActive()) return null;

    const graph = this.r11.project(domain, rawGraph);
    if (!graph) return null;

    const state = this.structureVM.fromGraph(graph, viewMode, fidelity);
    return this.graphAdapter.project(state);
  }

  /**
   * Get structure view state (for raw data consumption).
   */
  getStructureState(domain: string, rawGraph: any, viewMode: ViewMode = "normalized"): StructureViewState | null {
    if (!this.isActive()) return null;

    const graph = this.r11.project(domain, rawGraph);
    if (!graph) return null;

    return this.structureVM.fromGraph(graph, viewMode);
  }

  // ─── Diff Timeline ─────────────────────────────────────────

  /**
   * Get diff render data.
   */
  getDiffView(diffInput: { baseline: any; current: any; domain: string; baselineId: string; currentId: string }): DiffRenderData | null {
    if (!this.isActive()) return null;

    const baseline = this.r11.project(diffInput.domain, diffInput.baseline);
    const current = this.r11.project(diffInput.domain, diffInput.current);
    if (!baseline || !current) return null;

    const diffResult = this.r11.diff(baseline, current, diffInput.baselineId, diffInput.currentId);
    if (!diffResult) return null;

    const timelineDiff = this.timelineVM.fromDiff(diffResult);
    return this.diffAdapter.project(timelineDiff);
  }

  // ─── Replay Inspector ──────────────────────────────────────

  /**
   * Get replay render data.
   */
  getReplayView(domain: string, rawGraph: any, iteration: number = 1): ReplayRenderData | null {
    if (!this.isActive()) return null;

    const graph = this.r11.project(domain, rawGraph);
    if (!graph) return null;

    const state = this.replayVM.fromGraph(graph, iteration);
    return this.replayAdapter.project(state);
  }

  /**
   * Get replay determinism check across multiple iterations.
   */
  checkReplayDeterminism(domain: string, rawGraph: any, iterations: number = 5): {
    deterministic: boolean;
    count: number;
    allSame: boolean;
    firstHash: string;
  } | null {
    if (!this.isActive()) return null;

    const states: ReplayViewState[] = [];
    for (let i = 0; i < iterations; i++) {
      const graph = this.r11.project(domain, rawGraph);
      if (!graph) return null;
      states.push(this.replayVM.fromGraph(graph, i + 1));
    }

    return this.replayVM.checkDeterminism(states);
  }

  // ─── Fidelity ──────────────────────────────────────────────

  /**
   * Run fidelity test and return result.
   */
  getFidelity(domain: string, rawGraph: any): FidelityReport | null {
    if (!this.isActive()) return null;

    const tester = new FidelityTest(this.r11.getRegistry());
    try {
      return tester.run(domain, rawGraph);
    } catch {
      return null;
    }
  }

  // ─── Phase 3B: Drift Monitor ───────────────────────────────

  /**
   * Record a drift observation snapshot.
   * 记录当前投影状态的 hash + fidelity，标记时间维。
   */
  recordDrift(domain: string, rawGraph: any, runId: string, adapterVersion?: string): DriftRecord | null {
    if (!this.isActive()) return null;

    const graph = this.r11.project(domain, rawGraph);
    if (!graph) return null;

    const fidelityReport = this.getFidelity(domain, rawGraph);
    const replayView = this.getReplayView(domain, rawGraph, 1);

    const record: DriftRecord = {
      timestamp: Date.now(),
      domain,
      runId,
      projectionHash: this.hashData(graph),
      replayHash: replayView?.traceHash ?? "",
      fidelityScore: fidelityReport?.fidelityScore ?? 0,
      adapterVersion: adapterVersion ?? "v1",
    };

    this.driftRegistry.record(record);
    return record;
  }

  /**
   * Get drift report for all domains or specific domain.
   */
  getDriftReport(domain?: string): DriftReport {
    const records = this.driftRegistry.getRecords(domain);
    return this.driftDetector.generateReport(records);
  }

  /**
   * Get drift timeline data for UI consumption.
   */
  getDriftTimeline(domain?: string): DriftTimelineData {
    const records = this.driftRegistry.getRecords(domain);
    const report = this.driftDetector.generateReport(records);

    return {
      domains: report.domains,
      totalRecords: report.totalRecords,
      latestFidelity: report.latestRecord?.fidelityScore ?? 0,
      trend: report.deltas.map((d) => ({
        fromTimestamp: records[d.fromIdx]?.timestamp ?? 0,
        toTimestamp: records[d.toIdx]?.timestamp ?? 0,
        fidelityScore: records[d.toIdx]?.fidelityScore ?? 0,
        projectionDrift: d.delta.projectionDrift,
        replayDrift: d.delta.replayDrift,
        regression: d.delta.regression,
      })),
      regressionCount: report.regressions.length,
      adapterChanges: this.regressionMonitor.versionBoundedCheck(records),
    };
  }

  /**
   * Get raw drift registry (for testing / introspection).
   */
  getDriftRegistry(): DriftRegistry {
    return this.driftRegistry;
  }

  /**
   * Clear drift history.
   */
  clearDriftHistory(): void {
    this.driftRegistry.clear();
  }

  // ─── Phase 4: Stability Hardening ──────────────────────────

  /**
   * 综合稳定性评估：policy + SLA + adapter governance.
   */
  evaluateStability(domain: string, fidelity: number, history: number[]) {
    return this.stability.evaluate(domain, fidelity, history);
  }

  /**
   * 检查 adapter 更新是否被阻碍。
   */
  canUpdateAdapter(domain: string, newVersion: string) {
    return this.stability.canUpdateAdapter(domain, newVersion);
  }

  // ─── Phase 5: Causal Drift Attribution ─────────────────────

  /**
   * 将 drift timeline point 归因为因果链。
   */
  attributeDrift(input: CausalInput) {
    const report = this.causalTracer.trace(input);
    this.causalReports.push(report);
    return report;
  }

  /**
   * 批量归因 — 将 drift timeline 的多个点一并投射到因果图。
   */
  attributeDriftBatch(inputs: CausalInput[]) {
    const reports = this.causalTracer.traceBatch(inputs);
    this.causalReports.push(...reports);
    return reports;
  }

  /**
   * 获取合并因果图（所有已归因事件的合并视图）。
   */
  getCausalGraph() {
    return this.causalGraphBuilder.merge(this.causalReports);
  }

  /**
   * 获取所有因果报告。
   */
  getCausalReports() {
    return this.causalReports;
  }

  /**
   * 清空因果报告历史。
   */
  clearCausalHistory() {
    this.causalReports = [];
  }

  // ─── Private Helpers ───────────────────────────────────────

  private hashData(data: any): string {
    // Normalize: strip meta (non-structural), convert Maps to arrays
    const normalized = {
      domain: data.domain,
      nodes: Array.isArray(data.nodes)
        ? data.nodes.map((n: any) => ({ id: n.id, type: n.type, domainId: n.domainId }))
        : [],
      edges: Array.isArray(data.edges)
        ? data.edges.map((e: any) => ({ from: e.from, to: e.to, type: e.type }))
        : [],
    };
    const raw = JSON.stringify(normalized);
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

export interface DriftTimelinePoint {
  fromTimestamp: number;
  toTimestamp: number;
  fidelityScore: number;
  projectionDrift: boolean;
  replayDrift: boolean;
  regression: boolean;
}

export interface DriftTimelineData {
  domains: string[];
  totalRecords: number;
  latestFidelity: number;
  trend: DriftTimelinePoint[];
  regressionCount: number;
  adapterChanges: RegressionResult[];
}
