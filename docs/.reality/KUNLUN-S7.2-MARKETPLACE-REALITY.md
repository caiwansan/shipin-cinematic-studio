# KUNLUN-S7.2-MARKETPLACE-REALITY.md

> S7.2 AI Employee Marketplace MVP — Reality Gate（MT1-MT6）
> 日期: 2026-08-06 17:10 (CST) | 状态: ✅ **MT1-MT6 全 PASS**
> 依据: 掌柜 S7.2 指令（两个只读 API + Desktop Marketplace View; 规则搜索排序; 「员工不是工具」表达; 禁支付/订单/入驻/开放上传/SDK）
> 定位: **Marketplace = 企业 AI Employee 目录（发现层/展示层）**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/routes/marketplace.routes.ts | 新增: 列表 + 详情（只读, 组合视图零新表, 规则搜索排序, 分类映射） |
| backend/src/index.ts | +注册行 |
| desktop/ui/index.html | 员工区块升级 Marketplace（分类 tab/搜索框/「员工非工具」岗位表达） |
| backend/scripts/s72-test.mts | MT1-MT6 Reality Gate |
| docs/.reality/KUNLUN-S7.2-MARKETPLACE-REALITY.md | 本报告 |

**未触碰（边界）**: 零新表 / 零写操作 / 无支付订单 / 无开放上传 / Desktop 零本地逻辑 ✅

## 1. API（只读, 组合视图）

```
GET /api/marketplace/employees            # 列表: 分类过滤 + 关键词搜索（name/desc/category/capability）
  → { total, employees: [{ code, name, category, identity{title,description}, capabilities(F1),
                           plugins(公开增强类型), entitlement{available}, usage{executions,successRate}, status }] }
  规则排序: 授权优先 → 能力数 → （非 AI 推荐）
GET /api/marketplace/employees/:code      # 详情: 五要素 + 岗位表达 + 公开增强
  → 无 token 可浏览公开目录（entitlement/usage 为 null）; 有 JWT 补充企业视角
审核态 = View Layer Mapping: 只返回 status=active def（published 映射, 不硬改 status）✅
```

## 2. Desktop Marketplace 视图

```
分类 tab（全部/人力/内容/营销/风险）+ 搜索框（实时过滤, 全 Cloud）
商品卡: 岗位表达（「你的 AI 招聘员工」+ 负责事项, 非工具表述）+ 能力 + 分类 + 增强 + 用量/成功率
启动/详情复用（授权状态 Cloud 判定）
```

## 3. Reality Gate 结果（实测 14 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| MT1 | 列表来源 F1 | ✅ | 4 商品员工; Alice capabilities 与 agent_definition 一致 |
| MT2 | 分类正确 | ✅ | 人力/内容/营销/风险 映射; 分类过滤「风险→仅法务」 |
| MT3 | 搜索真实过滤 | ✅ | 关键词/能力码命中; 无匹配 → 空 |
| MT4 | 详情五要素 | ✅ | identity（员工非工具表达）+ capabilities/plugins/entitlement/usage; 无 token 可浏览 |
| MT5 | 未授权状态 | ✅ | B 企业 entitlement.available=false |
| MT6 | 四员工回归 | ✅ | 全 COMPLETED（法务带重试防偶发） |

## 4. 完成标准对照

```
Marketplace MVP 成立:
  商品列表（分类/搜索/推荐规则版/审核过滤）✅
  商品详情（五要素 + 「员工不是工具」表达）✅
  未授权状态正确（需要购买, 入口冻结）✅
  四员工执行不受影响 ✅
→ 用户从「购买功能」转向「购买员工」的发现层成立
→ 路线: Windows RG 并行 → S7.3 第五员工（财务）→ Payment/Order → Beta 1.0
```

## 5. 未完成项

- [ ] 第五员工（财务分析 financial.report/expense.analysis/business.insight, 掌柜 S7.3 候选）
- [ ] 商品详情页 UI 深度优化（使用案例/Seat 估计展示, 当前 API 已含基础）
- [ ] Payment/Order（冻结, Beta 1.0 前）
- [ ] Windows RG 实机（掌柜侧并行）

## 6. 结论

```
S7.2 ✅ 通过 —— AI Employee Marketplace 目录成立（零新表/零支付/零风险扩张）
→ 昆仑镜从「造员工」转向「卖员工」的发现层完成
```
