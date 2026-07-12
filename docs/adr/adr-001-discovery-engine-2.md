# ADR-001: GEO Discovery Engine 2.0 — 架构冻结记录

**状态**: 已冻结 (Frozen)
**日期**: 2026-07-04
**决策者**: 产品负责人 + 技术团队
**影响范围**: GEO Workspace Discovery Engine

---

## 背景

GEO Workspace 的 Discovery 引擎（品牌认知扫描入口）之前使用 `mockScanner`，每次执行返回固定数据，不具备真实性。初次审计发现：

1. Discovery 是 GEO 系统的入口引擎，但使用 Fake 数据
2. 下游 Knowledge、Recommendations、Mission 引擎的数据来源不可信
3. `mockScanner` 没有适配层结构，无法扩展到多个 AI Provider

## 决策

采用 **Context → Result → Envelope** 三层架构，取代原有的单层 Report 模型。

## 架构模型

### 核心概念

```
DiscoveryContext (Pipeline 中间状态)
      ↓ (Pipeline Stage 逐步修改)
DiscoveryResultBuilder
      ↓
DiscoveryResult (纯业务数据 SSOT)
      ↓
EnvelopeBuilder
      ↓
DiscoveryEnvelope (API 返回包装，含 diagnostics/execution 信息)
```

### 为什么采用三层？

| 层 | 职责 | 变更原因 |
|----|------|----------|
| Context | Pipeline 中间状态，Stage 修改 | 支持 Replay、Partial Result、Retry |
| DiscoveryResult | 纯业务数据，所有下游引擎的 SSOT | 不属于任何引擎，只属于 Domain |
| DiscoveryEnvelope | API 返回包装（含 diagnostics/execution） | 不污染 Result 数据 |

### 核心架构组件

```
UI/API → DiscoveryService (编排，不调 AI)
              ↓
       DiscoveryOrchestrator
              ↓
       DiscoveryPipeline (Stage 可插拔)
              ↓
       Adapters (按能力分: Presence/Search/Knowledge)
              ↓
       ProviderRegistry (Provider 热插拔, 默认仅 DeepSeek)
              ↓
       EventBus (只传 executionId)
```

### 关键设计原则

1. **Domain 不属于任何 Engine** — `DiscoveryResult` 放在 `domain/` 目录，Knowledge/Recommendations/Mission 全部通过 Domain 消费
2. **Adapter 按能力分，不按 Provider 分** — `PresenceAdapter` 内部管理多个 Provider，Discovery 不感知 DeepSeek/Qwen 等
3. **Context ≠ Result** — Pipeline Stage 修改 Context，Builder 负责转换为 Result
4. **Event 只传 executionId** — 监听者自己通过 Repository 拉取数据 Event Payload 不膨胀
5. **DiscoveryService 不调 AI** — 只负责 Start → Orchestrator → Save → Event → Return

## 替代方案

### 方案 A：直接用 LLM Prompt 替换 mockScanner（被拒绝）
- 短期是真了，但每个新 Provider 都需要写 Prompt
- Discovery 会随着 Provider 增加持续膨胀

### 方案 B：在旧代码上增加 Adapter 层（被拒绝）
- 无法引入 Pipeline 概念
- Context/Stage/Replay 等能力无法自然加入

## 影响

- **正**: 后续 Provider 增加 Discovery 代码不用改
- **正**: Pipeline Replay 可用于 Regression 测试
- **正**: 支持灰度切换（v1/v2 双轨）
- **负**: 短期开发周期增加（架构冻结后再接 Provider）
- **负**: 需要前端配合适配新 API 返回格式（Envelope）

## 冻结项

- [x] Context / Result / Envelope 模型定义
- [x] Pipeline Stage Contract
- [x] Adapter 接口（按能力分类）
- [x] ProviderRegistry + Capability Resolver
- [x] EventBus 事件定义（只传 executionId）
- [x] Replay 支持（orchestrator.replay）
- [x] Builder 拆为两个（ResultBuilder + EnvelopeBuilder）
- [x] DiscoveryService 仅限于编排

## 未冻结项（Sprint B2 处理）

- 真实 Provider 接入（DeepSeek 等）
- mockScanner 生产路径替换
- Capability Resolver（自动选择最优 Provider）
- 前端适配 DiscoveryEnvelope
