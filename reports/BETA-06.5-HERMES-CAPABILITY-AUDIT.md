# BETA-06.5 Hermes Capability Audit

> 审计日期：2026-07-18
> 目标：验证 Hermes Browser Agent 是否具备真实新媒体运营能力
> 
> **注意**：本审计基于代码审查 + 环境验证。关键发现：Puppeteer 未安装，Browser Agent 不存在。

---

## 审计范围

 Hermes Browser Agent 是否真的能够替代一个新媒体运营员工？

---

## 1. 登录能力

### 当前状态：⚠️ 部分

| 能力 | 状态 | 说明 |
|------|------|------|
| Cookie 保存 | ❌ 不支持 | 无持久化 Cookie 存储机制 |
| Session 保持 | ❌ 不支持 | 无浏览器会话复用 |
| 二次验证 | ❌ 不支持 | 无 2FA 处理逻辑 |
| 登录失效检测 | ❌ 不支持 | 无 token 过期监控 |
| 人工接管 | ⚠️ 可能 | OpenClaw Browser 支持 Chrome Extension Relay |

### 现有能力

- Puppeteer 可启动 Chrome 实例（`headless: true`）
- OpenClaw Browser Control Server 检测到 Chrome（`/usr/bin/google-chrome`）
- Puppeteer 仅在 PDF 生成场景使用（`screenplay-pdf.service.ts`）

### 差距

需要新增：
- 持久化浏览器 Profile（Cookie 存储）
- 登录状态检测与自动刷新
- 二次验证异常处理（短信/扫码）

---

## 2. 内容发布能力

### 当前状态：❌ 不支持

| 能力 | 状态 | 说明 |
|------|------|------|
| 上传图片 | ❌ | 无文件上传接口 |
| 上传视频 | ❌ | 无视频处理逻辑 |
| 编写文案 | ✅ | LLM 可生成文案（Phase 2 已验证） |
| 添加标签 | ❌ | 无标签选择交互 |
| 定时发布 | ❌ | 无调度系统 |

### 现有能力

- ModelRouter + callLLM 可生成文案内容
- Puppeteer 可进行页面导航和 DOM 操作（基础能力）

### 差距

需要新增：
- 文件上传接口（对接云存储）
- 各平台发布页面 DOM 映射（小红书/抖音/视频号）
- 发布流程自动化（导航 → 填写 → 上传 → 发布）
- 定时任务调度

---

## 3. 互动能力

### 当前状态：❌ 不支持

| 能力 | 状态 | 说明 |
|------|------|------|
| 读取评论 | ❌ | 无评论抓取逻辑 |
| 回复评论 | ❌ | 无评论发布接口 |
| 点赞 | ❌ | 无交互操作 |
| 私信 | ❌ | 无私信接口 |

### 差距

需要新增：
- 评论列表抓取
- 评论回复（DOM 操作 + 内容生成）
- 私信发送
- 好友请求处理

---

## 4. 数据采集能力

### 当前状态：❌ 不支持

| 能力 | 状态 | 说明 |
|------|------|------|
| 粉丝数 | ❌ | 无账号数据接口 |
| 播放量 | ❌ | 无内容数据接口 |
| 互动率 | ❌ | 无计算逻辑 |
| 内容浏览 | ❌ | 无数据接口 |

### 差距

需要新增：
- 各平台创作者中心数据抓取
- 数据清洗与结构化存储
- 趋势分析与报告生成

---

## 5. 风控能力

### 当前状态：⚠️ 基础

| 能力 | 状态 | 说明 |
|------|------|------|
| 紧急停止按钮 | ✅ | Phase 2 已实现（UI + API） |
| Runtime 停止检查 | ✅ | Phase 2 已实现（执行前检查） |
| Browser Agent 停止 | ❌ | 无 Browser Agent 实例可停止 |
| 任务队列停止 | ❌ | 无任务队列系统 |
| 操作日志保留 | ✅ | AuditTrail 已有完整日志 |
| 异常操作告警 | ❌ | 无告警系统 |

### 已有能力

- `emergencyStopAll(tenantId)` — Runtime 层停止
- `execution.blocked_emergency` — 执行前拦截
- `AgentAuditTrail` — 完整审计日志

### 差距

需要新增：
- Browser Agent 实例级停止
- 任务队列管理（暂停/恢复/优先级）
- 异常操作检测与告警（频率限制、异常行为）

---

## 6. 底层能力盘点

### 可用组件

| 组件 | 状态 | 说明 |
|------|------|------|
| Puppeteer | ❌ 未安装 | `package.json` 中无依赖，`npm list` 无结果 |
| OpenClaw Browser Control | ❌ 不可用 | Chrome Extension Relay 未连接（端口 18792 无服务） |
| Google Chrome | ✅ 已安装 | 路径 `/usr/bin/google-chrome` |
| Hermes Binding Layer | ⚠️ 半实现 | CRUD 完整，但无 Runtime 连接 |
| Hermes Tool Allow List | ⚠️ 半实现 | 映射逻辑存在，但 tools 是 stubs（not_installed） |
| SOUL.md Generator | ✅ 已实现 | 可生成 Agent 人格描述 |
| Memory Namespace | ✅ 已实现 | 路径规划完成 |
| ModelRouter + callLLM | ✅ 已验证 | LLM 调用可用（Phase 2 Golden Case） |

### 核心差距

**Hermes Browser Agent 不存在。**

环境验证：
- 代码中 `import puppeteer from 'puppeteer'` 但 puppeteer 未安装
- PDF 生成服务 (`screenplay-pdf.service.ts`) 也无法运行
- OpenClaw Browser Control 需要 Chrome Extension Relay，当前未连接

当前状态：
- Binding Layer = 数据库 CRUD（无实际 Runtime 连接）
- Tool Adapter = Mock 实现（所有工具 `not_installed`）
- SOUL.md / Memory = 路径规划（无实际读写）
- Browser Automation = 空白（Chrome 已安装但无自动化库）

---

## 7. 第一平台建议

### 推荐：小红书

理由：

| 维度 | 小红书 | 抖音 | 快手 |
|------|--------|------|------|
| Web 版本可用性 | ✅ 有创作者中心 | ⚠️ 功能受限 | ⚠️ 功能受限 |
| 登录复杂度 | 中（手机+验证码） | 高（滑块验证） | 高 |
| 内容形式 | 图文为主 | 视频为主 | 视频为主 |
| 发布流程 | 相对简单 | 复杂 | 复杂 |
| API 开放度 | 低（需浏览器） | 极低 | 极低 |
| 验证周期 | 短 | 长 | 长 |

选择小红书的原因：
1. 图文内容为主，LLM 可直接生成
2. Web 创作者中心功能相对完整
3. 适合作为概念验证（MVP）
4. 验证后可复制到抖音/视频号

---

## 8. Golden Media Case 方案

### 目标

一个企业 → 一个账号 → 三个 AI 员工 → 完整运营闭环

### 流程

```
1. 昆仑镜 Demo Company
   ↓
2. 注册/配置小红书创作者中心账号
   ↓
3. 配置 3 个 AI 员工：
   - 热点分析师（扫描今日行业热点）
   - 内容创作 AI（根据热点生成 3 篇笔记）
   - 内容审核 AI（评分 ≥85 通过）
   ↓
4. Hermes Browser Agent 执行：
   - 登录小红书创作者中心
   - 选择「发布笔记」
   - 填写标题（AI 生成）
   - 填写正文（AI 生成）
   - 上传配图（用户提供或 AI 生成）
   - 添加话题标签
   - 点击发布
   - 记录发布 URL
   ↓
5. 数据库记录：
   - media_platform_account（账号信息）
   - media_content（内容信息）
   - media_publish_record（发布记录）
   - media_interaction（互动记录，后续）
   ↓
6. 用户查看：
   - 查看已发布内容
   - 查看内容数据（阅读量/点赞/评论）
   - 查看 AI 工作日志
```

### 验收标准

不是"页面完成"，而是：

```
真实小红书账号
  → AI 热点分析
  → AI 生成内容
  → AI 审核 ≥85
  → Hermes 登录
  → 自动发布
  → 数据库记录 media_content + media_publish_record
  → 用户可查看发布 URL 和状态
```

---

## 9. 风险评估

### 高风险项

| 风险 | 说明 | 缓解措施 |
|------|------|---------|
| 平台反爬机制 | 小红书有反自动化检测 | 模拟人工操作（随机延迟、鼠标轨迹） |
| 登录态失效 | Cookie 过期需重新登录 | 自动检测 + 通知用户扫码 |
| 内容审核违规 | AI 生成内容可能违规 | 内容审核 AI + 人工复审 |
| 账号被封 | 频繁自动化操作可能封号 | 频率控制 + 人机模拟 |

### 中风险项

| 风险 | 说明 | 缓解措施 |
|------|------|---------|
| 平台 UI 变更 | DOM 映射失效 | 选择稳定的页面元素 + 自动检测 |
| 内容质量不稳定 | LLM 输出波动 | 审核 AI + SOUL.md 调优 |

---

## 10. 路线图建议

### Phase 3.1：小红书单平台 MVP（先做这个）

1. **Puppeteer 登录小红书** — 验证可行性
2. **Cookie 持久化** — 一次登录多次使用
3. **发布笔记** — 最简单的图文发布
4. **数据库记录** — 存储发布信息
5. **紧急停止** — Browser Agent 立即停止

### Phase 3.2：评论/私信自动回复

### Phase 3.3：企业微信私域闭环

### Phase 3.4：复制到其他平台

---

## 11. 审计结论

### Hermes Browser Agent 当前状态

| 维度 | 评估 |
|------|------|
| 登录能力 | ❌ 需开发 |
| 发布能力 | ❌ 需开发 |
| 互动能力 | ❌ 需开发 |
| 数据采集 | ❌ 需开发 |
| 风控/停止 | ⚠️ 部分可用（Runtime 层已就绪） |
| LLM 内容生成 | ✅ 已验证（Phase 2 Golden Case） |
| 紧急停止（Runtime） | ✅ 已实现 |

### 建议方案

**先验证，后开发。**

Step 1：Puppeteer 连接小红书创作者中心（证明可行）
Step 2：手动登录 → 保存 Cookie → 自动发布一篇笔记
Step 3：成功后产品化（封装为 Hermes Browser Agent）
Step 4：接入紧急停止 + 任务队列
Step 5：扩展到其他平台

### 通过条件

```
先决条件：
  → 安装 Puppeteer（或 Playwright）
  → 确认 Chrome 可启动（headless 模式）
  → 验证可访问小红书创作者中心

验证步骤：
  → Puppeteer 启动 Chrome
  → 导航到小红书登录页
  → 人工登录后保存 Cookie
  → 使用 Cookie 访问创作者中心
  → 导航到发布页面
  → 填写内容并模拟发布（不实际发布）
  → 紧急停止可中断 Browser Agent
```

通过后进入小红书单平台 MVP 开发。

### 立即行动项

1. **安装 Puppeteer**：`npm install puppeteer` 或 `npm install playwright`
2. **验证 Chrome 启动**：确保 headless 模式可用
3. **连接小红书**：验证网络可达 + 页面可解析
4. **Cookie 持久化**：设计存储方案

没有这四步，Phase 3 无法推进。

---

## 附录：技术准备清单

- [ ] Puppeteer 环境确认（Chrome + 依赖）
- [ ] 小红书创作者中心账号（测试用）
- [ ] Cookie 持久化存储方案
- [ ] DOM 映射表（小红书发布页面）
- [ ] 任务队列基础架构
- [ ] 频率控制与反检测策略
- [ ] 发布前人工确认机制（初期）
