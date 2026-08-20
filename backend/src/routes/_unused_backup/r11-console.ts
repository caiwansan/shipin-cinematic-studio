/**
 * routes/r11-console.ts
 *
 * R11 Observability Console — API 路由
 *
 * 纯被动投影层——所有数据来自 R11Service，无存储、无状态。
 * 铁律：不做任何解释 / 分析 / 标注。
 */

import { FastifyInstance } from "fastify";
import { R11Service } from "../r11/r11-service";
import { R11UIService } from "../r11/ui/r11-ui-service";
import { setR10Config, isR10Enabled } from "../r10/r10-config";
import { AgentGraphAdapter } from "../r11/adapter/adapters/agent-graph-adapter";
import { DecisionGraphAdapter } from "../r11/adapter/adapters/decision-graph-adapter";
import { CharacterImageDAGAdapter } from "../r11/adapter/adapters/character-image-dag-adapter";
import { PromptVersionGraphAdapter } from "../r11/adapter/adapters/prompt-version-graph-adapter";

let r11: R11Service;
let ui: R11UIService;

function ensureService() {
  if (!r11) {
    setR10Config({ enabled: true });
    r11 = new R11Service();
    r11.registerAdapters([
      new AgentGraphAdapter(),
      new DecisionGraphAdapter(),
      new CharacterImageDAGAdapter(),
      new PromptVersionGraphAdapter(),
    ]);
  }
  if (!ui) {
    ui = new R11UIService(r11);
  }
}

export default async function (fastify: FastifyInstance) {
  // ── Graph View ──
  fastify.post("/api/r11/graph-view", async (req, reply) => {
    ensureService();
    if (!ui.isActive()) {
      return reply.status(503).send({ error: "R10 disabled" });
    }

    const { domain, rawGraph, viewMode, fidelity } = req.body as any;
    const data = ui.getGraphView(domain, rawGraph, viewMode, fidelity);
    if (!data) {
      return reply.status(404).send({ error: "projection failed" });
    }
    return data;
  });

  // ── Diff View ──
  fastify.post("/api/r11/diff-view", async (req, reply) => {
    ensureService();
    if (!ui.isActive()) return reply.status(503).send({ error: "R10 disabled" });

    const { domain, baseline, current, baselineId, currentId } = req.body as any;
    const data = ui.getDiffView({ domain, baseline, current, baselineId, currentId });
    if (!data) return reply.status(404).send({ error: "diff failed" });
    return data;
  });

  // ── Replay View ──
  fastify.post("/api/r11/replay-view", async (req, reply) => {
    ensureService();
    if (!ui.isActive()) return reply.status(503).send({ error: "R10 disabled" });

    const { domain, rawGraph, iteration } = req.body as any;
    const data = ui.getReplayView(domain, rawGraph, iteration);
    if (!data) return reply.status(404).send({ error: "replay failed" });
    return data;
  });

  // ── Fidelity ──
  fastify.post("/api/r11/fidelity", async (req, reply) => {
    ensureService();
    if (!ui.isActive()) return reply.status(503).send({ error: "R10 disabled" });

    const { domain, rawGraph } = req.body as any;
    const data = ui.getFidelity(domain, rawGraph);
    if (!data) return reply.status(404).send({ error: "fidelity check failed" });
    return data;
  });

  // ── Domain List ──
  fastify.get("/api/r11/domains", async (req, reply) => {
    ensureService();
    return { domains: r11.listDomains() };
  });

  // ── Status ──
  fastify.get("/api/r11/status", async (req, reply) => {
    ensureService();
    return {
      active: ui.isActive(),
      domains: r11.listDomains(),
      timestamp: Date.now(),
    };
  });

  // ════════════════════════════════════════════════════════════
  // Phase 3B — Drift Monitor（时间维稳定性 overlay）
  // ════════════════════════════════════════════════════════════

  // ── Record drift observation ──
  fastify.post("/api/r11/drift/record", async (req, reply) => {
    ensureService();
    if (!ui.isActive()) return reply.status(503).send({ error: "R10 disabled" });

    const { domain, rawGraph, runId, adapterVersion } = req.body as any;
    const record = ui.recordDrift(domain, rawGraph, runId ?? "auto", adapterVersion);
    if (!record) return reply.status(404).send({ error: "drift record failed" });
    return record;
  });

  // ── Get drift report ──
  fastify.get("/api/r11/drift/report", async (req, reply) => {
    ensureService();
    const { domain } = req.query as any;
    return ui.getDriftReport(domain || undefined);
  });

  // ── Get drift report ──
  fastify.get("/api/r11/drift/report", async (req, reply) => {
    ensureService();
    const { domain } = req.query as any;
    return ui.getDriftReport(domain || undefined);
  });

  // ── Get drift timeline (for UI overlay) ──
  fastify.get("/api/r11/drift/timeline", async (req, reply) => {
    ensureService();
    const { domain } = req.query as any;
    return ui.getDriftTimeline(domain || undefined);
  });

  // ── Clear drift history ──
  fastify.post("/api/r11/drift/clear", async (req, reply) => {
    ensureService();
    ui.clearDriftHistory();
    return { cleared: true };
  });

  // ════════════════════════════════════════════════════════════
  // Phase 4 — Stability Hardening
  // ════════════════════════════════════════════════════════════

  // ── Evaluate stability ──
  fastify.post("/api/r11/stability/evaluate", async (req, reply) => {
    ensureService();
    const { domain, fidelity, history } = req.body as any;
    return ui.evaluateStability(domain, fidelity, history ?? []);
  });

  // ── Get stability policies (drift policy + SLA + adapter) ──
  fastify.get("/api/r11/stability/policies", async (req, reply) => {
    ensureService();
    return {
      driftPolicies: ui.stability.driftPolicy.listPolicies(),
      slas: ui.stability.slaEngine.listSLAs(),
      adapters: ui.stability.adapterGov.list(),
    };
  });

  // ── Set drift policy ──
  fastify.post("/api/r11/stability/policy", async (req, reply) => {
    ensureService();
    const { domain, warnThreshold, blockThreshold, enabled } = req.body as any;
    ui.stability.driftPolicy.setPolicy(domain, {
      warnThreshold: warnThreshold ?? 0.98,
      blockThreshold: blockThreshold ?? 0.95,
      enabled: enabled ?? true,
    });
    return { set: true, domain };
  });

  // ── Lock/unlock adapter ──
  fastify.post("/api/r11/stability/adapter/lock", async (req, reply) => {
    ensureService();
    const { domain, lock } = req.body as any;
    const result = lock ? ui.stability.adapterGov.lock(domain) : ui.stability.adapterGov.unlock(domain);
    return { domain, locked: lock, success: result };
  });

  // ════════════════════════════════════════════════════════════
  // Phase 5 — Causal Drift Attribution
  // ════════════════════════════════════════════════════════════

  // ── Attribute a drift point ──
  fastify.post("/api/r11/causal/attribute", async (req, reply) => {
    ensureService();
    const input = req.body as any;
    return ui.attributeDrift(input);
  });

  // ── Batch attribute ──
  fastify.post("/api/r11/causal/attribute-batch", async (req, reply) => {
    ensureService();
    const { inputs } = req.body as any;
    if (!Array.isArray(inputs)) return reply.status(400).send({ error: "inputs must be array" });
    return ui.attributeDriftBatch(inputs);
  });

  // ── Get merged causal graph ──
  fastify.get("/api/r11/causal/graph", async (req, reply) => {
    ensureService();
    return ui.getCausalGraph();
  });

  // ── Get causal reports history ──
  fastify.get("/api/r11/causal/reports", async (req, reply) => {
    ensureService();
    return ui.getCausalReports();
  });

  // ── Clear causal history ──
  fastify.post("/api/r11/causal/clear", async (req, reply) => {
    ensureService();
    ui.clearCausalHistory();
    return { cleared: true };
  });
}
