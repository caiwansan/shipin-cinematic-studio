# GEO-RC2 — Discovery Runtime Realization

## 状态: FINAL
冻结日期: 2026-07-02
前置依赖: KH-RC2 (AI Knowledge Model v1.0) — ✅ Frozen

## 一句话目标
把 GEO Discovery 从 Mock 依赖升级为 **Verifiable / Replayable / Calibratable 的 Evidence-driven Runtime**。

## 架构定位
GEO 工作台不再自己维护知识上下文，全面消费 AI Knowledge Hub 输出的标准化知识资产。

## 四阶段

### Stage 1: Discovery Context Runtime（最高优先级）
Discovery 不再自行组织上下文，统一消费 Knowledge Package。

- Discovery 仅通过 Knowledge Compiler 获取 `KnowledgePackage`
- 去除品牌/产品/知识的重复拼装逻辑
- Provider 输入统一为 `CompiledContext`
- Prompt Registry 全部基于 Compiler 输出
- B2B: BrandOverview 页面的知识模块改为消费 Compiler 数据

**Gate**: Discovery 不再直接读取 Repository，所有 Prompt Context 来源可追溯到 Snapshot

### Stage 2: Provider Runtime
建立统一 Provider 执行层，不急于接入真实 API。

职责:
- Provider Registry
- Prompt Executor
- Retry / Cache / Rate Limit / Circuit Breaker
- Timeout / Cost Tracking / Latency Tracking
- Model Metadata

Mock Provider 保留为 **Development Provider**，不再作为 Discovery 默认执行路径。

### Stage 3: Replay Runtime
每一次 Discovery 都保存完整执行记录。

存储内容:
- Snapshot Version (来自 KH)
- Prompt / Provider / Model / Parameters
- Response / Parsed Result / Evidence
- Timing / Cost / Hash

**Gate**: 任意历史结果可完整复现

### Stage 4: Golden Runtime
把 Golden Dataset 真正接入 Runtime。

流程:
```
Replay → Evaluator → Golden Dataset → Score → Gap Analysis → Prompt Calibration
```

## 验收指标

| 指标 | 目标 |
|------|------|
| Discovery 全链路通过率 | 100% |
| Knowledge Package 覆盖率 | ≥95% |
| Context 来源可追溯率 | 100% |
| Replay 可复现率 | 100% |
| Snapshot 命中率 | 100% |
| Golden Dataset 自动评测 | 100% |
| Prompt 可校准率 | 100% |
| Mock 依赖（生产路径） | 0 |

## 完成后架构

```
AI Knowledge Hub
  │
  Knowledge Compiler
  │
  Knowledge Package
  │
  Discovery Runtime (Stage 1)
  │
  Provider Runtime (Stage 2)
  │
  ┌──────┼──────┐
  ▼      ▼      ▼
Verify Publish Replay (Stage 3)
  │      │      │
  └──────┼──────┘
         ▼
  Golden Evaluator (Stage 4)
  │
  Gap Analysis
  │
  Prompt Calibration
  │
  Runtime Learning
```
