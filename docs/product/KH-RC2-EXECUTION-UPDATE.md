# KH-RC2 — 更新执行路线

## 状态: FINAL
冻结人: 熊大
更新日期: 2026-07-02

## 执行顺序（调整后）

| 顺序 | 模块 | 依赖 | 预计输出 |
|------|------|------|----------|
| 1 | **M4 — Knowledge Compiler**（优先） | M1/M2/M3 | 统一出口：聚合→去重→版本→编译 |
| 2 | **M5 — Knowledge Snapshot** | M4 | 基于 Compiler 输出的版本快照 |
| 3 | **M6 — Knowledge Package API** | M4/M5 | 5 个端点，只访问 Compiler |
| 4 | **M7 — Knowledge Consumption Layer** | M4 (NEW) | GEO 模块全部走 Compiler |

## 约束
- M4 (Compiler) 是唯一入口，禁止 API 直接访问 Repository 或 Builder
- M7 完成后，Discovery / Publishing / Verification / Benchmark 全部通过 Compiler 获取知识
