# GEO-RC3 — Production Provider Runtime

**版本**: RC3 (Post RC2)
**冻结目标**: 2026-07
**状态**: ⏳ PLANNING

---

## 定位

RC3 的目标不是"接一家新 AI"，而是让 Provider Runtime 进入生产级。

### RC3 完成标志
```
✓ 真实 Provider 可切换
✓ Discovery 使用真实 AI 返回
✓ Replay 全量可追溯
✓ Golden Evaluator 使用真实数据评分
✓ Calibration 基于真实 Gap 生成建议
✓ Knowledge Hub → Provider → Replay → Golden → Calibration 闭环在生产环境运行
```

---

## Epic 1: Production Provider Runtime (P0)

### 架构

```
ExecutionEngine (现有的)
    │
    ▼
ProviderRegistry (增强)
    │
    ├── DeepSeekAdapter → authenticate→execute→stream→structured
    ├── ClaudeAdapter   (预留)
    └── OpenAIAdapter   (预留)
```

### 清单

| 项目 | 状态 | 备注 |
|------|------|------|
| Provider Registry 自动发现 | 🔜 | Capability 枚举 |
| Provider Capability | 🔜 | chat / search / reasoning / json |
| Timeout 统一 | 🔜 | 现有的 Reliability 可用 |
| Retry 增强 | 🔜 | 现有，加 Provider 级策略 |
| Rate Limit | 🔜 | 现有 RateLimiter，加 Provider 限流 |
| Cost Tracking | 🔜 | Provider 级 |
| Token Usage | 🔜 | Provider 级 |
| Circuit Breaker | 🔜 | 现有 |
| Health Check | 🔜 | Provider 级 |

### 文件

- `services/geo/runtime/provider/registry.ts` — 增强
- `services/geo/runtime/provider/types.ts` — 增加 Capability 类型

---

## Epic 2: DeepSeek Production Adapter (P0)

### Adapter 接口

```typescript
class DeepSeekAdapter implements ProviderAdapter {
  name = 'deepseek';
  model = 'deepseek-chat';
  
  // 认证
  async authenticate(): Promise<void>;
  
  // 执行
  async execute(context: ProviderContext, prompt: string, options?: ExecuteOptions): Promise<StructuredResult>;
  
  // 流式（预留）
  async stream(context: ProviderContext, prompt: string, options?: ExecuteOptions): AsyncIterable<Chunk>;
  
  // 结构化输出
  async structured(context: ProviderContext, prompt: string, schema: any, options?: ExecuteOptions): Promise<StructuredResult>;
  
  // 嵌入（预留）
  async embedding(text: string): Promise<number[]>;
  
  // 健康
  async health(): Promise<boolean>;
  
  // 成本估算
  async estimateCost(prompt: string, outputLength: number): Promise<CostEstimate>;
}
```

### 清单

| 项目 | 状态 | 备注 |
|------|------|------|
| API Key 配置 | 🔜 | 环境变量 |
| JSON Mode | 🔜 | DeepSeek API 直接支持 |
| Structured Output | 🔜 | Function Calling / JSON Schema |
| Streaming | 🔜 | 预留 |
| Tool Calling | 🔜 | 预留 |
| Provider Metadata | 🔜 | 模型名/版本/延迟/Token |

### 文件

- `services/geo/runtime/provider/deepseek-adapter.ts` — 新建

### 当前 DeepSeek API 概况

- 端点: `https://api.deepseek.com/chat/completions`
- 模型: `deepseek-chat` (deepseek-v3) / `deepseek-reasoner` (deepseek-r1)
- 支持: JSON Mode (`response_format: { type: "json_object" }`)
- 支持: Function Calling
- 支持: Streaming
- 认证: `Authorization: Bearer <API_KEY>`
- 定价: deepseek-chat 约 ¥1/1M input tokens, ¥2/1M output tokens
- Rate Limit: 500 RPM (标准)

### 当前环境已有

- 项目中可能存在 `.env` 中的 DeepSeek API Key（需要在 `backend/.env` 中检查）
- 如果未配置，从 `process.env.DEEPSEEK_API_KEY` 读取

---

## Epic 3: Prompt Runtime (P0)

### 现状

当前 Prompt Builder 在 Knowledge Compiler 中已存在，但功能有限。

### RC3 升级

| 组件 | 说明 |
|------|------|
| Prompt Version | 每次编译自动版本化 |
| Prompt Registry | 按 Provider/Scenario/Intent 索引 |
| Prompt Hash | 内容哈希，可追溯 |
| Prompt Metrics | 记录每次 Prompt 的 Token / Latency / Result |
| Prompt Template | 正式模板引擎（参数化） |

### 核心价值

- 每次 Replay 能知道 "这次用了哪个 Prompt"
- 真实 Gap 出现时，能溯源到 Prompt 版本

---

## Epic 4: Evidence Collection (P0)

### 现状

Mock Provider 返回的 evidence 是空数组。Replay 的 evidence 索引功能存在但无数据。

### RC3 改造

```
Prompt → Provider → Raw Response → Citation → Evidence → Golden Evaluation
```

| 字段 | 说明 |
|------|------|
| originalText | 原文 |
| sourceUrl | 来源 URL |
| timestamp | 爬取/生成时间 |
| hash | 内容哈希 |
| providerId | 来源 Provider |
| confidence | 置信度 |

### 核心价值

- Golden Evaluator 不再 evidence 始终为 0
- Gap Analysis 能识别真实引用缺失

---

## Epic 5: Replay 升级 (P1)

### 现状

当前 ReplayRecord 包含基础执行信息，但缺少上下文追溯能力。

### RC3 升级

| 字段 | 说明 |
|------|------|
| question | 触发问题 |
| prompt | 使用的完整 Prompt |
| promptVersion | Prompt 版本 |
| promptHash | Prompt 哈希 |
| knowledgePackageVersion | 知识包版本 |
| knowledgeSnapshotHash | 快照哈希 |
| provider | Provider 名称 |
| model | 模型名称 |
| latency | 延迟 (ms) |
| tokenUsage | Token 使用 |
| cost | 成本估算 |
| rawResponse | 原始响应 |
| structuredResult | 结构化结果 |
| evaluationReportId | 评测报告 ID（评测后回填） |
| calibrationId | 校准记录 ID（校准后回填） |

### 核心价值

- 任何一次回答都可以完全复现
- Replay → Evaluation → Calibration 完整追溯

---

## Epic 6: Golden Continuous Learning (P1)

### 现状

Golden Dataset 是静态 JSON 文件。Entry 不会随生产数据增长。

### RC3 升级

```
Production Replay → 低分自动标记 → Candidate → Human Review → Golden Dataset Update → Re-evaluate
```

| 组件 | 说明 |
|------|------|
| Candidate 自动识别 | Overall < 60 的 Replay 自动标记为 Candidate |
| Candidate Store | 独立存储，等待审核 |
| Review API | 审核/拒绝/修改 |
| Golden Dataset Update | 审核通过后自动更新 Golden Entry |
| Re-evaluate | 自动重新评测关联 Replay |

### 核心价值

- 第一次触发真正的数据飞轮
- 随着运行自动提升评测质量

---

## RC3 不做

| 项目 | 原因 |
|------|------|
| ❌ 多 Provider 路由 | 等 Runtime 稳定后再做 |
| ❌ UI 大改 | 优先核心能力 |
| ❌ Benchmark Dashboard | 数据还不值得展示 |
| ❌ Prompt Calibration UI | 自动 Calibration 稳定后再做 |
| ❌ Claude / OpenAI Adapter | 先跑通 DeepSeek |

---

## RC3 依赖

- [ ] DeepSeek API Key 配置（环境变量）
- [ ] Provider Runtime 增强（Capability, Health, Cost）
- [ ] DeepSeekAdapter 实现
- [ ] Prompt Runtime 升级
- [ ] Evidence Collection 接入
- [ ] Replay 结构升级
- [ ] Golden Continuous Learning

---

## 发布 Gate

| Gate | 验收标准 |
|------|----------|
| G1 | DeepSeekAdapter 开发完成，单次执行返回真实数据 |
| G2 | 真实 Replay 记录（含 Prompt/Package/Token/Cost） |
| G3 | Golden Evaluator 基于真实数据评分，Evidence 非空 |
| G4 | Calibration Candidate 基于真实 Gaps 生成 |
| G5 | 端到端验证：KH → DeepSeek → Replay → Eval → Cal 全链路 |
| G6 | 冻结文档 + Release Tag |
