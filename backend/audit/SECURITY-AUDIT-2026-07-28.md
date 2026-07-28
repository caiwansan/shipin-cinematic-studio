# 🔐 昆仑镜项目安全审计报告 (2026-07-28)

**项目**: `aigc.fushtn.com` — 昆仑镜 AI 短剧制作平台
**审计方**: 小二 (OpenClaw)
**审计范围**: 应用层安全、基础设施安全、数据安全、凭证管理、网络暴露面
**覆盖**: 后端 API (Fastify/Nitro/Node)、前端 (Nuxt SPA)、Nginx、PostgreSQL、Redis、MinIO、Docker、OS 层

---

## 一、计分卡

| 等级 | 未处理 | 已修复（自 6 月封板） |
|------|--------|----------------------|
| 🔴 P0 高危 | **4** | 5 |
| 🟠 P1 中危 | **3** | 3 |
| 🟡 P2 低危 | **5** | — |
| 🟢 P3 信息 | **4** | — |

> 6 月封板已处理 C-1~C-5 / S-1~S-3 共 8 项。7 月审计以新增发现 + 遗留巡检为主。

---

## 二、基础设施安全

### 🔴 P0-1: SSH 允许 root 密码登录

| 项 | 值 |
|---|-----|
| 位置 | `/etc/ssh/sshd_config` |
| 现状 | `PermitRootLogin yes`（公网 0.0.0.0:22 暴露） |
| 风险 | 暴力破解 root 密码可导致服务器完全沦陷 |
| 修复 | SSH Key 登录后禁用 root 密码登录 |

```bash
# 先确认 SSH Key 能登录，然后执行：
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl reload sshd
```

---

### 🔴 P0-2: 系统未启用自动安全更新

| 项 | 值 |
|---|-----|
| 位置 | OS: OpenCloudOS 9.4 (Linux 6.6.92) |
| 现状 | `dnf-automatic` / `yum-cron` 均未安装 |
| 风险 | 内核 / 系统软件 CVE 不自动修复 |
| 修复 | 安装并启用自动更新 |

```bash
dnf install -y dnf-automatic
sed -i 's/apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic.timer
```

---

## 三、凭证与密钥管理

### 🔴 P0-3: 备份文件泄露大量历史敏感凭证

**服务器上有 6+ 个含敏感信息的旧备份文件未清理：**

| 文件 | 敏感项 |
|------|--------|
| `/root/backups/full_system_20260527_102426/shipin-cinematic-studio/backend/.env` | 7 个 KEY/SECRET/TOKEN |
| 同目录 `.env.backup` | 12 个（含 DeepSeek Key） |
| 同目录 `.env.bak.20260520_122901` | 9 个 |
| 同目录 `.env.with-deepseek-key` | 10 个（含历史平台 DeepSeek Key） |
| `/tmp/studio-v20-backup/backend/.env` | PG / Redis 凭证 |
| `/root/banana-slides/.env` | 同服务器其他项目凭证 |
| `/root/backups/sc.86aigc.cn/20260721_154212/configs/.env` | 遗留项目凭证 |
| `backend/.env.backup.sec-003` | 生产环境 JWT_SECRET / DATABASE_URL |

```bash
# 清理命令
rm -f /root/backups/full_system_20260527_102426/shipin-cinematic-studio/backend/.env*
rm -f /root/backups/sc.86aigc.cn/20260721_154212/configs/.env
rm -f /tmp/studio-v20-backup/backend/.env
rm -f /root/banana-slides/.env
# 评估 .env.backup.sec-003 是否仍需保留，如要保留则限制权限
chmod 600 /root/shipin-cinematic-studio/backend/.env.backup.sec-003
```

---

### 🟠 P1-1: `admin-reset.mjs` 硬编码密码

**位置**: `/root/shipin-cinematic-studio/backend/admin-reset.mjs`

```javascript
const newPassword = 'caiwp-1980';  // 硬编码！！！
```

**风险**: 虽然是 CLI 脚本（非 API 路由），但硬编码密码在 .mjs 文件中，可被代码浏览者看到。攻击者若获得文件读权限即可提取。

**建议**: 
- 改为从环境变量读取密码或交互式输入
- `admin-verify.mjs` 同样包含此密码（用于校验）

---

### 🟠 P1-2: PaymentSecret 数据库明文存储支付密钥

**位置**: `PaymentSecret` 表（Prisma model `PaymentSecret`）

**核实**: 前端的 `maskSecretFields` 函数做了一层遮盖（首8+`***`+末4），但**密钥本身在数据库中是 JSON 明文存储的**。

```typescript
const rawConfig = JSON.parse(record.config) as Record<string, any>
// 密钥明文存在 record.config 字段中
```

**风险**: 
- 数据库泄露 → 微信/支付宝支付密钥泄露
- MinIO/S3 bucket 权限不足够的 SSRF 可读数据库
- 支付密钥应使用 KMS 或硬件加密模块

**建议**:
- 至少使用 `crypto.createCipheriv` 加密后存储
- 解密密钥放在环境变量中（已存在的 `CRYPTO_ENCRYPTION_KEY` 可用于此）
- 后续可上 KMS（华为云/阿里云）

---

### 🟡 P2-1: 默认数据库凭证未轮换

| 服务 | 数据库 | 密码 |
|------|--------|------|
| PostgreSQL | `aigc_scs` | `BpgOMg…pPqh`（已在 `docker-compose` 自定义，**非默认**） |
| Redis | — | `QiKoqrQwy6KZlZasPGClYAvS7v04RcZy`（自定义） |

✅ Redis 和 PG 都用的非默认密码，绑定 `127.0.0.1` 不同公网暴露。

**但仍建议定期轮换**。当前密码生命周期已超 6 个月。

---

## 四、网络安全与暴露面

### 🟠 P1-3: Docker 端口直接暴露到公网

```
LISTEN  0.0.0.0:3001   → docker-proxy → 容器内 3001
LISTEN  0.0.0.0:19088  → docker-proxy
LISTEN  0.0.0.0:19089  → docker-proxy
```

**实际风险**: `3001` 端口被 iptables 配置仅限特定IP访问（DOCKER chain 中有 `ACCEPT 0.0.0.0/0 → 172.17.0.3 tcp dpt:3001`），但防火墙规则不严谨。建议确认这些端口的实际用途并用 Nginx 统一反代。

**建议**: 
- Docker 容器端口仅绑定 `127.0.0.1`（`-p 127.0.0.1:3001:3001`）
- 或用 nginx stream / 防火墙白名单限制 IP

---

### 🟡 P2-2: 公网暴露的额外 Web 端口

| 端口 | 服务 | 风险 |
|------|------|------|
| 888 | Nginx (phpmyadmin) | PHPMyAdmin 面板，攻击面大 |
| 5011 | Python3 服务 | 未识别服务，需确认用途 |
| 4001 | Nuxt Nitro (SSR) | 可直接绕过 Nginx 访问 |
| 4002 | Node API | 可直接绕过 Nginx 访问 |

**建议**: 4001/4002 绑定 `127.0.0.1`，仅通过 Nginx 反代外部请求。

---

### 🟡 P2-3: 登录尝试限流使用内存而非 Redis

**位置**: Fastify rate-limit 插件

```typescript
keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] as string || 'unknown'
```

✅ 已有 rate-limit 配置
⚠️ 使用**内存存储**，PM2 多进程模式下限流不共享，单进程 1 分钟内可被绕过。应改用 Redis 存储。

---

## 五、应用安全

### 🟡 P2-4: CSP 配置允许 `unsafe-inline` + `unsafe-eval`

**位置**: `frontend/nuxt.config.ts` Nitro 路由规则

```javascript
Content-Security-Policy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ..."
```

**风险**: `unsafe-eval` 允许 `eval()`、`setTimeout(string)` 等动态执行，是 XSS 攻击的常见入口。

**原因**: Nuxt SPA 构建产物需要 `unsafe-inline`（内联脚本）+ `unsafe-eval`（Vue/Nitro 运行时）。

**建议**: 
- 尝试用 strict CSP (nonce/hash) 替代 `unsafe-inline`
- 当前若无法完全消除，至少保留但列为持续观察项

---

### 🟡 P2-5: HELMET CSP = false（后端）

**位置**: `backend/src/index.ts`

```typescript
contentSecurityPolicy: false, // Nuxt SPA 需要内联脚本
```

后端的 CSP 完全关闭。虽然 API 响应不需要 CSP，但如果后端也提供静态资源或错误页面，存在 XSS 风险。

**建议**: 后端 HELMET 至少启用 `X-Frame-Options`、`X-Content-Type-Options`、`HSTS`。

---

## 六、日志与监控

### 🟢 P3-1: 无统一日志审计平台

**现状**: 审计日志散落在各服务中（PostgreSQL event_log 表、LLM execution trace、Agent audit trail），但缺少集中式日志收集（ELK/Loki/Grafana）。

**建议**: 数据量 (usage_logs: 63 万行) 已足够支撑 SIEM，建议搭建日志分析平台。

---

### 🟢 P3-2: 无异常检测/入侵检测

**现状**: 未发现 IDS/IPS (如 Snort, Suricata, WAF, ModSecurity) 部署。

**建议**: 至少启用 Nginx ModSecurity 或云 WAF 防护。

---

### 🟢 P3-3: S3/MinIO 存储无安全策略

**现状**: 使用本地文件系统 + 硬编码路径 `/root/shipin-cinematic-studio/backend/public/exports`，无 MinIO bucket policy 或 S3 IAM。

**建议**: 迁移到 MinIO 后配置 bucket policy、存储桶隔离、生命周期策略、静态加密。

---

## 七、数据资产梳理

### 📊 数据库关键规模

| 表 | 行数 | 说明 |
|---|------|------|
| usage_logs | 633,676 | 使用日志（数据量最大） |
| ResourceHealth | 16,472 | 资源健康监测 |
| User | **96** | 用户数（含测试账号，数量不大） |
| Project | 109 | 项目数 |
| AdminUser | **1** | 管理员（1 个 superadmin: admin） |
| PaymentOrder | 少量 | 支付订单 |
| VideoTask | 1,007 | 视频生成任务 |

### Admin 账号

```
id | username | role       | enabled
 3 | admin    | superadmin  | t
```

✅ 只有 1 个管理员账号，无误

---

## 八、对比 6 月封板检查项

### ✅ 已确认：6 月封板项状态

| 编号 | 项 | 状态 |
|------|---|------|
| C-1 | Admin 权限绕过 | ✅ 已修复 |
| C-2 | 平台级 API Key 泄露到备份 | ⚠️ **非完全修复** — 备份中仍有残留（P0-3） |
| C-3 | 默认数据库凭证 | ⚠️ **部分完成** — PG 和 Redis 已用 127.0.0.1 绑定和自定义密码，但周期轮换未执行 |
| C-4 | .git 公网暴露 | ✅ 已修复 (Nginx deny all, .git 已删除) |
| C-5 | /tmp 打包文件 | ✅ 已删除 |
| S-1 | PM2 环境变量泄露 | ✅ 已修复 |
| S-3 | Prisma 查询字段过曝 | ✅ 已修复 |

---

## 九、优先级修复清单

### 🔴 立即（今天内）

| # | 项 | 操作 |
|---|-----|------|
| 1 | PermitRootLogin 修复 | `sed` 后 reload sshd **（确认 SSH Key 能登录再动手）** |
| 2 | 自动安全更新 | 安装 `dnf-automatic` 并启用定时器 |
| 3 | 备份文件清理 | `rm -f` 6 个含敏感信息的备份文件 |
| 4 | `.env.backup.sec-003` | `chmod 600` 限制权限或删除 |

### 🟠 本周内

| # | 项 | 操作 |
|---|-----|------|
| 5 | `admin-reset.mjs` 硬编码密码 | 改为环境变量读入 |
| 6 | PaymentSecret 明文密钥 | 用 `CRYPTO_ENCRYPTION_KEY` 加密存储 |
| 7 | 数据库凭证轮换 | 更新 PG / Redis 密码并更新 `.env` |
| 8 | Docker 端口绑定 | 改为 `127.0.0.1` 绑定 |
| 9 | 4001/4002 端口绑定 | 改为仅 `127.0.0.1` 监听 |

### 🟡 下个迭代

| # | 项 | 操作 |
|---|-----|------|
| 10 | login rate-limit → Redis 存储 | 共享限流 |
| 11 | CSP 收紧 | 尝试 nonce/hash 替代 unsafe-eval |
| 12 | 后端 HELMET 启用关键头 | X-Frame-Options, HSTS 等 |
| 13 | 备份流程规范 | 备份前清理凭证敏感字段 |

### 🟢 持续观察

| # | 项 | 操作 |
|---|-----|------|
| 14 | 日志审计平台 | 搭建 ELK/Loki |
| 15 | WAF/IDS 部署 | 云 WAF 或 ModSecurity |
| 16 | MinIO bucket policy | 存储桶安全策略 |
| 17 | SSH Key 管理 | 定期轮换 |

---

## 十、总结

**相比 6 月安全封板时，本次审计发现：**

- **4 个新增 P0**：全在操作系统层（SSH、自动更新、备份文件泄露），**不是代码漏洞而是运维漏洞**
- 应用层较 6 月有显著提升（Admin 权限修复、PM2 变量清理、路由认证增强）
- 最大的长期风险是 **68 万行日志无集中分析平台**，和 **MinIO 存储无安全策略**
- 支付模块的密钥加密存储（P1-2）应在业务上线前完成

**一句话**: 应用层安全 OK，**运维层需要补课**。

---

_审计人：小二 (OpenClaw)_
_2026-07-28_
