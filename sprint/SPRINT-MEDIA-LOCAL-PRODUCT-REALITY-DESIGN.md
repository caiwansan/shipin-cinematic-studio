# SPRINT-MEDIA-LOCAL-PRODUCT-REALITY-DESIGN.md

> **只读产品审计 + 流程设计**（掌柜 2026-08-04 指令：先设计，过 Reality Gate 再拆开发 Sprint）
> 状态：📋 设计评审待掌柜验收 | 范围：Kunlun Media.exe + AI内容运营经理 + Channel Adapter + Browser Runtime + 真实运营流程

---

## 0. 掌柜战略定位（原文要点）

> 「ECO-01～ECO-10 完成的是生态商业结构；ECO-11.2～11.3 完成的是生态运行形态。昆仑镜已从 AI工具平台 跨越到 AI应用生态操作系统雏形。」
> 「现在最大的风险已经不是技术。剩下的问题是：**用户是否愿意用 AI员工解决真实新媒体运营问题**。」
> 「下一步重点应该从『造生态』转向『证明第一个生态商品能卖、能用、能续费』。」

**本 Sprint 不是开发 Sprint** —— 是 Kunlun Media 产品 Reality Gate 的设计阶段：
审计现状（诚实盘货）→ 设计真实运营流程 → 定义验收标准 → 掌柜拍板后才拆开发任务。

---

## 1. 现状诚实盘点（只读审计，2026-08-04）

### 1.1 已成立（证据充分，无需重造）

| 层 | 现状 | 证据 |
|---|---|---|
| **Kunlun Desktop**（Tauri 壳） | 登录/设备注册/我的应用/插件授权/本地运行时卡片 | ECO-11.3 G1-G7 36/36 |
| **Local Runtime** | 插件生命周期 + 心跳 + 版本 | `ecology_local_plugin_runtime` |
| **License System** | grant/check/renew/expire/suspend/restore + 设备绑定 + 双端一致 | ECO-11.3 G3/G4/G7 |
| **Channel Adapter**（四平台） | connect/wait-for-login/confirm-binding/refresh-credential/health + 平台 registry | `enterprise-channel-runtime.ts` G6 链路 |
| **Browser Runtime** | 持久化 profile + 身份持久化 + HealthGuard + 退出登录清环境 | `browser-workspace.routes.ts` + 真机验证 |
| **Metrics 提取器** | 快手/小红书/视频号配置驱动 + 数据页 URL 判定（防假指标） | `browser-metrics.extractor.ts` |
| **AI 员工** | AgentInstance + 任务执行 + 身份绑定数字电脑 | `agent-identity.ts` `/instances/:id/task` |

### 1.2 已知缺口（诚实标注，不假装成功）

| 缺口 | 现状 | 影响 |
|---|---|---|
| **四平台真机登录态** | 快手当前会话已失效（数据中心 IP 被风控）；抖音/小红书/视频号需掌柜真机扫码确认 | Task02 前置 |
| **AI 员工真实内容产出链路** | 任务执行框架存在，但「新媒体内容运营」场景（选题→标题→文案→评论策略→发布计划）**无专属流程/模板** | Task03 核心 |
| **发布执行** | 冻结（掌柜：自动发布不做）——MVP = 生成计划，人工确认执行 | 设计约束 |
| **插件订阅支付** | License 全链路通，但无真实支付入口（掌柜冻结商城 UI） | Task04 用模拟/手动 grant 验证 |
| **Desktop → 线上上下文** | `?plugin=` 入口已做，但「桌面启动插件 → 进入新媒体工作台」的完整 UX 未真机走通 | Task01 |

### 1.3 现有代码资产映射（不新造架构）

```
Kunlun Desktop.exe（desktop/ui/index.html）
   │  open_workspace（域名白名单 + ?plugin= 上下文）
   ▼
新媒体工作台（线上 nuxt-frontend /workspace/media）—— Application Layer
   │
   ├─ Channel Adapter（enterprise-channel-runtime.ts：connect/wait-for-login/confirm-binding）
   │      └─ Browser Runtime（browser-workspace：持久化 profile + HealthGuard）
   │             └─ Platform Account（抖音/快手/小红书/视频号真实扫码）
   │
   ├─ Metrics（channel-metrics.routes.ts：collect/latest/history/analyze + extractor）
   │
   └─ AI 员工（agent-identity：AgentInstance → /instances/:id/task）
          └─ AI内容运营经理（ai-content-ops-manager 插件，License 599/年）
```

---

## 2. 目标用户路径（Product Reality Gate 要证明的事）

### 2.1 一句话产品定义

> **一个新媒体从业者，买了一台「装了 Kunlun Media.exe 的 Windows 电脑」，登录后拥有一个 AI 内容运营经理 + 四平台账号数字电脑；他每天做的事：给 AI 员工派任务 → AI 员工基于真实账号数据生成内容方案 → 他确认 → 发布。**

### 2.2 完整用户旅程（从购买到续费）

```
[买] 获取安装包 → 安装 Kunlun Media.exe（WebView2 自动装）
[装] 注册设备 → 登录账号 → 我的应用（kunlun-media）
[订] 购买 AI内容运营经理（License 599/年）→ 安装插件 → 启动本地运行时
[绑] 新媒体工作台 → 抖音/快手/小红书/视频号 扫码 → 数字电脑在线
[用] 给 AI 员工派任务（今天发布新能源汽车短视频）
     → 生成选题/标题/文案/评论回复策略/发布计划
     → 人工确认 → （人工）发布
[续] 订阅到期 → 插件停止（应用继续可用）→ 续费 → 恢复
```

### 2.3 关键成功指标（Reality Gate 验收）

| # | 指标 | 目标 | 验证方式 |
|---|---|---|---|
| K1 | 安装→登录→插件启动 | ≤ 10 步 / ≤ 5 分钟 | 掌柜 Windows 真机走查 |
| K2 | 四平台扫码登录 | 4/4 平台账号真实在线 | G6 真机扫码 |
| K3 | AI 任务真实产出 | 1 个任务 → 完整内容方案（选题/标题/文案/评论策略/发布计划） | 端到端任务执行 |
| K4 | 产出基于真实数据 | 内容方案引用账号真实指标（粉丝/近7日数据）或如实 unavailable | extractor 诚实链路 |
| K5 | 订阅闭环 | 过期停用 → 续费恢复（SaaS 体验） | Task04 全流程 |
| K6 | 卸载重装 | 数据保留、License 恢复 | Task01 真机 |

---

## 3. 流程设计（Task03 核心：AI 内容运营经理真实任务）

### 3.1 任务输入（用户侧）

```
POST /instances/:id/task
{
  "type": "media-content-plan",
  "input": {
    "brief": "今天发布新能源汽车短视频",
    "platform": ["douyin", "kuaishou"],   // 可选，默认全部已绑定平台
    "accountIds": ["..."],                 // 数字电脑
    "constraints": { "style": "专业评测", "duration": "60s", "timeRange": "18:00-20:00" }
  }
}
```

### 3.2 AI 员工执行链（Hermes 编排，五段产出）

```
1. 盘点（真实数据门）: 读绑定账号 metrics（粉丝/近7日/爆款）→ 无数据则如实标注 unavailable
2. 选题: 基于盘点 + brief → 3 个选题方向（每个含理由）
3. 标题: 每选题 3 条标题（钩子/情绪/悬念三型）
4. 文案: 主文案（口播稿或图文稿）+ 分镜/段落建议
5. 策略: 评论回复策略（预判问题+回复话术）+ 发布计划（时间/平台差异化）
→ 产出 = 结构化方案（JSON + 人读版本），状态 = awaiting_confirmation（绝不自动发布）
```

### 3.3 人机确认闭环（冻结：不自动发布）

```
方案生成 → 工作台展示 → 掌柜/用户确认/修改 → 人工执行发布
AI 员工角色 = 策划 + 文案 + 策略军师，发布永远人工
```

### 3.4 数据来源分级（诚实原则，防假数据）

| 数据 | 来源 | 不可用时的行为 |
|---|---|---|
| 账号身份 | identitySnapshot（SSOT） | 如实展示「未验证」 |
| 粉丝/指标 | extractor 真实读取（数据页 URL 判定） | unavailable + reason，绝不 0/假值 |
| 历史内容 | extractor 扩展（后续 Sprint） | 本期不做，方案基于指标+通用知识 |
| 行业趋势 | 通用知识（无外部 API） | 方案标注「基于通用知识，非实时趋势」 |

---

## 4. Task 拆分建议（掌柜拍板后拆 Sprint）

### Task01 — Kunlun Media 真机验收（Windows）
- 安装/登录/设备绑定/插件启动/退出/升级/卸载/重装数据保留
- 桌面插件卡片 → 打开工作台完整 UX 走查
- **交付：真机走查记录 + 问题清单**（开发量≈0，纯验收）

### Task02 — 新媒体账号真实闭环恢复（Media Application Layer）
- 四平台真机扫码（掌柜账号）→ 数字电脑在线 → 指标真实读取
- 复用现有 Channel Adapter / Browser Runtime / extractor，**不重写**
- 只修真机暴露的问题（如快手风控恢复、扫码确认窗）
- **交付：四平台在线 + 真实指标快照**

### Task03 — AI内容运营经理真实任务
- 新增 `media-content-plan` 任务类型（Hermes 编排五段产出）
- AI 员工绑定数字电脑 → 读取真实指标 → 生成方案 → awaiting_confirmation
- **交付：端到端任务执行 + 结构化方案展示**（这是本 Sprint 的「商业价值证明」）

### Task04 — 插件订阅体验全流程
- 模拟 SaaS 生命周期：购买（手动 grant 模拟）→ 安装 → 使用 → 过期 → 插件停止 → 续费 → 恢复
- 桌面端过期体验（应用继续开、插件灰态、续费引导）
- **交付：完整订阅旅程演示脚本**

---

## 5. Reality Gate 验收标准（本设计文档的 Gate）

| 项 | 标准 |
|---|---|
| 审计诚实性 | 现状盘点无夸大；缺口全部显式标注 |
| 流程可行性 | Task03 五段产出可被现有 Hermes/agent-identity 承载（无新架构） |
| 冻结遵守 | 无自动发布/无新平台/无商城/无第三方插件 |
| 商业闭环 | K1-K6 定义清晰可测 |

**掌柜验收本设计文档后 → 拆为开发 Sprint（建议顺序 Task01 → Task02 → Task03 → Task04，Task03 为价值核心）。**

---

## 6. 风险清单（诚实）

| 风险 | 等级 | 缓解 |
|---|---|---|
| 快手/抖音风控变化导致真机登录态不稳 | 高 | 复用 HealthGuard + 如实 unavailable；不承诺「永远在线」 |
| AI 内容产出质量未达商业价值线 | 高 | Task03 先做「方案完整度」验收，质量迭代进后续 Sprint |
| 数据中心 IP 扫码成功率低 | 中 | 掌柜真机（家用网络）验收；不上线前不承诺 |
| 真机验收依赖掌柜时间 | 中 | Task01/02 均为人工步骤，文档化清单压缩掌柜操作成本 |

---

## 7. 冻结清单（本 Sprint 及后续，持续遵守）

❌ 大商城 ❌ 开放开发者注册 ❌ 第三方插件执行 ❌ 本地代码插件
❌ 推广系统 ❌ 钱包提现 ❌ 自动发布 ❌ 新平台扩展
❌ 电商/订单表 ❌ 支付接入（订阅用手动 grant 模拟验证）
⏸ ECO-12 命名暂缓（掌柜指令：先过 Kunlun Media Product Reality Gate）
