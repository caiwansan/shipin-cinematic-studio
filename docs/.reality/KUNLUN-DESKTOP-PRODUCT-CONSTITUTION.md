# KUNLUN-DESKTOP-PRODUCT-CONSTITUTION.md

> S4.0 Desktop Product Reality Freeze — 商品化入口宪法（只写架构与验收标准, 不写代码）
> 日期: 2026-08-06 09:00 (CST) | 状态: ✅ **FROZEN（文档级）**
> 依据: 掌柜 S4 裁决（AI OS 商品化收敛阶段）/ S3.4 Final Reality（员工运行能力成立）/ S1.2 Final Archive / 宪法 C1-C6 / Phase 0 产品规格
> 定位: **恢复 Desktop 作为 AI 应用平台商品入口的正确定位——证明「昆仑镜作为 AI 应用平台商品」成立**

---

## 0. 前置事实（S3.4 已证明）

```
✅ AI Employee Runtime 成立: Alice 可部署/可授权/可审计/可交付业务结果
✅ 员工运行能力 = 商品前提已满足
⛔ 商品缺口: 用户如何购买 / 在哪里发现 / 如何启动 / 如何授权 / 如何获得结果
→ S4.0 冻结 Desktop 在这五问中的位置与验收标准
```

## 1. Desktop 定位（冻结）

### 不是
```
❌ AI Agent 客户端
❌ OpenClaw 外壳
❌ 聊天窗口
❌ 承载 Hermes Runtime
❌ 实现 AI Employee 业务逻辑
```

### 是
```
昆仑镜 Desktop = AI Application Platform Client
  包含: Application Center / Workspace Entry / Plugin Enhancement / AI Employee Marketplace 入口（未来）
```

### 分层架构（保持三层宪法）
```
Cloud Control Plane（身份/商业/治理/规划）
  ↓
Desktop Experience Layer（入口/状态/展示/生命周期管理）
  ↓
Workspace/Application Layer（业务入口: 招聘/新媒体/短剧工作台）
  ↓
Hermes AI Employee Runtime Plane（唯一执行者）
  ↓
Skill / Tool / Provider
```

### Desktop 职责边界（S1.2 冻结延续）
```
✅ Desktop: 安装 / 展示 / 生命周期管理 / 状态呈现 / 商品入口
❌ Desktop: Agent 调度 / AI 执行 / Tool 调用 / 商业权限（执行权外移 Hermes, 决策权外移 Cloud）
```

## 2. Workspace 模型（冻结）

```
Workspace = 业务入口（岗位工作台）
  - 招聘工作台 / 新媒体工作台 / 短剧工作台 …
生命周期: 创建 → 进入 → 任务执行 → 资产归属 → 退出（Phase 0 UX/WORKFLOW 规格延续）
资产: 员工产出（报告/数据）归属 Workspace 资产空间（复用 Asset/UserAsset, 零新系统）
禁止: Workspace 复制 Runtime 能力 / 直接调用 AI / 持有 Key（数据流必须经 Hermes）
```

## 3. AI Employee 商品模型（冻结）

### 商品定义
```
AI Employee 商品 = 岗位能力（购买一个员工 = 购买一个岗位能力, 不是购买一个页面）
商品化五要素（S4.2 验证链）:
  Capability    = AgentDefinition（能力声明, F1）
  License       = EcologyLicense（org+plugin 授权, SSOT）
  Entitlement   = 授权判定（S3.2.2, Enterprise/PersonalEntitlement 表启用属 S4.2 决策）
  Usage         = InvocationLog + KernelEvent（用量与审计底座, 已真实）
  Billing       = 订阅模型（产品假设, 待验证）
```

### 商业模型假设（作为产品假设继续验证, 非冻结承诺）
```
Basic        299/月   1 AI Employee
Professional 999/月   3 AI Employee
Enterprise  2999/月  10 AI Employee
验证条件: 一个企业真实购买 → 员工真实完成岗位任务 → 续费意愿
```

### 员工商品生命周期（企业视角）
```
发现（岗位化入口）→ 购买（License）→ 授权（Entitlement）→ 启动（Desktop 入口）
→ 工作（Hermes 执行）→ 交付（Workspace 资产）→ 审计（KernelEvent）
```

## 4. Plugin 边界（冻结, S2 延续）

```
Plugin = 能力入口封装（Application+Extension+Skill 混合模型, 非执行者）
Plugin 生命周期 = 入口 + 授权（非安装, S2 冻结）
Skill Extension: Plugin manifest 可引用/组合 Skill —— 不复制能力定义（F1: AgentDefinition.capabilities 唯一）
Plugin ↔ AI Employee: 入口关系（员工岗位能力经 Plugin 入口暴露, 执行仍归 Hermes）
禁止: Plugin 直接执行 / Plugin 持有 LLM Key / Plugin 定义第二份能力
```

## 5. 商品入口验收标准（S4.3 Desktop Release Gate 前置, 冻结）

| # | 关卡 | 验收标准 |
|---|---|---|
| DP1 | 岗位化入口 | 用户首启看到「我要一个招聘员工 / 新媒体运营员工 / 短剧导演」, 而非技能管理后台 |
| DP2 | 员工启动闭环 | 点击员工 → Desktop 发起 → Cloud 校验（License/Entitlement）→ Hermes 就绪 → 可下任务 |
| DP3 | 授权可见 | 员工卡片/详情展示授权状态（License ACTIVE/EXPIRED; 未授权引导购买） |
| DP4 | 结果可交付 | 员工产出（报告/数据）在 Workspace 资产空间可查看/下载 |
| DP5 | 无 Runtime 越界 | Desktop 侧零 AI 执行/零 Key/零直接 Tool 调用（grep 断言） |
| DP6 | 身份一致 | Desktop 会话 ↔ Cloud 身份 ↔ 员工授权 三者一致（G8） |

## 6. 与后续阶段衔接（S4 路线）

```
S4.0 本文档（入口宪法冻结）      ← 本阶段, 不写代码
S4.1 BYOK Reality               Tenant → Provider Credential → Runtime Resolver → Hermes（企业自持 Key）
S4.2 Alice Commercial Reality    Capability + License + Entitlement + Usage + Billing 闭环
S4.3 Desktop Release Gate        应用中心 / Workspace 入口 / AI Employee 入口（DP1-DP6）
D-F（P1/P2 间小任务）: Interview Record Adapter（Manual Input → Adapter → Hermes Skill; 禁自动联系/三方/爬取）
```

## 7. 禁止范围（S4.0）

- ❌ 不写代码 / 不改 Desktop / 不做 UI / 不建表
- ❌ 不引入: 模型市场 / 自动采购 / Key 托管 / 自动联系候选人 / 三方招聘 / 爬取
- ✅ 本阶段唯一产出: 本文档（架构 + 验收标准冻结）

## 8. 结论

```
S4.0: ✅ Desktop 商品入口宪法冻结
下一步: 掌柜批准 → S4.1 BYOK Reality（企业自持 Key 的真实路由与审计）
```

## 冻结仪式

```
✅ 本文档为 Desktop 商品化唯一事实基线（只提交 docs）
🔒 S4.3 任何 UI/功能开发必须对照 DP1-DP6 验收; 冲突改动需掌柜批准
```
