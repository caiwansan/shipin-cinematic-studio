# BETA-06.7 — Phase 3.1 小红书真实运营闭环

> 启动日期：2026-07-19
> 前置条件：BETA-06.6.1 ✅ BETA-06.6.2 ✅
> 范围：仅小红书，禁止扩平台/扩功能

---

## 目标

> 昆仑镜 AI 新媒体运营部门，是否真的可以替代一个基础新媒体运营团队完成一次内容生产和发布？

## 闭环链路

```
连接小红书账号 → AI热点分析 → AI内容创作 → AI内容审核(≥85)
    → Hermes Browser Agent自动发布 → 数据回流 → AI运营日报
```

---

## 已有基础（BETA-06.6 已建设）

| 组件 | 状态 |
|------|------|
| `browser-runtime.service.ts` | ✅ Playwright Chromium 管理 |
| `browser-agent.adapter.ts` | → `publishXiaohongshuNote()` |
| `media-platform.service.ts` | → 账号/内容 CRUD |
| `media_platform_account` 表 | ✅ 已创建 |
| `media_hotspot` 表 | ✅ 已创建 |
| `media_content` 表 | ✅ 已创建 |
| `media_content_publish` 表 | ✅ 已创建 |
| `media_interaction` 表 | ✅ 已创建 |
| Hermes Sub Agent 体系 | ✅ 7岗位 system prompts |
| Browser Agent 权限模型 | ✅ read_only / create_content / publish_content |

---

## 执行 Gate

### Gate 1：账号授权真实化 🟡 Capability PASS 🔴 Production PASS

```
目标：media_platform_account 产生真实小红书账号记录
输入：小红书创作者账号 Cookie（手动获取）
输出：Base64 加密存储 + 可解密验证 + Playwright 可还原
验收：[x] Cookie 存储（Base64, 2036 chars, 8 cookies）
       [x] Cookie 解密验证成功
       [x] Playwright 加载 Cookies → XHS 站点可达
       [!] Cookie 已过期（需用户重新登录获取 fresh cookies）

数据库状态：
  media_platform_account: demo_xhs_creator (active, credential_vault_id 已关联)
  media_credential_vault: Base64 加密 payload, encryption_version=1

⚠️ 待办：需要用户以「小红书创作者账号」重新登录一次 google-chrome，
   脚本自动捕获并刷新 Credential Vault。
```

### Gate 2：热点分析 AI 🔜 IN PROGRESS

```
输入：品牌信息 / 行业 / 目标用户 / 账号历史
输出：media_hotspot 记录 + 选题建议
验收：[ ] 3个热点选题 + 关联度评分
```

### Gate 3：内容生产链 ⏳ PENDING

```
链路：热点分析师 → 内容创作AI → 内容审核AI（≥85分通过）
输出：media_content 记录 + 审核评分
验收：[ ] 笔记标题 + 正文 + 配图建议 + 4维评分
```

### Gate 4：Hermes 发布 ⏳ PENDING

```
链路：Browser Runtime → 小红书创作中心 → 上传 → 填写 → 发布 → URL
输出：media_content_publish 记录 + 真实URL
验收：[ ] 小红书笔记真实URL  [ ] 内容匹配创作输入
```

### Gate 5：互动闭环 ⏳ PENDING

```
链路：评论读取 → 销售顾问AI话术 → 自动回复
输出：media_interaction 记录
验收：[ ] 读取真实评论  [ ] 生成回复建议  [ ] 回复合规
```

### Gate 6：数据回流 + AI日报 ⏳ PENDING

```
采集：曝光 / 点赞 / 收藏 / 评论 / 涨粉
输出：AI运营日报
验收：[ ] 真实数据  [ ] 日报结构完整
```

---

## 冻结范围

| 禁止 | 允许 |
|------|------|
| ❌ 抖音/快手/微博/视频号 | ✅ 小红书单平台 |
| ❌ 新AI岗位 | ✅ 热点分析师/内容创作/内容审核 |
| ❌ 新Dashboard | ✅ 复用 media-department 页面 |
| ❌ 新套餐 | ✅ 复用现有套餐 |
| ❌ UI美化 | ✅ 功能正确性优先 |

---

## 下一交付

`reports/BETA-06.7-XIAOHONGSHU-MVP-LOOP.md`
