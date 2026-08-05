# KUNLUN-S3.2.1-SKILL-LIFECYCLE-REALITY.md

> S3.2.1 Skill Lifecycle Adapter — Reality Gate
> 日期: 2026-08-06 04:45 (CST) | 状态: ✅ **SL1-SL5 全 PASS**
> 提交: feat(skill): add lifecycle adapter
> 定位: **Skill 拥有真实生命周期状态（只读），仍不执行**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/ecosystem/skill-lifecycle-adapter.ts | SkillLifecycleAdapter（只读适配层 + 纯 compose 函数） |
| backend/src/routes/skill-lifecycle.routes.ts | 只读 API（GET /api/skills/:id/lifecycle） |
| backend/src/index.ts | 注册（skill-catalog 之后，1 行） |
| backend/scripts/s321-mapping-test.mts | Task 03 状态映射验证（零写库） |
| docs/.reality/KUNLUN-S3.2.1-SKILL-LIFECYCLE-REALITY.md | 本报告 |

**未修改（禁止范围）**: prisma/schema.prisma / migrations / Hermes / RuntimeRouter / Commerce ✅

---

## 1. 实现内容（Task 01-02）

### Task 01: Skill Lifecycle Adapter

```
SkillDefinition（S3.1）
  → AgentDefinition.status（宿主状态）
  → EcologyPlugin.status + lifecycleState（发布状态）
  → EcologyPluginPublishRequest.status（审核状态）
  → EcologyLicense.status（授权状态）
  → 统一 SkillLifecycleState
```

- **只读 Adapter**：不修改原模型，零新表（SL2）
- **composeLifecycleState 为纯函数**：输入归一化来源、输出状态，可直接单测（Task 03）
- 状态机（S3.2.1 生效子集）:
  `DRAFT → SUBMITTED → APPROVED → PUBLISHED → AVAILABLE`
  出口: `REJECTED / DEPRECATED / DISABLED`（任意阶段可废弃）
  预留: `AUTHORIZED`（S3.2.2 授权接线）/ `EXECUTABLE`（S3.2.3）
- 状态合成优先级（高→低）: REJECTED > DISABLED > DEPRECATED > AVAILABLE（Plugin 已发布）> AVAILABLE（AgentDefinition active）> AVAILABLE（Runtime active）> DRAFT/SUBMITTED/APPROVED（审核流）> DRAFT（Plugin 已注册未提交）

### Task 02: Lifecycle Query API

`GET /api/skills/:id/lifecycle`（只读，返回 `{ skillId, state, version, authorization, executionReady, source, updatedAt }`）

```
authorization = { required, status: ACTIVE|EXPIRED|SUSPENDED|NONE, licenseId, licenseType, expireAt }
executionReady = false   ← S3.2.1 边界：Lifecycle 不执行（Hermes 执行属 S3.3）
```

**AVAILABLE ≠ EXECUTABLE**：Skill 可以存在；无授权不能执行；S3.2.1 下任何状态 executionReady 恒 false。

---

## 2. Task 03 状态映射验证（实测）

### Case A — AgentDefinition active → AVAILABLE（真实数据）

```
GET /api/skills/def-resume-parser/lifecycle
→ state: AVAILABLE
  source.agentDefinition: { code: def-resume-parser, status: active, version: 1.0.0 }
  authorization: { required: false, status: NONE }
  executionReady: false
```

### Case B — Plugin DEPRECATED → DEPRECATED（映射测试）

```
compose({ plugin: { status: DEPRECATED } })
→ state: DEPRECATED ✅
（线上 ecology_plugins 无 DEPRECATED 样本：69 个 = 40 REGISTERED + 29 PUBLISHED，全 ACTIVE）
```

### Case C — License EXPIRED → AUTHORIZED=false（映射测试）

```
compose({ plugin: PUBLISHED, license: { status: EXPIRED } })
→ authorization.status: EXPIRED（≠ ACTIVE = 未授权）✅
（线上 ecology_licenses 22 个全 ACTIVE，无 EXPIRED 样本）
```

### Case D — PublishRequest REJECTED → REJECTED（映射测试）

```
compose({ plugin: REGISTERED, publishRequest: { status: REJECTED } })
→ state: REJECTED ✅
（线上 ecology_plugin_publish_requests 21 个全 APPROVED，无 REJECTED 样本）
```

### 补充实测

- `runtime:agent.lifecycle`（真实数据）→ AVAILABLE，authorization.required=false（系统能力非商业）
- 全链（PUBLISHED + APPROVED + License ACTIVE）→ AVAILABLE + authorization.required=true + status ACTIVE
- 未知 skill → 404
- 映射测试结果: **13 PASS / 0 FAIL**（零写库）

### 线上数据事实（Task 03 结论）

```
AgentDefinition:      1 条（def-resume-parser, active）
EcologyPlugin:        69 条（40 REGISTERED / 29 PUBLISHED，全部 ACTIVE）
PublishRequest:       21 条（全 APPROVED）
EcologyLicense:       22 条（全 ACTIVE）
Skill↔Plugin 挂载:    0 条（manifest 未声明 capabilities/skills）
```

→ Case A 用真实数据验证；B/C/D 线上无样本，用同一 compose 纯函数做映射测试（结构与线上真实路径完全一致）。当前 Catalog 无商业化 Skill，authorization.required=true 路径由映射测试覆盖，真实触发待 S3.2.2 / 插件 capabilities 填充。

---

## 3. Reality Gate SL1-SL5

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| SL1 | Lifecycle Source | ✅ | 状态全部来自 AgentDefinition/EcologyPlugin/PublishRequest/License 既有字段，adapter 无新状态存储 |
| SL2 | No New Table | ✅ | schema.prisma 未动，migrations 未新增（git status 为空） |
| SL3 | Permission Boundary | ✅ | Lifecycle ≠ Permission：授权仅为只读视图（License 状态），无任何权限写入/变更 |
| SL4 | Execution Boundary | ✅ | adapter/routes 无 Hermes 引用（grep 0 命中），executionReady 恒 false |
| SL5 | Regression | ✅ | Plugin Registry / Hermes Bridge / Workspace / Agent Runtime 文件零改动；Catalog 冒烟 7 skills 不变 |

**SL1-SL5 全 PASS = S3.2.1 完成**

---

## 4. 禁止范围确认

- ✅ 未创建 SkillLifecycle/SkillApproval/SkillVersion/SkillLicense 表（无第二套治理体系）
- ✅ 未修改 schema.prisma / 未新增 migration
- ✅ 未调用 Hermes / 未改 RuntimeRouter / 未改 Commerce
- ✅ 未执行任何 Skill（executionReady 恒 false）

## 5. 未完成事项（后续阶段）

- [ ] S3.2.2 Skill 授权接线（License/Entitlement 关联 AgentDefinition.capabilities → AUTHORIZED 状态启用）
- [ ] S3.2.3 生命周期状态流转（DRAFT→EXECUTABLE 完整闭环）
- [ ] S3.3 Skill 经 Hermes 执行（executionReady 置 true 的唯一路径）

## 6. 结论

```
S3.2.1 Skill Lifecycle: ✅ Skill 拥有真实生命周期状态
用户现在可以查询: 一个 Skill 是什么 / 当前状态 / 是否授权 / 是否具备执行条件
但: Skill 仍然不会执行（Hermes 边界，SL4）

Registry 管能力 / Lifecycle 管状态 / License 管授权 / Hermes 管执行 — 四者不合并。
```
