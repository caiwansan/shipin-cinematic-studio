# P0-T006 — Opportunity Engine（第一版）

**Status:** ✅ Complete  
**Date:** 2026-06-30  
**Branch/Commit:** Single commit on main

---

## 验收标准检查

| # | 标准 | 状态 | 说明 |
|---|------|------|------|
| 1 | Opportunity 类型完整 | ✅ | 含 effort / tags / reason / suggestion / expectedAdiGain |
| 2 | Priority 规则 ≥ 5 条 | ✅ | 6 条规则（4 条基础 + 2 条调节） |
| 3 | Impact 计算规则 ≥ 3 条 | ✅ | 基线 + priority 倍率 + effort 倍率 |
| 4 | Effort 判定规则 ≥ 2 条 | ✅ | easy 5 场景 / hard 5 场景 / 默认 medium |
| 5 | Reason 生成规则 ≥ 8 条 | ✅ | 10 条规则 + 1 条兜底 |
| 6 | Suggestion 覆盖全部 25 场景 | ✅ | 5 行业 × 5 场景，每条均有映射 |
| 7 | OpportunityService 接收 DiscoveryScenario[] → Opportunity[] | ✅ | 完整流水线 |
| 8 | Discovery 页面接入升级后的 Opportunity 展示 | ✅ | Priority 颜色/ADI Gain/Reason/Suggestion/Effort/Tags |
| 9 | Build PASS（前后端） | ✅ | TS 编译验证通过 |
| 10 | 单 Commit | ✅ | 所有变更在一个提交中 |
| 11 | TASK_RESULT.md | ✅ | 本文档 |
| 12 | 未使用 LLM / AI / Provider | ✅ | 纯规则引擎 |

---

## 新增文件

```
backend/src/benchmark/opportunity/
  ├── types.ts                       — Opportunity 完整类型定义
  ├── priority-rules.ts              — 优先级判定（6 条）+ Effort 判定（2 条）
  ├── impact-calculator.ts           — Expected ADI Gain 计算（3 条规则）
  ├── reason-generator.ts            — 原因生成器（10 条规则）
  ├── suggestion-map.ts              — 25 场景优化建议映射
  ├── opportunity-service.ts         — 整合引擎：DiscoveryScenario[] → Opportunity[]
  └── index.ts                       — 统一导出
```

## 修改文件

| 文件 | 变更 |
|------|------|
| `backend/src/benchmark/discovery/types.ts` | `DiscoveryOpportunity` 升级为完整类型（含 id / coverageScore / industryId / expectedAdiGain / reason / effort / tags） |
| `backend/src/benchmark/discovery/discovery-service.ts` | 替换硬编码机会识别为 `OpportunityService.generateOpportunities()` |
| `frontend/workspaces/geo/services/discoveryService.ts` | 前端 `DiscoveryOpportunity` 接口同步升级 |
| `frontend/workspaces/geo/stores/useDiscoveryStore.ts` | 新增 `lowPriorityOpportunities` computed |
| `frontend/workspaces/geo/pages/DiscoveryLabPage.vue` | Opportunity 卡片升级：颜色区分、ADI Gain、Reason、Suggestion、Effort 标识、Tags |

---

## 规则引擎详述

### Priority 规则（6 条）

| 规则 | 条件 | 结果 |
|------|------|------|
| 1 | coverageScore < 20 | high |
| 2 | 20 ≤ coverageScore < 40 + competitorCount > 2 | high |
| 3 | 40 ≤ coverageScore ≤ 60 | medium |
| 4 | coverageScore > 60 | low |
| 5 | trend === 'down' + coverageScore < 50 | high（覆盖规则 5） |
| 6 | matchedIntentCount > 3 | 提升一级（覆盖规则 6） |

### Impact 计算规则（3 条）

1. **基线**：`gain = gap × 0.15`
2. **High priority 倍率**：`gain × 1.5`
3. **Easy effort 倍率**：`gain × 1.2`

### Effort 判定规则（2 条 + 默认）

- **easy**：brand-history, brand-positioning, brand-discovery, brand-comparison, hotel-experience
- **hard**：product-safety, shop-trust, shop-reputation, brand-trust, product-purchase
- **medium**：其余场景（默认）

### Reason 生成规则（10 条 + 1 兜底）

1. coverageScore < 10 → "该场景几乎未被覆盖，存在重大信息缺失"
2. coverageScore < 30 + matchedIntentCount > 3 → "该场景用户需求强烈，但实体信息覆盖不足"
3. trend === 'down' + coverageScore < 50 → "该场景发现趋势正在下降，需要立即干预"
4. coverageScore < 50 + competitorCount > 3 → "行业中同类实体在此场景表现更好"
5. 40 ≤ coverageScore ≤ 60 + trend === 'down' → "中等覆盖但呈下降趋势，需巩固以防止进一步流失"
6. industryId === 'brand' + coverageScore < 50 → "品牌信息缺失影响用户认知和信任建立"
7. scenarioId 含 purchase/booking/comparison + coverageScore < 50 → "直接影响用户购买决策转化"
8. trend === 'stable' + coverageScore < 40 → "长期覆盖不足，稳定需求场景中的短板"
9. gap > 70 → "低于行业平均水平，存在系统性提升空间"
10. coverageScore ≥ 70 + matchedIntentCount > 3 → "当前覆盖较好，但用户需求增速超过覆盖提升速度"
11. 兜底：'"{name}" 场景覆盖率为 {score}%，存在 {gap} 分的提升空间'

### Suggestion 映射（25 场景全覆盖）

| 行业 | 场景 | 建议 |
|------|------|------|
| brand | brand-discovery | 补充品牌基本信息，包括创立时间、核心产品、市场定位 |
| brand | brand-comparison | 整理与主要竞品的差异化信息，明确自身优势 |
| brand | brand-trust | 提供资质认证、媒体报道、第三方评价等信任背书 |
| brand | brand-history | 完善品牌发展里程碑、关键成就与文化故事 |
| brand | brand-positioning | 明确品牌的市场定位、目标人群与核心价值主张 |
| product | product-research | 丰富产品规格、功能亮点与使用场景说明 |
| product | product-comparison | 制作同类产品客观对比表，突出差异化优势 |
| product | product-purchase | 提供价格区间、优惠渠道与售后服务说明 |
| product | product-safety | 展示安全认证、检测报告与合规资质 |
| product | product-alternative | 整理替代产品清单，帮助用户全面比较选择 |
| hotel | hotel-booking | 完善酒店设施、周边交通、房型等基础信息 |
| hotel | hotel-location | 详细描述酒店地理位置优势与周边景点距离 |
| hotel | hotel-experience | 收集并展示真实住客评价与入住体验分享 |
| hotel | hotel-value | 突出性价比分析，对比同档次酒店的差异化服务 |
| hotel | hotel-suitability | 说明适合的出行人群类型（商务、亲子、情侣等） |
| ecommerce | shop-trust | 提供资质证书、用户评价、售后保障等信任信息 |
| ecommerce | shop-quality | 展示商品质检报告、材质细节与实拍图片 |
| ecommerce | shop-service | 完善退换货政策、客服响应时间和物流说明 |
| ecommerce | shop-reputation | 整理店铺评分、好评率与纠纷处理记录 |
| ecommerce | shop-recommendation | 建立商品推荐体系，帮助用户发现合适商品 |
| restaurant | restaurant-recommendation | 完善推荐菜、招牌菜与必点清单信息 |
| restaurant | restaurant-cuisine | 详细描述菜系特色、食材来源与烹饪工艺 |
| restaurant | restaurant-ambiance | 描述餐厅环境风格、座位布局与氛围特点 |
| restaurant | restaurant-value | 展示人均消费区间、套餐组合与性价比分析 |
| restaurant | restaurant-suitable | 丰富不同场合的用餐场景描述 |

---

## 测试验证

```
✅ OpportunityService works correctly!
   Total opportunities: 2
   High: 1
   Medium: 1
   Low: 0
```

- brand-discovery（覆盖率 15，趋势 down）→ **High priority**, gain=23 ADI, **Easy effort**
- product-comparison（覆盖率 45，稳定）→ **Medium priority**, gain=8.3 ADI
- hotel-booking（覆盖率 85）→ 未生成 opportunity（gap ≤ 15，过滤噪音）

---

## 用户价值

> **这次普通用户能看到什么新增价值？**
>
> 升级后的 Discovery Lab 页面展示了更丰富、更具行动指导性的优化机会卡片：
>
> 1. **Priority 颜色区分**：High=🔴红（急需处理）、Medium=🟡黄（值得优化）、Low=⚪灰（锦上添花），一目了然
> 2. **Expected ADI Gain 量化**：每个机会旁边显示预计能提升的 ADI 点数（如 "+23 ADI"），让用户直观看到优化后的收益
> 3. **优化原因**：不再只说"差距大"，而是给出具体原因，如"该场景用户需求强烈，但实体信息覆盖不足"或"该场景发现趋势正在下降，需要立即干预"
> 4. **具体优化建议**：针对每个场景给出可执行的行动项，如"补充品牌基本信息，包括创立时间、核心产品、市场定位"
> 5. **Effort 难度标识**：🟢 Easy（补充文本即可）、🟡 Medium、🔴 Hard（需要实质内容验证），帮助用户按优先级和投入成本决策
> 6. **Tags 标签**：显示场景特征标签，如 priority:high, effort:easy, trend:declining, critical
>
> 简单说：**以前只告诉你"这里有问题"，现在告诉你"问题是什么、为什么、怎么改、改完能提升多少、难不难改"**。
