# ADMIN-IA-REALITY-02 — 昆仑镜后台导航治理规范（三入口边界冻结）

**Date:** 2026-08-01
**Gate:** 掌柜指令冻结（多 Workspace / 多 AI Employee / 企业订阅 / BYOK / 统一身份体系架构前提）
**状态:** ✅ 冻结并已上线

---

## 一、核心原则（KMKI 级，永久生效）

> **后台管理 = 管理昆仑镜平台本身**
> **工作台管理 = 管理某个业务 Workspace 的运营能力**
> **企业管理 = 企业客户自己的组织/员工/订阅/资产管理**
> **个人中心 = 当前用户自己的账户与权益管理**

**不得混在一起。**

---

## 二、三个入口边界

| 入口 | 用户 | 内容 | 禁止出现 |
|------|------|------|----------|
| `/admin` | 平台老板/运营 | 用户、钱、模型、Agent、Workspace、系统 | 业务套餐/订阅/ROI 等 Workspace 商业能力 |
| `/admin/workspaces/:workspace/*` | 平台运营 | 某业务 Workspace 的运营能力 | 平台级用户/支付/模型管理 |
| `/enterprise` | 企业客户 | 企业资料/成员/订阅/AI员工/模型配置/用量/账单 | 平台用户管理/系统设置 |
| `/profile` | 当前用户 | 我的资料/VIP/订单/API Key/Agent/项目/安全设置 | 用户管理/套餐管理/系统设置 |

---

## 三、后台一级导航（8 模块，已上线）

```
/admin

├── 📊 数据罗盘                    → /admin/aigc/overview
├── 🌐 公共信息设置                → 短信/微信/QQ/支付/COS（P2: 邮件/CDN）
├── 💎 VIP套餐管理                 → 套餐列表/VIP订单（平台级会员商业化）
├── 👥 用户与权限                  → 会员/管理员/代理/社区/发私信/企业客户列表（P2: 角色权限）
├── 🤖 大模型管理                  → 模型列表（P2: Provider/平台模型配置/调用统计）
├── 🧠 AI Agent管理                → Agent列表/Runtime状态/能力资源·风格库
├── 🏭 Workspace工作台管理         → 全部 Workspace 折叠（招聘/法律/商城/短剧/小说/GEO/音乐/电商图片/广告）
└── ⚙️ 系统设置                    → P2: 基础信息（名称/Logo/域名/ICP/SEO）+ SEO收录配置
```

**一级入口数量：8**（含 1 个数据罗盘 + 6 个平台模块组 + 1 个工作台组 + 系统设置组待建后加入）。

---

## 四、硬规则

### R1 删除「全局后台里的业务套餐」🚫

禁止在后台一级导航出现：

```
后台
 ├── 招聘套餐 ❌
 ├── 招聘订阅 ❌
 ├── 招聘模型 ❌
 ├── 招聘AI员工 ❌
 ├── 招聘ROI ❌
 └── 招聘额度 ❌
```

招聘商业能力全部折叠进：

```
🏭 Workspace工作台管理
 └── 求职招聘管理
     ├── 套餐管理 / 订阅管理 / 配置
     ├── 企业订阅 / 套餐定义 / 模型健康 / AI员工活动 / ROI / 试运营 / 日报 / 额度 / 收入 / 入驻审核
```

### R2 工作台订阅规则（SaaS 化）

> **需要单独订阅的，直接在对应工作台管理页面内设置。**

```
求职招聘管理:
  套餐:  招聘AI员工 Basic / Pro / Enterprise
  能力:  AI JD / AI面试 / AI人才匹配
  Agent: Alice / Bob / Carol
```

禁止：`后台 → 招聘套餐` / `后台 → GEO套餐` / `后台 → 小说套餐` —— 未来 20 个 Workspace 会爆炸。

### R3 一个 Workspace = 一个后台入口

- 全部 Workspace 折叠在「🏭 Workspace工作台管理」组内，三层导航：组 → Workspace → 子页
- 新增功能只能进入所属 Workspace 内部 Tabs
- 新增 Workspace 的唯一方式：`ADMIN_WORKSPACE_REGISTRY` 增加一项
- **三件套缺一不可**：前台 Workspace + Workspace Registry + Admin Route Registry

---

## 五、技术落地

| 项 | 文件 | 状态 |
|----|------|------|
| Workspace Registry（8 模块导航源） | `frontend/config/admin-workspace-registry.ts` | ✅ |
| Route Registry（49 路由全登记） | `frontend/config/admin-route-registry.ts` | ✅ |
| 孤儿页面 CI 检查 | `frontend/scripts/route-ownership-check.mjs`（挂 nuxt build hook） | ✅ |
| 三层导航渲染（workspace-group） | `frontend/layouts/admin-aigc.vue` | ✅ |
| Deprecated 机制 | `beta-customers` / `customer-service`（hidden，不删文件） | ✅ |

### 导航对比

| 版本 | 一级入口 |
|------|----------|
| 治理前 | 27 + 招聘 11 = 38 |
| ADMIN-IA-01 | 11 |
| ADMIN-IA-02（当前） | **8**（数据罗盘 + 6 平台组 + 1 工作台组） |

---

## 六、待办（P2，等掌柜指令）

- ⏸ `/admin/aigc/enterprises` 与 `/admin/enterprises` 合并归属
- ⏸ 系统设置组：基础信息（系统名称/Logo/favicon/官网域名/ICP/网站介绍/SEO 标题/关键词/描述）
- ⏸ SEO 收录配置（robots.txt / sitemap / 搜索引擎验证 / 页面 Meta 模板）
- ⏸ 公共信息：邮件配置、CDN 配置
- ⏸ 用户与权限：角色权限管理
- ⏸ 大模型管理：Provider 管理 / 平台模型配置 / 调用统计
- ⏸ Workspace Admin Shell 统一：`/admin/workspaces/:workspace/*` 路由收敛（P1 短剧/小说/GEO 接入时一并落地）

---

## 七、Reality Gate

| Gate | 要求 | 状态 |
|------|------|------|
| G1 | 一级入口 ≤ 15 | ✅ 8 |
| G2 | 无业务套餐/订阅/ROI 一级入口 | ✅ 全折叠进招聘 Workspace |
| G3 | 一个 Workspace 一个入口 | ✅ 9 Workspace 全在「🏭 工作台管理」组内 |
| G4 | 全部现有路由可达（无回归 404） | ✅ |
| G5 | Build PASS（含孤儿检查 hook） | ✅ |
| G6 | 三入口边界冻结成文 | ✅ 本文档 |
