# P1.2 — Retrieval Entropy Recovery
## 让 seed 从 filter 变 amplifier

## 问题诊断

当前 pipeline:
```
query → seed match → domain selection → (seed path? ↑ return : fallback path)
                                           ↓
                                    只有 3 个 dead queries
                                    "enterprise 财报 推荐"
                                    "enterprise 财报 排行"  
                                    → Ev=0
```

**根因：** `generateSearchQueries()` 在 seed 有 match 且 `buildSeedDrivenQueries` 返回有效 query 时，**直接 return，不走 domain template 和 raw query**。
这导致：seed match 后搜索空间被过度压缩。

Enterprise domain 的 Ev 不降（0.74 vs 0.70）是因为旧 seed（`company-general`）有 template。General 的 Hit Ev=0.12 是因为新 seeds 无 template → fallback 到 `"general 某个词"` → 搜不到。

## 方案：Hybrid Query Generation（三路混合，非二路独占）

### 改动点 1：generateSearchQueries 返回混合 queries

不再做 `if seed → return seedQueries` 的独占选择，而是：

```
seedPath → seedQueries  (1-2 queries, intent-guided)
domainPath → domainQueries (1-2 queries, domain-guided)
rawPath → rawQuery (1, original user query)
```

混合器：保留全部，去重，返回。

对于无 template 的 seed（P1 new seeds），seedPath 退化为：
```
"问题原文"  (不要 "domain keyword" 的死格式)
```

### 改动点 2：新的 fallback 策略

当 seed 没有 `SEED_QUERY_TEMPLATES` 时：

**当前（错误）：** `[domain, ...objectives].join(' ')` → `"enterprise 财报 推荐"`

**改成：** 
1. 整句问题作为搜索 query（用户知道自己在问什么）
2. 问题中提取的关键词组合（去掉停用词）
3. domain + objective 组合（保留原名，但作为次要 query）

### 改动点 3：意图增强（不是替换）

给 search.agent 注入 seed intent 信息时，不再用 `bias.domain + seedId` 去覆盖 search space，而是作为 **query modifier**：
- `华为公司最新动态` → `华为 公司 财报 2025`（保留关键词 + domain terms）
- `什么是通货膨胀` → `通货膨胀 定义 原理`（不是 `general 通货膨胀 推荐`）

---

## 代码改动

### 文件 1：`deterministic-transform.ts`

#### 改动 A：`generateSearchQueries` 改为混合模式

```typescript
export function generateSearchQueries(problem: DecisionProblem, bias?: {
  seed?: string
  domain?: string
}): string[] {
  const { constraints, objectives } = problem
  const queries: string[] = []

  // ===== 路径 1：Raw Query（始终包含）=====
  const rawQuery = problem.objectives.join(' ') || problem.domain
  queries.push(rawQuery)

  // ===== 路径 2：Seed-Driven Queries（如有）=====
  if (bias?.seed && bias?.domain) {
    const seedQueries = buildSeedDrivenQueries(problem, bias.seed, bias.domain)
    queries.push(...seedQueries)
  }

  // ===== 路径 3：Domain Templates（始终包含）=====
  const domainTerms: Record<string, string[]> = { ... }
  const terms = domainTerms[domain as DecisionDomain] || ['推荐']
  const city = constraints.find(c => c.startsWith('城市:'))
  // ... (domain queries 逻辑不变)

  // 去重，保留最多 5 条
  return [...new Set(queries)].filter(q => q.trim()).slice(0, 5)
}
```

#### 改动 B：`buildSeedDrivenQueries` fallback 优化

```typescript
function buildSeedDrivenQueries(problem: DecisionProblem, seedId: string, domain: string): string[] {
  const builder = SEED_QUERY_TEMPLATES[seedId]
  if (builder) {
    return builder(problem, domain)
  }

  // seed 无 template：使用 user intent 增强版 query（不再是 domain+objective 死格式）
  const raw = problem.objectives.join(' ')
  const domainTerms = getDomainTerms(domain) // 从 DOMAIN_TOKEN_MAP 取
  return [
    raw,  // 原问题作为搜索 query
    `${raw} ${domainTerms.slice(0, 3).join(' ')}`,  // 原问题 + domain 关键词
  ].filter(q => q.trim())
}
```

### 文件 2：`u1-seed-matcher.ts`（小改动）

新增 `getDomainTerms(domain)` 导出函数，让 `deterministic-transform.ts` 能调用 DOMAIN_TOKEN_MAP。

---

## 预期效果

| 指标 | 当前 | 修复后预期 |
|------|------|-----------|
| General Hit Ev | 0.12 | ≥ 1.0 |
| General Miss Ev | 2.08 | ≤ 2.0 |
| Enterprise Hit Ev | 0.74 | ≥ 1.5 |
| Enterprise Miss Ev | 0.70 | ≤ 1.0 |
| 全局 Seed Influence Rate | 41% | ≥ 50% |

关键变化：Hit Ev ≥ Miss Ev（seed 从 filter 变 amplifier）。
