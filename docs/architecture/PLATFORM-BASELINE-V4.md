# V4 Platform Baseline — 昆仑镜统一平台规范

> **文档版本**: V4.0  
> **冻结日期**: 2026-07-17  
> **适用范围**: 昆仑镜平台全工作台（短剧 / 小说 / PPT / GEO / 未来工作台）
> **状态**: ✅ 已冻结

---

## 1. 平台架构总览

```
Kunlun Mirror Platform
│
├── Workspace（工作台层）
│   ├── 短剧工作台
│   ├── 小说工作台
│   ├── PPT 工作台
│   ├── GEO 工作台
│   └── Future Workspace
│
├── Platform SDK（平台接口层）
│   ├── Capability Runtime（PLAT-006）
│   ├── Execution Runtime（PLAT-007）
│   ├── AI Resource Runtime（PLAT-008）
│   ├── Workspace Runtime（PLAT-009）
│   ├── Agent Runtime（PLAT-010）
│   ├── Workflow Runtime（PLAT-011）
│   └── Platform Governance（PLAT-012 —— 跨层）
│
├── Knowledge Infrastructure（知识基础设施层）
│   ├── Knowledge Object
│   ├── Citation Engine
│   ├── Evidence Engine
│   ├── Claim Engine
│   └── Trust Engine（平台级）
│
├── Asset Center（资产中心）
│   ├── 图片
│   ├── 视频
│   ├── 音频
│   ├── Prompt
│   ├── Citation
│   ├── Character
│   ├── Knowledge Object
│   └── GEO Knowledge
│
├── kmki-ui（统一 UI 组件库）
│
└── Admin（平台后台管理）
    ├── 工作台管理
    ├── 用户管理
    ├── 订单
    ├── 支付
    ├── 模型管理
    ├── 存储
    ├── Runtime 管理
    ├── Agent 管理
    ├── Trace & Telemetry
    ├── Audit
    ├── SLA
    ├── GEO 平台管理
    │   ├── 项目(Project)管理
    │   ├── Knowledge Object（后台查看/审核）
    │   ├── Claim 管理
    │   ├── Evidence 管理
    │   ├── Citation 管理
    │   ├── Trust Engine 配置
    │   ├── GEO Prompt Registry
    │   ├── GEO Template Library
    │   ├── GEO 数据源管理
    │   ├── GEO Provider 配置（各模型兼容）
    │   ├── GEO 统计分析
    │   └── GEO 审计日志
    └── License & Entitlement（VIP 权限体系）
```

---

## 2. Workspace Specification — 工作台统一规范

### 2.1 工作台生命周期

```
Init → Load → Activate → Use → Deactivate → Dispose
```

所有工作台必须实现以下钩子：

| 钩子 | 说明 |
|------|------|
| `onInit()` | 注册导航、加载元数据 |
| `onActivate()` | 激活工作台（恢复状态） |
| `onDeactivate()` | 停用工作台（保存草稿） |
| `onDispose()` | 销毁工作台 |

### 2.2 工作台目录结构

```
workspace/[module]/
  pages/           ← 页面文件（≤150 行）
  components/      ← Feature + 模块内组件
    [module]/      ← 业务模块子目录
  composables/     ← 组合式逻辑
  stores/          ← Pinia 状态
  services/        ← API 调用
  config/          ← 配置（侧边栏、路由、权限）
  types/           ← 类型定义
```

### 2.3 路由规范

```
/workspace/[module]?panel=[panelId]
```

面板 ID 全工作台唯一，避免冲突。

---

## 3. Project Specification — 项目生命周期

### 3.1 统一项目模型

```ts
interface WorkspaceProject {
  id: string
  type: 'SHORT_DRAMA' | 'NOVEL' | 'PPT' | 'GEO' | string  // 工作台类型
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'DELETED'
  config: Record<string, any>      // 扩展配置
  assets: AssetRef[]               // 关联资产
  createdAt: Date
  updatedAt: Date
}
```

### 3.2 项目状态流转

```
DRAFT → ACTIVE → ARCHIVED → DELETED
         ↑          │
         └──────────┘  (恢复)
```

---

## 4. Knowledge Object Specification — 统一知识对象

### 4.1 KO 模型（冻结）

```ts
interface KnowledgeObject {
  id: string
  projectId: string
  topic: string
  status: 'DISCOVERED' | 'PROCESSED' | 'FAILED'
  
  // 知识维度
  entities: EntityNode[]
  relations: RelationEdge[]
  claims: ClaimRef[]
  evidence: EvidenceRef[]
  citations: CitationRef[]
  
  // 元数据
  version: number
  confidence: number   // 0-1
  source: string       // 来源标识
  metadata: Record<string, any>
  
  createdAt: Date
  updatedAt: Date
}
```

### 4.2 KO 生命周期

```
DISCOVERED（初始发现） → PROCESSED（智能处理完成） → （可重复处理）
              ↘ FAILED（处理失败）
```

### 4.3 KO 非功能性约束

- **唯一真相源**：不允许 Agent 绕过 KO 直接写入 Graph
- **版本控制**：每次变更创建新版本
- **迁移路径**：GraphSync 同步 KO → Graph（单向）
- **跨工作台**：短剧/小说/PPT 的素材评估、世界观资料、引用来源均可使用 KO 模型

---

## 5. Asset Specification — 统一资产

### 5.1 资产模型

```ts
interface Asset {
  id: string
  projectId: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'PROMPT' | 'CITATION' 
      | 'CHARACTER' | 'VOICE' | 'MUSIC' | 'KNOWLEDGE_OBJECT'
      | 'GEO_KNOWLEDGE' | string
  name: string
  url?: string
  filePath?: string
  metadata: Record<string, any>
  tags: string[]
  createdAt: Date
  updatedAt: Date
}
```

### 5.2 资产中心

- 所有工作台共享 `Asset Center`
- 资产按 `type + projectId` 索引
- 支持跨工作台引用资产
- 每个资产关联所属工作台项目

---

## 6. Trust Specification — 平台级可信度体系

### 6.1 Trust Engine 模型

```ts
interface TrustScore {
  knowledgeScore: number    // 知识完整性
  evidenceScore: number     // 证据质量
  citationScore: number     // 来源可信度
  claimScore: number        // 推理置信度
  freshnessScore: number    // 时效性
  consistencyScore: number  // 一致性
  coverageScore: number     // 覆盖面
  
  // 综合
  overall: number           // 加权总分
  dimensions: Record<string, number>  // 可扩展维度
}
```

### 6.2 Trust Engine 架构

```
core/trust/
├── TrustEngine.ts          ← 统一入口
├── dimensions/
│   ├── KnowledgeDimension.ts
│   ├── EvidenceDimension.ts
│   ├── CitationDimension.ts
│   ├── ClaimDimension.ts
│   ├── FreshnessDimension.ts
│   ├── ConsistencyDimension.ts
│   └── CoverageDimension.ts
├── scoring/
│   ├── WeightedScorer.ts
│   └── AdaptiveScorer.ts
└── config/
    └── trust-defaults.yaml
```

### 6.3 跨工作台复用

| 工作台 | Trust Engine 适用场景 |
|--------|---------------------|
| 短剧 | 剧情资料、历史素材、角色设定的可信度 |
| 小说 | 引用来源、世界观资料、知识一致性 |
| PPT | 数据来源、图表引用可靠性 |
| GEO | Claim → Evidence → Citation → Trust 完整闭环 |

---

## 7. Capability Specification — 能力注册与调用

### 7.1 能力定义（PLAT-006 冻结）

```ts
interface Capability {
  id: string
  name: string
  version: string
  runtime: 'PLAT-007' | 'PLAT-010' | 'PLAT-011'
  contracts: {
    input: Schema
    output: Schema
  }
  provider?: string   // AI Provider（如适用）
  metadata: Record<string, any>
}
```

### 7.2 注册流程

1. 实现 Capability 接口
2. 注册到 Capability Registry
3. 定义 input/output Schema
4. 绑定 Runtime（Execution / Agent / Workflow）

---

## 8. UI Kit Specification — 统一 kmki-ui 组件库

### 8.1 组件目录

```
frontend/components/kmki-ui/
  Card/        ← 通用卡片
  StatCard/    ← 统计卡片
  EmptyState/  ← 空状态
  Skeleton/    ← 骨架屏
  Toast/       ← 通知
  Badge/       ← 状态标签
  Modal/       ← 模态框
  Toolbar/     ← 工具栏
  SearchBar/   ← 搜索
  Filter/      ← 筛选
  Timeline/    ← 时间线
  Wizard/      ← Wizard 框架
  ProgressBar/ ← 进度条
  Metric/      ← 指标展示
  Button/      ← 按钮
  Loading/     ← 加载态
```

### 8.2 开发规范

- 每个组件一个目录，`index.vue` 入口
- 支持 `v-model` 和 `$attrs` 透传
- 统一暗色主题，支持 CSS 变量覆盖
- 所有组件 ≤80 行
- 跨工作台引用路径：`~/components/kmki-ui/[Module]/index.vue`

---

## 9. License & Entitlement Specification — 统一 VIP 权限体系

### 9.1 层级

| 层级 | 可访问的工作台 |
|------|---------------|
| **普通 VIP** | ✅ 短剧 / ✅ 小说 / ✅ PPT |
| **高级 VIP** | ✅ 短剧 / ✅ 小说 / ✅ PPT / ✅ GEO |

### 9.2 未来扩展

```
AI Agent → 专属 License
Asset Center → 按存储 / 下载量计费
更多 Workspace → 按模块解锁
```

### 9.3 统一 Entitlement 系统

```
backend/src/services/platform/entitlement/
├── EntitlementService.ts   ← 统一权限检查
├── LicenseResolver.ts      ← License 解析
├── plans/                   ← 套餐定义
│   ├── basic.ts
│   ├── premium.ts
│   └── enterprise.ts
└── policies/               ← 按工作台/功能的权限策略
```

---

## 10. Admin Specification — 平台后台管理

统一后台 `admin/` 路径，包含：

### 10.1 平台通用管理

| 模块 | 说明 |
|------|------|
| 用户管理 | 注册/权限/License |
| 订单 | 套餐/支付/发票 |
| 模型管理 | AI Provider × Model 映射 |
| 存储 | 资产存储配额/用量 |
| Runtime 管理 | Runtime 状态/版本 |
| Agent 管理 | Agent 注册/监控 |
| Trace | 执行轨迹查询 |
| Telemetry | 系统监控 |
| Audit | 操作审计 |
| SLA | 服务等级监控 |

### 10.2 GEO 平台管理

| 模块 | 说明 |
|------|------|
| 工作台管理 | 工作台启停/版本 |
| 项目管理 | GEO 项目概览/审核 |
| Knowledge Object 管理 | KO 后台查看/审核/删除 |
| Claim 管理 | Claim 列表/审核 |
| Evidence 管理 | Evidence 列表/审核 |
| Citation 管理 | Citation 来源管理 |
| Trust Engine 配置 | 各维度权重配置 |
| GEO Prompt Registry | Prompt 版本管理 |
| GEO Template Library | 模板管理 |
| 数据源管理 | 来源配置 |
| Provider 配置 | 各模型兼容配置 |
| 统计分析 | 使用量/质量统计 |
| 审计日志 | GEO 操作审计 |

---

## 11. 跨层依赖关系

```
kmki-ui ──────────────┐
                       │
Admin ────────────────┤
                       │
Asset Center ──────────┤
                       ├──► Workspace Layer
Knowledge Infra ───────┘
    │
    └── Trust Engine (core/trust/)
         │
         ├── 短剧：剧情资料可信度
         ├── 小说：世界观一致性
         ├── PPT：数据引用可靠性
         └── GEO：Claim → Evidence → Citation → Trust 闭环
```

---

## 12. 开发纪律

所有新能力必须回答三个问题：

| 问题 | 说明 |
|------|------|
| **1. 它属于哪一层？** | Workspace / Platform SDK / Knowledge Infra / Asset / kmki-ui / Admin |
| **2. 它生产数据还是消费数据？** | 禁止 Consumer 先于 Producer 开发 |
| **3. 它是不是平台能力？** | 是 → 放入 `core/` / `runtime/` / `kmki-ui/` ；否 → 工作台内 |

---

## 附：已冻结的 Platform Runtime 层级

| PLAT | Runtime | 状态 |
|------|---------|------|
| PLAT-006 | Capability Platform | ✅ 冻结 |
| PLAT-007 | Execution Runtime | ✅ 冻结 |
| PLAT-008 | AI Resource Runtime | ✅ 冻结 |
| PLAT-009 | Workspace Runtime | ✅ 冻结 |
| PLAT-010 | Agent Runtime | ✅ 冻结 |
| PLAT-011 | Workflow Runtime | ✅ 冻结 |
| PLAT-012 | Platform Governance | ✅ 冻结 |

---

*V4 Platform Baseline — 昆仑镜统一平台规范*
*2026-07-17 — 与 GEO V1 第一阶段同步冻结*
