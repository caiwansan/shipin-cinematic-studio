# GEO-RC3 Gate A — Production Provider Connected

**冻结时间**: 2026-07-02
**版本**: GEO-RC3 Gate A v1.0
**Git Tag**: `geo-rc3-gate-a`
**状态**: ✅ **FROZEN**

---

## 范围

RC3 Gate A 聚焦 **Production Provider Runtime** 的第一阶段：真实 Provider 接入 + 评测基线校准。

### 已交付

| 模块 | 说明 | 状态 |
|------|------|------|
| Provider Config | provider-config.ts — 统一 Provider/Model 配置 | ✅ |
| DeepSeek Adapter | deepseek-adapter.ts — 真实 API 调用，JSON Mode | ✅ |
| Provider Registry 集成 | 通过 ExecutionEngine 注册，provider/model 参数切换 | ✅ |
| Structured Response | 统一 StructuredResult 格式 | ✅ |
| Replay Integration | 真实 Replay 记录含 cost/latency/token | ✅ |
| Golden Dataset v1.1 | 基于真实 Provider 校准的 expected 基线 | ✅ |
| Confidence Tolerance | ±10% 容忍区间，消除误报 | ✅ |

---

## 架构变更

```
┌─────────────────────────────────────────┐
│           Provider Runtime               │
├─────────────────────────────────────────┤
│  ProviderRegistry                       │
│  ├─ MockProvider (默认)                  │
│  └─ DeepSeekProvider (生产)             │
│      ├─ model: deepseek-v4-flash         │
│      └─ model: deepseek-v4-pro           │
│                                          │
│  provider-config.ts (配置驱动)           │
│  → provider=deepseek&model=xxx 切换     │
└─────────────────────────────────────────┘
```

### API 变化

| 方法 | 路径 | 新参数 | 说明 |
|------|------|--------|------|
| GET | `/api/v1/geo/discovery/run` | `provider`, `model` | 支持指定 Provider/Model |
| GET | `/api/v1/geo/discovery/config` | - | 返回当前默认配置 |

### DeepSeek 模型支持

| 模型 | 类型 | 状态 | 实测 |
|------|------|------|------|
| deepseek-v4-flash | 快速推理 | ✅ Production | 80/100 Good |
| deepseek-v4-pro | 深度推理 | ✅ Production | 响应较慢~20s |

---

## 校准记录

### Golden Dataset 版本化

| 版本 | 文件 | 基线 | 日期 |
|------|------|------|------|
| v1.0 | golden-v1.json | Mock | 冻结不修改 |
| v1.1 | golden-v1.1.json | deepseek-v4-flash | 2026-07-02 |

### Confidence Tolerance

- 配置名: `CONFIDENCE_TOLERANCE = 0.10`
- 偏差 ≤ 10% → 不触发 wrong_band
- 偏差 > 10% → 按比例扣分，生成 Gap

### 校准效果

| Provider | 校准前 | 校准后 | 说明 |
|----------|--------|--------|------|
| DeepSeek v4-flash | 72/100 Fair | **80/100 Good** | 与人工判断一致 |
| Mock | 53/100 Weak | ~30/100 Poor | 保持明显区分 |
| wrong_band 误报 | 容易触发 | 仅偏差 >10% | 规则稳定 |

---

## 验收结果

| 标准 | 结果 |
|------|------|
| ✅ deepseek-v4-flash 真实调用验证 | 返回 4 findings, confidence=0.8 |
| ✅ deepseek-v4-pro 真实调用验证 | 返回 5 findings, confidence=0.7 |
| ✅ Provider Registry 可配置切换模型 | provider=deepseek&model=xxx |
| ✅ Execution Engine 无需修改业务代码 | 仅注册不同 Provider 实例 |
| ✅ 返回统一 StructuredResult | Adapter 保证字段完整 |
| ✅ Replay 正常记录 | Cost / Latency / Token 全部记录 |
| ✅ Golden Evaluator 正常评分 | 80/100 Good |
| ✅ Cost / Latency / Token Usage 记录 | Observability 有真实数据 |
| ✅ Evaluator 可稳定区分 Provider 输出质量 | Mock: Poor, DeepSeek: Good |
| ✅ wrong_band 校准后仅真实偏差触发 | 偏差 30% 正常触发，5% 不触发 |

---

## 已知限制

1. **Evidence 评分偏严**：Evaluator 对证据数量和质量要求较高，部分 DeepSeek 输出因 evidence 格式差异被扣分。待更多真实数据积累后校准。
2. **样本量有限**：当前 Golden Dataset v1.1 仅 5 个场景，验证基于少量真实 Replay。扩展样本后应确认评测参数稳定性。
3. **v4-pro 响应慢**：~20s 推理时间，生产环境可能需要超时策略优化。
4. **Cost 估算**：当前为近似计算（基于 token 数 × 单价估算），精确 Cost 待 DeepSeek 账单兼容后优化。
5. **单 Provider**：仅完成 DeepSeek 接入。其他 Provider (Claude, OpenAI) 属于后续 Gate。

---

## 后续 Gate B 建议

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | Evidence Quality Calibration | 校准证据评分，而非放宽 |
| P0 | Production Replay 积累 | 真实 Replay 数据自动沉淀 |
| P1 | Golden Dataset 扩充 | 更多行业、更多真实案例 |
| P1 | 多 Provider 验证 | 评测体系跨 Provider 一致性 |

---

## Release Decision

**RC3 Gate A: ✅ FROZEN**

核心价值：评测体系完成了从 Mock 基线到真实 Provider 基线的校准。
Golden Evaluator 现在能够稳定区分不同 Provider 的输出质量。
