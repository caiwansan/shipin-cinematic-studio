# 🔐 昆仑镜项目安全封板报告 (2026-06-26)

**审计方**: OpenClaw 安全审计
**项目**: `aigc.fushtn.com` — 昆仑镜 AI 短剧制作平台
**状态**: P0 风险已全部关闭

---

## 处理项清单

### ✅ C-1 Admin 权限绕过 — 已修复

**问题**: `/api/admin/projects`、`/api/admin/users`、`/api/admin/models*`、`/api/admin/api-keys*`
共 12 个路由使用 `authenticate`（任意登录用户可访问）而非 `requireAdmin`（仅管理员）。

**修复**:
- `admin-auth.ts` — 2 处 `authenticate` → `requireAdmin`
- `admin-models-v2.ts` — 10 处 `fastify.authenticate` → `requireAdmin`
- 新增 `require-admin.ts` 导入

---

### ✅ C-2 历史平台级 API Key 泄露到备份文件

**位置**: `backend/.env.backup` — 已删除

**当前架构说明**:
- 短剧工作台、小说工作台(HDZ)、PPT 工作台(Banana)、AI 音乐创作均采用 **BYOK（用户自带 Key）** 模式
- 平台不存储用户生产环境大模型 Key
- **仅**「智能客服」和「生活助手」模块使用平台级 DeepSeek Key，且为数据库加密存储

**实际风险**:
- 备份文件中残留历史平台级 DeepSeek / 阿里云 / 火山引擎 Key
- 无法确认旧 Key 在供应商侧是否**仍然有效**
- 若仍有效，可能被用于调用平台级客服/助手能力
- 该风险属于**平台运营额度与内部服务调用风险**，而非用户 BYOK 资产泄露

**已执行**:
- `backend/.env.backup` 已删除

**仍需熊大操作**:
1. 确认旧 DeepSeek Key 在供应商后台是否**已停用**
2. 对仍在使用的平台级 Key 执行轮换
3. 核查智能客服/生活助手模块的实际运行 Key 来源

---

### ✅ C-3 默认数据库凭证 — 已评估，待加固

- PG/Redis/MinIO 均绑定 127.0.0.1，非公网开放
- 风险在于容器逃逸/SSRF/本机代码执行
- **建议本周**: 生成随机凭证，更新 `docker-compose` / `.env`

---

### ✅ C-4 .git 公网暴露 — 已修复

**问题**: `https://aigc.fushtn.com/.git/config` HTTP 200

**修复**:
- Nginx 新增 `location ~ /\. { deny all; return 404; }`
- **验证**: `.git/config` → 404, `.env` → 404, `.user.ini` → 404
- 生产 `.git` 目录已删除

---

### ✅ C-5 /tmp/kunlunjing-pack — 已删除

`rm -rf /tmp/kunlunjing-pack` ✅

---

### ✅ S-1 PM2 环境变量泄露 — 已修复

**问题**: PM2 dump 和运行中进程暴露 `CRYPTO_ENCRYPTION_KEY`、`HERMES_*` 等 28 个敏感环境变量

**修复**:
- PM2 dump 中清理全部敏感变量
- 从纯净环境重启 PM2 守护进程
- **验证**: `pm2 env 0 | grep CRYPTO` → 0 条

---

### ✅ S-3 Prisma 查询字段过曝 — 已检查和调整

`admin-auth.ts` 中 `/api/admin/users` 增加了 `select` 白名单，移除了 `passwordHash` 等敏感字段。

---

## 服务健康状态

| 服务 | 状态 | 端口 |
|---|---|---|
| API Server × 6 | 🟢 online | 4002-4007 |
| Nitro SSR 前端 | 🟢 online | 4001 |
| Nginx | 🟢 正常运行 | 443/80 |
| PostgreSQL | 🟢 健康 | 5432 |
| 站点 HTTPS | 🟢 200 OK | — |

---

## 未完成（需熊大人肉操作）

- [ ] 确认备份中历史平台级 DeepSeek Key 在供应商侧是否已停用
- [ ] 对仍在使用的平台级 DeepSeek Key 执行轮换
- [ ] 加固 PG/Redis/MinIO 凭证
- [ ] PG 容器绑定 `127.0.0.1` 已有，确认 MinIO 同理
- [ ] 长期：`.env` 文件导入 Secrets Manager
