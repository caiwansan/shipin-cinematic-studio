# KUNLUN-S3-SKILL-EXECUTION-FINAL-ARCHIVE.md

> S3 Skill Runtime Foundation — Final Archive（冻结基线）
> 日期: 2026-08-06 05:30 (CST) | 状态: ✅ **FROZEN（只文档，不编码）**
> 依据: S3.1/S3.2.1/S3.2.2/S3.2.3 Reality Gate 全 PASS + 掌柜验收
> 定位: S3.3 Skill Composition 开始前的唯一事实基线（防 Skill 孤岛 / 防第二套能力体系）

---

## 0. S3 状态总览

```
S3.1 Skill Manifest        ✅ FROZEN（7034466b + 7cd788a5）
S3.2.1 Skill Lifecycle     ✅ FROZEN（a7de3c36 + 4ee63e32 + 1c3e5a9c）
S3.2.2 Skill Authorization ✅ FROZEN（6cf55e15 + 92de6f00）
S3.2.3 Skill Execution     ✅ FROZEN（70ff6bc2 + baaffa87）
────────────────────────────────────────────
S3 Skill Runtime Foundation ✅ COMPLETE
```

昆仑镜现在具备：**Skill 可描述 / 可治理 / 可授权 / 可执行 / 可审计**。

---

## 1. 冻结声明（7 项）

### F1. Skill SSOT（能力描述唯一来源）

```
AgentDefinition.capabilities   ← 唯一能力 SSOT
      ↓
Skill Manifest Adapter（只读映射）
      ↓
SkillDefinition（id/name/version/capabilities/requiredTools/permissions）
```

- **禁止**：新建 `Skill.capabilities` / `SkillManifest` 第二份能力定义
- **禁止**：Plugin Manifest 声明能力作为 Skill 能力来源（Plugin manifest = 入口描述，非能力 SSOT）
- 违反后果: AgentDefinition + Skill Manifest + Plugin Manifest 三套能力 SSOT 漂移

### F2. Lifecycle Authority（状态权威）

```
Lifecycle 管状态 = SkillLifecycleAdapter（只读）
状态来源: AgentDefinition.status / EcologyPlugin.status+lifecycleState
         / EcologyPluginPublishRequest.status / EcologyLicense.status
状态机: DRAFT → SUBMITTED → APPROVED → PUBLISHED → AVAILABLE
      出口: REJECTED / DEPRECATED / DISABLED
预留: AUTHORIZED / EXECUTABLE 为授权/执行维度，不并入 Lifecycle 状态字段
```

- **禁止**：Lifecycle 写入任何状态；Lifecycle 不等于 Permission（SL3）
- **禁止**：新增 SkillLifecycle/SkillApproval/SkillVersion 表（第二套治理体系）

### F3. Authorization Authority（授权权威）

```
EcologyLicense（org+plugin, ACTIVE/EXPIRED/SUSPENDED）← 唯一授权 SSOT
判定语义 = LicenseService.checkLicense（惰性到期 + 审计日志）
Skill 层 = SkillAuthorizationAdapter（只读解释，零授权写入）
```

- EnterpriseEntitlement / PersonalEntitlement：仅 schema，未建表，S4 前不可用
- EcologyPluginInstall = 入口态，**不是授权**（Installed ≠ Authorized）
- **禁止**：Skill 层直接改 License / 新建 SkillLicense 表

### F4. Execution Authority（执行权威）

```
Skill 层生成执行意图（不执行）
      ↓
Hermes Skill Runtime（tools/hermes-runtime-skill.mjs）← 唯一执行者
      ↓
Sub-Agent 实例 → 白名单 Tool → Result
```

- **禁止**：Backend Route 直接执行 AI / 绕过 Hermes
- **禁止**：Skill 层直接调用工具（工具调用只在 Hermes Runtime 沙箱内）

### F5. Hermes Boundary（H-D 能力边界）

```
允许: Approved Tools（allowedTools 白名单）/ Workspace APIs / Cloud Authority APIs / 沙箱资源
禁止: Direct Payment / Identity Mutation / Registry Mutation / Bypass Entitlement / Arbitrary Native Execution
deniedTools 冻结: [payment.*, identity.modify, registry.write, native.exec]
越权调用 → POLICY_REJECTED（SE3 实测）
```

### F6. executionReady 语义（冻结定义）

```
executionReady = Authorization Passed
               + Capability Binding Exists
               + Policy Can Be Generated
```

- **不包含**：Tool availability / Runtime health / Task success（属 Hermes Runtime 职责）
- 语义: 「具备进入 Hermes 执行流程的资格」≠「一定执行成功」
- 演变: S3.2.1/3.2.2 恒 false（边界）→ S3.2.3 起 AUTHORIZED = true（打开）

### F7. Tool Policy Ownership（工具策略归属）

```
allowedTools 推导 = Skill 真实 capabilities（AgentDefinition.capabilities 映射）
deniedTools 归属 = Hermes Capability Boundary（H-D, 单一权威）
```

- Skill ≠ Tool：Skill 是业务能力（resume.parse），Tool 是 Runtime 资源（resume.pdf）
- **禁止**：在 S3.3 创建第二份工具策略（策略只由 H-D + allowedTools 表达）

---

## 2. 技术债冻结（3 项）

### T1. Hermes Skill Runtime 定位更名

```
旧: tools/hermes-runtime-skill.mjs（mock）
新: Hermes Skill Runtime Reference Implementation（参考实现，可重复 Test Harness）
```

- 已 pm2 常驻（hermes-skill-runtime, 127.0.0.1:9457），S3.2.3 起为提交资产
- **禁止删除/降级为临时文件**；文件头注释更名随 S3.3 首个实现提交执行
- 仅含 mock 工具（resume.parse/profile.extract/mock-calc），无真实业务

### T2. Capability 来源冻结

```
AgentDefinition.capabilities
      ↓
Skill Adapter（只读映射）
      ↓
allowedTools（执行操作）→ Hermes Policy
```

- **禁止**：Skill.capabilities 第二份能力定义（会形成三套能力 SSOT）

### T3. 并发仓库纪律

- 仓库存在并发会话（IM 茶馆等）：部署脚本必须 cp 全部变更文件；commit 前 `git status` 核对文件清单（S3.2.3 曾因漏文件导致 add 全量失败）

---

## 3. S3 分层边界（复述冻结）

```
Registry 管能力 / Lifecycle 管状态 / License 管授权 / Hermes 管执行
Installed ≠ Authorized ≠ Executable
Authorization 通过 ≠ 直接执行（仍需 Hermes Tool Policy, SE3）
```

## 4. 冻结仪式

```
✅ 本文档为 S3 唯一事实基线（只提交 docs）
⏳ S3.3 任何设计/实现必须对照本文档 F1-F7 逐项兼容
🔒 违反 F1-F7 的改动需掌柜批准后方可进入
```
