# P0-T004 — Scenario Intelligence Engine (SIE) — Task Result

## 概述

**Scenario Intelligence Engine (SIE)** 是基于规则的自然语言场景匹配引擎，用于将用户的自然语言输入（需求表达）自动匹配到 Scenario Library 中定义的最相关场景。

### 目录结构

```
backend/src/benchmark/sie/
├── types.ts              — MatchResult + 相关类型定义
├── keyword-map.ts        — 25 个 Scenario × 各 ≥ 5 个特征关键词
├── scenario-matcher.ts   — 匹配引擎核心实现
├── test-cases.ts         — 21 个测试用例覆盖
└── index.ts              — 统一导出
```

## 实现了什么

### 1. MatchResult 类型定义 (`types.ts`)

```typescript
interface MatchResult {
  raw: string;                    // 原始输入
  normalized: string;             // 归一化后的输入
  matched: boolean;               // 是否匹配到 Scenario
  scenarioId: string | null;      // 匹配到的 Scenario ID
  industryId: string | null;      // 匹配到的行业 ID
  confidence: number;             // 匹配置信度 (0-1)
  matchedKey: string | null;      // 匹配到的关键词/表达
  matchedType: 'exact' | 'keyword' | 'intent' | 'none';
}
```

### 2. 匹配策略（按优先级）

| 优先级 | 策略 | 说明 | 置信度范围 |
|--------|------|------|-----------|
| 1 | **Exact Match** | 输入完全匹配某个 Scenario 的 naturalExpression | 1.0 |
| 2 | **Keyword Match** | 输入包含 Scenario 的特征关键词（多关键词累积评分） | 0.3 - 0.95 |
| 3 | **Intent Match** | 输入与 Intent description 有字符级重叠（兜底策略） | 0.2 - 0.30 |

**Keyword Match 评分模型：**
- 每个匹配到的关键词贡献 `length^1.5 × 0.06` 分
- 2 字词 ~0.17，3 字词 ~0.31，4 字词 ~0.48，6 字词 ~0.88
- 多关键词命中时累加 + 多样性加分（最多 +0.12）
- 累计分数上限 0.88 + 多样性加分 = 最高 0.95

**Intent Match 条件：**
- 要求输入与 intent description 至少有 4 个**不同中文字符**重叠
- 置信度上限 0.30（确保不会超过弱关键词匹配）

### 3. Matcher API

- `match(raw: string): MatchResult` — 单条匹配，返回最佳结果
- `matchTopK(raw: string, k: number): MatchResult[]` — 返回 Top-K 匹配
- `batchMatch(raws: string[]): MatchResult[]` — 批量匹配

### 4. Keyword 体系

25 个 Scenario 全覆盖，每个 Scenario 至少 5 个关键词（实际 12-14 个）。关键词设计原则：
- 优先选择长词（≥4 字）以获得更好区分度
- 避免过于通用的高频词（如"推荐"、"了解"、"有什么"）
- 一个输入匹配到同 Scenario 的多个关键词可累积加分

### 5. 测试用例

21 个测试用例，覆盖：
- **Exact match** × 3: 完全命中 naturalExpression
- **Keyword match** × 6: 通过关键词命中
- **Intent match** × 3: 通过意图方向命中
- **No match** × 3: 天气、技术术语、问候语（完全不相关）
- **Multi-match** × 3: 输入匹配多个 Scenario 的场景
- **Top-K 验证** × 3: 验证 matchTopK 的正确性
- **Edge cases** × 3: 空字符串、特殊字符、单字符

## 依赖关系

### 本模块依赖
- `Scenario Library` (`benchmark/scenario/scenario-store.ts`) — 获取 Scenario 列表和 intent 数据

### 谁依赖本模块
- **当前：无**。SIE 是独立模块，预留扩展点。
- **未来**：Discovery Lab、Benchmark Runner、CLI 工具可通过 `import { scenarioMatcher } from '../sie'` 接入。

## 当前限制

1. **无 AI / 语义理解** — 纯规则引擎，没有 LLM、Embedding 或向量数据库
2. **关键词依赖** — 匹配质量取决于 keyword-map 的覆盖度和特异性
3. **中文优先** — 归一化和字符提取逻辑针对中文优化
4. **无上下文** — 单条输入独立匹配，不支持对话历史
5. **Intent Match 较弱** — 仅基于字符重叠，无法理解语义关系
6. **无分层阈值** — 所有 Scenario 使用相同的置信度阈值

## 下一 Task 接入指南

### Discovery Lab 接入

```typescript
import { scenarioMatcher } from '../benchmark/sie';

// 用户输入
const input = '这家酒店的性价比怎么样';
const result = scenarioMatcher.match(input);

if (result.matched) {
  // result.scenarioId → 'hotel-value'
  // result.confidence → 0.83
  // result.matchedType → 'keyword'
}
```

### Benchmark Runner 接入

```typescript
import { scenarioMatcher } from '../benchmark/sie';

// 批量评估
const demoInputs = loadTestCases();
const results = scenarioMatcher.batchMatch(demoInputs);
results.forEach((r) => console.log(`${r.raw} → ${r.scenarioId} (${r.confidence})`));
```

### 扩展建议

- **添加新 Scenario**：在 `keyword-map.ts` 中添加对应的 keyword 数组
- **调整阈值**：修改 `MIN_CONFIDENCE` 常量（目前 0.3）
- **增加语言支持**：扩展 `normalize()` 方法支持英文或其他语言
- **集成 LLM**（未来）：当 rule-based 匹配置信度低于阈值时，fallback 到 AI 匹配

## 验收清单

| 验收标准 | 状态 |
|----------|------|
| ✅ MatchResult 类型定义完整 | ✅ |
| ✅ ScenarioMatcher 支持 match / matchTopK / batchMatch | ✅ |
| ✅ keyword-map 覆盖全部 25 个 Scenario，每 Scenario ≥ 5 keywords | ✅ (12-14 个) |
| ✅ 测试用例 ≥ 20 个 | ✅ (21 个) |
| ✅ 覆盖 exact/keyword/intent/no-match/multi-match/edge | ✅ |
| ✅ Build PASS (tsc --noEmit 无 SIE 相关错误) | ✅ |
| ✅ 单 Commit | ✅ |
| ✅ TASK_RESULT.md 生成 | ✅ |
| ✅ 未使用 AI / Embedding / LLM / 向量数据库 | ✅ |
