# SPRINT-ECO-01: 生态基础设施 Reality Implementation Plan

> **昆仑镜 AI 应用生态平台 — Phase 1 生态基础设施最小闭环实施计划**
> 版本：V1.0 | 类型：实施计划（**只设计，禁止代码**，批准后才开发） | 日期：2026-08-03
> 技术总监批准：Phase 0.5 三 Gate 通过，拆更小 Sprint（ECO-01~04），先建四大地基，不碰工作台业务

---

## 0. 本计划定位

**证明一件事**：一个 AI 员工插件，可以被 **安装 → 授权 → 运行 → 计费**。

**明确不做**（总监拍板暂缓）：
- ❌ 插件商城 UI（无运行闭环，商城无意义）
- ❌ 推广系统（无插件收入，无分润可言）
- ❌ 本地 Kunlun Media.exe（License + Runtime + Browser 隔离未稳，本地版是最后一步）

**执行纪律**：Online First；现有 9 工作台业务零改动；只挂载应用身份；本文件通过后再开发。

---

## 1. Application Adapter 数据模型（ECO-01 交付）

### 1.1 数据库（4 表，纯新增，对应 ECOLOGY-DATABASE-DESIGN §2.1）

| 表 | 关键字段 | 职责 |
|----|---------|------|
| `EcologyApplication` | slug(unique) / name / category / authorOrgId / isPlatformBuiltIn / status(draft\|review\|published\|deprecated) | 应用（工作台）注册 |
| `EcologyApplicationVersion` | applicationId / version(semver) / frontendEntry / backendModule / manifest(Json 能力声明) / status | 应用版本与能力声明 |
| `EcologyApplicationInstall` | organizationId + applicationId(unique) / versionId / status(installing\|active\|disabled) / config | 租户安装记录 |
| `EcologyApplicationPermission` | installId / permission / grantedBy / status | 应用权限授予（browser/content/analytics…） |

**约定**：`organizationId` 一律 = `Organization.id`（UUID，与 JWT org 强制解析对齐，不复用 URL tenantId）。

### 1.2 Application Adapter 运行时接口（挂载身份，不重构）

```typescript
interface ApplicationAdapter {
  meta: {
    applicationId: string;      // media-workspace
    name: string;               // Kunlun Media
    version: string;            // 1.0.0
    category: string;           // media | recruit | drama | novel | geo | legal | mall | music | ad
    icon?: string;
  };
  mountRoutes(): RouteConfig[];                    // 挂载前端路由（/workspaces/media → 应用路由）
  declareCapabilities(): CapabilityDeclaration[];  // 能力声明（供插件调用）
  permissionManifest(): PermissionManifest;        // 权限清单（browser/content/analytics…）
  pluginMountPoints(): MountPoint[];               // 插件挂载点（media.analytics / media.calendar…）
}
```

### 1.3 内置应用注册表（9 工作台挂身份，零业务改动）

| applicationId | 名称 | 前端入口 | 后端模块 | 挂载点（示例） |
|---------------|------|---------|---------|--------------|
| `media-workspace` | Kunlun Media | /workspaces/media | enterprise/channel | media.analytics / media.calendar / media.publish |
| `recruit-workspace` | Kunlun Recruit | /workspaces/recruit | 招聘域 | recruit.candidates / recruit.interview |
| `drama-workspace` | Kunlun Drama Studio | /workspaces/drama | 短剧域 | drama.storyboard / drama.production |
| `novel-workspace` | Kunlun Novel | /workspaces/novel | 小说域 | novel.outline / novel.chapters |
| `geo-workspace` | Kunlun GEO | /workspaces/geo | GEO 域 | geo.audit / geo.reports |
| `legal-workspace` | Kunlun Legal | /workspaces/legal | 法律域 | legal.contracts |
| `mall-workspace` | Kunlun Mall | /workspaces/mall | 商城域 | mall.products |
| `music-workspace` | Kunlun Music | /workspaces/music | 音乐域 | music.tracks |
| `ad-workspace` | Kunlun Ad | /workspaces/ad | 广告域 | ad.campaigns |

> **关键**：Adapter 只是「注册表 + 身份声明」，不修改任何工作台内部逻辑。注册为平台内置（isPlatformBuiltIn=true, authorOrgId=null）。

### 1.4 ECO-01 Reality Gate

- [ ] 9 内置应用注册成功，`EcologyApplication` 幂等回填 9 行
- [ ] 现有 9 工作台前端路由零改动正常运行（回归）
- [ ] 前端新增「应用中心」只读页：列出 9 应用（名称/图标/版本/状态），可查看能力声明
- [ ] 无数据库破坏、无用户影响（`prisma db execute` + 手写 SQL 双通道，纯新增表）

---

## 2. Plugin Registry 数据模型（ECO-02 交付）

### 2.1 数据库（3 表，纯新增，对应 ECOLOGY-DATABASE-DESIGN §2.2 + §2.7）

| 表 | 关键字段 | 职责 |
|----|---------|------|
| `EcologyPlugin` | manifestId(unique) / name / type(agent\|tool\|workflow) / authorOrgId / status(draft\|review\|gray\|published\|removed) / manifest(Json 快照) | 插件注册 |
| `EcologyPluginVersion` | pluginId / version / packageUrl / manifest / reviewStatus(pending\|passed\|rejected) / releaseStatus(draft\|gray\|released\|rolled_back) | 插件版本与审核状态 |
| `EcologyPluginInstall` | tenantId + pluginId(unique) / versionId / status(installing\|active\|disabled) / config | 租户安装记录 |

（Agent 模板域 `EcologyAgentTemplate`：本 Sprint 只设计不建，进入 ECO-04 后随 License 一起落地）

### 2.2 Plugin Manifest 解析器（只读，不执行）

```
输入 plugin.json → 校验器（纯函数，无副作用）
  ├─ id 命名空间唯一（^[a-z][a-z0-9-]+(\.[a-z][a-z0-9-]+)*$）
  ├─ type ∈ {agent, tool, workflow}
  ├─ runtime 声明（kaor 版本区间）
  ├─ application 关联（必须指向已注册 EcologyApplication.slug）
  ├─ permissions 声明（必须在权限字典内，默认拒绝未声明）
  ├─ billing 声明（type=subscription, price, period；仅存储，不触发支付）
  └─ entry 入口声明（agent/tools/workflows 路径）
通过 → EcologyPlugin 注册 + EcologyPluginVersion 记录
失败 → 返回结构化错误清单（供开发者修正）
```

### 2.3 Plugin Registry Service（API 契约）

```
POST   /api/ecosystem/plugins/register        // 注册插件（只读解析 manifest）
GET    /api/ecosystem/plugins?type=agent      // 插件列表（分页/筛选）
GET    /api/ecosystem/plugins/:manifestId     // 插件详情（含版本）
POST   /api/ecosystem/plugins/:id/versions    // 上传新版本（解析+校验）
POST   /api/ecosystem/plugins/:id/install     // 租户安装（记录 install，不接支付）
POST   /api/ecosystem/plugins/:id/uninstall   // 租户卸载（status=disabled）
```

### 2.4 ECO-02 Reality Gate

- [ ] plugin.json 合法样本 5 条全部通过校验并注册
- [ ] plugin.json 非法样本 5 条（坏 id / 未知 type / 未注册应用 / 越权权限 / 坏 billing）全部拒绝且报错清晰
- [ ] 插件版本管理：同插件多版本记录，releaseStatus 流转正确
- [ ] 租户安装/卸载记录落库；**不接商城、不产生支付**

---

## 3. KAOR Interface 边界（ECO-03 交付）

### 3.1 结构（兼容优先，不拆 Hermes）

```
KAOR Interface（抽象接口层，九模块契约）
        │
Hermes Adapter（映射实现：现有 Hermes 能力 → KAOR 接口）
        │
Existing Hermes Runtime（现有 Agent 运行环境，零重构）
```

### 3.2 九模块接口契约（冻结版，只定接口不实现）

| # | 模块 | 核心接口（设计签名） |
|---|------|---------------------|
| 1 | Agent Lifecycle | `create(template, ctx) → AgentHandle` / `start / pause / destroy / heartbeat` |
| 2 | Memory | `get(key, {namespace}) / set(key, value, {namespace}) / search(query, {namespace})` |
| 3 | Tool Calling | `register(toolSchema) / invoke(toolId, args, {permissions})` |
| 4 | Browser Control | `navigate(url) / evaluate(selector, extractor) / screenshot() / qrScan()` |
| 5 | Workflow Engine | `load(def) / start(run) / onNodeComplete(cb)` |
| 6 | Scheduler | `cron(expr, task) / once(at, task) / cancel(jobId)` |
| 7 | Plugin Loader | `loadManifest(manifest) / resolve(pluginId, version) / hotReload()` |
| 8 | Permission Sandbox | `check(resource, action, ctx) → {allow, reason}` / `grant / revoke` |
| 9 | Local Execution | `spawn(runtime, config) / resourceQuota(id) / terminate(id)` |

### 3.3 Hermes Adapter 映射表（现有 → KAOR）

| 现有 Hermes 能力 | KAOR 接口 | 映射方式 |
|------------------|----------|---------|
| 子代理生命周期（agentInstance） | Agent Lifecycle | 现有 EnterpriseAgentInstance 状态机 → create/start/pause/destroy |
| HermesProfileBinding | Plugin Loader 载体 | binding.soulMdContent → 插件 Agent 模板加载 |
| AgentMemory / PromptMemory | Memory | namespace = tenant/{tenantId}/agent/{agentInstanceId}（现有命名空间沿用） |
| 工具白名单（toolAllowList） | Tool Calling + Permission Sandbox | allowList → permissions 校验 |
| WorkflowDef / AgentEdge | Workflow Engine | 现有图定义 → 流程契约 |
| SchedulerTask | Scheduler | 现有定时任务 → 调度契约 |
| BrowserRuntime | Browser Control | 现有浏览器抽象 → 通用接口 |

### 3.4 ECO-03 Reality Gate

- [ ] KAOR 九模块接口契约文档冻结（含 TypeScript 类型定义，放 shared/kaor-contracts/）
- [ ] Hermes Adapter 映射表落地（接口文件 + 映射实现，不重构 Hermes 本体）
- [ ] 现有 AI 员工（如招聘顾问）经 Adapter 走通一次 Agent Lifecycle 冒烟（create→start→heartbeat→destroy）
- [ ] 现有 Agent 运行回归无破坏

---

## 4. License Service 设计（ECO-04 交付）

### 4.1 数据库（2 表，纯新增，对应 ECOLOGY-DATABASE-DESIGN §2.3）

| 表 | 关键字段 | 职责 |
|----|---------|------|
| `EcologyPluginSubscription` | installId / tenantId / pluginId / plan(monthly\|quarterly\|yearly) / status(trialing\|active\|past_due\|canceled\|expired) / trialEndsAt / currentPeriodStart/End / cancelAtPeriodEnd | 插件订阅 |
| `EcologyLicense` | licenseKey(unique) / tenantId / scope(plugin:{id}\|app:{id}) / deviceLimit / status(active\|expired\|suspended) / expiresAt / revokedAt | 授权凭证 |

### 4.2 License 生命周期状态机

```
订阅（用户购买/试用） → ACTIVE（可运行）
  ├─ 到期未续费      → EXPIRED（Plugin Disabled，Application 继续运行，数据保留 30 天）
  ├─ 风控/违规       → SUSPENDED（冻结，仅可申诉）
  └─ 主动取消        → CANCELED（当期有效至周期末）
离线宽限：本地缓存 License 快照，断网最多宽限 7 天（防永久破解：心跳校验）
```

### 4.3 License Service API（契约）

```
POST   /api/ecosystem/license/issue       // 签发：tenantId + pluginId + plan → licenseKey
GET    /api/ecosystem/license/verify?key= // 验证 → { status, expiresAt, scope, entitlements }
POST   /api/ecosystem/license/revoke      // 吊销（退款/违约）
POST   /api/ecosystem/license/suspend     // 挂起（风控）
POST   /api/ecosystem/license/unsuspend   // 解挂
GET    /api/ecosystem/license/status      // 租户插件授权总览
```

### 4.4 运行链路（总监定调）

```
用户订阅插件 → 生成 License → KAOR 启动插件 → 验证 License → 运行
```
过期行为：**Plugin Disabled（插件禁用），Application 继续运行**——符合「卖的是 AI 员工订阅，不是卖软件」。

### 4.5 ECO-04 Reality Gate

- [ ] License 签发 → 验证 → 吊销全链路 API 通过（含设备数限制）
- [ ] 过期场景：模拟订阅到期 → 插件能力禁用 + 应用基础功能继续 + 数据保留
- [ ] 挂起场景：SUSPENDED → 插件拒绝运行 → 解挂恢复
- [ ] 与现有 PaymentOrder 打通：插件订阅订单入 PaymentOrder（type=plugin_subscription），License 关联订单号（本 Sprint 仅打通订单→License 的模拟闭环，真实支付通道不动）

---

## 5. 与现有 User / Tenant / Commerce 集成方案

| 现有体系 | 集成方式 | 冲突 |
|---------|---------|------|
| **User** | 零改动；插件订阅以 org 为主体（tenantId），User 仅作操作者审计 | 无 |
| **Tenant（Organization / JWT org）** | 生态表 organizationId = Organization.id（UUID）；JWT org 强制解析复用现有中间件；无 org = 403 兜底 | 无 |
| **Workspace** | 不动；Application 通过 frontendEntry 指向现有路由，非新建空间 | 无 |
| **Commerce（PaymentOrder / RechargeOrder / EnterpriseSubscription）** | 插件订阅 = 新增独立域（EcologyPluginSubscription）；订单复用 PaymentOrder（type=plugin_subscription）；**现有 EnterpriseSubscription/套餐零改动** | 无 |
| **AI 员工链（AgentTemplate → EnterpriseAgentProfile → EnterpriseAgentInstance → HermesProfileBinding）** | 插件 agent 类型 = 模板升级通道：EcologyAgentTemplate 衔接 AgentTemplate；插件授权通过后实例化走现有链 | 低（ECO-04 只落 EcologyAgentTemplate 表，不接实例化改造） |
| **审计（AuditLog）** | 生态动作（注册/安装/授权/吊销）统一写现有审计通道 | 无 |

**关键决策**：
1. 生态域完全独立命名空间（Ecology*），只增不改，现有 461 表零结构变更。
2. 支付不新建通道：插件订阅订单走 PaymentOrder 统一支付（type 扩展一个枚举值）。
3. 插件授权 → 运行链路在 ECO-04 打通「模拟订单→License→KAOR 校验」，真实支付在 Phase 2/4 商城 Sprint 再接。

---

## 6. Migration 风险

| # | 风险 | 等级 | 缓解 |
|---|------|:----:|------|
| 1 | `prisma migrate dev` 被历史迁移卡死（团队模式已知教训） | 高 | 手写 SQL + `prisma db execute --schema` 双通道，不依赖自动迁移 |
| 2 | 外键引用 Organization.id 存在性 | 中 | 内置应用 authorOrgId=null 避开；租户安装前校验 org 存在 |
| 3 | 回填幂等性（9 内置应用） | 中 | slug 唯一约束 + upsert 语义 |
| 4 | 只增不改被破坏（有人动现有表） | 高 | Migration 文件独立前缀 ecology_；评审门禁 |
| 5 | manifest 校验规则后续演进 | 低 | EcologyPlugin.manifest 存完整快照，校验器版本化（schemaVersion 字段） |
| 6 | 插件安装跨 org 越权 | 中 | tenantId 必须映射 JWT org（复用 TENANT_CONTEXT_INVALID 403 中间件） |

**回滚策略**：纯新增表，回滚 = 逆序 DROP ecology_* 表（无存量数据依赖）。

---

## 7. Sprint 拆分（总监批准版）

| Sprint | 范围 | 交付 | Reality Gate | 禁止 |
|--------|------|------|:------------:|------|
| **ECO-01** | Application Adapter Layer | 4 表 + Adapter 接口 + 9 内置应用注册 + 应用中心只读页 | ✅ 9 应用注册 / 工作台回归 / 前端可见 | 改任何工作台业务 |
| **ECO-02** | Plugin Manifest Runtime | 3 表 + Manifest 解析器 + Registry API | ✅ 合法/非法样本 5+5 / 版本管理 / 安装卸载 | 接商城 / 执行插件 |
| **ECO-03** | KAOR Runtime Boundary | KAOR 接口契约 + Hermes Adapter + 冒烟 | ✅ 契约冻结 / 映射表 / 现有 Agent 回归 | 拆 Hermes / 重写 |
| **ECO-04** | License System | 2 表 + License 状态机 + API + 订单打通 | ✅ 签发/验证/吊销 / 过期降级 / 挂起 | 真实支付通道 / 商城 |

**执行顺序**：ECO-01 → ECO-02 → ECO-03 → ECO-04 严格串行；每个 Sprint 过 Gate 才进下一个。
**总验收（Phase 1 最小闭环）**：一个 AI 员工插件走通 **安装 → 授权 → 运行 → 计费** 全链路（模拟订单）。

---

## 8. 执行纪律（冻结）

1. **本文件批准后才允许写代码**；批准前继续零代码。
2. Online First：所有生态能力先在线上验证，本地封装是最后一步。
3. 不碰已有工作台业务逻辑；只挂载身份、只新增生态表。
4. 商城 / 推广 / 本地 exe 一律暂缓，任何人不得提前开工。
5. 每个 Sprint 结束产出 Reality Gate 报告（docs/.reality/ 规范）。
