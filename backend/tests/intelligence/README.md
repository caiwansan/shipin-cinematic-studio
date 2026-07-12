# Intelligence Test Platform — Golden Dataset & Regression Framework

## Golden 原则

> **Dataset 永远不能为了让测试通过而修改。**

Golden Dataset (`golden/knowledge/inputs/dataset.ts`) 是 Intelligence Engine 的质量锚点。它长期稳定，不随 Rule 修改而改变。当 Rule 发生预期变化时：

1. Regression Fail
2. 分析 Diff（snapshot-manager + diff-engine）
3. Code Review 确认变化合理
4. 更新 expectations（`golden/knowledge/expectations/v1.0.json`）

## 三层分离结构

```
golden/
├── knowledge/
│   ├── inputs/
│   │   └── dataset.ts              # 30 个标准输入（长期稳定）
│   ├── expectations/
│   │   └── v1.0.json               # 人工审核后的基线期望（版本化）
│   └── snapshots/                   # 运行产物（不提交，.gitignore）
│       └── latest.json
├── discovery/                       # 预留
├── packaging/                       # 预留
├── distribution/                    # 预留
├── observation/                     # 预留
└── adaptive/                        # 预留

runner/
├── regression-suite.ts             # Regression Runner
├── determinism-check.ts            # 幂等性验证
├── snapshot-manager.ts             # 版本化 Snapshot 管理
├── diff-engine.ts                  # Diff 计算 + Risk Level
├── report-generator.ts             # Markdown 报告生成
└── generate-expectations.ts        # 期望生成工具

reports/
└── regression-report.md            # 最新报告输出

README.md                           # 本文件
```

## 如何添加新的 Golden Dataset

1. 在 `golden/{domain}/inputs/` 下创建 `dataset.ts`
2. 确保每个 Object 包含 Engine `evaluate()` 所需的全部字段
3. 覆盖所有 Rule 路径（边界值、空值、临界值）
4. 运行 `npx tsx runner/regression-suite.ts --domain {domain}` 验证
5. 运行 `npx tsx runner/determinism-check.ts` 验证幂等性
6. 生成 expectations 并提交

## 如何运行 Regression

```bash
# 运行 Knowledge domain 的 Regression
npx tsx backend/tests/intelligence/runner/regression-suite.ts --domain knowledge

# 运行 Determinism Check
npx tsx backend/tests/intelligence/runner/determinism-check.ts

# 生成完整报告
npx tsx backend/tests/intelligence/runner/report-generator.ts

# 查看报告
cat backend/tests/intelligence/reports/regression-report.md
```

## 如何更新 Expectations

当 Rule 发生**预期内的**变化时：

```bash
# 1. 确认变化合理
npx tsx backend/tests/intelligence/runner/regression-suite.ts --domain knowledge

# 2. 重新生成 expectations
npx tsx backend/tests/intelligence/runner/generate-expectations.ts

# 3. 确认再次 Regression 通过
npx tsx backend/tests/intelligence/runner/regression-suite.ts --domain knowledge

# 4. 提交 expectations 变更
git add golden/knowledge/expectations/v1.0.json
git commit -m "chore: update v1.0 expectations for KR-XXX rule change"
```

## IRG — Intelligence Regression Gate

IRG 是 Intelligence Regression Gate 的缩写，是新 Engine 必须通过的准入检查：

| 检查项 | 要求 | 工具 |
|--------|------|------|
| Golden Replay | 100% PASS | regression-suite.ts |
| Determinism | 100% PASS | determinism-check.ts |
| Rule Coverage | 每条 Rule 有覆盖 | regression-suite.ts (Coverage Report) |
| Score Diff | 可解释（≤2 容差） | diff-engine.ts |
| Recommendation Diff | 可解释 | diff-engine.ts |
| Stability Score | ≥95% | report-generator.ts |

## 新 Engine 必须满足的条件

任何新的 Intelligence Engine 在接入平台前必须满足：

1. **Golden Dataset**: 提供 ≥30 个标准输入对象，覆盖所有 Rule 路径
2. **Regression Suite**: 所有 Golden Object 与 Expectations 比对通过
3. **Determinism Check**: evaluate() 在相同输入下 3 次结果完全一致
4. **Explainability**: 每个 Rule 提供 delta + reason，Diff 可追溯
5. **IRG Pass**: Intelligence Regression Gate 全部检查项通过

## Diff Engine Risk Level

| 条件 | Risk Level |
|------|------------|
| Recommendation 优先级变化 | HIGH |
| maxScoreDelta ≥ 10 且 Label 变化 | MEDIUM |
| maxScoreDelta < 10 且 Label 不变 | LOW |
| 无变化 | NONE |

## 目录预留

以下目录为后续 Intelligence Domain 预留：

- `discovery/` — Discovery Engine
- `packaging/` — Packaging Engine
- `distribution/` — Distribution Engine
- `observation/` — Observation Engine
- `adaptive/` — Adaptive Engine
