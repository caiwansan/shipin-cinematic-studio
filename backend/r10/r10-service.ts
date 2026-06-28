/**
 * r10/r10-service.ts
 *
 * R10 — 差分分析服务
 *
 * 组合 DiffKernel + ReplayEngine 为统一入口。
 * 遵循三条硬约束：
 *   1. 不可侵入主 runtime（只读 snapshot + output）
 *   2. 无副作用（pure function, stateless）
 *   3. 默认关闭（R10_ENABLED = false）
 */

import { DiffKernel } from "./diff/diff-kernel";
import { ReplayEngine } from "./replay/replay-engine";
import { DiffResult } from "./diff/diff-types";
import { ReplayInput, ReplayOutput, ReplayResult } from "./replay/replay-types";
import { isR10Enabled } from "./r10-config";

export class R10Service {
  private diffKernel = new DiffKernel();
  private replayEngine = new ReplayEngine();

  /**
   * Compare two arbitrary objects and return structured diff.
   * Pure function — no side effects.
   */
  async runDiff(
    baseline: any,
    current: any,
    baselineId: string,
    currentId: string,
  ): Promise<DiffResult | null> {
    if (!isR10Enabled()) {
      console.warn("[R10] R10 is disabled. Enable via r10-config.ts or env.");
      return null;
    }

    return this.diffKernel.buildResult(baseline, current, baselineId, currentId);
  }

  /**
   * Deterministic replay of a snapshot.
   * No external state access.
   */
  async replay(input: ReplayInput): Promise<ReplayOutput | null> {
    if (!isR10Enabled()) {
      console.warn("[R10] R10 is disabled. Enable via r10-config.ts or env.");
      return null;
    }

    return this.replayEngine.replay(input);
  }

  /**
   * Replay + compare with original output for determinism check.
   */
  async compareReplay(
    original: any,
    snapshot: any,
    params?: any,
  ): Promise<ReplayResult | null> {
    if (!isR10Enabled()) {
      console.warn("[R10] R10 is disabled. Enable via r10-config.ts or env.");
      return null;
    }

    return this.replayEngine.compareReplay(original, snapshot, params);
  }
}
