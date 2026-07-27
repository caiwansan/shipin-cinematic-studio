# 昆仑镜 Architecture Governance

## Rule #1: API Contract Type Guard

**生效日期**: 2026-07-23  
**违规代价**: 前端调用参数静默错位，后端收不到预期字段

### 规则

所有前后端 API 调用必须使用 Interface/Object 参数，禁止使用位置参数传递业务字段。

```typescript
// ❌ 禁止：位置参数
export async function chat(message: string, userId?: string, history?: any[])

// ✅ 强制：接口对象
export interface ChatRequest {
  message: string
  userId?: string
  history?: ChatMessage[]
}
export async function chat(req: ChatRequest)
```

### 原因

Phase 2-P3 中 `chatWithCareerAgent(message, userId)` 调用时，函数签名为 `(message, history)`，导致 `userId` 被当作 `history` 传入，后端收不到 `userId`，聊天功能完全失效。

---

## Rule #2: Workspace Release Gate

**生效日期**: 2026-07-23  
**适用范围**: 所有工作台（个人/企业/地理/法律等）

### 上线检查清单

| 检查项 | 方法 | 通过标准 |
|--------|------|----------|
| API Contract Test | 前后端参数类型一致 | TypeScript 编译通过 |
| Production Build Verify | 源码 build = 生产运行 build | 文件 hash 一致 |
| Runtime UI Playwright | 真实访问页面 | HTTP 200 + 关键元素可见 |
| Permission Verify | 个人/企业入口分离 | 个人用户看不到企业功能，反之亦然 |

---

## Rule #3: Deploy Pipeline 标准化

**生效日期**: 2026-07-23  
**文件**: `deploy.sh`

每次前端部署必须包含：
1. `npm run build`
2. `rsync -av --delete frontend/.output/public/_nuxt/ <生产目录>/_nuxt/`
3. `rsync -av --delete frontend/.output/server/ <生产目录>/.output/server/`
4. `pm2 restart nuxt-frontend`

### 原因

静态资源同步缺陷已导致两次生产事故：
- STUDIO-V2: JS 404
- AI招聘工作台: JS 404

---

## Rule #4: 个人/企业工作台分离

**生效日期**: 2026-07-23  
**商业模型**: SaaS 订阅

- 个人工作台 (`/workspace/job`): 免费/会员
- 企业工作台 (`/workspace/enterprise`): 企业 SaaS 299/999/月
- 禁止在个人页面展示企业功能入口（除交叉导航按钮外）
- 禁止在企业页面展示个人功能入口（除交叉导航按钮外）
