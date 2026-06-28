# Execution Graph Schema Survey — Phase 0 Report

Date: 2026-06-23
Scope: All production and experimental graph-shaped execution systems in backend/src

---

## 1. Graph Taxonomy

### 1.1 Production Execution Graphs (actively used in runtime)

| # | Graph System | File | Type | Nodes | Edges | R11 Schema Compat |
|---|-------------|------|------|-------|-------|-------------------|
| G1 | **character-image-dag** | `runtime/character-image-dag.ts` | Dependency DAG | DAGNode { key, mode, prompt, dependsOn } | Implicit (dependsOn) | ✅ Easy — directed graph with explicit deps |
| G2 | **image pipeline runner** | `services/image/pipeline/runner.ts` | Sequential pipeline | PipelineStage | Implicit (order) | ⚠️ Partial — linear chain, no branch |
| G3 | **production-loop DAG** | `production-loop/dag-builder.ts` | Tree (Director→Scene→Shot) | TimelineNode { parentId } | Implicit (parentId) | ⚠️ Partial — tree, no cross edges |
| G4 | **decision-graph-lane** | `services/image/pipeline/decision/decision-graph-lane.ts` | Weighted decision graph | D2InputNode{ locked, label }, D2InputEdge{ from, to, weight, active } | Explicit | ✅ High — full DAG with typed edges |
| G5 | **LLM Execution Graph v2** | `llm-execution-graph-v2/types.ts` | Execution trace | GraphNode{ id, type, provider, model } | None (node list only) | ⚠️ Partial — no edge model, needs reconstruction |
| G6 | **AgentGraph (core)** | `core/agent-graph/agent-graph.ts` | Agent DAG | AgentNode | AgentEdge{ from, to, label } | ✅ High — closest to R11 model |

### 1.2 Observation / Trace Graphs

| # | Graph System | File | Type | R11 Schema Compat |
|---|-------------|------|------|-------------------|
| G7 | **governance DAG** | `governance/dag/execution-dag.ts` | ExecutionDagNode{ parentId } | ⚠️ Partial — flat, parentId only |
| G8 | **kernel DAG** | `kernel/dag/execution-dag.ts` | DagNode{ parentId } (from events) | ⚠️ Partial — linearized |
| G9 | **shot graph** | `director-v2/shot-graph/shot-graph-schema.ts` | ShotNode{ continuity } | ⚠️ Partial — linked list via continuity |
| G10 | **narrative scene graph** | `director-v2/story/scene-graph.ts` | Scene graph | ❓ Not sampled |

### 1.3 Experimental / Design-Phase Graphs (not in production)

| # | Graph System | File | Type | R11 Schema Compat |
|---|-------------|------|------|-------------------|
| G11 | **graph-patch** | `graph-patch/graph-model.ts` | Pipeline (NodeType enum) | ✅ High — full Node/Edge/Pipeline model |
| G12 | **graph-optimization** | `graph-optimization/` | Optimization target | ⚠️ Wraps graph-patch |
| G13 | **graph-optimization types** | `graph-optimization/optimization.types.ts` | OptimizationPlan | ❓ Not sampled |
| G14 | **replay-analytics** | `replay-analytics/` | Analysis graphs | ❓ Not sampled |
| G15 | **causal-graph** | `causal-graph/` | Causal dependency | ❓ Not sampled |
| G16 | **control-layer DAG** | `control-layer/dag-patch-engine.ts` | Patch DAG | ✅ High — full operation |
| G17 | **character-identity-graph** | `character-persistence/character-identity-graph.ts` | Identity linkage | ❓ Not sampled |
| G18 | **execution-intelligence DAG** | `execution-intelligence/dag-optimizer.ts` | Optimization target | ❓ Not sampled |
| G19 | **execution-memory lineage** | `execution-memory/lineage-graph.ts` | Execution lineage | ❓ Not sampled |
| G20 | **event-driven health** | `health/event-driven-health.ts` | Event chain | ❓ Not sampled |
| G21 | **screenwriter service (HDZ)** | `services/hdz/screenwriter.service.ts` | Agent chain | ❓ Not sampled |
| G22 | **runtime execution graph** | `runtime/graph/execution-graph.ts` | Execution graph | ❓ Not sampled |
| G23 | **scene-graph-composer** | `autonomous-director/scene-graph-composer.ts` | Scene composition | ❓ Not sampled |
| G24 | **narrative-constraint engine** | `narrative-constraint/` | Constraint propagation | ❓ Not sampled |
| G25 | **PromptVersionGraph** | `runtime/prompt/PromptVersionGraph.ts` | Version DAG | ✅ High — explicit DAG |
| G26 | **PromptTraceBuilder** | `runtime/prompt/PromptTraceBuilder.ts` | Trace chain | ❓ Not sampled |

---

## 2. R11 Compatibility Matrix (Sampled)

| Graph | Node Type | Edge Type | Direction | Weighted | Lockable | Direct R11 Compat |
|-------|-----------|-----------|-----------|----------|----------|-------------------|
| character-image-dag | DAGNode {key,mode,prompt,dependsOn} | dependsOn reference | forward | No | No (optional) | ✅ Easy — deps are explicit |
| image pipeline | PipelineStage | stage order | linear | No | No | ⚠️ Linear adapter needed |
| production-loop | TimelineNode | parentId tree | reverse (child→parent) | No | No | ⚠️ Tree adapter |
| decision-graph-lane | D2InputNode | D2InputEdge {from,to,weight,active} | forward | ✅ weight | ✅ locked | ✅ High — near 1:1 |
| LLM exec graph v2 | GraphNode | none | implicit | No | No | ⚠️ Edge model missing |
| AgentGraph | AgentNode | AgentEdge {from,to,label} | forward | No | No | ✅ High — near 1:1 |
| shot graph | ShotNode | continuity { previousRelation } | backward | No | No | ⚠️ Linked list |
| governance DAG | ExecutionDagNode | parentId | backward | No | No | ⚠️ Flat tree |
| graph-patch | Pipeline | NodeType enum edges | forward | No | No | ✅ High |
| PromptVersionGraph | VersionNode | version DAG edges | forward | No | No | ✅ High |

---

## 3. Critical Finding: Graph Diversity

The system contains **at least 26 distinct graph-shaped structures** across production and experimental code. They fall into **5 structural families**:

### Family A: Explicit DAG (good R11 fit)
- `decision-graph-lane` (G4) — weighted edges, lockable nodes
- `AgentGraph` (G6) — full AgentNode + AgentEdge model
- `graph-patch` (G11) — Pipeline model
- `PromptVersionGraph` (G25) — version DAG

### Family B: Dependency DAG (implicit edges via dependsOn)
- `character-image-dag` (G1) — explicit `dependsOn` field
- Easy to normalize: dependsOn → edges

### Family C: Sequential Pipeline (linear order)
- `image pipeline runner` (G2) — stage order is the only edge
- Adapter: sequential list → linear chain

### Family D: Tree via parentId
- `production-loop` (G3)
- `governance DAG` (G7)
- `kernel DAG` (G8)
- Adapter needed: tree flattening + parentId → edge

### Family E: Domain-Specific Graph (no generic node/edge model)
- `shot graph` (G9) — continuity-linked
- `LLM exec graph` (G5) — no edge model
- Requires domain-specific adapter

---

## 4. Adapter Strategy

### Phase 1 Target: Only Production Graphs (G1-G6)
Restrict R11 to actively used execution graphs. Experimental graphs (G11+) are excluded until they enter production.

### Adapter Types Needed

```
Family A (Explicit DAG)    → direct mapping (zero adapter)
Family B (dependsOn)       → dependsOn → Edge adapter
Family C (Sequential)      → linear list → chain adapter
Family D (parentId tree)   → parentId → Edge adapter
```

### Proposed Adapter Interface

```ts
export interface GraphAdapter<T> {
  id: string                          // adapter identifier
  canAdapt(input: any): boolean       // guard check
  toExecutionGraph(input: T): ExecutionGraph
}
```

---

## 5. Recommendation

1. **R11 should initially target only Family A + B** (decision-graph-lane, AgentGraph, character-image-dag, PromptVersionGraph)
2. Family C (linear pipelines) should be deferred — they add complexity with minimal diff value
3. Family D (trees) needs a separate adapter pass
4. Experimental graphs (Family? unclassified) are explicitly excluded
5. The LLM Execution Graph v2 needs edge reconstruction before it can be diffed

This keeps R11 minimal, production-grounded, and avoids the "false unification" risk.
