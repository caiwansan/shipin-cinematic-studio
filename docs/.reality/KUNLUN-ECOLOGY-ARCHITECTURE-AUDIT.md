# KUNLUN-ECOLOGY-ARCHITECTURE-AUDIT.md

> **昆仑镜 AI 应用生态平台 — 架构审计与演进设计总览**
> 版本：V1.2（技术总监批准 Phase 1 拆 Sprint + SPRINT-ECO-01 实施计划） | 类型：只读审计 + 架构设计 | 日期：2026-08-03
> 执行纪律：零代码改动 / 零数据库改动 / 零删除 / 零重构 ✅

---

## 一、战略定位

> 昆仑镜不是 AI 工具集合，而是：**AI 应用操作系统 + AI Agent 应用生态市场**。

类比：Windows + 应用商店 / iOS + App Store / Salesforce + AppExchange / 微信 + 小程序生态。

**核心资产差异**：Windows 卖软件，苹果卖 App，**昆仑镜卖 AI员工 + AI能力插件 + AI应用**。

```
                  昆仑镜
                       │
              AI Application Store
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    Application层   Plugin市场     Hermes Runtime
    Media/Drama/   AI员工/Workflow/  (KAOR - Agent OS)
    Recruit/Legal   Tool            
        └──────────────┼──────────────┘
                       │
                Cloud Platform
        Identity / Commerce / Billing /
        License / Developer / Registry

---

## 二、审计核心发现（摘要）

### 2.1 平台基础：已具备，需收敛与契约化

| 能力 | 现状 | 结论 |
|------|------|------|
| Identity/Tenant | User/Organization/GovUser 完整 | ✅ 直接复用 |
| RBAC/Permission | Role/Policy/CapabilityGrant | ✅ 收敛入口（现分散） |
| Model Gateway | model-adapters/ai-router/AiModel | ✅ 统一入口（现多网关） |
| Commerce | PaymentOrder/Subscription/Entitlement | ✅ 直接复用 |
| Billing | BillingRecord/UsageRecord | ✅ 收敛口径（现多表） |
| Storage | UnifiedAsset/StorageConfig | ✅ 收敛资产模型 |
| Audit | AuditLog/AgentAuditTrail | ✅ 直接复用 |
| Agent 底座 | agent-runtime + HermesProfileBinding | ✅ **Hermes 已是统一 Agent 底座雏形** |

### 2.2 重复建设：8 类（真实存在）

任务编排 ×5、Agent 实体 ×6、记忆表 ×7、模型网关 ×5、权限入口分散、资产模型分裂、成本计费 ×5、工作台脚手架重复。

**根因**：平行开发 + 无平台 API 契约 + 无插件边界强制。

### 2.3 分界线

- **平台公共**：账户/权限/模型/任务/记忆/资产/计费/审计。
- **工作台私有**：领域模型/领域算法/领域提示词。
- **新媒体特殊**：浏览器控制 → 下沉为 Local Device Runtime（本地设备能力），身份探针/指标提取器 → 配置化插件私域。

---

## 三、设计交付物索引

| 文档 | 对应 Task | 一句话结论 |
|------|----------|-----------|
| AI-ECOLOGY-COMMON-CAPABILITY-AUDIT.md | 01 能力审计 | 平台基础已具备，8 类重复需收敛，分界线=领域语义 |
| APPLICATION-MARKETPLACE-DESIGN.md | 02 应用市场 | 工作台=可安装应用，内置应用零成本接入 |
| LOCAL-APPLICATION-ARCHITECTURE.md | 03 本地应用 | **Electron**（已有壳），业务 100% 线上，本地仅设备桥 |
| HERMES-RUNTIME-EVOLUTION-DESIGN.md | 04 Hermes 生态化 | **升级为 Kunlun AI Operating Runtime（KAOR）**，九大模块职责 |
| PLUGIN-MARKETPLACE-DESIGN.md | 05/06 插件+商业 | 三类插件 + Manifest + 订阅制 + 50/36/10-40 分账 + 禁 MLM |
| DEVELOPER-ECOSYSTEM-DESIGN.md | 07 开发者生态 | SDK + 开发者中心 + 审核流水线 |
| ECOSYSTEM-PARTNER-DESIGN.md | 08 推广 | **SaaS Affiliate + Partner Revenue Share**，小区业绩制，禁拉人头 |
| MEDIA-WORKSPACE-LOCALIZATION-DESIGN.md | 09 新媒体定位 | **第一个本地应用**，凭证/浏览器本地化根治风控 |
| ECOLOGY-DATABASE-DESIGN.md | 10 数据库 | 14 新增表，零改现有 461 表 |
| **APPLICATION-BOUNDARY-AUDIT.md** | **11 边界审计** | **9 工作台全部可应用化（3-5★），Adapter 增量接入零重构** |
| **KAOR-BOUNDARY-DESIGN.md** | **0.5-A 边界冻结** | **Runtime/Plugin/Application/Workspace 四层归属冻结 + 四问测试** |
| **KUNLUN-MEDIA-LOCAL-APP-BLUEPRINT.md** | **0.5-B 本地蓝图** | **Tauri + WebView2 技术蓝图，Vault/本地浏览器/在线授权** |
| **PLUGIN-SDK-DESIGN.md** | **0.5-C SDK 设计** | **三类插件 + Manifest + 权限 + 计费 + 测试 + 发布** |
| **SPRINT-ECO-01-IMPLEMENTATION-PLAN.md** | **Phase 1 实施计划** | **四大地基 ECO-01~04 拆分：Application Adapter / Plugin Registry / KAOR 接口 / License** |
| ECOLOGY-MIGRATION-ROADMAP.md | 路线 | 设计序列 6 步 + 开发 6 Phase，Reality Gate 门禁 |

---

## 四、Reality Gate 十问回答

### 产品

**1. 昆仑镜是否具备成为 AI 生态平台基础？**

✅ **具备**。不是从零建平台——Identity/Tenant/RBAC/Model Gateway/Subscription/Billing/Asset/Audit 已存在且被多域引用；Hermes（agent-runtime）已是 Agent 底座；461 表的数据底座足以承载生态层。缺的是「契约 + 边界 + 分发」，而这些正是本设计交付的内容。**判断：基础 80% 已就绪，生态化是收敛不是重建。**

**2. 哪些现有工作台可以无损接入？**

✅ **全部 9 个可零改造接入**（内置应用自动安装）。接入成本评估：
- 应用市场：工作台零改动，只新增 Application 注册表 + 路由挂载器。
- 插件化：新媒体（浏览器/探针/提取器下沉本地）为第一个；短剧（导演状态机/分镜）领域复杂但边界清晰；招聘（管线/评估）适合插件化；GEO（扫描/验证）适合 Tool 插件化。
- **无损前提**：兼容期双通道（现有直接调用保留，新代码走平台 API）。

**3. 新媒体是否适合作为第一个本地应用？**

✅ **最适合**，且是唯一有硬约束的选择：
- 登录稳定性痛点（服务器 IP 风控、会话被回收）只能靠**本地设备持有会话**根治——本地 Chromium 是唯一解。
- 新媒体同时验证生态全链路：应用安装（Kunlun Media）→ 本地运行时（Device Bridge）→ 插件（AI 运营经理）→ 订阅商业。
- 风险：线上闭环必须先打穿（Phase 0 门禁），本地化不能成为逃避线上问题的借口。

### 技术

**4. Hermes 是否能够成为统一 Agent 底座？**

✅ **能**。agent-runtime 已含 lifecycle/orchestrator/workflow/gates/context/brain；HermesProfileBinding 已有 soul.md/工具白名单/记忆命名空间——这就是「插件化 AI 员工」的隔离雏形。生态化只需：插件注册（Manifest→AgentTemplate）、订阅分发（License→实例）、多套 Agent/记忆/工作流收敛契约。**同一内核可云端/本地双部署**（Local 不是真相源的技术保证）。

**5. 插件系统应该放在哪一层？**

✅ **平台层（Hermes Runtime 之上、工作台之下）**：
- 插件注册/审核/订阅/计费 = 平台层（商城域）。
- 插件执行 = Hermes Runtime（agent/tool/workflow 三类统一运行时）。
- 工作台 = 插件的能力宿主（可内置插件组合）。
- 强制边界：插件只经 Platform SDK / Hermes SDK 调用公共能力，禁止 import 域模块。
- 沙箱（plugin-sandbox 已有）+ 权限闸门（Manifest 声明）+ 命名空间隔离（记忆/资产/凭证）三层安全。

**6. 本地应用如何与云端生态连接？**

✅ 主动出站连接 + 设备桥：
- 本地客户端启动 → WebSocket 主动连接线上（带 License + 设备指纹），**不开本地监听端口**（防攻击面）。
- Device Bridge：browser.control / credential.vault / file.access / system.info，指令级权限校验。
- 凭证分层：线上只存「本地凭证索引」，平台 cookie 存本地加密 vault——**SSOT 仍是线上**，但敏感会话在本地。
- 状态同步：本地操作结果实时回写线上（账号连接/身份/指标），刷新/换设备仍可见。

### 商业

**7. 插件订阅闭环是否成立？**

✅ **成立，且已设计为自洽闭环**：
- 用户订阅付费 → PaymentOrder 实收 → RevenueRecord 分账 → DeveloperWallet → Settlement 月度结算。
- 分账：开发者 50% / 市场生态最高 36% / 平台 10-40%（覆盖支付通道+服务器成本）。
- License 吊销 ↔ 能力暂停 ↔ 数据保留，订阅生命周期完整。
- 信任：分成比例 Manifest 声明 + 订单级明细可查。
- **成立前提**：Phase 0 新媒体闭环先打穿（有真实用户），否则商业闭环无地基。

**8. 开发者生态是否可持续？**

✅ 可持续的四个支柱：
- **供给端**：50% 分成（行业高位）+ 低门槛 SDK/CLI/沙箱模拟器 + 扶持期（首月平台只取 10%）。
- **需求端**：平台 9 个工作台提供真实用户场景，插件有明确买家。
- **质量端**：Reality Gate 强制 + 审核流水线 + 质量指标门槛（防劣币驱逐良币）。
- **治理端**：平台不自研竞争性插件（同审核流程），开发者实名/企业认证，违规冻结分成。
- **可持续性判定**：订阅制（非买断）保证开发者有长期收入流，才有持续维护动力。

**9. 推广收益是否基于真实商业收入？**

✅ **严格基于真实 GMV**。技术总监确认：采用 **SaaS Affiliate + Partner Revenue Share** 模式，明确禁止 MLM（拉人头/入门费/层级计酬/团队人数奖励）。
- 伙伴赚取 = 自己推广产生的订阅流水分成（小区业绩 × 等级比例）。
- 业绩 = 实收流水（扣退款/拒付），过退款期才入账。
- 小区业绩公式（团队总业绩 − 最大业绩线）天然防止传销式堆叠。
- 防作弊：实名 + 设备指纹 + 自购排除 + 异常检测 + 结算冻结审计。

**10.（新增）9 个工作台能否全部应用化？边界如何？**

✅ **全部可应用化，且零重构**（Task 11 APPLICATION-BOUNDARY-AUDIT）：
- 星级：新媒体/招聘 ★★★★★ → 短剧/小说/GEO ★★★★ → 法律/商城/音乐/广告 ★★★。
- 迁移铁律：现有工作台不动，应用化 = 新增 **Application Adapter**（mountRoutes/declareCapabilities/permissionManifest/pluginMountPoints）。
- 拆解红线：领域算法/模型/提示词私有；平台只拿浏览器控制/流程编排/支付/记忆/存储等无领域语义能力。
- 插件落点：每应用 3-5 个付费插件（如新媒体：AI内容运营经理 ¥599/月、AI矩阵运营团队 ¥1,999/月）。
- **优先级**：P0 新媒体（本地+全链路）→ P1 招聘（Agent 体系最成熟）→ P2 短剧/小说/GEO → P3 其余。

---

## 五、Reality Gate 设计序列（技术总监定调）

进入开发前必须按序完成的设计序列，每步有产物、过门禁才进下一步：

```
1. 生态架构审计（本批次 16 份文档）        ✅ 完成
2. Application 边界确定（Task 11 审计）    ✅ 完成
3. 插件模型确定（Manifest/生命周期/授权）  ✅ 完成
4. Hermes 升级路线确定（KAOR 九模块）      ✅ 完成
5. 新媒体 Local App 设计                   ✅ 完成
6. 开发 Sprint 拆解                        ⏳ 待掌柜批准后
```

> 设计序列全部完成后才拆开发 Sprint；**不提前碰代码**（执行纪律）。

## 六、Phase 0.5 技术总监拍板（2026-08-03）

**批准结论**：

> 批准 OpenClaw 当前 Phase 01 设计成果。但下一步**不要直接开发**，先补三个地基设计审计（KAOR 边界 + 新媒体本地应用蓝图 + Plugin SDK），三个 Gate 通过后才进入 Sprint 生态基础设施开发。

| 拍板项 | 结论 |
|--------|------|
| 战略定位 | 昆仑镜 = **AI 应用操作系统**（Windows + App Store + Agent Runtime），核心资产 = Application + AI员工插件 + Hermes Runtime + 开发者生态 + 订阅商业 |
| 现有工作台 | **不动**，Application Adapter 包装（Task 11 认可） |
| 优先级 | 新媒体 ★★★★★（生态样板）→ 招聘 ★★★★★（AI员工属性最强）→ 其余 |
| Hermes | 升级 KAOR（九大能力确认：Agent Lifecycle/Memory/Tool Calling/Browser Control/Workflow/Scheduler/Plugin Loader/Permission Sandbox/Local Execution） |
| **本地技术栈** | **✅ Tauri + WebView2（Windows 优先）**（替代原 Electron：包小/内存低/安全/适合本地 AI Runtime） |
| 商业 | 卖 **AI员工订阅**（免费 App + 付费插件）；在线 License（Active/Expired/Suspended，过期=基础功能继续+AI员工停止） |
| 推广 | SaaS Affiliate + Partner Revenue Share；收入只能来自插件订阅；分账：开发者 50% / 平台 10-40% / 生态伙伴最高 36% |
| **禁止清单** | 不马上改新媒体代码 / 不马上建插件商城代码 / 不马上拆 Hermes（先 KAOR 架构冻结） |
| 下一步 | **Phase 0.5 三个 Gate**（Task A/B/C）→ Sprint 生态基础设施开发（顺序：Application Layer → Plugin Model → License System → KAOR Runtime → Developer Center → Marketplace → Kunlun Media Local App） |

### Phase 0.5 三 Gate 完成状态

| Gate | 输出 | 状态 |
|------|------|:----:|
| A KAOR Runtime Boundary Design | KAOR-BOUNDARY-DESIGN.md（四层归属 + 四问测试 + 违例自查） | ✅ |
| B Kunlun Media Local App Blueprint | KUNLUN-MEDIA-LOCAL-APP-BLUEPRINT.md（Tauri 蓝图 + Vault + License） | ✅ |
| C Plugin SDK Design | PLUGIN-SDK-DESIGN.md（Manifest/API/权限/计费/测试/发布 + 示例插件） | ✅ |

> **三 Gate 全部通过 → 下一步由掌柜批准拆 Sprint 生态基础设施开发。**

---

## 七、最终建议（给掌柜的决策摘要）

| 决策点 | 建议 |
|--------|------|
| 是否推倒重做 | ❌ 不推倒。收敛 + 契约 + 叠加（生态层新增，现有冻结） |
| 是否删 AI 员工 | ❌ 不删。AI 员工 = 插件实例化的载体（HermesProfileBinding 已是雏形） |
| Hermes 定位 | ✅ 升级为 Kunlun AI Operating Runtime（KAOR），Agent OS 内核 |
| 是否保留新媒体线上 | ✅ 保留并先打穿线上闭环（Phase 0 门禁） |
| 第一个本地应用 | ✅ 新媒体（Kunlun Media App） |
| 本地技术栈 | ✅ **Tauri + WebView2（Windows 优先）**（总监拍板；Electron 弃用仅作参考） |
| 推广模式 | ✅ SaaS Affiliate + Partner Revenue Share（禁 MLM） |
| 工作台迁移 | ✅ 零重构，Application Adapter 增量接入 |
| 下一步实施 | **Phase 0.5 三 Gate 已完成** → 掌柜批准后拆 Sprint（Application Layer → Plugin Model → License System → KAOR Runtime → Developer Center → Marketplace → Kunlun Media Local App） |

---

## 六、执行确认

- [x] 零代码改动
- [x] 零数据库改动
- [x] 零删除
- [x] 零重构
- [x] 16 份交付文档全部生成（docs/.reality/，Phase 01 十二份 + Phase 0.5 三份 + SPRINT-ECO-01 实施计划）

> 本审计通过 Reality Gate 后，再按 ECOLOGY-MIGRATION-ROADMAP 拆 Sprint 实施。
