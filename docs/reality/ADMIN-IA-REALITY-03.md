# ADMIN-IA-REALITY-03 — 平台基础设施补位（P0 系统设置 + SEO）

**Date:** 2026-08-01
**Gate:** 掌柜指令（后台治理方向确认后，按平台基础设施优先级排序）

---

## 优先级路线（掌柜冻结）

```
ADMIN-IA-REALITY-02
 ↓
ADMIN-IA-REALITY-03
 T01 系统设置 + SEO      P0  ✅ 本次完成
 T02 大模型管理          P0  ⏳ 待开（Provider/模型列表/默认模型/健康检测/调用统计）
 T03 AI Agent 管理       P1  ⏳ 待开（Agent列表/模板/能力/风格库/Runtime/使用统计）
 T04 用户与权限          P1  ⏳ 待开（Role/Permission/Resource 统一权限模型）
 T05 企业列表治理        P2  ⏳ 待开（/admin/customers：企业/个人/VIP/代理）
 T06 Workspace Admin Shell P2 ⏳ 待开（等短剧/小说/GEO 接入一起做，避免过度设计）
```

---

## T01 系统设置 + SEO — COMPLETE ✅

### 问题（Reality Audit 发现）

`site-config.ts` 路由一直存在，但 **SiteConfig 表从未创建**（schema 中无此模型），
所有读写被 `try/catch` 静默吞掉 → **配置从未持久化，线上永远返回硬编码默认值**。
系统设置是「假配置」——这正是掌柜说的「配置黑盒」。

### 落地

| 项 | 内容 | 状态 |
|----|------|------|
| SystemConfig 模型 | `key/value/group/updatedBy/updatedAt`（Prisma + 手动建表，避开 db push 全量警告） | ✅ |
| GET /api/system/config | 公开读取（官网/前台 SEO 用），白名单 key | ✅ |
| GET/PUT /api/admin/system/config | requireAdmin 保护，updatedBy 记录管理员 | ✅ |
| GET /robots.txt | 动态生成（seo.robots + 自动附加 Sitemap 行） | ✅ |
| GET /sitemap.xml | 动态生成（site_domain + seo_sitemap_urls） | ✅ |
| 前端页面 | `/admin/aigc/system`：基础信息 + SEO 设置双 Tab + 搜索预览 | ✅ |
| 导航接入 | ⚙️ 系统设置组激活（ADMIN_SYSTEM_GROUP） | ✅ |
| Nuxt 代理 | `server/routes/robots.txt.ts` + `sitemap.xml.ts` → 后端 4002 | ✅ |
| 动态 SEO head | app.vue 读取 /api/system/config 覆盖 title/description/keywords/og | ✅ |

### 配置项（22 个 key，group 分类）

```
site 组：site_name / site_title / site_description / site_keywords / site_logo /
        site_favicon / site_domain / site_intro / icp_beian / icp_license /
        icp_company / icp_business / icp_copyright / og_image
seo  组：seo_title / seo_keywords / seo_description / seo_robots /
        seo_sitemap_urls / seo_verify_baidu / seo_verify_google
```

### Reality Test

| 用例 | 结果 |
|------|------|
| GET 公开配置（无 token） | ✅ 200，22 key |
| PUT 无 token | ✅ 401 拦截 |
| PUT 有 token 写入 → 回读 | ✅ 值即时生效 |
| DB 持久化 | ✅ system_config 表落库，updatedBy=admin |
| /robots.txt 动态 | ✅ 200，含 Sitemap 行 |
| /sitemap.xml 动态 | ✅ 200，XML 格式正确 |
| 前端页面 | ✅ 200 |
| Build + 孤儿检查 | ✅ 50 路由 / 0 孤儿 |

---

## 冻结规则补充（写入规范）

> **后台新增一级菜单必须经过 Admin IA Review。**
> 新功能默认进入已有 Workspace 或已有平台模块，不允许创建新的一级入口。

**系统设置页面路由：** `/admin/aigc/system`（归 ⚙️ 系统设置组，owner: system）

---

## Reality Gate

| Gate | 状态 |
|------|------|
| G1 配置不再黑盒（真实持久化） | ✅ |
| G2 官网/后台/公开页统一读取 | ✅ /api/system/config 单一来源 |
| G3 写操作需管理员鉴权 | ✅ requireAdmin |
| G4 robots/sitemap 动态可配 | ✅ |
| G5 Build PASS + 0 孤儿 | ✅ |
