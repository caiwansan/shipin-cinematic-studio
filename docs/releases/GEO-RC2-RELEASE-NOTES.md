# GEO-RC2 Release Notes

**版本**: GEO-RC2 v1.0
**Git Tag**: `geo-rc2-v1`
**冻结日期**: 2026-07-02
**产品**: AI Brand Visibility & Recommendation Platform

---

## 概述

RC2 完成 **Knowledge Hub → Golden Evaluation** 的完整闭环基础设施建设。从 RC1 的单点 Discovery + 前端基建，升级为可度量、可追溯、可自动优化的 AI 可见度评测体系。

---

## RC1 → RC2 新增能力

### 🏗 平台层
| 能力 | 说明 |
|------|------|
| Knowledge Hub | 统一的 Source of Truth — 品牌/产品/知识/实体数据治理 |
| Knowledge Compiler | 自动构建 Package / JSON-LD / Prompt / Snapshot |
| Version Management | 发布链：Validate → Version → Review → Publish |
| Review Engine | 审批/评论/修改请求流程 |

### 🏃 Runtime 层
| 能力 | 说明 |
|------|------|
| Context Runtime | 从 KH 获取品牌/知识上下文的统一入口 |
| Provider Runtime | ExecutionEngine + Adapter 框架 + Reliability + Observability |
| Replay Runtime | 每次执行自动记录 + 证据索引 + Diff 对比 |

### 🎯 评测层
| 能力 | 说明 |
|------|------|
| Golden Dataset Loader | 文件/内存双模式加载 |
| Scenario Resolver | 自动匹配 Replay → Golden Entry |
| Evaluation Engine | 9 维评分 + Band 统一 |
| Gap Analysis | Structural Gap 输出 |
| Explainability | 每个扣分附带 Why/Impact/Fix |
| Calibration Candidate | 自动生成优化建议 |

### 🌐 AI 生态
| 能力 | 说明 |
|------|------|
| 18 AI 平台展示 | 全部标记"已支持"，统一蓝色标签 |

---

## 新 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/geo/benchmark/evaluate` | 单次评测 |
| POST | `/api/v1/geo/benchmark/evaluate/batch` | 批量评测 |
| GET | `/api/v1/geo/benchmark/result/:id` | JSON 报告 |
| GET | `/api/v1/geo/benchmark/report/:id` | Markdown 报告 |
| GET | `/api/v1/geo/discovery/run` | 触发扫描 |
| GET | `/api/v1/geo/replay/diff` | Replay 差异 |
| GET | `/api/v1/geo/replay/evidence` | 证据索引 |

---

## 兼容性

### Breaking Changes
- 无。RC1 API 端点全部保留。

### Deprecations
- 无。

### 迁移指南
- 无需迁移。RC2 在 RC1 上新增能力，不修改已有路由。

---

## 已知限制

见 `GEO-RC2-V1-FROZEN.md` 第 8 章节。

---

## RC3 规划

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| RC3-1 | 真实 Provider 接入 (DeepSeek 优先) | P0 |
| RC3-2 | Replay 数据库持久化 | P0 |
| RC3-3 | Knowledge Hub 产品体验 | P1 |
| RC3-4 | Workspace 评测界面 | P1 |

---

## 致谢

所有 GEO-RC2 的能力由熊大产品方向与架构决策驱动。
