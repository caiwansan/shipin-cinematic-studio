# KAOR-BOUNDARY-DESIGN.md

> **昆仑镜 AI 应用生态平台 — Phase 0.5 Task A：KAOR Runtime Boundary Design**
> 版本：V1.0 | 类型：架构冻结设计（只读，不实施） | 日期：2026-08-03
> Gate：技术总监拍板「先完成 KAOR 架构冻结，不马上拆 Hermes」——本文件是生态操作系统的地基之一

---

## 一、目的

回答唯一问题：**哪些能力属于 Runtime / Plugin / Application / Workspace？**

边界错了，就会重演「每个工作台独立建设，最后无法生态化」；边界对了，短剧/小说/招聘/法律才能平稳接入。

---

## 二、四层定义（先冻结语义）

| 层 | 定义 | 类比 | 有无领域语义 | 可否跨应用售卖 |
|----|------|------|:-----------:|:------------:|
| **Runtime（KAOR 内核）** | 无领域语义的执行基础设施 | Windows 内核 + Docker | ❌ 无 | — |
| **Application（应用）** | 有领域语义的业务整体，用户安装的最小单元 | Windows 里的 Office | ✅ 有 | 应用本身 |
| **Plugin（插件）** | 有领域语义、运行在 KAOR 之上、可单独售卖的能力包 | Office 加载项 | ✅ 有 | ✅ 单独售卖 |
| **Workspace（工作区）** | 用户数据/配置/会话容器，不属于任何代码层 | 用户文件夹 | 数据非代码 | — |

**一句话边界**：代码按领域语义归位——没语义的进 Runtime，有语义的进 Application 或 Plugin（按是否跨应用售卖区分），数据归 Workspace，平台服务（身份/计费/授权）永远在云端 Platform 层。

---

## 三、能力归属判定准则（四问测试）

对任何一个候选能力，依次回答：

```
Q1 它是否包含领域业务语义（新媒体/招聘/短剧/法律…）？
   └─ 否 → Runtime（内核）✅ 到此为止
   └─ 是 → 继续 Q2

Q2 它是否只服务于单一应用、且与该应用强耦合？
   └─ 是 → Application（应用私有）✅
   └─ 否 → 继续 Q3

Q3 它是否可被多个应用复用、或可独立售卖？
   └─ 是 → Plugin（插件）✅
   └─ 否 → 重新审视：要么归 Application，要么是 Runtime 缺抽象

Q4 它是用户数据/状态/配置，而非代码？
   └─ 是 → Workspace（命名空间隔离存储）✅
```

**红线**：
- KAOR 内核禁止领域代码（写进内核的领域逻辑 = 未来无法插件化的定时炸弹）。
- Application 禁止直连平台 API，必须经 Application Adapter 的 Capability 声明。
- Plugin 只能通过公开 API（CapabilityRegistry / KAOR SDK）访问应用与内核，禁止摸私有实现。
- Workspace 数据按 `namespace = applicationId:pluginId:userId` 隔离，插件卸载可迁可留。

---

## 四、能力归属总表（冻结版）

### 4.1 Runtime（KAOR 内核）—— 九大模块

| 能力 | 归属 | 边界说明 |
|------|------|---------|
| Agent Lifecycle | Runtime | 实例创建/启动/暂停/销毁/心跳，无领域语义 |
| Memory | Runtime（API 层） | 统一记忆 API + 命名空间；**数据本体归 Workspace** |
| Tool Calling | Runtime | 工具注册表 + 调用执行器 + 参数校验 |
| Browser Control | Runtime | 浏览器抽象（启动/导航/元素/截图/扫码）；**不包含任何平台适配逻辑** |
| Workflow Engine | Runtime | 流程图执行引擎（节点/分支/重试/超时） |
| Scheduler | Runtime | 定时/事件触发，统一调度契约 |
| Plugin Loader | Runtime | Manifest 解析 + 版本/依赖 + 热加载 |
| Permission Sandbox | Runtime | 权限强制（声明→授权→执行时闸门）+ 资源隔离 |
| Local Execution | Runtime | 本地实例宿主（进程/线程/资源配额） |

### 4.2 Application（应用层）—— 领域私有

| 能力 | 归属 | 理由 |
|------|------|------|
| 新媒体平台适配（登录状态机/平台适配器/探针） | Application | 领域语义（平台兼容逻辑），且不跨应用复用 |
| 内容管理/日历/基础发布/数据视图 | Application | 新媒体业务语义 |
| 招聘匹配/简历解析算法 | Application | 领域算法，强耦合招聘域 |
| 导演状态机/叙事约束/镜头语法 | Application | 创作语义，强耦合短剧域 |
| 法条/合同/案件模型 | Application | 法律领域私有 |
| 商品/订单/分销模型 | Application | 商城领域私有 |
| 领域提示词库（默认） | Application | 随应用分发的领域知识 |
| 应用 UI/路由/菜单 | Application | 通过 Adapter mountRoutes 挂载 |

### 4.3 Plugin（插件层）—— 跨应用可售

| 能力 | 归属 | 示例 |
|------|------|------|
| AI员工（Agent 模板 + Prompt + 工具绑定） | Plugin | AI内容运营经理 / AI招聘顾问 / AI导演 |
| 领域 Tool | Plugin | 爆款分析器 / 简历解析器 / 合同审查器 |
| 领域 Workflow | Plugin | 选题→发布→复盘流水线 / 招聘筛选流水线 |
| 领域能力增强（挂载到应用挂载点） | Plugin | 数据分析增强（media.analytics） |
| 开发者自研领域插件 | Plugin | 第三方 AI 员工 |

### 4.4 Workspace（工作区）—— 用户空间

| 数据 | 归属 | 说明 |
|------|------|------|
| 用户数据/文档/资产 | Workspace | UnifiedAsset 挂载，namespace 隔离 |
| 应用配置/偏好 | Workspace | 应用级配置（随应用，跨设备同步） |
| 插件数据 | Workspace | 插件命名空间（卸载可迁） |
| 会话/上下文历史 | Workspace | 会话记录 |
| 凭证（本地） | Workspace 安全区 | Credential Vault（加密存储，仅本机可解） |

### 4.5 Cloud Platform（云端，不在本地 Runtime）

| 服务 | 归属 | 说明 |
|------|------|------|
| Identity / 登录 | 云端 | 用户身份 SSOT |
| 订阅 / License | 云端 | 授权中心（Active/Expired/Suspended） |
| Billing / Commerce | 云端 | 支付、分账、钱包 |
| Application / Plugin Registry | 云端 | 市场目录、版本、更新 |
| Developer Center | 云端 | 开发者注册、插件管理、审核 |
| 审计 / 遥测 | 云端 | 合规审计、使用统计 |

---

## 五、关键边界裁决（易错点）

| 争论点 | 裁决 | 理由 |
|--------|------|------|
| 浏览器控制（Browser Control）在哪？ | **Runtime** | 无领域语义的通用抽象；平台适配在 Application |
| 登录状态机在哪？ | **Application** | 每个平台的登录是领域知识，绝不进内核 |
| 「自动选题」是应用还是插件？ | **插件**（AI内容运营经理） | 可跨应用售卖、独立订阅 |
| 「基础发布」是应用还是插件？ | **应用免费能力** | 账号/内容/基础发布是 Kunlun Media 免费底包 |
| 「多平台分发」是应用还是插件？ | **插件**（审核后发行） | 增值能力，订阅制 |
| 现有 enterprise/channel 代码去哪？ | 拆两半：**浏览器抽象→Runtime；平台适配/状态机→Application** | 内核拿走通用，应用留下领域 |
| HermesProfileBinding 去哪？ | **Plugin 载体**（AI员工=插件实例化） | 已是插件化雏形，升级为 Plugin Loader 产物 |
| 导演状态机拆不拆？ | **不拆**，整体归 Application | 重创作语义，保守留私有 |
| 记忆数据存哪？ | **Workspace**（Memory API 只提供访问） | 数据与代码分离，用户可导出/删除 |

---

## 六、边界违例自查清单（评审用）

- [ ] 内核模块是否出现平台名（douyin/kuaishou/xhs）？→ 违例，必须下沉 Application
- [ ] 应用代码是否直连 prisma/平台 API？→ 违例，必须经 Adapter Capability
- [ ] 插件是否访问应用私有实现（非公开 API）？→ 违例，审核拦截
- [ ] 是否有一个能力既在 A 应用又在 B 应用重复实现？→ 该能力应升 Plugin 或降 Runtime
- [ ] 插件代码是否包含完整业务闭环？→ 违例，插件只增强，不替代应用

---

## 七、冻结结论

1. **四层归属已冻结**：Runtime 无领域语义、Application 领域私有、Plugin 跨应用可售、Workspace 用户空间、Platform 永远云端。
2. **新媒体拆分路径明确**：浏览器抽象进 Runtime，平台适配/状态机留 Application，AI员工全部插件化。
3. **内核纯净度是生态健康的第一指标**——任何领域逻辑混入内核，本文件即为违例判据。
4. 本文件是 Task B（Kunlun Media Blueprint）与 Task C（Plugin SDK）的边界基准。
