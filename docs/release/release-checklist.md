# Release 发布清单

## 发布候选分支
- `release/audit-p1-20260724`

## 包含内容
- P1-A：VIP 权限收口（8 条路由）
- P1-C：工作台状态治理（14 工作台，入口过滤）

## 不包含内容
- P1-B：Quota / Credit Guard
- 半成品功能补齐
- TypeScript 2285 预存报错修复
- 废弃表清理

## Staging 部署前检查

### 1. 工作区状态
- [ ] `git status` clean（已确认：master 分支有 339 个未跟踪文件，release 分支 clean）

### 2. TypeScript 验证
- [x] 基线：2285 处（master 全量扫描）
- [x] release 分支：2019 处（实际减少，无新增）
- [x] P1-A 文件：0 新增
- [x] P1-C 文件：0 新增

### 3. 构建检查
- [ ] pnpm build / npm run build

### 4. Prisma 检查
- [ ] npx prisma generate

### 5. 测试
- [ ] pnpm test / npm test

## Staging 冒烟测试

### 权限冒烟
- [ ] 法律 Agent：未登录 401，Free 403，Pro 通过
- [ ] 导演工作台：Free 403，Pro 通过
- [ ] AI 优化：Free 403，Pro/Basic 通过

### 工作台首页冒烟
- [ ] music 不展示
- [ ] hdz 不展示
- [ ] voice 不展示
- [ ] preview 工作台显示"预览版"
- [ ] beta 工作台显示"公测版"
- [ ] stable 工作台正常展示

### hidden 路由冒烟
- [ ] /music → 提示/重定向
- [ ] /hdz → 提示/重定向
- [ ] /voice → 提示/重定向

### 省市区冒烟
- [ ] RegionPicker 可加载
- [ ] 注册页可选择省市区
- [ ] 资料页可编辑地区

### governance 冒烟
- [ ] Director OS 旧治理数据可读取
- [ ] 页面显示历史/冻结数据提示

## 回滚方案
- 回滚 commit：`7aaff314`（P0 fix）
- workspace status 可通过 `routeTierPolicy.ts` 动态调整
- 无破坏性数据库迁移

## 生产上线前置条件
- [ ] Staging 部署成功
- [ ] Staging 冒烟全部通过
- [ ] RELEASE_READINESS.md 输出
- [ ] 掌柜确认临时会员等级
- [ ] 掌柜确认 novel-public 状态
- [ ] 掌柜明确批准生产上线
