# KUNLUN-S4.2-ALICE-COMMERCIAL-REALITY.md

> S4.2 Alice Commercial Reality — Reality Gate
> 日期: 2026-08-06 09:45 (CST) | 状态: ✅ **CR1-CR5 + DF1 全 PASS**
> 提交: feat(ai): alice commercial reality (S4.2)
> 依据: 掌柜 S4.2 执行指令（Task 01-05 + D-F）
> 定位: **把 Alice 从「技术可运行员工」变成「可授权销售的 AI Employee 商品」——商品最小闭环**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/ecosystem/skill-orchestrator.ts | +checkEmployeeEntitlement（Cloud 执行入口 Gate, CR2/CR3）+ getEmployeeUsageMeter（CR4）+ ExecutePlanOptions.tenantUserId |
| backend/src/routes/skill-orchestrator.routes.ts | /plans/execute 透传 tenantUserId; +GET /employees/:code/usage |
| backend/src/ecosystem/interview-parser.ts | +buildInterviewTranscript（D-F 记录适配器, 纯函数） |
| backend/src/routes/skill-tools-internal.routes.ts | interview-evaluate 接受 interviewRecord（适配后评估） |
| DB | +enterprise_entitlement 表（S4.0 冻结的 S4.2 决策; subscription FK 暂缓至订单域） |
| backend/scripts/s42-test.mts | CR1-CR5 + DF1 Reality Gate |
| docs/.reality/KUNLUN-S4.2-ALICE-COMMERCIAL-REALITY.md | 本报告 |

**未修改（禁止范围）**: desktop/ frontend（0 行）/ Marketplace / Payment / Billing SaaS / 新 Agent/Skill / Memory / Loop / 三方招聘 ✅

## 1. 商业模型（冻结原则落实）

```
出售 = AI Employee 岗位能力（Alice 招聘 AI 员工）
组成 = Capability(AgentDefinition) + License(Entitlement) + Entitlement(Gate) + Usage(计量) + Billing Reference(Usage Meter)
License 最小语义: EnterpriseEntitlement.capabilityCodes 含员工 code = 企业拥有该员工使用权
Gate 位置: Cloud 执行入口（禁止 Skill/Desktop 判断授权）
```

## 2. Reality Gate 结果（实测 24 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| CR1 | Capability | ✅ | Alice 唯一 + 3 Skills 绑定 + 逐 Skill AUTHORIZED |
| CR2 | 无 License 拒绝 | ✅ | 未授权 → ENTITLEMENT_DENIED:NO_ENTITLEMENT（Hermes 前拦截） |
| CR3 | 企业隔离 | ✅ | A 授权 → 执行 COMPLETED; B 未授权 → EMPLOYEE_NOT_ENTITLED 不执行 |
| CR4 | Usage | ✅ | executions/skills 分解/成功失败计数（复用 InvocationLog+KernelEvent） |
| CR5 | Full Commercial E2E | ✅ | 授权企业 → Planner → BYOK → Hermes → 3 Skills 全真实 → Usage 反映全链 |
| DF1 | Interview Record Adapter | ✅ | questions/dialog 结构 → 文本; 字符串透传; 非法 → 空串 |

## 3. 六项交付证据

1. **Capability**: Alice def（5 条 AgentDefinition 唯一）+ 3 Skills + authorizeSkill 全 AUTHORIZED
2. **License**: EnterpriseEntitlement(capabilityCodes=[def-recruiter-alice], status=active) — 企业购买态的最小表示（Purchase State）
3. **Entitlement**: 执行入口 Gate（executeSkillPlan → checkEmployeeEntitlement）; 未授权零执行
4. **Usage**: getEmployeeUsageMeter（谁调用=InvocationLog.userId / 什么能力=KernelEvent.toolCalls / 次数 / 成功与否）
5. **Alice Full Commercial Flow**: 授权 → Planner(tenantUserId) → execute(tenantUserId) → 3 Skills → Asset → Audit → Usage
6. **禁止项检查**: desktop/frontend 0 行; 无 Payment/Billing/Marketplace; 无新 Agent/Skill/Memory/Loop

## 4. 边界确认

- ✅ Entitlement Gate 在 Cloud（orchestrator）; Skill/Desktop 零授权判断
- ✅ Usage 零新统计表（复用现有审计底座）
- ✅ enterprise_entitlement 启用但 subscription FK 暂缓（订单域接线属 S4.3+; 合成 subscription_id 占位, 文档化）
- ✅ 非商业路径（无 tenantUserId/employeeDefinitionId）行为保持（dev/回归不受影响）

## 5. 完成标准对照

```
Alice 达到: 可部署 ✅ + 可授权 ✅ + 可计量 ✅ + 可销售 ✅ + 可审计 ✅
→ 用户购买一个岗位 → 获得一个 AI 员工 → 员工执行真实业务
→ 企业承担自己的模型成本（BYOK, S4.1）→ 平台记录使用价值（Usage Meter）
→ 进入 S4.3 Desktop Release Gate 的前置条件成立
```

## 6. 未完成事项（后续阶段）

- [ ] S4.3 Desktop Release Gate（DP1-DP6, 应用中心/Workspace/员工入口）
- [ ] 订单/支付域接线（enterprise_subscription FK + 真实 Purchase State; 当前为最小占位）
- [ ] Marketplace（P3 延后, 前置: 多员工模板）

## 7. 结论

```
S4.2 Alice Commercial Reality: ✅ AI Employee 商品最小闭环成立
昆仑镜第一次具备: 岗位 → 员工 → 真实业务 → 企业成本归属 → 平台使用价值记录
```
