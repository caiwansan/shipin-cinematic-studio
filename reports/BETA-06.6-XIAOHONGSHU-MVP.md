# BETA-06.6 Phase 3.1 — 小红书单平台 MVP

> 执行日期：2026-07-18
> 模式：边开发、边部署、边验证（Continuous Runtime Verification）

---

## 目标

证明：一个 AI 员工可以通过 Browser Runtime 完成一次真实新媒体运营动作。

---

## 架构状态

```
用户
  ↓
昆仑镜用户体系
  ↓
AI 新媒体运营部门
  ↓
Hermes Sub Agent（身份/记忆/权限） ← Phase 2 完成
  ↓
Runtime Bridge（LLM 调用） ← Phase 2 完成
  ↓
Browser Runtime（Playwright + Chrome） ← Phase 3.1 建设中
  ↓
小红书 / 抖音 / 视频号 / ...
```

---

## Gate 1: Browser Runtime Health — ✅ PASS

**验证端点：** `GET /gate1/browser-health`

**结果：**
```json
{
  "code": 0,
  "data": {
    "status": "healthy",
    "version": "148.0.7778.96",
    "gate": "gate1-browser-runtime",
    "timestamp": "2026-07-18T16:11:44.801Z"
  }
}
```

**验证项：**
- Playwright 启动 ✅
- Chromium 连接 ✅
- Chrome 版本 148.0.7778.96 ✅
- 健康检查 API 可达 ✅

---

## Gate 2: 小红书 Session 持久化 — ✅ PASS（机制验证）

**验证流程：**
```
1. POST /browser/launch   → 启动浏览器
2. POST /browser/navigate → 打开小红书登录页
3. POST /browser/save-session → 保存 Cookie
4. POST /browser/close    → 关闭浏览器
5. POST /browser/restore-session → 恢复 Session
6. POST /browser/navigate → 导航到发布页
```

**结果：**
- 小红书登录页加载成功 ✅
- 页面标题：「小红书创作服务平台」✅
- Session 保存成功 ✅
- Session 恢复成功 ✅
- 导航到发布页 → 正确跳转到登录页（因为未登录）✅

**截图证据：**
- 小红书登录页：`/tmp/browser-sessions/demo-org-001-1784391148416.png`
- 重定向验证：`/tmp/browser-sessions/demo-org-001-1784391183075.png`

**待用户操作：**
- 用户需扫码登录小红书 → 系统检测登录状态 → 保存有效 Session

---

## 已完成的组件

### 1. Browser Runtime Service
- Playwright 浏览器池管理
- 多 Session 隔离
- Cookie 持久化（save/restore）
- 健康检查

### 2. Browser Agent Adapter
- 小红书 DOM 映射
- 模拟人工操作（随机延迟、逐字输入）
- 发布笔记任务编排
- 登录任务编排

### 3. Platform Adapter 接口
- 抽象平台操作接口
- 未来支持多平台（抖音、微博、视频号）
- 统一 login/createPost/publish/fetchMetrics

### 4. Media Platform Service
- 账号管理
- 内容 CRUD
- 审核评分（≥85 通过）
- 发布记录

### 5. 数据库
- `media_platform_account` — 平台账号
- `media_hotspot` — 热点分析
- `media_content` — 内容
- `media_content_publish` — 发布记录
- `media_interaction` — 互动记录
- `media_browser_session` — 浏览器 Session 独立管理

### 6. API Routes（18 个端点）
- Browser: launch, navigate, save-session, restore-session, close, cookies
- Accounts: list, create
- Hotspots: list, create
- Contents: list, create, review
- Publish: publish, records

### 7. 独立媒体服务器
- 端口：4003
- 避免预存代码问题
- JWT 认证
- Gate 1 验证端点

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 浏览器自动化 | Playwright + Chromium |
| Chrome 版本 | 148.0.7778.96 |
| 服务器 | Fastify + tsx |
| 数据库 | PostgreSQL + Prisma |
| 认证 | JWT |
| Cookie 存储 | JSON 文件（未来加密） |

---

## 验收里程碑

| Gate | 状态 | 说明 |
|------|------|------|
| Gate 1: Browser Runtime Health | ✅ PASS | Playwright → Chromium → Chrome 148 |
| Gate 2: 小红书 Session 持久化 | ✅ PASS | save/restore 机制验证 |
| Gate 3: AI 生成内容 + 审核 | 🔜 下一步 | 热点分析 → 内容创作 → 审核 ≥85 |
| Gate 4: Browser 自动填写 | 🔜 下一步 | Human Assisted 模式 |
| Gate 5: 真实发布 | 🔜 最后 | autoPublish |

---

## 下一步

1. **Gate 3**: 实现 AI 热点分析 + 内容创作 + 审核流程
2. **Gate 4**: Human Assisted 发布（用户扫码登录 → AI 填写 → 用户确认发布）
3. **Gate 5**: 全自动发布（autoPublish=true）

---

## 注意事项

- 当前 Session 持久化已验证机制，但需要用户实际扫码登录才能获得有效 Cookie
- 小红书属于高风险平台，第一版采用 Human Assisted 模式
- 禁止扩展其他平台，直到发布闭环验证成功
