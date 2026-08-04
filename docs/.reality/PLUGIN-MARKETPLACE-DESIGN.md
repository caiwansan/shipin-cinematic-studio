# PLUGIN-MARKETPLACE-DESIGN.md

> **昆仑镜 AI 应用生态平台 — Task 05/06 AI 插件商城 + 插件授权商业模型设计**
> 版本：V1.0 | 类型：架构设计（只读，不实施） | 日期：2026-08-03

---

## 一、插件分类体系

### 1.1 三大插件类型

| 类型 | 定义 | 示例 | 运行时载体 |
|------|------|------|-----------|
| **AI员工插件**（agent） | 可安装的 AI 角色/岗位 | AI新媒体运营经理、AI招聘顾问、AI导演、AI客服 | Hermes Runtime（Agent 实例） |
| **Tool插件**（tool） | 单项能力工具 | 数据分析、SEO分析、视频分析、舆情监测 | Hermes 工具注册表 |
| **Workflow插件**（workflow） | 预置流程模板 | 爆款视频生产流程、账号冷启动流程 | Workflow Engine |

### 1.2 组合规则

- AI员工插件可**声明依赖** Tool 插件与 Workflow 插件（安装时自动携带）。
- Workflow 插件可引用 Tool 插件节点。
- 应用（工作台）可内置插件组合——**新媒体应用 = 应用 + 内置 AI员工插件 + 内置 Tool 插件**，示范「应用内插件」形态。

---

## 二、Plugin Manifest（插件清单，核心契约）

```json
{
  "id": "media-manager",
  "name": "AI新媒体运营经理",
  "type": "agent",
  "version": "1.0.0",
  "author": "dev-org-xxx",
  "description": "负责账号内容规划、发布排期与数据复盘",
  "permissions": ["browser", "content", "analytics", "scheduler"],
  "requires": {
    "platformMinVersion": "1.2.0",
    "plugins": ["data-analytics@>=1.0"],
    "models": ["llm:gpt-4o", "llm:doubao-pro"]
  },
  "runtime": {
    "memoryNamespace": "plugin/media-manager",
    "toolAllowList": ["browser.control", "content.publish", "analytics.read"],
    "soul": "soul/media-manager.md"
  },
  "subscription": {
    "monthly": 299,
    "quarterly": 797,
    "yearly": 2870,
    "trialDays": 7,
    "perSeat": true
  },
  "pricing": { "revenueShare": { "developer": 0.50, "ecosystem": 0.36, "platform": 0.14 } }
}
```

**Manifest 三读**：平台读（权限/版本/依赖校验）、运行时读（工具白名单/记忆命名空间）、商城读（定价/展示）。

---

## 三、插件生命周期

```
开发（开发者中心）
  ↓
上传（Manifest + 包体）
  ↓
测试环境（沙箱自测）
  ↓
提交审核（自动化扫描 + 人工审核）
  ↓
线上灰度（白名单租户试用）
  ↓
真实用户验证（Reality Gate：安装/运行/计费/审计全链路）
  ↓
商城发布（可见可购）
  ↓
版本迭代（同上循环） / 下架（安全问题/违规）
```

**强制原则（掌柜）**：未经验证插件禁止进入商城。灰度期数据 = 真实安装 + 真实运行 + 真实计费，缺一不可。

---

## 四、商城核心实体

```
Plugin              插件元数据（id/manifest/status/rating）
PluginVersion       版本（包体+manifest 快照+审核状态）
PluginInstall       安装（tenant/org/user + plugin + version + config）
PluginSubscription  订阅（installId + 周期 + 状态 + 续费/取消）
License             授权（licenseKey + 设备数 + 有效期 + 范围）
RevenueRecord       收入流水（订单/订阅周期收入 + 分成快照）
DeveloperWallet     开发者钱包（可提现余额 + 流水）
Settlement          结算（周期结算单 + 状态）
```

---

## 五、商业模型（订阅制 + 分账）

### 5.1 原则（掌柜定调 + 技术总监确认）

- **插件禁止一次性买断，全部订阅制；插件必须在线授权，到期必须续订（防永久破解）。**
- 收入必须来自**真实插件订阅收入（真实 GMV）**，禁止拉人头奖励。
- 推广采用 **SaaS Affiliate + Partner Revenue Share** 模式，**明确禁止 MLM**（无招募奖励/无入门费/无团队人数奖励/无层级计酬）。

### 5.2 分账模型

```
插件订阅收入
      │
      ├── 开发者         50%
      ├── 市场生态       最高 36%（推广伙伴佣金池）
      └── 昆仑镜平台     10% ~ 40%（区间取决于生态伙伴等级/结算通道费）
```

| 场景 | 开发者 | 市场生态 | 平台 |
|------|--------|---------|------|
| 无推广伙伴（自然流量） | 50% | 0% | 50% |
| 有推广伙伴（普通级） | 50% | 10% | 40% |
| 有推广伙伴（省级/合伙人） | 50% | 36% | 14% |

- 平台分成区间 10%-40%：**渠道成本（支付通道/税/服务器）由平台承担**，生态伙伴等级越高平台让利越多（换取增长）。
- 分成以**实收订阅金额**计算（扣除退款/拒付），非标价。

### 5.3 订阅生命周期

```
免费试用(7天) → 订阅激活 → 周期扣费（月/季/年）
  → 续费成功 / 扣费失败（宽限期3天→暂停） → 取消订阅（到期失效）
```

- **停订阅 = 停能力**：License 吊销 → Hermes 运行时权限闸门关闭 → 插件实例暂停（数据保留 N 天）。
- 企业订阅（EnterpriseSubscription）与个人订阅（PersonalEntitlement）复用现有模型扩展。

### 5.4 定价示例（新媒体首发插件）

| 插件 | 定价 | 价值 |
|------|------|------|
| AI爆款分析师 | ¥299/月 | 爆款拆解/趋势分析 |
| AI内容运营经理 | ¥599/月 | 自动选题/标题/热点/计划 |
| AI短视频导演 | ¥399/月 | 脚本/分镜/剪辑方案 |
| AI评论运营 | ¥299/月 | 评论分析/用户画像/互动回复 |
| AI矩阵运营团队 | ¥1,999/月 | 多 Agent（运营经理+数据分析师+文案专家+增长专家） |

> 定价为示意，最终以商城运营策略为准。

---

## 六、开发者收益流程

```
用户订阅付费
  ↓
PaymentOrder 实收
  ↓
RevenueRecord（按分成比例拆账，快照时点汇率/比例）
  ↓
DeveloperWallet 入账（可提现余额）
  ↓
提现申请 → Settlement 结算单 → 审核 → 打款（月度）
```

**信任机制**：分成比例在 Manifest 声明 + 平台结算单可核对（开发者可查每笔 RevenueRecord 明细）。

---

## 八、安全与合规

| 项 | 机制 |
|----|------|
| 插件包审核 | 静态扫描（权限滥用/危险调用）+ 沙箱试运行 + 人工抽查 |
| 权限最小化 | Manifest 声明制，超权限拒绝安装 |
| 数据隔离 | 插件命名空间隔离（记忆/资产/凭证） |
| 退款 | 7 天无理由（未使用额度）+ 争议仲裁 |
| 合规 | 插件开发者实名/企业认证；违规插件下架 + 分成冻结 |
