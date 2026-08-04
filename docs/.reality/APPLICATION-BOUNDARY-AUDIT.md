# APPLICATION-BOUNDARY-AUDIT.md

> **昆仑镜 AI 应用生态平台 — Task 11 Application Boundary Audit**
> 版本：V1.0 | 类型：只读审计 + 边界设计 | 日期：2026-08-03
> 补充来源：技术总监评审（2026-08-03）——「工作台 = Application，不是页面；迁移不是重构，是增加 Application Adapter」

---

## 一、审计目的

回答：**哪些现有模块可以成为 Application？每个工作台应用化需要拆什么？**

判定标准（四项）：

| 维度 | 说明 |
|------|------|
| 领域独立性 | 业务语义是否自洽、可独立描述 |
| 公共能力依赖 | 是否只依赖平台层（Identity/Commerce/Billing/Model Gateway/Storage），无跨领域耦合 |
| Agent 化潜力 | 领域能力是否可封装为 AI员工/工具/工作流插件 |
| 用户价值闭环 | 安装后用户能否独立完成「登录→使用→产出」闭环 |

---

## 二、工作台应用化评估总表

| 工作台 | 可应用化 | 后端资产 | 需要拆什么 | 插件机会 | 优先级 |
|--------|:-------:|---------|-----------|---------|:------:|
| **新媒体** | ★★★★★ | `enterprise/channel`（identity-probe / login-state-machine / platform-registry / token.service / adapters）+ `enterprise/reality` + `enterprise/revenue` + `enterprise/knowledge` | 浏览器控制 → 下沉 Local Device Runtime；探针/提取器 → 配置化插件私域 | AI内容运营经理 / AI爆款分析师 / AI矩阵运营团队 / AI评论运营 | **P0 第一个** |
| **招聘** | ★★★★★ | `agents/job/*`（enterprise-recruit-agent / interview-agent / resume-parser-agent / talent-search-agent / job-evaluation / job-career-engine）+ recruitment-* 模型 | 简历解析/匹配算法保持私有；招聘管线复用 Workflow Engine 契约 | AI招聘顾问 / AI面试官 / AI猎头 / AI简历分析师 | **P1** |
| **短剧** | ★★★★ | `director*` + `cinematic-*`（导演状态机 / 分镜谱系 / 叙事约束 / 镜头语法） | 导演状态机体积大，需拆分「创作核心」与「制作流程」两层 | AI导演 / AI分镜 / AI制片 / AI编剧助手 | P2 |
| **小说** | ★★★★ | `hdz*`（世界观记忆 / 章节状态机 / 风格DNA / 稿纲） | 世界观记忆系统 → 对齐统一 Memory API 命名空间 | AI小说家 / AI世界观设定 / AI连载助手 | P2 |
| **GEO** | ★★★★ | `geo*` 模型 + `graph-optimization` + `workspaces/geo` | 扫描/验证引擎保持私有；Schema 标记工具 → Tool 插件化 | AI SEO顾问 / GEO扫描工具 / AI内容优化 | P2 |
| **法律** | ★★★ | `legal*` 模型 + `workspaces/legal` | 法条/合同/案件领域模型保持私有；提示词库 → 知识包 | AI法律顾问 / 合同审查 / AI法条检索 | P3 |
| **商城** | ★★★ | `mall*` / `ecom*` / `creative-economy` | 商品/订单/分销保持私有；**支付/结算走 Commerce Core**（不重复建） | AI选品助手 / AI客服 / 分销分析 | P3 |
| **音乐** | ★★★ | `studio`（MUSIC/MV 工作台）+ music 提供商编排 | 音乐生成编排保持私有；Suno/Mureka 适配器 → Provider 注册制 | AI作曲 / AI歌词 / AI混音顾问 | P3 |
| **广告** | ★★★ | `studio`（AD 工作台）+ 品牌资产模型 | 品牌资产/三阶段流程保持私有 | AI广告脚本 / AI分镜 / 效果分析 | P3 |

---

## 三、分工作台拆解明细

### 3.1 Kunlun Media（新媒体）— P0

```
应用包 kunlun-media@1.0.0
  runtime: web/local          ← 本地运行时（Electron + Device Bridge）
  permissions: browser, storage, ai, scheduler

拆出到平台层：
  → 浏览器控制（enterprise/channel 的 BrowserRuntime）→ Local Device Runtime
  → 身份探针/指标提取器 → 配置化注册（平台提供注册表，探针逻辑插件私域）

保留在应用包：
  → 账号生命周期管理（登录状态机/平台适配器）
  → 内容管理/基础发布/基础数据查看（免费能力）
  → 平台适配器（channel.adapter / platform-registry）

插件机会（订阅制）：
  AI爆款分析师    ¥299/月
  AI内容运营经理  ¥599/月
  AI评论运营     ¥299/月
  AI短视频导演   ¥399/月
  AI矩阵运营团队（多Agent：运营经理/数据分析师/文案专家/增长专家）¥1,999/月
```

### 3.2 Kunlun Recruit（招聘）— P1

```
应用包 kunlun-recruit@1.0.0
  runtime: web
  permissions: ai, storage, scheduler

拆出到平台层：
  → 招聘管线流程 → Workflow Engine 注册（workflow 类型：screening/interview/eval）
  → Agent 实例 → Hermes Runtime（agents/job/* 已符合 Agent 形态，直接注册模板）

保留在应用包：
  → 简历解析（resume-parser-agent 领域算法）
  → 匹配引擎（job-matching / talent-search 领域算法）
  → 评估体系（job-evaluation / interview-agent 领域算法）

插件机会：
  AI招聘顾问   ¥499/月
  AI面试官     ¥399/月
  AI猎头       ¥799/月
  AI简历分析师 ¥199/月
```

**优势**：`agents/job/*` 已是独立 Agent 集群，应用化 = 模板注册 + Manifest 声明，工作量最小。

### 3.3 Kunlun Drama（短剧）— P2

```
应用包 kunlun-drama@1.0.0
  runtime: web
  permissions: ai, storage

拆出到平台层：
  → 导演状态机中的「任务编排」部分 → Workflow Engine
  → 分镜/角色/场景谱系数据 → Storage（UnifiedAsset 挂载）

保留在应用包：
  → 导演状态机核心（创作语义）
  → 叙事约束引擎 / Cinematic Grammar（领域算法）
  → 镜头运动规划（领域算法）

插件机会：
  AI导演   ¥699/月（导演状态机增值：自动分镜/节奏控制）
  AI分镜   ¥299/月
  AI制片   ¥399/月
```

**注意**：短剧是「重创作语义」工作台，抽离边界要保守——宁可多留私有，不把导演语义塞进平台。

### 3.4 其余工作台（P2/P3）

| 工作台 | 拆出到平台 | 保留私有 | 插件机会 |
|--------|-----------|---------|---------|
| 小说 | 世界观记忆 → Memory API 命名空间 | 章节状态机/风格DNA/稿纲 | AI小说家 ¥399 / AI世界观设定 ¥199 / AI连载助手 ¥299 |
| GEO | Schema 标记工具 → Tool 插件 | 扫描/实体图谱/验证引擎 | AI SEO顾问 ¥499 / GEO扫描 ¥299 / AI内容优化 ¥399 |
| 法律 | 提示词库 → 知识包 | 法条/合同/案件模型 | AI法律顾问 ¥699 / 合同审查 ¥399 / AI法条检索 ¥199 |
| 商城 | 支付/结算 → Commerce Core | 商品/订单/分销 | AI选品 ¥299 / AI客服 ¥399 / 分销分析 ¥199 |
| 音乐 | 提供商适配 → Provider 注册制 | 音乐生成编排 | AI作曲 ¥299 / AI歌词 ¥99 / 混音顾问 ¥199 |
| 广告 | 无 | 品牌资产/三阶段流程 | AI广告脚本 ¥299 / AI分镜 ¥299 / 效果分析 ¥399 |

---

## 四、Application Adapter（应用适配器）设计

**迁移铁律（技术总监）**：现有工作台**不动**，应用化 = 新增 Adapter，不是重构。

```
┌─────────────────────────────────────────────┐
│  Application Runtime                        │
│   ┌───────────────────────────────────────┐ │
│   │ Application Adapter（每应用一个）       │ │
│   │   mountRoutes()   前端路由挂载         │ │
│   │   registerMenus() 菜单/入口注册        │ │
│   │   exposeCapabilities() 能力注册        │ │
│   │   declarePermissions() 权限声明        │ │
│   │   attachPlugins()   插件挂载点          │ │
│   └───────────────────────────────────────┘ │
│        │                                    │
│   ┌────┴───────┐                     ┌──────┴─────┐
│   │ 现有代码   │   ← 零改动          │ 平台 API   │
│   │ (工作台)   │                     │ (SDK)      │
│   └────────────┘                     └────────────┘
└─────────────────────────────────────────────┘
```

### 4.1 Adapter 接口契约

```typescript
interface ApplicationAdapter {
  id: string;                       // kunlun-media
  version: string;                  // 1.0.0
  mountRoutes(app: Router): void;   // 现有路由零改动注册
  registerMenus(): MenuItem[];
  declareCapabilities(): Capability[];  // 能力声明（供插件发现）
  permissionManifest(): Permission[];   // browser/storage/ai/...
  pluginMountPoints(): MountPoint[];    // 插件挂载点（如 media.analytics）
  onInstall(ctx): Promise<void>;        // 安装钩子（初始化配置）
  onUninstall(ctx): Promise<void>;      // 卸载钩子（软删）
  healthCheck(): Promise<Health>;       // 运行健康
}
```

### 4.2 能力注册（Capability Registry）

```
Capability = { id, applicationId, type, description, inputSchema, outputSchema }

例：
  kunlun-media:analytics.read      → 数据读取（供 AI爆款分析师 插件调用）
  kunlun-media:content.publish     → 内容发布（供 AI内容运营经理 调用）
  kunlun-recruit:resume.parse      → 简历解析（供 AI简历分析师 调用）
  kunlun-drama:storyboard.generate → 分镜生成（供 AI分镜 插件调用）
```

插件通过 `CapabilityRegistry` 发现并调用应用能力——**应用成为插件的能力宿主**，这是「应用内插件」的机制基础。

---

## 五、应用化优先级与依赖

```
P0 新媒体（第一个，本地应用，全链路试点）
  └─ 验证：Application Adapter + 本地 Runtime + 插件 + 订阅 全链路
P1 招聘（Agent 体系最成熟，工作量最小）
  └─ 验证：非本地应用的纯云端应用化 + Agent 插件化
P2 短剧/小说/GEO（领域复杂，保守拆解）
P3 法律/商城/音乐/广告（按需，不着急）
```

**依赖关系**：P0 打穿机制 → P1 验证纯云端应用 → P2/P3 批量复制模式。

---

## 六、审计结论

1. **9 个工作台全部可应用化**，星级 3-5，无一需要重构——全部走 Application Adapter 增量接入。
2. **新媒体（P0）+ 招聘（P1）是优先试点**：新媒体验证本地+生态全链路，招聘验证「Agent 体系→插件」的最短路径。
3. **拆解红线**：领域算法/领域模型/领域提示词永远私有；平台只拿「浏览器控制/流程编排/支付结算/记忆/存储」这类无领域语义的能力。
4. **插件机会清单已明确**（每应用 3-5 个插件），商业模型有真实落点。
