# ECOLOGY-MIGRATION-ROADMAP.md

> **昆仑镜 AI 应用生态平台 — 迁移路线图**
> 版本：V1.0 | 类型：路线规划（只读，不实施） | 日期：2026-08-03

---

## 一、迁移总原则

1. **Online First**：所有生态能力先在线上验证，桌面封装是发行形态。
2. **新媒体为试点**：第一个本地应用 = 生态全链路（应用/插件/本地/订阅）的试验田。
3. **零破坏**：现有 9 工作台冻结不动，生态层以「新增 + 契约」方式叠加。
4. **Reality Gate 门禁**：每个阶段有真实用户可验证的验收标准，未过不进入下一阶段。

---

## 二、阶段总览

### 2.0 设计序列（技术总监定调：进入开发前的必经步骤，已完成）

```
1. 生态架构审计（12 份文档）        ✅ Phase 01
2. Application 边界确定（Task 11）  ✅ Phase 01
3. 插件模型确定（Manifest/授权）    ✅ Phase 01
4. Hermes 升级路线确定（KAOR）     ✅ Phase 01
5. 新媒体 Local App 设计            ✅ Phase 01
6. 开发 Sprint 拆解                ⏳ 掌柜批准后（Phase 0.5 三个 Gate 先行）
```

### 2.0.5 Phase 0.5：生态架构冻结（技术总监拍板 2026-08-03，当前）

**批准**：Phase 01 设计成果批准，但不直接开发。先补三个地基设计审计（三个 Gate）：

| Gate | 任务 | 输出 | 状态 |
|------|------|------|:----:|
| A | KAOR Runtime Boundary Design（Runtime/Plugin/Application/Workspace 四层边界） | KAOR-BOUNDARY-DESIGN.md | ✅ |
| B | Kunlun Media Local App Technical Blueprint（**Tauri + WebView2**，Windows 优先） | KUNLUN-MEDIA-LOCAL-APP-BLUEPRINT.md | ✅ |
| C | Plugin SDK Design（manifest/runtime API/permission/billing/testing/publish） | PLUGIN-SDK-DESIGN.md | ✅ |

**三个 Gate 通过后** → 才进入 Sprint 生态基础设施开发（顺序见下）。

### 2.1 开发阶段总览

```
Phase 0    新媒体线上闭环（进行中）         ← 当前 Reality Closure（不受生态影响）
Phase 0.5  生态架构冻结（三 Gate）          ← 本次完成
Phase 1    生态基础设施（Application Layer → Plugin Model → License System）
Phase 2    KAOR Runtime → Developer Center → Marketplace
Phase 3    Kunlun Media Local App（Tauri + WebView2）
Phase 4    插件商城全量 + 商业闭环
Phase 5    生态规模化（推广 + 多应用）
```

### 2.2 Sprint 生态基础设施开发顺序（技术总监定调，严格按序）

```
1  Application Layer（Application Adapter 框架 + 内置应用注册）  → Sprint ECO-01
2  Plugin Model（Manifest + 三类插件 + 沙箱）                    → Sprint ECO-02
3  License System（订阅 + 在线授权 Active/Expired/Suspended）    → Sprint ECO-04
4  KAOR Runtime（九模块契约冻结 + 本地宿主）                     → Sprint ECO-03
5  Developer Center（SDK 发布 + 审核流水线）
6  Marketplace（商城前端 + 购买 + 分账）
7  Kunlun Media Local App（Tauri 壳 + 本地浏览器 + Vault）
```

> **总监 2026-08-03 拍板**：1-4 拆成更小 Sprint（ECO-01 → ECO-02 → ECO-04 → ECO-03 按依赖实际执行序为 ECO-01→ECO-02→ECO-03→ECO-04，见 SPRINT-ECO-01-IMPLEMENTATION-PLAN.md）；商城/推广/本地 exe 暂缓。Phase 1 最小闭环 = 一个 AI 员工插件走通「安装 → 授权 → 运行 → 计费」。

---

## 三、各阶段详情

### Phase 0：新媒体线上闭环（现在）

**目标**：从空态证明快手单平台完整闭环（SPRINT-MEDIA-REALITY-RESET-01）。

| 项 | 内容 |
|----|------|
| 验收 | 空列表 → 扫码 → 身份落库 → 凭证生成 → 刷新存活 → 重启恢复 |
| 输出 | Reality Gate 报告 |
| 产出物 | 稳定的登录链路 + 干净的 SSOT（生态化的地基） |
| 门禁 | 验收 9/9 通过 → Phase 1 |

**本阶段禁止**：生态开发、本地化开发、新平台接入。

### Phase 1：生态基础设施

**目标**：生态层表结构 + 平台 API 契约 + 应用市场壳。

| 工作包 | 内容 |
|--------|------|
| 1.1 数据库 | ECOLOGY-DATABASE-DESIGN 的 14 表（纯新增） |
| 1.2 契约 | Platform SDK 接口草案（identity/permission/model/task/memory/storage/audit） |
| 1.3 应用市场 | Application CRUD + **Application Adapter 框架**（Task 11 接口）+ 内置应用注册（9 工作台自动安装）+ 市场前端页 |
| 1.4 插件框架 | Plugin Manifest 解析器 + 沙箱接入（plugin-sandbox 强化） |
| 1.5 Hermes 升级 | KAOR 九模块职责清单落地（先冻结接口契约，不重构） |

**验收（Reality Gate）**：9 个工作台在市场列表可见且一键安装可用；Manifest 校验通过/拒绝用例各 5 条；新表迁移回滚安全。

### Phase 2：KAOR Runtime + Developer Center + Marketplace

**目标**：本地 Agent 内核宿主 + 开发者发布通道 + 商城购买闭环。

| 工作包 | 内容 |
|--------|------|
| 2.1 KAOR Runtime | 九模块契约冻结落地（KAOR-BOUNDARY-DESIGN）+ 本地宿主（Node sidecar） |
| 2.2 Plugin SDK | @kunlun/kaor-sdk + @kunlun/platform-sdk + CLI（kaor dev/test/perm/bundle/publish） |
| 2.3 开发者中心 | 注册认证/插件管理/数据看板/收益钱包 + 审核流水线（自动扫描+人工+灰度） |
| 2.4 商城 | 插件列表/详情/购买/订阅管理 + License 全链路（购买→激活→吊销） |

**验收（Reality Gate）**：外部开发者（内部模拟）完成「创建→开发→提交→审核→灰度→发布→收益可见」全流程；恶意插件样本拦截率 100%；真实用户购买→实收→分账→提现闭环对账一致。

### Phase 3：Kunlun Media Local App（Tauri + WebView2）

**目标**：Windows 本地应用 + 本地浏览器登录 + 本地 Vault。

| 工作包 | 内容 |
|--------|------|
| 3.1 桌面壳 | **Tauri + WebView2** 应用壳（在线模式 + 多应用路由；Windows 优先；WebView2 运行时引导） |
| 3.2 Device Bridge | browser.control / credential.vault / file.access / system.info（Tauri Commands 白名单安全桥） |
| 3.3 本地登录 | 本地 Chromium 扫码 → Credential Vault 本地加密 → 线上 SSOT 同步（凭证本地化） |
| 3.4 License | 应用授权 + 设备绑定 + **在线 License Server 校验**（心跳 + 离线宽限；Active/Expired/Suspended） |

**验收（Reality Gate）**：KUNLUN-MEDIA-LOCAL-APP-BLUEPRINT 验收全过（本地扫码→线上可见→重开恢复→退出清理→重登闭环→插件授权→过期暂停（基础功能继续）→换设备重授权→刷新不丢）。

### Phase 5：生态规模化

**目标**：推广体系 + 多应用生态。

| 工作包 | 内容 |
|--------|------|
| 5.1 推广 | Partner 体系（**SaaS Affiliate + Partner Revenue Share**，小区业绩/防作弊/结算） |
| 5.2 多应用 | 按 APPLICATION-BOUNDARY-AUDIT 优先级：P1 招聘 → P2 短剧/小说/GEO → P3 其余 |
| 5.3 本地多应用 | 其他工作台的本地封装（按需） |

**验收（Reality Gate）**：推广业绩与订阅流水对账一致；第二个工作台（如短剧）完成应用化发行闭环。

---

## 四、依赖与并行

```
Phase 0 ──→ Phase 0.5 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
  │            │             │            │            │            │
  └─ 新媒体线上  └─ 架构冻结    └─ 地基      └─ KAOR/开发者 └─ 本地App   └─ 商业/规模
     （前置）      （三 Gate）    （1-3）      （4-6）        （7）         （变现/增长）
```

- Phase 0.5 三个 Gate 已完成（KAOR 边界 / 新媒体蓝图 / Plugin SDK），是 Phase 1-3 的设计基准。
- Phase 1 可与 Phase 0 并行准备（文档/契约草案），但**实施必须在 Phase 0 验收后**。
- Phase 2 依赖 Phase 1（Application Layer → Plugin Model → License System），严格按序。
- Phase 3（Kunlun Media Local App）依赖 Phase 2 的 KAOR 宿主与 License System。
- Phase 4/5 严格串行（商业闭环需要商城与开发者生态）。

---

## 五、资源与风险

| 项 | 说明 |
|----|------|
| 资源 | 每个 Phase 独立 Sprint，单人可交付；Phase 3 需桌面端能力（Tauri/Rust，可配 Node sidecar 分担） |
| 最大风险 | Phase 0 新媒体闭环反复（历史教训）→ 门禁：不通过不前进 |
| 次风险 | 生态过度设计 → 每 Phase 以「最小可用闭环」交付，不做完整企业级功能 |
| 纪律 | 每个 Phase 结束产出 Reality Gate 报告（沿用 docs/.reality/ 规范） |

---

## 六、里程碑时间线（示意）

| 里程碑 | 内容 | 目标 |
|--------|------|------|
| M1 | Phase 0 快手闭环验收 | 2 周内 |
| M2 | Phase 1 生态地基（表+契约+市场壳） | M1 + 3 周 |
| M3 | Phase 2 Kunlun Media 本地内测 | M2 + 4 周 |
| M4 | Phase 3 开发者中心内测 | M3 + 4 周 |
| M5 | Phase 4 商城 + 商业闭环上线 | M4 + 4 周 |
| M6 | Phase 5 推广 + 第二应用 | M5 + 6 周 |

> 时间线为示意，以 Reality Gate 验收为准，**验收不过则时间顺延，不赶工**。
