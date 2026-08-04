# APPLICATION-MARKETPLACE-DESIGN.md

> **昆仑镜 AI 应用生态平台 — Task 02 应用工具市场设计**
> 版本：V1.0 | 类型：架构设计（只读，不实施） | 日期：2026-08-03

---

## 一、设计目标

每个成熟工作台最终成为「可安装应用」：

```
Kunlun Media      （新媒体运营）
Kunlun Drama      （AI短剧）
Kunlun Recruit    （求职招聘）
Kunlun Novel      （小说）
Kunlun Legal      （法律）
Kunlun GEO        （GEO优化）
Kunlun Mall       （商城）
```

应用市场 = 工作台的**发行渠道 + 安装管理 + 版本控制 + 权限声明**。

### 1.1 与插件市场的边界（关键区分）

| 维度 | 应用市场（Application Marketplace） | 插件市场（Plugin Marketplace） |
|------|-----------------------------------|-------------------------------|
| 粒度 | 完整工作台（模块级） | 能力单元（AI员工/工具/Workflow） |
| 用户 | 终端用户（企业/个人） | 终端用户 + 开发者 |
| 安装后 | 出现完整工作台入口 | 注入现有工作台/Agent 能力 |
| 类比 | App Store 的 App | App 内的内购能力/小程序 |
| 商业 | 应用订阅费 | 插件订阅费 + 分账 |

---

## 二、应用模型设计

### 2.1 核心实体（Application Domain）

```
Application            应用元数据（即工作台）
  ├── id / slug / name / icon / description
  ├── category / tags / screenshots
  ├── author（EnterpriseProfile 或平台）
  ├── status: draft | review | published | deprecated | removed
  ├── isPlatformBuiltIn（内置工作台标志）
  └── pricingModel: free | subscription | per_seat

ApplicationVersion      版本
  ├── applicationId
  ├── version: semver（1.0.0）
  ├── changelog
  ├── frontendEntry（如 /workspaces/media）
  ├── backendModule（如 enterprise/channel）
  ├── schemaVersion（数据库迁移版本号）
  ├── minPlatformVersion（最低平台版本）
  ├── manifest（能力声明 JSON：permissions/models/apis）
  ├── status: draft | testing | approved | released | rolled_back
  └── releaseNote

ApplicationInstall     安装记录
  ├── tenantId / organizationId / userId（安装主体）
  ├── applicationId / versionId
  ├── status: installing | active | disabled | uninstalling
  ├── config（工作台配置快照 JSON）
  ├── installedAt / lastUsedAt
  └── 唯一约束 (organization_id, application_id)

ApplicationPermission  应用权限授予
  ├── installId
  ├── permission（browser/content/analytics/publish/storage...）
  ├── grantedBy / grantedAt / expiresAt
  └── status

ApplicationRuntime     应用运行状态
  ├── installId
  ├── runtimeState（ready/error/maintenance）
  ├── lastHealthCheckAt
  └── healthPayload
```

### 2.2 内置工作台 = 预装应用

- 现有 9 个工作台全部以 `isPlatformBuiltIn: true` 注册为「平台预装应用」，**安装记录自动创建，用户零操作**。
- 好处：统一管理入口、版本追踪、后续可拆分为「基础版免费 + 高级模块付费」。

---

## 三、安装生命周期状态机

```
draft → review → published → deprecated → removed
              ↓
          released（版本）
              ↓
         installed（租户安装）
              ↓
   installing → active ⇄ disabled → uninstalling → 删除
              ↓
          runtime 健康检查
```

- **安装即路由**：安装后前端按 `ApplicationVersion.frontendEntry` 动态挂载路由（Nuxt 动态路由 + 菜单注册），后端按 `backendModule` 挂载 API 前缀。
- **卸载 = 软删**：保留配置与数据，停用入口；数据删除策略由应用自声明（`dataRetention`）。

---

## 四、市场界面设计（产品层）

### 4.1 市场首页（/marketplace/apps）

```
┌─────────────────────────────────────────────┐
│  应用市场                                     │
│  [搜索] [分类: 全部/创作/运营/商业/效率]        │
├──────────────┬──────────────┬───────────────┤
│ Kunlun Media │ Kunlun Drama │ Kunlun Recruit│
│ 新媒体运营    │ AI短剧制作    │ 求职招聘       │
│ ⭐4.8 已装1.2w│ ⭐4.9 已装3.4w│ ⭐4.6 已装8k  │
│ [安装]       │ [安装]       │ [安装]        │
└──────────────┴──────────────┴───────────────┘
```

### 4.2 应用详情页

- 截图轮播、版本历史、更新日志、权限声明列表（用户可见）、订阅价格、评分评论、开发者信息。
- 「安装」→ 确认权限 → 订阅支付（如需）→ 安装进度 → 跳转工作台。

### 4.3 已安装管理（/marketplace/installed）

- 应用列表：启用/停用/卸载、版本更新（一键升级 + changelog）、使用统计、订阅管理。

---

## 五、与现有架构的映射（零破坏接入）

| 现有资产 | 映射为 |
|---------|--------|
| `frontend/workspaces/*` + `pages/*` | Application.frontendEntry |
| `backend/src/enterprise/*` / `director*` / `hdz*` / `geo*` / `legal*` | Application.backendModule |
| `WORKSPACE-DOMAIN-MATRIX.md` 能力归属矩阵 | 应用权限声明的来源 |
| `frontend/modules/*` 菜单/路由注册 | 应用安装后的动态挂载 |
| `SubscriptionPlan/Subscription` | 应用订阅计费 |
| `AuditLog` | 安装/卸载/升级审计 |

**接入成本评估**：现有工作台无需改动，只需新增 `Application/ApplicationVersion/ApplicationInstall` 表 + 市场前端页 + 安装路由挂载器。**兼容期内置应用自动安装，用户无感知。**

---

## 六、风险与决策

| 项 | 风险/决策 |
|----|----------|
| 动态路由挂载 | Nuxt 需支持应用级动态路由注册（现有 modules/ 机制可扩展）；失败回退 404 + 提示「应用未安装」 |
| 版本升级数据兼容 | 每个 ApplicationVersion 声明 schemaVersion，升级前跑迁移检查，失败阻止升级（借鉴新媒体 migration 双通道经验） |
| 内置应用与市场应用冲突 | 内置应用不可卸载（可停用），市场应用全生命周期可管理 |
| 应用权限信任 | 平台预装应用=平台背书；第三方应用走审核 + 权限最小化 |
