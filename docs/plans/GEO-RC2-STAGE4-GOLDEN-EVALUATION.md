# GEO-RC2 Stage 4 — Golden Evaluation Runtime

## 状态: FINAL
冻结日期: 2026-07-02
前置依赖: GEO-RC2 Stage 3 — ✅ PASS

## 一句话目标
Replay 可自动评测、Gap 可结构化输出、Score 可历史对比。

## 架构位置

```
Replay Runtime (Stage 3)
  │
  ▼
Golden Evaluation Runtime (Stage 4) — 在此
  │
  ├── M1: Dataset Loader
  ├── M2: Scenario Resolver
  ├── M3: Golden Evaluator
  ├── M4: Score Generator
  ├── M5: Gap Analyzer
  └── M6: Calibration Recommendation
  │
  ▼
Evaluation Report
```

## 6 个 Milestone

### M1: Dataset Loader（最高优先级）
- 加载 Golden Dataset v1.0
- 版本管理 / 完整性校验
- 与现有 Validator 集成

### M2: Scenario Resolver
根据 Replay 自动匹配 Industry / Intent / Scenario / Expected Band / Evidence Requirement

### M3: Golden Evaluator（核心）
输入: Replay + Golden Dataset  
输出: Pass/Fail / Precision / Recall / Evidence Coverage / Band Accuracy / Confidence

### M4: Score Generator
统一评分: Overall Score / Category Score / Provider Score / Scenario Score / Trend

### M5: Gap Analyzer
结构化 Gap 输出: Missing Evidence / Wrong Band / Missing Signal / Prompt Issue / Context / Provider

### M6: Calibration Recommendation
**不直接修改 Prompt。** 生成建议（Prompt/KG/Dataset/Context/Provider），由后续 Calibration 决策是否采纳。

## 注意
M3（Evaluator）依赖 Replay 有真实数据。当前 Discovery→Provider Runtime→Replay 尚未串联。
需在 Evaluator 开始前完成串联：ExecutionEngine.execute() → createReplayRecord()。

## 文件结构
```
backend/src/services/geo/runtime/golden/
├── dataset-loader.ts      (M1)
├── scenario-resolver.ts   (M2)
├── evaluator.ts           (M3)
├── score-generator.ts     (M4)
├── gap-analyzer.ts        (M5)
├── calibration-recommendation.ts (M6)
├── types.ts               (公共类型)
└── index.ts               (导出)
```

## Gate 验收条件
- [ ] Replay 可自动评测
- [ ] Golden Dataset 自动匹配
- [ ] Evaluation 可重复
- [ ] Gap 可结构化输出
- [ ] Recommendation 可生成
- [ ] Score 可历史对比
