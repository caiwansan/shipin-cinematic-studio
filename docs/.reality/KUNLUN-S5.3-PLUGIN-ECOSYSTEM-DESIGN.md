# KUNLUN-S5.3-PLUGIN-ECOSYSTEM-DESIGN.md

> S5.3 Plugin Ecosystem Reality — AI Employee Plugin Enhancement 模型（Phase A Design Freeze）
> 日期: 2026-08-06 12:50 (CST) | 状态: ✅ **审计完成 + 设计冻结, 待掌柜批准实施**
> 依据: 掌柜 S5.2 验收裁决（S5.3 优先于 Marketplace; 验证 Plugin = Employee Enhancement, 不是新 Agent）
> 定位: **证明「员工可以扩展」——插件增强员工能力, 不创建第二 Runtime/身份/授权/Billing**

---

## 0. 审计结论（实证）

### 现有 Plugin 体系
| 项 | 现状 |
|---|---|
| EcologyPlugin | 69 个（29 PUBLISHED + 40 REGISTERED）; manifest = `{id, name, type, author, version, permissions, runtime:{kaor}}` |
| **manifest.capabilities** | **69 个插件全部为空**——S3.1 的「Plugin 挂载 Skill 引用」是预留机制, 从未启用 |
| EcologyLicense | 22 全 ACTIVE（org+plugin, S3.2.2 冻结的授权 SSOT） |
| Desktop 插件入口 | 设备级插件生命周期（authorized-plugins / start / stop / uninstall / heartbeat）; 员工区块（S4.3）独立 |
| 插件类型 | type: agent \| tool \| workflow |

### 关键事实
- 插件「能力声明」通道存在（manifest JSON, 只存不执行）但零使用
- 插件授权体系（EcologyLicense）与员工授权体系（EnterpriseEntitlement）**并存且独立**——天然双层
- 插件执行面（devices/plugins/start）是设备运行时域; 员工执行面（Hermes）是 Cloud 域——**必须不交叉**

## 1. 核心模型（掌柜裁决原则落地）

```
Plugin ≠ Employee    （插件不创建员工身份）
Plugin ≠ Skill       （插件不创建 Skill 定义, 不动 AgentDefinition.capabilities, F1 保持）
Plugin = Employee Enhancement （增强员工既有 Skill 的输入/规则/模板）
```

### 模型: Skill Enhancement（prompt 层注入）
```
EcologyPlugin.manifest.enhancements（JSON 字段扩展, 零新表, 只存不执行）
  = [{ skillId: "resume.parse" | "candidate.score" | ...,   # 挂载点: 员工 Skill Set 内既有 Skill
       data: { templates/词典/规则/评分标准 } }]            # 增强数据（纯文本/JSON, 非代码）
运行时:
  员工执行 Skill → 内部路由 buildPrompt 时
    → 读取企业已授权插件的 enhancements（匹配 skillId）
    → 注入 prompt（模板/规则作为上下文）
    → unifiedAIGateway.invokeAI → 解析器 → 结果
```

### 边界（三层不变）
```
身份层:   不变（员工 = AgentDefinition; 插件不引入第二身份）
能力层:   F1 保持（capabilities 唯能力源; 插件不新增 capability 声明, 只增强执行输入）
执行层:   Hermes 原子执行不变; 插件增强数据只参与 prompt 组装, 非代码执行
授权层:   双层判定（见 §3）
计费层:   不新增（Usage Meter 只记员工执行; 插件增强不单独计费）
```

## 2. 数据模型复用（零新表）

| 复用项 | 用途 |
|---|---|
| ecology_plugins.manifest.enhancements | 插件增强声明（JSON 字段扩展, 向后兼容空 manifest） |
| ecology_licenses | 插件授权（org+plugin 已有, S3.2.2 SSOT） |
| enterprise_entitlement.capabilityCodes | 员工授权（S4.2） |
| 内部路由 + unifiedAIGateway | 执行链（S3.4.2 模式, 零新路由体系） |

## 3. Entitlement 双层判定（设计）

```
企业是否能用员工:       EnterpriseEntitlement（capabilityCodes 含员工 code）——已有
企业是否能用插件增强:   EcologyLicense（org+plugin ACTIVE）——已有
执行时:
  Skill 执行（员工已授权）→ 查插件授权（EcologyLicense ACTIVE + 挂载点匹配）
    → 有: prompt 注入增强; 无: 按无增强执行（降级, 不拒绝）
```
- **插件增强不是执行前置条件**（降级而非拒绝）——插件是增强不是必需品
- 双层都用已有表, 零新授权体系

## 4. Desktop 展示方式

```
插件授权页（已有, 设备级）: 保持
员工区块（S4.3）: 员工卡片可显示「已启用增强」badge
  （数据源 = 新只读 API: GET /api/skills/employees/:code/enhancements, Cloud 返回该员工 Skill Set 上企业已授权插件的增强列表）
```

## 5. Runtime 安全边界

```
✅ 增强数据 = 纯文本/JSON（模板/词典/规则）, 非代码 → 无执行面
✅ 注入发生在 Cloud 内部路由（buildPrompt）, Hermes 不可见增强机制
✅ 插件禁直执 Skill / 禁持 Key / 禁 provider 调用（S4.0 宪法保持）
❌ 插件不得声明 capabilities（不碰 F1）
❌ 插件不得创建 AgentDefinition / 员工
❌ 插件不得引入第二 Runtime / 身份 / Billing
```

## 6. Reality Gate（PE1-PE6, 待批准实施）

| # | 关卡 | 验证 |
|---|---|---|
| PE1 | Enhancement 模型 | 插件 manifest.enhancements 可声明（挂载点 ∈ 员工 Skill Set） |
| PE2 | 授权双层 | 员工授权 + 插件授权独立判定; 无插件授权 → 降级执行（不拒绝） |
| PE3 | 注入生效 | 有插件增强 → prompt 含增强数据; 结果真实（source=real） |
| PE4 | F1 保持 | AgentDefinition.capabilities 零改动; 插件零新 capability |
| PE5 | Runtime 边界 | 插件 0 直执 / 0 Key / 0 provider; Hermes 核心零改动 |
| PE6 | 三员工回归 | Alice/短剧/新媒体 全链无影响 |

## 7. 真实场景建议（Phase B 候选, 待掌柜选择）

```
场景 1（招聘）:  JD 模板插件 → 增强 Alice 的 resume.parse/candidate.score
                 （企业自有 JD 模板/评分规则注入 prompt）
场景 2（短剧）:  风格词库插件 → 增强 prompt.optimize（风格词典注入）
场景 3（新媒体）: 品牌语料插件 → 增强 content.draft（品牌调性/禁用词注入）
```

## 8. 边界（冻结确认）

✅ 允许: manifest.enhancements JSON 字段 / 增强注入路由 / 只读查询 API / 测试插件（幂等 seed）
❌ 禁止: 新表 / 新 Runtime / 新身份 / 新授权体系 / 新 Billing / capabilities 扩展 / 插件直执 / 插件持 Key / Marketplace / Memory / Loop / 浏览器自动化

## 9. 结论

```
Plugin = Employee Enhancement 模型成立（设计冻结）
→ 员工生态扩展路径: 模板/词典/规则注入, 零架构破坏
→ 未来 Marketplace 卖的是「员工 + 增强」, 不是裸工具
→ 待掌柜批准 Phase B 实施（选真实场景 + PE1-PE6 测试）
```
