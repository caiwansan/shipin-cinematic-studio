# PLUGIN-SDK-DESIGN.md

> **昆仑镜 AI 应用生态平台 — Phase 0.5 Task C：Plugin SDK Design**
> 版本：V1.0 | 类型：SDK 设计（只读，不实施） | 日期：2026-08-03
> 核心：开发者不开发完整软件，开发 **Agent Plugin / Workflow Plugin / Tool Plugin**，运行在 KAOR 之上

---

## 一、插件类型（冻结）

| 类型 | 定义 | 载体 | 示例 |
|------|------|------|------|
| **Agent Plugin（AI员工）** | 带生命周期/记忆/工具绑定的智能体模板 | Agent 模板 + Prompt + Tool 绑定 | AI内容运营经理、AI招聘顾问 |
| **Workflow Plugin** | 可编排的领域流程 | 流程图定义（节点/分支/人工确认） | 选题→发布→复盘流水线 |
| **Tool Plugin** | 单一能力封装 | 函数 + Schema | 爆款分析器、简历解析器 |

一个插件可混合：Agent 插件内可携带私有 Tool 与 Workflow。

---

## 二、Manifest 规范（plugin.json）

```json
{
  "id": "kunlun.media.operations-manager",
  "name": "AI内容运营经理",
  "version": "1.2.0",
  "type": "agent",
  "icon": "asset://icon.png",
  "runtime": {
    "kaor": ">=0.9.0",
    "minAppVersion": "1.0.0"
  },
  "permissions": [
    { "resource": "kunlun-media:analytics.read", "reason": "读取账号数据用于选题分析" },
    { "resource": "kunlun-media:content.create", "reason": "创建内容草稿" },
    { "resource": "memory:read", "scope": "kunlun.media.operations-manager" },
    { "resource": "model:chat", "models": ["gpt-4o", "deepseek-v3"], "reason": "AI 分析与生成" }
  ],
  "mountPoints": ["media.analytics", "media.calendar"],
  "capabilities": [
    {
      "id": "topic.analyze",
      "type": "tool",
      "input": { "keywords": "string[]", "platform": "string" },
      "output": { "topics": "Topic[]", "heatScore": "number" }
    }
  ],
  "billing": {
    "sku": "kunlun_media_operations_manager_monthly",
    "price": 599,
    "currency": "CNY",
    "period": "month",
    "trialDays": 7
  },
  "entry": {
    "agent": "./agent.ts",
    "tools": ["./tools/*.ts"],
    "workflows": ["./workflows/*.json"]
  }
}
```

**Manifest 校验**（开发者中心强制）：id 命名空间唯一 / 权限最小化声明 / 能力 Schema 合法 / 计费 SKU 与商城一致。

---

## 三、Runtime API（KAOR SDK）

```typescript
import { KAOR } from '@kunlun/kaor-sdk';

// 1. Agent 生命周期
const agent = await KAOR.agent.create({
  template: './agent.ts',
  memory: { namespace: 'kunlun.media.operations-manager' },
  tools: ['topic.analyze', 'kunlun-media:content.create'],
});
await agent.start(); await agent.pause(); await agent.destroy();

// 2. Memory（命名空间隔离）
await KAOR.memory.set('plan.2026w32', plan, { namespace: agent.id });
const plan = await KAOR.memory.get('plan.2026w32', { namespace: agent.id });

// 3. Tool Calling（应用能力经 CapabilityRegistry）
const topics = await KAOR.capability.invoke('kunlun-media:analytics.read', {
  platform: 'douyin', period: '7d',
});

// 4. Browser（本地浏览器控制，Runtime 抽象）
await KAOR.browser.navigate('https://cp.kuaishou.com');
const fans = await KAOR.browser.evaluate(selector, extractor);

// 5. Workflow（流程编排）
const wf = await KAOR.workflow.load('./workflows/publish-pipeline.json');
const run = await wf.start({ contentId: 'c_123', platforms: ['douyin', 'kuaishou'] });

// 6. Scheduler（定时触发）
await KAOR.scheduler.cron('0 9 * * *', async () => { /* 每日选题 */ });

// 7. 事件
KAOR.events.on('content.published', (e) => { /* 复盘触发 */ });

// 8. 日志/遥测（审计上云）
KAOR.log.info('plan generated', { durationMs });
```

**SDK 三原则**：
1. 插件只能通过 SDK 触达能力，禁止直接 import 应用/内核内部模块（审核强制）。
2. 所有敏感调用（凭证/发布/删除）返回 `PermissionDenied` 而非绕过。
3. SDK 版本与 KAOR 运行时强绑定，Manifest 声明兼容区间。

---

## 四、权限模型（声明 → 授权 → 闸门）

```
① 声明（Manifest）  开发者声明所需资源 + 理由
② 授权（安装时）    用户看到权限清单，逐项同意/拒绝（可后改）
③ 闸门（运行时）    Permission Sandbox 执行时校验
④ 审计（全程）      敏感调用上送云端审计
```

| 权限资源 | 说明 |
|---------|------|
| `kunlun-media:analytics.read` | 读账号数据（应用挂载点能力） |
| `kunlun-media:content.create/update/delete` | 内容操作（delete 必须单独授权） |
| `kunlun-media:publish` | 发布（最高敏感级，每次执行需人工确认） |
| `browser:control` | 浏览器控制（限定域白名单） |
| `credential:read` | 凭证读取（默认禁止，仅系统插件可申请） |
| `memory:read/write` | 记忆读写（限 namespace 作用域） |
| `model:chat` | 模型调用（限定模型清单） |
| `file:read/write` | 本地文件（限定目录） |
| `network:request` | 外呼（限域白名单） |

**默认拒绝原则**：未声明即禁止；越权调用 → 插件 Suspended + 开发者警告。

---

## 五、Billing 集成

```typescript
// 插件内订阅状态查询（只读）
const status = await KAOR.license.check('kunlun.media.operations-manager');
// → { state: 'active' | 'expired' | 'suspended' | 'trial', expiresAt }

// 触发购买（拉起商城支付页）
await KAOR.license.purchase('kunlun.media.operations-manager');

// 事件
KAOR.license.on('state-change', ({ pluginId, from, to }) => {
  if (to === 'expired') { /* 优雅降级：停 AI 任务，保留数据 */ }
});
```

**规则**：
- 插件代码不做支付逻辑——只查 License 状态、触发购买、响应状态事件。
- 过期/挂起时插件必须优雅降级（能力暂停、数据保留、UI 提示续费），禁止静默失败。
- License 判定以 License Server 为准，本地缓存仅离线宽限（7 天）。

---

## 六、Testing（开发/审核双轨）

### 6.1 开发者本地测试

```
@kunlun/kaor-sdk dev
  ├─ kaor dev .          ← 本地起沙箱运行插件（模拟器）
  ├─ kaor test .         ← 单元测试（Vitest + 断言工具）
  ├─ kaor perm .         ← 权限静态扫描（未声明资源/越权调用）
  ├─ kaor bundle .       ← 打包（签名 + 完整性校验）
  └─ kaor publish .      ← 上传开发者中心
```

### 6.2 平台审核流水线（开发者中心）

```
上传 → 自动扫描（权限/恶意模式/依赖漏洞/大小）
     → 沙箱运行测试（模拟场景 + 边界输入）
     → 人工审核（功能符合性 + 数据合规 + 计费一致性）
     → 灰度发布（白名单用户）
     → 全量上架
```

---

## 七、Publish 流程

```
kaor bundle → 开发者中心上传
  → 自动扫描 ✅/❌
  → 人工审核 ✅/❌（附修改意见）
  → 灰度（可选）
  → 上架商城（显示定价/权限/更新日志）
  → 版本更新（same 流程，增量发布）
  → 下架/召回（安全事件时强制）
```

---

## 八、示例：AI内容运营经理（完整插件骨架）

```
kunlun.media.operations-manager/
├── plugin.json              # Manifest（见第二节）
├── agent.ts                 # Agent 定义
├── tools/
│   ├── topic-analyzer.ts    # 爆款选题分析（调 analytics.read）
│   ├── title-generator.ts   # 标题生成（model:chat）
│   └── content-planner.ts   # 内容计划（memory + calendar 挂载点）
├── workflows/
│   └── weekly-plan.json     # 每周计划流水线（人工确认节点）
├── assets/icon.png
└── tests/
    ├── topic-analyzer.test.ts
    └── permission.test.ts   # 越权调用防护测试
```

```typescript
// agent.ts 核心（AI内容运营经理）
import { KAOR } from '@kunlun/kaor-sdk';

export default KAOR.agent({
  id: 'operations-manager',
  role: '内容运营经理',
  prompt: `
    你是资深新媒体内容运营经理。
    职责：每日分析爆款 → 生成选题 → 产出标题 → 制定发布计划。
    原则：所有内容必须经用户人工确认后才能创建/发布。
  `,
  tools: ['topic-analyzer', 'title-generator', 'content-planner'],
  schedule: { cron: '0 9 * * *', task: 'daily-plan' },
  permissions: { /* 与 Manifest 一致，运行时闸门兜底 */ },
  onExpired: () => { /* 停任务、保留计划数据、提示续费 */ },
});
```

---

## 九、SDK 冻结结论

1. **三类插件**（Agent/Workflow/Tool）+ 统一 Manifest 是开发者入口的唯一契约。
2. **权限模型三层**（声明/授权/闸门）+ 默认拒绝，是生态安全的底线。
3. **计费零侵入**：插件只查 License、触发购买、响应状态，支付/分账全在云端。
4. **双轨测试**：本地 `kaor dev/test/perm` + 平台审核流水线，保证质量门槛。
5. 本文件与 KAOR-BOUNDARY-DESIGN 共同构成开发者 SDK 的边界基准。
