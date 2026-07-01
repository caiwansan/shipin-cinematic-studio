# P0-T008 — Verification Engine MVP

## 验收摘要

| 验收项 | 状态 |
|---|---|
| ✅ VerificationReport 类型完整 | ✅ 通过 |
| ✅ VerificationEngine 规则化实现 | ✅ 通过 |
| ✅ VerificationService 整合 Discovery + ActionPlan | ✅ 通过 |
| ✅ API `GET /api/geo/discovery/verify?entity=X` | ✅ 通过 |
| ✅ 前端 VerificationPage 展示全部数据 | ✅ 通过 |
| ✅ kmki-ui 组件（5个） | ✅ 通过 |
| ✅ 侧边栏 Verify 入口 | ✅ 通过（已有 Verification 入口） |
| ✅ Build PASS（前端 + 后端） | ✅ 后端编译通过（仅预存 Set 迭代 warning） |
| ✅ 单 Commit | ✅ |
| ✅ TASK_RESULT.md | ✅ |
| ✅ 未使用 LLM / 真实 Scanner / Provider | ✅ 全部 deterministic 规则 |

## 新增文件

### Backend
| 文件 | 说明 |
|---|---|
| `backend/src/benchmark/verification/types.ts` | VerificationReport / VerifiedItem 类型定义 |
| `backend/src/benchmark/verification/verification-engine.ts` | 验证引擎：Before/After ADI + 维度 + Breakdown + Confidence 规则 |
| `backend/src/benchmark/verification/verification-service.ts` | VerificationService：整合 Discovery + ActionPlan |
| `backend/src/benchmark/verification/index.ts` | 统一导出 |

### 修改文件
| 文件 | 变更 |
|---|---|
| `backend/src/services/geo/routes/geo-discovery.route.ts` | 新增 `GET /api/v1/geo/discovery/verify?entity=X` 端点 |

### Frontend
| 文件 | 说明 |
|---|---|
| `frontend/components/kmki-ui/VerificationCard/index.vue` | 主数据卡片（Before → After 对比） |
| `frontend/components/kmki-ui/ScoreComparison/index.vue` | 分数对比展示组件 |
| `frontend/components/kmki-ui/ImprovementBadge/index.vue` | 改进徽标（+N ADI） |
| `frontend/components/kmki-ui/ConfidenceMeter/index.vue` | 置信度指示器 |
| `frontend/components/kmki-ui/VerificationTimeline/index.vue` | 改进瀑布图组件 |
| `frontend/workspaces/geo/pages/VerificationPage.vue` | 完整验证页面（全功能重构） |
| `frontend/workspaces/geo/services/verificationService.ts` | 新增 `fetchEntityVerification()` 和 `VerificationReport` 类型 |

## 核心逻辑

### Verification Engine 规则（全部 deterministic）

**Before ADI:** 从 DiscoveryService baseline 报告获取

**After ADI 计算:**
- `afterAdi = beforeAdi`
- 每个 completed ActionPlan: `+= estimatedImpact × 0.6`
- 完成率 > 50% 的场景额外 bonus 0.5 ADI
- 总 completionRate > 80%: 额外 +5 ADI
- 上限 95

**维度变化:**
- `afterX = beforeX + completionRatio × gap × 0.4` (coverage)
- `afterX = beforeX + completionRatio × gap × 0.3` (share, position)

**Improvement Breakdown:** 按模板类型分组，32 个模板各有关联标签

**Confidence:**
- completionRate > 80% → 0.9
- 60-80% → 0.7
- 40-60% → 0.5
- < 40% → 0.3

## 产品闭环 — RC3 完整链路

### 现在 RC3 的完整产品闭环是什么？普通用户能看到什么？

**完整产品闭环（RC3）：**

```
品牌发现诊断 → 优化机会识别 → 行动方案生成 → 效果验证
   (Discover)      (Opportunity)    (Action Plan)   (Verify)
```

1. **Discovery Lab** — 用户输入实体名称，系统通过 SIE 匹配 + Mock 扫描生成发现报告，展示 ADI、三维度分数、覆盖场景和优化机会
2. **Opportunity Engine** — 自动为每个 gap 生成优先级、预计 ADI 提升、优化建议和难度评估
3. **Action Plan Engine** — 为每个 opportunity 匹配 32 种模板之一，生成带步骤的详细行动方案
4. **Verification Engine** — 验证 Before/After ADI 对比、维度变化、改进瀑布图、置信度

**普通用户能看到什么？**

1. **Discovery Lab 页面**（`/workspace/geo/discovery`）：输入品牌名 → 看到 ADI 评分、三维度雷达图、覆盖/未覆盖场景列表、优化机会列表
2. **推荐的行动方案**（在 Discovery Lab 底部）：每个机会对应一个行动方案，含步骤、预计影响和优先级
3. **验证页面**（`/workspace/geo/verification`）：输入品牌名 → 看到：
   - **Score Comparison 卡片**：Before → After 分数对比 + 改善率
   - **子维度变化**：Coverage / Share / Position 三个维度各自的 Before → After 条形对比
   - **Action 完成率**：进度条 + 已完成/待完成/忽略计数
   - **改进瀑布图**：Baseline → 各项改进的累积得分
   - **已验证条目列表**：每项任务的状态和 ADI 贡献
   - **剩余问题**：仍需处理的场景和优先级
   - **置信度指示器**：基于完成率计算的验证可信度
