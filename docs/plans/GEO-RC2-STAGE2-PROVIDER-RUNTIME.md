# GEO-RC2 Stage 2 — Provider Runtime v1.0

## 状态: FINAL
冻结日期: 2026-07-02
前置依赖: GEO-RC2 Stage 1 — ✅ PASS

## 一句话目标
建立**统一、可观测、可替换的 AI 执行层**。不绑定具体模型，只负责协议转换与执行管理。

## 架构位置

```
Discovery Context Runtime (Stage 1)
    │
    ▼
Provider Runtime (Stage 2) — 在此
    │
    ├── Execution Engine (M1)
    ├── Provider Adapter Framework (M2)
    ├── Reliability Layer (M3)
    ├── Observability (M4)
    └── Structured Response (M5)
    │
    └── StructuredResult ← 唯一输出
    │
    ▼
Stage 3 (Replay) / Stage 4 (Golden)
```

## 5 个 Milestone

### M1：Execution Engine（优先级最高）
Runtime Session / Request 生命周期 / Context 注入 / Prompt 注入 / Provider Dispatch

**Gate**: 所有 Discovery 请求必须经过 Execution Engine。

### M2：Provider Adapter Framework
统一 Provider 接口: `execute(context, prompt, options) -> StructuredResult`
- Discovery 不感知 Provider 差异
- Mock Provider 保留为开发模式
- 生产路径不得默认使用 Mock

### M3：Reliability Layer
统一实现 Retry / Timeout / Cache / Circuit Breaker / Rate Limit
禁止各 Provider 各自实现。

### M4：Observability
每次执行记录: Provider / Model / Prompt Version / Snapshot Version / Duration / Token / Cost / Status / Error / Trace ID

### M5：Structured Response
统一输出格式:
```
StructuredResult
├── summary
├── findings
├── evidence
├── citations
├── confidence
├── metrics
├── providerMetadata
└── rawResponse
```

## 核心纪律
**禁止 Provider 适配器包含业务逻辑。** Provider 只负责通信与协议转换；Discovery 规则、Evidence 提取、评分、Recommendation 等业务逻辑必须留在 Runtime 或上层服务。

## 文件结构

```
backend/src/services/geo/runtime/
├── provider/              ← NEW
│   ├── execution-engine.ts    (M1)
│   ├── adapter-framework.ts   (M2)
│   ├── reliability.ts         (M3)
│   ├── observability.ts       (M4)
│   ├── structured-response.ts (M5)
│   ├── types.ts               (公共类型)
│   └── index.ts               (注册/导出)
├── discovery/
│   └── context-runtime.ts     (Stage 1, 已有)
```

## Gate 验收条件
- [ ] Discovery 不直接调用任何 Provider
- [ ] 所有 Provider 都通过 Runtime 执行
- [ ] Mock 不作为默认生产路径
- [ ] Retry / Cache / Circuit Breaker / Timeout 全部统一
- [ ] StructuredResult 成为唯一输出格式
- [ ] 所有执行均产生 Trace，可进入 Replay
- [ ] Provider 适配器不含业务逻辑
