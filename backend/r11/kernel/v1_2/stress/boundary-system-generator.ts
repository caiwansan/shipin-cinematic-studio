/**
 * v1_2/stress/boundary-system-generator.ts
 *
 * v1.2 Stress Phase — Boundary System Generator
 *
 * 不生成"复杂系统"，而是生成三类"结构冲突源"：
 * A. Overlap Systems — 结构重叠（测 morphotype collapse）
 * B. Partial Systems  — 结构缺失（测 family 识别能力）
 * C. Adversarial Systems — 对抗结构（测 classification robustness）
 */

import { DefaultSystemInstance } from "../../v1_1/system-instance";
import type { SystemInstance } from "../../v1_1/system-instance";
import type { ExecutionOperator } from "../../r10_5/execution-operator";

export type StressType = "OVERLAP" | "PARTIAL" | "ADVERSARIAL";

export interface StressSystem {
  system: SystemInstance;
  stressType: StressType;
  description: string;
}

// ─── Base operators ───

function kernelOp(id: string): ExecutionOperator {
  return { id, version: "v1.0.0", execute(s: any) { return s; } };
}

function domainOp(id: string): ExecutionOperator {
  return { id, version: "v1.0.0", execute(s: any) { return s; } };
}

// ─── Type A: Overlap Systems ───

function buildOverlapSystems(): StressSystem[] {
  // A1: Cinematic + Presentation hybrid
  const hybrid = new DefaultSystemInstance({
    id: "stress-overlap-cine-present",
    name: "CinePresent Hybrid",
    description: "同时包含短剧和 PPT 的 domain operators — 双语义解释冲突",
    version: "stress-v1",
  });

  // 同时注册两个家族的 domain operators
  for (const id of ["truth-anchor", "trace-recorder", "execution-engine", "projection-observe"]) {
    hybrid.register(kernelOp(id));
  }
  // cinematic domain ops
  hybrid.register(domainOp("script-breakdown"));
  hybrid.register(domainOp("character-agent"));
  hybrid.register(domainOp("scene-prompt-agent"));
  // presentation domain ops
  hybrid.register(domainOp("outline-agent"));
  hybrid.register(domainOp("content-agent"));
  hybrid.register(domainOp("layout-engine"));

  // A2: Same graph topology, different semantics
  const topoMirror = new DefaultSystemInstance({
    id: "stress-overlap-topo-mirror",
    name: "Topology Mirror",
    description: "operator 拓扑结构与短剧相同，但名称语义颠倒 — morphotype 边界测试",
    version: "stress-v1",
  });
  for (const id of ["truth-anchor", "trace-recorder", "execution-engine", "projection-observe"]) {
    topoMirror.register(kernelOp(id));
  }
  // 语义颠倒：名称像 cinematic，但顺序像 presentation
  topoMirror.register(domainOp("script-breakdown"));  // = outline-agent 的语义
  topoMirror.register(domainOp("character-agent"));   // = content-agent 的语义
  topoMirror.register(domainOp("pipeline-runner"));   // = layout-engine 的语义

  return [
    { system: hybrid, stressType: "OVERLAP", description: "双 domain 语义重叠 → 测 morphotype collapse" },
    { system: topoMirror, stressType: "OVERLAP", description: "拓扑镜像 → 测语义边界" },
  ];
}

// ─── Type B: Partial Systems ───

function buildPartialSystems(): StressSystem[] {
  // B1: Missing truth layer
  const noTruth = new DefaultSystemInstance({
    id: "stress-partial-no-truth",
    name: "No Truth Layer",
    description: "缺少 truth-anchor — family 是否能识别",
    version: "stress-v1",
  });
  noTruth.register(kernelOp("execution-engine"));
  noTruth.register(kernelOp("trace-recorder"));
  noTruth.register(domainOp("script-breakdown"));

  // B2: Missing execution loop (no execution engine)
  const noEngine = new DefaultSystemInstance({
    id: "stress-partial-no-engine",
    name: "No Execution Engine",
    description: "只有 operators 无 engine — 不完整的 δ 系统",
    version: "stress-v1",
  });
  noEngine.register(kernelOp("truth-anchor"));
  noEngine.register(kernelOp("projection-observe"));
  noEngine.register(domainOp("character-agent"));

  // B3: Only domain operators, no kernel at all
  const domainOnly = new DefaultSystemInstance({
    id: "stress-partial-domain-only",
    name: "Domain-only System",
    description: "只有 domain operators，无任何 kernel 层 — 完全偏离 Kernel invariants",
    version: "stress-v1",
  });
  domainOnly.register(domainOp("custom-gen"));
  domainOnly.register(domainOp("custom-edit"));
  domainOnly.register(domainOp("custom-export"));

  return [
    { system: noTruth, stressType: "PARTIAL", description: "缺 truth 层 → 测 family 识别能力" },
    { system: noEngine, stressType: "PARTIAL", description: "缺执行引擎 → 测完整性阈值" },
    { system: domainOnly, stressType: "PARTIAL", description: "无 kernel 层 → 测新家族判定" },
  ];
}

// ─── Type C: Adversarial Systems ───

function buildAdversarialSystems(): StressSystem[] {
  // C1: Deliberate ambiguity — operators with conflicting intent
  const ambiguity = new DefaultSystemInstance({
    id: "stress-adv-ambiguity",
    name: "Ambiguity Engine",
    description: "operator 名称和职责故意冲突 — intent routing 歧义",
    version: "stress-v1",
  });
  ambiguity.register(kernelOp("truth-anchor"));
  ambiguity.register(domainOp("script-breakdown"));
  ambiguity.register(domainOp("script-breakdown"));  // duplicated name
  ambiguity.register(domainOp("layout-engine"));      // named like ppt but semantically cinematic

  // C2: Inverted execution semantics — δ 行为与命名相反
  const inverted = new DefaultSystemInstance({
    id: "stress-adv-inverted",
    name: "Inversion Engine",
    description: "operator 名称是 cinematic 但执行函数破坏 invariants — 假标签",
    version: "stress-v1",
  });
  inverted.register(kernelOp("truth-anchor"));  // named truth but actually mutates
  inverted.register(kernelOp("projection-observe")); // named observation but mutates
  inverted.register(domainOp("script-breakdown"));

  // C3: Fake invariants — 所有 operator 名与 Kernel 相同但行为完全不同
  const fake = new DefaultSystemInstance({
    id: "stress-adv-fake-invariants",
    name: "Fake Invariant System",
    description: "operator 命名完全模仿短剧系统但内部语义对抗 — 测 φ 是否被名字欺骗",
    version: "stress-v1",
  });
  // 完全复制短剧的 operator list — 但行为上 break invariants
  for (const id of ["truth-anchor","trace-recorder","execution-engine",
                     "projection-observe","constraint-layer","deterministic-validator"]) {
    // kernel operators 名称正确但版本不同（模拟语义对抗）
    fake.register({ id, version: "fake-v2", execute(s: any) { return s; } });
  }
  for (const id of ["script-breakdown","character-agent","scene-prompt-agent",
                     "aigc-orchestrator","pipeline-runner"]) {
    fake.register({ id, version: "fake-v2", execute(s: any) { return s; } });
  }

  return [
    { system: ambiguity, stressType: "ADVERSARIAL", description: "意图歧义 → 测分类鲁棒性" },
    { system: inverted, stressType: "ADVERSARIAL", description: "语义反转 → 测 invariant 深度" },
    { system: fake, stressType: "ADVERSARIAL", description: "假 invariants → 测 φ 是否被名称欺骗" },
  ];
}

// ─── Main Generator ───

export class BoundarySystemGenerator {
  generateAll(): StressSystem[] {
    return [
      ...buildOverlapSystems(),
      ...buildPartialSystems(),
      ...buildAdversarialSystems(),
    ];
  }

  generateByType(type: StressType): StressSystem[] {
    switch (type) {
      case "OVERLAP": return buildOverlapSystems();
      case "PARTIAL": return buildPartialSystems();
      case "ADVERSARIAL": return buildAdversarialSystems();
    }
  }
}
