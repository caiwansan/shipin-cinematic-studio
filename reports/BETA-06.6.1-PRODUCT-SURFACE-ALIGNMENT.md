# BETA-06.6.1 — Product Surface Alignment

> 决策日期：2026-07-19
> 决策者：CTO
> 模式：**产品入口优先，暂停自动化能力开发**

---

## 问题诊断

三层断裂：

```
用户入口（/enterprise）     → 旧企业数字部门 ❌
管理员入口（/admin/aigc）   → 旧企业数字部门 ❌  
实际产品（/media-department）→ AI 新媒体运营部门 ✅ 但藏在隐藏路由里
```

结论：**卖旧产品，卖错产品，用户找不到新产品。继续开发小红书发布 = 扩大裂痕。**

---

## 验收矩阵

| 项目 | 当前（旧） | 目标（新） | 状态 |
|------|-----------|-----------|------|
| `/enterprise` | 旧企业数字部门 | 301 重定向到 `/media-department` | 🔜 |
| `/media-department` | 新部门（隐藏路由） | 默认入口 | 🔧 |
| `/admin/aigc/overview` | 旧企业管理 | 新增"AI新媒体运营部门管理" | 🔜 |
| 旧企业套餐 | Token额度 + 模型费用 | AI员工 + 平台 + 高级功能 | 🔜 |
| 首页体验 | "AI员工 0 渠道 0 初始化未完成" | 新用户引导 | 🔜 |
| 导航 | 混乱的三排 | 三排折叠 + AI新媒体运营 | 🔜 |
| 旧数字部门管理 | 存在 | **删除**（不是隐藏） | 🔜 |

---

## Task 清单

### Task 1: 首页入口修正（P0）

**当前：**
```
/enterprise → 旧企业数字部门页面
```

**目标：**
```
/enterprise → 301 Redirect → /media-department
```

操作：
1. 删除 `pages/enterprise/` 目录所有旧组件
2. 删除旧导航入口
3. 删除旧文案：
   - "企业数字部门"
   - "CEO Dashboard"
   - "ROI驾驶舱"
   - "Leads"
   - "Approval"
4. 全部替换为 "AI 新媒体运营部门"
5. 在 `nuxt.config.ts` 或路由中间件中添加 `/enterprise` → `/media-department` 的 301 重定向

### Task 2: 后台管理重构（P0）

**目标结构：**
```
后台
├── 用户管理
├── VIP会员管理
├── 支付订单
├── AI新媒体运营部门管理  ← 新增
│   ├── 企业列表
│   ├── 企业套餐
│   ├── AI员工数量
│   ├── 平台授权数量
│   ├── AI员工状态
│   ├── 紧急停止状态
│   └── 模型配置
└── 系统设置
```

操作：
1. 在 `/admin/aigc/` 新增"AI新媒体运营部门管理"路由
2. 保留现有"用户管理/VIP/支付"菜单
3. 删除"企业数字部门管理"菜单项
4. 迁移必要数据（如有）

### Task 3: 删除旧企业数字部门后台（P0）

不是隐藏，是**删除**：
- 删除 `pages/admin/enterprise/` 相关页面
- 删除 `pages/admin/enterprise-dashboard/` 
- 删除 `src/routes/enterprise-dashboard.ts` 中旧的企业管理端点
- 保留 `/api/enterprise/:tenantId/dashboard`（新版 AI 新媒体运营数据）

### Task 4: 套餐重新校准（P0）

**旧设计：**
```
套餐 → Token额度 → 模型费用  ❌
```

**新设计：**
```
企业套餐
├── AI员工数量限制
├── 新媒体平台数量限制
├── 高级功能权限
└── 团队协作权限
```

套餐示例：

| 套餐 | AI员工 | 平台 | 高级功能 |
|------|--------|------|---------|
| 基础版 | 5个 | 3个 | 基础数据分析 + 自动发布 |
| 专业版 | 20个 | 全部 | 热点分析 + 运营报告(7天/月/季度) |
| 旗舰版 | 无限 | 全部 | 团队协作 + 企业API |

### Task 5: 首次进入体验（P0）

**当前（失败）：**
```
AI员工 0 渠道 0 模型 0 初始化未完成
```

**目标：**
```
欢迎加入昆仑镜 AI 新媒体运营部门

你的AI运营团队还未创建

1️⃣ 创建企业
2️⃣ 购买运营套餐
3️⃣ 连接你的新媒体账号
4️⃣ 创建AI员工

[ 开始创建 ]
```

### Task 6: 导航最终确认

首页顶部只保留：
```
商城 | 社区 | 更多项目 ▼
```

展开后三排：
```
第一排：短剧工作台 | 音乐创作 | 小说创作 | 法律工作台
第二排：PPT制作 | GEO优化 | AI新媒体运营 | 电商图片
第三排：广告制作
```

**AI新媒体运营** 排第二位，与其他产品并列。

---

## 执行顺序

```
Task 1: /enterprise 301 重定向          (30min)
Task 2: 后台"AI新媒体运营部门管理"       (2h)
Task 3: 删除旧企业数字部门后台           (30min)
Task 4: 套餐重新校准                     (1h)
Task 5: 首次进入体验                     (1h)
Task 6: 导航最终确认                     (30min)
```

**总计：约 5.5 小时**

---

## 验收 Gate

### Gate A: 产品唯一入口检查

```
扫描路径：
  frontend/src/router
  frontend/src/layout
  frontend/src/components/navigation
  backend/src/routes/admin

禁止存在：
  Enterprise Digital Department
  企业数字部门
  enterprise dashboard
  CEO Workspace

用户侧只能看到：
  AI新媒体运营部门
```

### Gate B: 数据库语义检查

```sql
-- Subscription 表增加 product_type
ALTER TABLE subscription_plan ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'MEDIA_DEPARTMENT';

-- limits JSON 结构
{
  "ai_employee": 20,
  "platforms": 10,
  "advanced_report": true
}
```

避免 GEO/电商/视频/新媒体 混在一个套餐表。

### Gate C: 首页真实激活路径测试

```
测试账号: test_media_user

流程:
  登录 → /media-department → 无企业 → 创建企业 → 购买套餐 → 连接小红书 → 创建热点分析师

禁止出现:
  "0 AI员工 0渠道 0模型 初始化失败"

目标显示:
  昆仑镜 AI新媒体运营部门
  杭州XX科技有限公司 专业版
  AI员工: 热点分析师 / 内容创作AI / 内容审核AI
  连接平台: 小红书
  今日运营: 热点分析完成 / 内容生成完成 / 待审核内容3条
```

---

## 冻结的 Phase 3.1

暂停开发：
- ❌ 小红书发布自动化
- ❌ 评论回复
- ❌ YouTube支持
- ❌ 其他平台扩展

**解冻条件：** Gate 1-6 + Gate A/B/C 全部通过。

**恢复后顺序：**
```
小红书账号授权 → 热点抓取 → 内容生成 → 内容审核评分 → 自动发布 → 数据回流 → AI日报
```

---

## 决策依据

> 企业 AI 产品必须把"身份、权限、管理入口、执行能力"统一，否则出现孤岛入口问题。
> — 企业 AI 产品设计原则

用户需要在浏览器地址栏输入 `/media-department` 才能看到新产品，这不是产品化。
