# KUNLUN-S6.1-DESKTOP-PRODUCT-REALITY.md

> S6.1 Desktop Product UI — AI Employee 商品消费入口（Reality）
> 日期: 2026-08-06 13:40 (CST) | 状态: ✅ **DP1'-DP6' 全 PASS**
> 依据: 掌柜 S6.1 执行指令（把 Cloud 商品能力投射到 Desktop; 禁新 Runtime/本地 Skill 执行/Key/Agent 逻辑迁移/支付/Billing）
> 定位: **Desktop 成为 AI Employee 商品消费入口（应用 + 员工商品 + 增强包）**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/routes/skill-orchestrator.routes.ts | +GET /api/skills/employees/:code/enhancements（JWT 鉴权, 只读, 复用 S5.3 函数） |
| desktop/ui/index.html | 商品卡升级（五要素）+ 员工详情视图 + 启动映射（Alice→/workspace/recruitment, 短剧→/hdz/workspace, 新媒体→/media-department/workspace） |
| backend/scripts/s61-test.mts | DP1'-DP6' Reality Gate |
| docs/.reality/KUNLUN-S6.1-DESKTOP-PRODUCT-REALITY.md | 本报告 |

**未触碰（边界）**: Tauri Runtime / Rust Host / 安装包 / Marketplace 交易 / 支付 / Billing ✅

## 1. 后端（唯一新 API, 只读）

```
GET /api/skills/employees/:code/enhancements
  JWT 鉴权（S4.4）→ orgId（getOrganizationIdForUser）→ getOrgEnhancementsForSkills(orgId, 员工 capabilities)
  → { employeeCode, enhancements: [{ skillId, type, templates, pluginId }] }
数据源: EcologyLicense（ACTIVE）+ ecology_plugins.manifest.enhancements（S5.3 复用, 零新表）
无授权组织 → 空数组（Desktop 隐藏增强）
```

## 2. Desktop 商品卡（五要素, 全 Cloud 来源）

```
招聘专员 alice   [已授权/需要购买]          ← entitlement API
能力: resume.parse profile.extract ...     ← agent-definitions API
增强: jd-template  用量: N 次              ← enhancements + usage API（S4.4 JWT, 无 query 参数）
[启动] [详情]
```

## 3. Employee Detail（新增视图）

```
身份 + 授权 badge → 能力明细（skills API）→ 用量（executions/成功/失败）
→ 增强包（模板明细列表）→ [启动] [关闭]
```

## 4. Reality Gate 结果（实测 17 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| DP1' | 商品入口 | ✅ | Desktop 目录 API 可发现 Alice/短剧/新媒体 三员工 |
| DP2' | 商品详情 | ✅ | skills/entitlement/usage/enhancements 四 API 全通（JWT） |
| DP3' | Enhancement | ✅ | A 企业（JD 插件授权）显示增强; B 企业增强为空（隐藏） |
| DP4' | Usage 一致 | ✅ | usage API 与 Cloud Meter 数值一致 |
| DP5' | Runtime 边界 | ✅ | Desktop 0 provider key / 0 Skill 执行 / Hermes 仅契约握手; Rust 白名单保持 |
| DP6' | 三员工同展 | ✅ | 三员工商品卡数据齐备（授权+用量+增强） |

## 5. 完成标准对照

```
Desktop = AI Employee 商品消费入口 ✅
  商品卡五要素（身份/能力/授权/增强/用量）全 Cloud 来源
  详情页（身份/能力/Skills/增强/用量/启动）✅
  增强展示（授权显/未授权隐）✅
  Usage 可见（与 Cloud 一致）✅
  边界保持（0 Key / 0 Skill 执行 / 0 Hermes 承载）✅
→ S6.2 Release Engineering 前置条件成立
```

## 6. 未完成项

- [ ] S6.2 Windows 发布工程（tauri.conf nsis+updater → 实机 build → installer 实测 → 签名/崩溃收集）
- [ ] 企业级 License 概览页（已购员工/增强包/到期; P3 商业展示层, 依赖订单域）
- [ ] 应用详情页（App Center 完善, 掌柜 P1 缺口）
- [ ] Marketplace 交易（S7, 前置: 企业购买流程）

## 7. 结论

```
S6.1 ✅ 通过 —— Cloud 商品能力已投射到 Desktop
→ 用户可在 Desktop 发现员工、查看授权/增强/用量、启动工作台
→ 下一阶段: S6.2 Windows Release Engineering
```
