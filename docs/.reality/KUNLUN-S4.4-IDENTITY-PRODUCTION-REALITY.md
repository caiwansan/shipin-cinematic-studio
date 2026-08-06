# KUNLUN-S4.4-IDENTITY-PRODUCTION-REALITY.md

> S4.4 Identity & Production Reality — Reality Gate
> 日期: 2026-08-06 10:45 (CST) | 状态: ✅ **P0 JWT Identity Authority 全 PASS（JI1-JI5）**
> 依据: 掌柜 S4.3 验收裁决（tenantUserId query → JWT 为 S4.4 P0; Windows 实机构建 → P1; Billing 准备 → P2）
> 定位: **把已成立的 AI OS 商品链推进到生产级身份权威**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/routes/skill-planner.routes.ts | from-intent 加 preHandler authenticate; tenantUserId = JWT（body 传参忽略） |
| backend/src/routes/skill-orchestrator.routes.ts | execute/entitlement/usage 三路由加 authenticate; 身份 = JWT（query/body 传参忽略） |
| backend/src/ecosystem/skill-orchestrator.ts | 执行身份统一: step.input.tenantUserId 强制覆盖为入口身份（防注入） |
| backend/scripts/s44-test.mts | JI1-JI5 Reality Gate |
| docs/.reality/KUNLUN-S4.4-IDENTITY-PRODUCTION-REALITY.md | 本报告 |

**未触碰（边界）**: Desktop 零改动（api() 自动带 Bearer token, 员工区块直接受益）; 内部 skill-tools 路由保持 token 门禁; 无新表; 无支付/订单

## 1. P0 JWT Identity Authority（掌柜裁决: 身份权威问题）

### 改造前（Reality 测试态）
```
客户端 → /entitlement?tenantUserId=<客户端自报> → 授权边界依赖客户端传参 ❌
```

### 改造后（生产态）
```
Authenticated User (JWT)
      ↓ request.user.id（jwtVerify + tokenVersion 单设备检查）
Organization Resolver（getOrganizationIdForUser, S4.1）
      ↓
Entitlement → Hermes（执行身份统一）
```

- 4 个入口路由全部 `preHandler: [app.authenticate]`: plans/from-intent, plans/execute, employees/:code/entitlement, employees/:code/usage
- **身份权威 = JWT**: body/query 的 tenantUserId 一律忽略（伪造无效）
- **执行身份统一**: executeSkillPlan 在 Entitlement Gate 通过后, 将每个 step.input.tenantUserId 强制覆盖为入口身份——客户端无法经 step input 伪造租户（BYOK 路由 + InvocationLog 归属随 JWT 身份）
- 无 token → 401（四个入口全覆盖）
- 复用既有 JWT 基础设施（fastify-jwt + auth.ts + plugins/auth.ts）, 零新体系

## 2. P1 Desktop Production Reality（发布工程, 记录不阻塞）

| 项 | 状态 |
|---|---|
| Tauri Windows build / installer | build.sh 存在（前端 SPA + Tauri 构建链路）; **实机构建需 Windows 开发机**（本机 Linux 只承载后端; 掌柜裁决记录不阻塞） |
| Deep link / protocol registration | lib.rs register_all（kunlun://, 幂等）✅ 已实现 |
| First-run login | 登录桥 + 设备注册 + token 注入 ✅ 已实现 |
| Update channel | 未实现 → 记录（Release Engineering 后续） |
| 发布清单 | desktop/README.md 构建说明 ✅ |

## 3. P2 Enterprise Billing Preparation（非支付）

| 要素 | 状态 |
|---|---|
| License | EnterpriseEntitlement（S4.2）✅ |
| Usage Meter | getEmployeeUsageMeter（S4.2, InvocationLog+KernelEvent 零新表）✅ |
| Plan Mapping | 本报告固化: 计划(governance_subscription_plan 已有表) → 能力集/配额 → EnterpriseEntitlement; **不建表, Subscription/Order 后置** |
| 支付/订单 | ❌ 冻结（掌柜裁决保持后置） |

### Plan Mapping 设计（固化）
```
governance_subscription_plan（已有表, 只读引用）
  ↓ plan code
EnterpriseEntitlement（S4.2 表）
  capabilityCodes（员工授权集） + max_agents + quota 字段
  ↓
Usage Meter（实际用量）
  ↓
Billing Reference（仅计量输出, 无支付）
```

## 4. Reality Gate 结果（实测 11 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| JI1 | JWT 身份权威 | ✅ | 伪造 query tenantUserId → 身份仍 = JWT（ACTIVE）; 无 query 也正常 |
| JI2 | 无 token 拒绝 | ✅ | entitlement/usage/planner 三入口无 token 全 401 |
| JI3 | JWT 全链 | ✅ | planner→execute（3 Skills 真实）→usage, 全走 Bearer token |
| JI4 | 身份注入防护 | ✅ | step.input 伪造 tenantUserId → 被覆盖为入口 JWT 身份 |
| JI5 | 回归 | ✅ | 内部路由 token 门禁保持; B 租户 JWT → 未授权（企业隔离保持） |

## 5. 完成标准对照

```
S4.4 P0: 身份权威 = JWT ✅（消除 tenantUserId query, 授权边界不再依赖客户端传参）
S4.4 P1: Desktop 发布工程基线 ✅（Windows 实机构建待开发机, 已记录）
S4.4 P2: Billing 准备 ✅（License + Usage Meter + Plan Mapping 固化, 非支付）
冻结保持: Marketplace / Memory / Loop Agent / 自动招聘外部联系
```

## 6. 未完成项

- [ ] Desktop Windows 实机构建 + 安装包 + 更新通道（Release Engineering, 需 Windows 开发机）
- [ ] openWorkspace() 死引用清理（Plugin Ecosystem Cleanup, 掌柜裁决暂缓避免并发改动扩大）
- [ ] Marketplace（前置: 3+ AI Employee 商品 + 统一 License/Entitlement/Usage + 质量审核）
- [ ] 更多 AI Employee / Enterprise Billing 全量 / Plugin 生态扩展（掌柜后续裁决）

## 7. 结论

```
S4.4 P0: ✅ 授权边界从「客户端自报租户」升级为「JWT 身份权威」
昆仑镜商品链: Desktop 入口 → JWT 身份 → 组织解析 → Entitlement → Hermes → Asset → Usage → Audit
→ 生产级身份基础设施成立, 下一阶段待掌柜裁决
```
