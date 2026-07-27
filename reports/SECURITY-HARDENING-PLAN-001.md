# SECURITY HARDENING PLAN-001

> **版本**: v1.0  
> **日期**: 2026-03-17  
> **分类**: 机密 — 仅限 CTO Review  
> **状态**: 待审批  
> **目标域**: `aigc.fushtn.com` / `昆仑镜主系统` / `shipin-cinematic-studio`  
> **冻结范围**: `sc.86aigc.cn` / 短剧项目 / 其他独立项目代码 — ❌ 禁止触碰

---

## 执行摘要

本次审计发现 **生产环境信任边界系统性失效**，涉及 Secret 泄露、认证绕过、网络暴露三个维度共 11 项高危问题。建议立即冻结 M1-A 产品化开发，进入 Security Hardening Sprint (S0–S6)。所有修复按「零信任」原则逐项执行，**禁止批量修改**，每项完成后验证再进入下一项。

**预计总工时**: 2–3 工作日  
**预计用户影响**: 强制重新登录 (S0-S3 阶段短期中断)  
**回滚窗口**: 每项操作前备份，回滚时间 < 15 min/项

---

## Phase S0 — Secret Rotation (最高优先)

### RISK-001: DeepSeek API Key 泄露

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-001 |
| **CVSS** | 9.8 (Critical) |
| **影响范围** | `shipin-cinematic-studio/.env` — 生产 LLM 调用凭证 |
| **泄露状态** | 🔴 已确认泄露 (`sk-63...`, `sk-d41...`) |
| **修改文件** | `shipin-cinematic-studio/.env` |
| **需要重启** | ✅ 是 — 需重启 node 进程让新 key 生效 |
| **影响登录** | ❌ 不影响 |
| **操作风险** | LLM 服务暂时不可用 (~5 min) |

**修复步骤**:
1. 登录 DeepSeek 控制台 → 撤销 `sk-63...` / `sk-d41...`
2. 生成新 Key (权限最小化：仅 `chat:write`)
3. 更新 `.env` 中 `DEEPSEEK_API_KEY` 为新 Key
4. 执行 `pm2 reload all` 或 `docker-compose restart app`
5. 验证: `curl -H "Authorization: Bearer $NEW_KEY" https://api.deepseek.com/v1/models`

**回滚**:
- 如新 Key 异常 → 重新生成并替换，旧 Key 已撤销不可恢复

---

### RISK-002: JWT Secret 弱/共享

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-002 |
| **CVSS** | 8.2 (High) |
| **影响范围** | `shipin-cinematic-studio` — 所有用户 Token |
| **泄露状态** | 🟡 多项目共享，疑似泄露 |
| **修改文件** | `shipin-cinematic-studio/.env`, 认证中间件 |
| **需要重启** | ✅ 是 |
| **影响登录** | ✅ **所有用户强制重新登录** |
| **操作风险** | 现有 Token 全部失效 |

**修复步骤**:
1. 生成新 Secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. 更新 `.env`: `JWT_SECRET=<new-random>`
3. 数据库执行: `UPDATE users SET tokenVersion = tokenVersion + 1` (或类似机制)
4. 重启服务
5. 验证: 旧 Token 应返回 401

**回滚**:
- 恢复旧 Secret + 撤回 tokenVersion 递增 → 但旧 Token 仍有效，等于未修复

---

### RISK-003: Credential Master Key 状态未知

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-003 |
| **CVSS** | 8.5 (High) — 取决于是否用于生产加密 |
| **影响范围** | `CREDENTIAL_MASTER_KEY` — 所有存储的 API Key |
| **泄露状态** | 🟡 需确认是否已用于生产数据加密 |
| **修改文件** | `.env`, 加密/解密模块 |
| **需要重启** | ✅ 是 |
| **影响登录** | ❌ 间接影响 |
| **操作风险** | ❌ **禁止暴力替换 — 会导致已加密数据永久丢失** |

**修复步骤**:
1. **先确认**: 检查 `CREDENTIAL_MASTER_KEY` 是否用于加密存储的 API Key
2. **如未使用**: 直接替换为新随机值
3. **如已使用**: 必须执行重加密流程:
   ```
   for each encrypted_record:
     plaintext = decrypt_with_old_key(record)
     new_ciphertext = decrypt_with_new_key(plaintext)
     update_record(new_ciphertext)
   ```
4. 更新 `.env` 中的 Key
5. 重启服务

**回滚**:
- 保留旧 Key → 如重加密失败，用旧 Key 解密并回滚

---

## Phase S1 — 数据库安全

### RISK-004: PostgreSQL 默认密码

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-004 |
| **CVSS** | 9.1 (Critical) |
| **影响范围** | `postgres/postgres` — 全库读写权限 |
| **泄露状态** | 🔴 默认密码，公网可暴力破解 |
| **修改文件** | PostgreSQL 用户密码, `.env` (`DATABASE_URL`) |
| **需要重启** | ❌ 不需要 (ALTER USER 即时生效) |
| **影响登录** | ❌ 不影响 (连接池需刷新) |
| **操作风险** | 连接池短暂中断 |

**修复步骤**:
1. 生成强密码: `openssl rand -base64 32`
2. `psql -U postgres -c "ALTER USER postgres WITH PASSWORD '<new>';"`
3. 更新 `.env`: `DATABASE_URL=postgres://postgres:<new>@localhost:5432/shipin`
4. 重启连接池 / 重启 app
5. 验证: `psql $DATABASE_URL -c "SELECT 1"`

**回滚**:
- `ALTER USER postgres WITH PASSWORD 'postgres';` — 但等于未修复

---

### RISK-005: Redis 无认证

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-005 |
| **CVSS** | 8.8 (High) |
| **影响范围** | Session / Cache / BullMQ Queue |
| **泄露状态** | 🔴 无密码，端口暴露 |
| **修改文件** | `redis.conf`, `.env` (`REDIS_URL`) |
| **需要重启** | ✅ 是 (Redis 重启 ~10s) |
| **影响登录** | ⚠️ Session 短暂失效 |
| **操作风险** | 队列任务丢失 (BullMQ 持久化则无风险) |

**修复步骤**:
1. 生成密码: `openssl rand -base64 24`
2. `redis.conf` 追加: `requirepass <strong-password>`
3. `redis-cli shutdown save` → 重启 redis 服务
4. 更新 `.env`: `REDIS_URL=redis://:<new>@localhost:6379`
5. 重启 app
6. 验证: `redis-cli -a <new> ping` → `PONG`

**回滚**:
- 注释掉 `requirepass` → 重启 Redis → 恢复旧 `REDIS_URL`

---

## Phase S2 — MinIO 隔离

### RISK-006: MinIO 公网暴露

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-006 |
| **CVSS** | 9.0 (Critical) |
| **影响范围** | 用户图片、视频资产、上传文件 — **全量数据** |
| **泄露状态** | 🔴 `0.0.0.0:9000` / `0.0.0.0:9001` 公网直连 |
| **修改文件** | `docker-compose.yml`, MinIO 凭证 |
| **需要重启** | ✅ 是 (MinIO 重启 ~15s) |
| **影响登录** | ❌ 不影响 |
| **操作风险** | 文件上传/下载短暂中断 |

**修复步骤**:
1. 修改 `docker-compose.yml`:
   ```yaml
   ports:
     - "127.0.0.1:9000:9000"
     - "127.0.0.1:9001:9001"
   ```
2. Rotate 凭证:
   - `MINIO_ROOT_USER` → 新值
   - `MINIO_ROOT_PASSWORD` → 新值 (20+ 字符)
3. `docker-compose down && docker-compose up -d minio`
4. 更新 `.env`: `MINIO_ENDPOINT=127.0.0.1:9000`
5. 验证: `curl http://127.0.0.1:9000/minio/health/live`
6. 检查所有 bucket ACL 确认无公开读

**回滚**:
- 恢复 `0.0.0.0` 绑定 → 但等于未修复

---

## Phase S3 — 认证漏洞修复

### RISK-007: Demo Token 绕过

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-007 |
| **CVSS** | 9.9 (Critical) |
| **影响范围** | `tenant-guard.ts`, `media-platform.ts` |
| **泄露状态** | 🔴 硬编码 `Bearer demo-token` / `Bearer test` |
| **修改文件** | `src/middleware/tenant-guard.ts`, `src/routes/media-platform.ts` |
| **需要重启** | ✅ 是 |
| **影响登录** | ⚠️ 测试账号失效 |
| **操作风险** | 依赖这些 token 的自动化测试/脚本将失效 |

**修复步骤**:
1. 定位并删除:
   ```ts
   // 删除此类代码:
   if (token === 'demo-token' || token === 'test') {
     req.user = { role: 'admin', tenantId: 'demo' }
     return next()
   }
   ```
2. 确认无其他硬编码 bypass (grep `Bearer `, `demo`, `test`, `bypass`)
3. 提交代码 → CI 部署
4. 验证: 使用 `Bearer demo-token` 应返回 401

**回滚**:
- Git revert 该 commit → 部署

---

## Phase S4 — 网络边界

### RISK-008: 防火墙未收紧

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-008 |
| **CVSS** | 7.5 (High) |
| **影响范围** | 服务器全端口暴露 |
| **修改文件** | `ufw` / `iptables` / 安全组 |
| **需要重启** | ❌ 否 |
| **影响登录** | ⚠️ 配置错误会锁死 SSH |
| **操作风险** | 🔴 **操作不当将永久失去服务器访问** |

**修复步骤** (严格按顺序):
1. **先创建普通 sudo 用户**:
   ```bash
   useradd -m -s /bin/bash deploy
   usermod -aG sudo deploy
   passwd deploy
   ```
2. **SSH 测试**: 用 `deploy` 用户登录，确认 sudo 正常
3. **配置防火墙**:
   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP
   ufw allow 443/tcp   # HTTPS
   ufw enable
   ```
4. **禁止 root login**: `sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config`
5. `systemctl restart sshd`
6. **新开终端测试 SSH** — 确认 `deploy` 用户可用

**回滚**:
- 如云主机 → 通过 VNC 控制台恢复
- 如物理机 → 现场操作

---

## Phase S5 — Web 安全

### RISK-009: CORS 全开放

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-009 |
| **CVSS** | 6.5 (Medium) |
| **影响范围** | API 跨域策略 |
| **修改文件** | CORS 中间件配置 |
| **需要重启** | ✅ 是 |
| **影响登录** | ⚠️ 前端跨域可能短暂异常 |
| **操作风险** | 误配会导致前端白屏 |

**修复步骤**:
1. 替换 `origin: '*'` 为白名单:
   ```ts
   origin: ['https://aigc.fushtn.com', 'https://agi.fushtn.com']
   ```
2. 如有其他域名需加入白名单，在此阶段一并审批
3. 部署验证: 从非白名单域名发起请求应被拒绝

**回滚**:
- 临时恢复 `origin: '*'` → 部署

---

### RISK-010: Admin API 无限流

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-010 |
| **CVSS** | 7.0 (High) |
| **影响范围** | `/api/admin/*`, `/api/auth/login` |
| **修改文件** | Rate Limit 中间件 |
| **需要重启** | ✅ 是 |
| **影响登录** | ⚠️ 频繁登录用户可能被临时限制 |
| **操作风险** | 限流过严影响正常用户 |

**修复步骤**:
1. `/api/admin/*`: 5 req/min/IP
2. `/api/auth/login`: 3 req/min/IP + 账户级锁定 (5 次失败/15 min)
3. 使用 Redis 存储限流计数 (参见 RISK-005)
4. 部署验证: `ab -n 10 -c 2 https://aigc.fushtn.com/api/admin/test`

**回滚**:
- 移除限流中间件 → 部署

---

## Phase S6 — 清理泄露面

### RISK-011: 备份文件暴露

| 字段 | 值 |
|---|---|
| **风险编号** | RISK-011 |
| **CVSS** | 8.0 (High) |
| **影响范围** | `.env.bak*`, `.env.backup*`, `.conf.bak*` |
| **修改文件** | nginx conf, 文件系统 |
| **需要 restart** | ✅ nginx reload |
| **影响登录** | ❌ 不影响 |
| **操作风险** | 误删正在使用的备份 |

**修复步骤**:
1. 查找:
   ```bash
   find /root/shipin-cinematic-studio -name ".env*" -o -name "*.bak" -o -name "*.backup" -o -name "*.corrupt"
   ```
2. 确认无活跃引用后删除
3. Nginx 加固 — 添加:
   ```nginx
   location ~ \.(bak|backup|old|orig|save|swp|tmp)$ {
     deny all;
     return 404;
   }
   location ~ /\.(env|git|ht) {
     deny all;
     return 404;
   }
   ```
4. `nginx -t && nginx -s reload`
5. 验证: `curl -I https://aigc.fushtn.com/.env.bak` → 404

**回滚**:
- 如误删 → 从 Git 恢复 `.env` 参考版 → 手动填充 Secret

---

## 执行顺序总览

```
S0  Secret Rotation        ← 立即 (1-2h)
 ├── RISK-001 DeepSeek Key
 ├── RISK-002 JWT Secret
 └── RISK-003 Master Key
S1  Database               ← 同日 (1h)
 ├── RISK-004 PostgreSQL
 └── RISK-005 Redis
S2  MinIO                  ← 同日 (30min)
 └── RISK-006
S3  Auth Bypass            ← 次日 (2h)
 └── RISK-007
S4  Network Boundary       ← 次日 (2h ⚠️ 高风险)
 └── RISK-008
S5  Web Security           ← 次日 (1h)
 ├── RISK-009 CORS
 └── RISK-010 Rate Limit
S6  Cleanup                ← 最后 (30min)
 └── RISK-011
```

---

## 执行约束

| 约束 | 说明 |
|---|---|
| **范围限制** | `TARGET_SCOPE=aigc.fushtn.com ONLY` — 禁止触碰 `sc.86aigc.cn` |
| **单线执行** | 每项完成后验证，禁止批量修改 |
| **备份优先** | 任何修改前先备份 |
| **回滚测试** | S4 防火墙前必须新开 SSH 会话验证 |
| **用户通知** | RISK-002 (JWT) 执行前 30min 通知用户强制重新登录 |
| **审计日志** | 所有修改记录到 Git + 本报告附录 |

---

## 附录 A: 预检清单

执行前确认:

- [ ] 拥有 DeepSeek 控制台访问权限
- [ ] 拥有服务器 SSH 访问 (且已创建 `deploy` 用户)
- [ ] PostgreSQL 本地连接可用
- [ ] Redis CLI 可用
- [ ] Docker Compose 可用
- [ ] 代码仓库有最新提交 (便于回滚)
- [ ] 备份当前 `.env` 文件
- [ ] 备份当前 `docker-compose.yml`
- [ ] 备份当前 `redis.conf`

---

## 附录 B: 紧急联系

| 角色 | 联系 | 备注 |
|---|---|---|
| CTO | — | 本报告审批人 |
| DevOps | — | 基础设施变更 |
| 前端 Lead | — | CORS 变更确认 |

---

> **审批签字**: ___________________  
> **日期**: ___________________  
> **CTO 确认**: ☐ 批准执行 ☐ 需修改 ☐ 拒绝  
>
> **审批后方可进入 S0 执行阶段。**
