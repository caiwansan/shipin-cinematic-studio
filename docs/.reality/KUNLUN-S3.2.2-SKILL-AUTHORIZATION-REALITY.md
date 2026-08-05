# KUNLUN-S3.2.2-SKILL-AUTHORIZATION-REALITY.md

> S3.2.2 Skill Authorization Adapter — Reality Gate
> 日期: 2026-08-06 05:00 (CST) | 状态: ✅ **SA1-SA5 全 PASS**
> 提交: feat(skill): add authorization adapter
> 定位: **昆仑镜可以判断「这个 AI Employee 是否有资格使用这个 Skill」——仍不执行**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/ecosystem/skill-authorization-adapter.ts | authorizeSkill（Entitlement Check + Agent Capability Binding）+ composeAuthorization 纯函数 |
| backend/src/ecosystem/skill-lifecycle-adapter.ts | authorization 维度升级（required/source/reason，S3.2.2 接线） |
| backend/src/routes/skill-lifecycle.routes.ts | 新增 GET /api/skills/:id/authorization（handler 级 jwtVerify） |
| backend/scripts/s322-mapping-test.mts | Task 04 Reality Gate（SA1-SA5，零写库） |
| docs/.reality/KUNLUN-S3.2.2-SKILL-AUTHORIZATION-REALITY.md | 本报告 |

**未修改（禁止范围）**: prisma/schema.prisma / migrations / Hermes / RuntimeRouter / Commerce ✅

---

## 1. Task 01 审计结论 — 唯一授权来源

| 模型 | 现状 | 结论 |
|---|---|---|
| **EcologyLicense**（org+plugin, ACTIVE/EXPIRED/SUSPENDED） | 22 条真实数据，含惰性到期流转 + 审计日志 | ✅ **唯一授权来源（SSOT）** |
| EnterpriseEntitlement / PersonalEntitlement（capabilityCodes） | 仅 schema 定义，**未建表** | ⏸ 未来扩展（S4 开发者/套餐目录） |
| EcologyPluginInstall（INSTALL_REQUEST/INSTALLED/REMOVED） | 33 INSTALLED + 5 REMOVED + 1 UNINSTALLED | 入口态，非授权（S2 语义） |
| AgentDefinition.permissions | ["read-resumes"] | 能力声明，越权判定补充（Hermes Policy 层, S3.2.3） |

判定语义与 `LicenseService.checkLicense` 一致（唯一键 organizationId_pluginId、惰性到期 ACTIVE+过期→EXPIRED）。

---

## 2. Task 02 — Skill Authorization Adapter

```
输入: { skillId, agentDefinitionId?, organizationId?, userId? }
判定链（SA1-SA4）:
  SkillLifecycleState（载体/商业化/required）
  → AgentDefinition Capability Binding（agent.capabilities ⊇ skill.capabilities）
  → EcologyLicense（org 级判定，惰性到期）
输出: { skillId, authorizationState, reason, entitlementSource, agentBinding, license, checkedAt }
```

授权状态: `AUTHORIZED / NOT_AUTHORIZED / EXPIRED / SUSPENDED / SKILL_PERMISSION_DENIED / NONE`
授权来源: `EcologyLicense / FREE / NONE`（Enterprise/PersonalEntitlement 预留）

## 3. Task 03 — Lifecycle 接线

`GET /api/skills/:id/lifecycle` authorization 升级：

```
S3.2.1:  { required, status: ACTIVE|EXPIRED|SUSPENDED|NONE }
S3.2.2:  { required, status: AUTHORIZED|NOT_AUTHORIZED|EXPIRED|SUSPENDED|SKILL_PERMISSION_DENIED|NONE,
           source, reason, licenseId, licenseType, expireAt }
```

新增 `GET /api/skills/:id/authorization?agentDefinitionId=`（org 由 JWT 解析，G8 隔离；无 token 降级上下文无关判定）。
**executionReady 恒 false 不变** — Skill Authorization ≠ Skill Execution。

---

## 4. Reality Gate SA1-SA5（实测 23 PASS / 0 FAIL）

| # | 场景 | 预期 | 结果 |
|---|---|---|---|
| SA1 | 商业 Skill 无 License | AVAILABLE + NOT_AUTHORIZED | ✅ compose + lifecycle 联动 |
| SA2 | 有效 License | AVAILABLE + AUTHORIZED（source=EcologyLicense） | ✅ compose + lifecycle 联动 |
| SA3 | 过期 License（含惰性到期 ACTIVE+过期） | EXPIRED | ✅ |
| SA4 | 越权 Agent（能力未绑定） | SKILL_PERMISSION_DENIED | ✅ compose + 真实 ghost-agent 查询 |
| SA5 | Hermes 未触碰 | 引用计数 = 0 | ✅ 源码检查 0 命中 |

### 真实数据实测

```
GET /api/skills/def-resume-parser/lifecycle
→ state: AVAILABLE | authorization: { required:false, status:AUTHORIZED, source:FREE, reason:FREE_SKILL_NO_ENTITLEMENT_REQUIRED } | executionReady:false

GET /api/skills/def-resume-parser/authorization?agentDefinitionId=def-resume-parser
→ authorizationState: AUTHORIZED | source: FREE | agentBinding: { bound:true }

GET /api/skills/def-resume-parser/authorization?agentDefinitionId=ghost-agent
→ authorizationState: SKILL_PERMISSION_DENIED | reason: AGENT_CAPABILITY_NOT_BOUND

GET /api/skills/runtime:agent.lifecycle/authorization
→ authorizationState: NONE（系统能力，授权不适用）
```

### 边界说明

- def-resume-parser 为免费官方 Skill（无商业载体、无 License）→ required=false, AUTHORIZED/FREE（免费可用，无需授权）
- 商业 Skill 路径（SA1/SA2/SA3）由 compose 映射测试覆盖（结构就绪，真实触发待插件 capabilities 填充 + S3.2.2 商业接线）
- license 判定写入仅限 LicenseService 既有审计（ecology_license_check_logs）与惰性到期，Skill 层零授权写入

---

## 5. 完成定义核对

```
Skill Registry    ✅（S3.1）
Skill Lifecycle   ✅（S3.2.1）
Skill Authorization ✅（S3.2.2 本阶段）
Skill Execution   ⏸（S3.2.3 / Hermes）
```

- ✅ 知道有什么 Skill / 知道 Skill 状态 / **知道谁可以使用 Skill**
- ✅ 仍然不执行（executionReady 恒 false；Hermes 引用 0）
- ✅ 唯一授权来源 = EcologyLicense（未新建授权体系）
- ✅ 越权 Agent 判定（能力绑定）真实生效

## 6. 未完成事项（后续阶段）

- [ ] S3.2.3 Skill Execution Enable（AUTHORIZED → EXECUTABLE 经 Hermes Tool Policy）
- [ ] EnterpriseEntitlement/PersonalEntitlement 建表启用（套餐能力目录 → entitlementSource 扩展）
- [ ] 插件 capabilities 填充后商业 Skill 授权真实链路冒烟

## 7. 结论

```
S3.2.2 Skill Authorization: ✅ 昆仑镜可以判断「AI Employee 是否有资格使用 Skill」
判定 = Entitlement Check（EcologyLicense SSOT）+ AgentDefinition Capability Binding
授权现实已就位；执行权继续留给 S3.2.3 / Hermes。
```
