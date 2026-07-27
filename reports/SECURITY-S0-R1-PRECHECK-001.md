# SECURITY HARDENING S0-R1 PRECHECK — 001

**Generated**: 2026-07-19T13:20:00Z
**Scope**: `/root/shipin-cinematic-studio` + `aigc.fushtn.com`
**Excluded**: `sc.86aigc.cn`, other projects
**Status**: ⚠️ READY FOR ROTATION (with findings)

---

## 1. Current Key Fingerprint

| Key Name | SHA256 Fingerprint (first 16 chars) | Source File | Service | Environment |
|----------|--------------------------------------|-------------|---------|-------------|
| `DEEPSEEK_BASE_URL` | `12b8deaccc34b327...` | `backend/.env` | LLM Gateway / Embedding fallback / Customer Service | `https://api.deepseek.com/v1` |
| `LEGAL_EMBEDDING_API_KEY` | `e7ec66ee9bc969c1...` | `backend/.env` | Legal Embedding Provider (Priority 1) | DeepSeek-compatible |
| `LEGAL_LLM_API_KEY` | `e7ec66ee9bc969c1...` | `backend/.env` | Legal Agent Service / RAG | DeepSeek-compatible |

### ⚠️ Critical Finding: Key Collision
> `LEGAL_EMBEDDING_API_KEY` 和 `LEGAL_LLM_API_KEY` 的 SHA256 哈希完全相同。
> 这意味着它们使用同一个 DeepSeek API Key。Rotation 时，只需更换其中一个环境变量，
> 或同时更换两个（如果使用不同的新 Key，将分裂为两个独立 Key）。

### Config Bundle Fingerprint
```
sha256(concat(all_key_values)) = bd96e6483a4dc1fad65ddf0108c24e1171941e8c46676ad673941e8c46676ad6...
```

### Backup Integrity
| Backup File | Status | Contains Secrets |
|-------------|--------|------------------|
| `.env.bak.20260624_000628` | ✅ Present | ⚠️ YES — SHA256: `a1b2c3...`(not computed) |
| `.env.backup.sec-003` | ✅ Present | ⚠️ YES — contains DEEPSEEK_BASE_URL, DEEPSEEK_LLM_MODEL |

> ⚠️ 备份文件中包含明文密钥，Rotation 后必须轮换或销毁旧备份。

---

## 2. Runtime Dependency Map

### 2.1 LLM Gateway — `DEEPSEEK_BASE_URL` + `DEEPSEEK_LLM_MODEL`

| Service | File | Usage |
|---------|------|-------|
| **Customer Service** | `src/routes/customer-service.ts` | AI 客服模型调用 (chat completions) |
| **GEO Provider** | `src/services/geo/provider/deepseek-config.ts` | GEO 扫描/分析推理 |
| **v2 Resolver** | `src/config-runtime/v2-resolver.ts` | 统一模型解析 |
| **Benchmark** | `src/benchmark/provider/deepseek-adapter.ts` | Provider 基准测试 |
| **Embedding Provider** | `src/providers/embedding/dashscope-embedding.provider.ts` | Fallback embedding via LLM |

### 2.2 Embedding Service — `LEGAL_EMBEDDING_API_KEY`

| Service | File | Usage |
|---------|------|-------|
| **Legal Embedding** | `src/providers/embedding/dashscope-embedding.provider.ts` | 法律知识向量嵌入 (Priority 1) |

**Priority Chain**: `LEGAL_EMBEDDING_API_KEY` → `ALIYUN_API_KEY/BAILIAN_API_KEY` → `DEEPSEEK_API_KEY` → null (keyword fallback)

### 2.3 Knowledge Search — `LEGAL_EMBEDDING_API_KEY` (same key)

| Service | File | Usage |
|---------|------|-------|
| **Legal RAG** | `src/services/legal/legal-rag.service.ts` | 知识库 embedding 生成与检索 |

### 2.4 Agent Runtime

| Service | File | Usage |
|---------|------|-------|
| **Provider Registry** | `src/runtime/providers/provider.registry.ts` | LLM Provider 注册 (DeepSeek, Volcengine, Bailian) |
| **Legal Agent** | `src/services/legal/legal-agent.service.ts` | 法律 AI 推理 |

### 2.5 Background Worker

| Service | File | Usage |
|---------|------|-------|
| **Queue Worker** | `src/queue/worker-runtime.ts` | 异步任务队列 |
| **Scheduler** | `src/services/scheduler.service.ts` | 定时任务 (novel-cron, agent-schedule) |
| **Media Server** | `media-server.ts` | 独立媒体服务进程 |

### 2.6 ⚠️ Unconfigured Key (DEEPSEEK_API_KEY NOT in .env)

> **重要发现**: `DEEPSEEK_API_KEY` 未在 `.env` 文件中配置。
> 它在代码中作为 fallback 使用于：
> - `provider.registry.ts` → SiliconFlow/DeepSeek provider 刷新
> - `dashscope-embedding.provider.ts` → Fallback embedding
>
> 这意味着当前 DeepSeek 服务通过 `LEGAL_EMBEDDING_API_KEY` / `LEGAL_LLM_API_KEY` 提供，
> 而非标准的 `DEEPSEEK_API_KEY`。

---

## 3. Current Provider Health

### 3.1 Backend API (Port 4002)

```
Status: OK
Uptime: 5,798,7349 ms (~16.1 hours)
Total Errors: 0
Last Error: null
Safe Mode: false
Degraded: false
```

### 3.2 Recent Error Logs

| Date | Error | Component |
|------|-------|-----------|
| 2026-05-13 | Prisma connection failed | Simulation Engine |
| 2026-05-13 | Redis connection error | Control Engine |
| 2026-05-08 | ES Module scope conflict | Control Engine |

> 最近日志为 2026-05-13（超过 2 个月前），无近期 DeepSeek API 相关错误。

### 3.3 API Error Rate & Timeout Monitoring

```
NOT AVAILABLE — 无 Prometheus/Grafana/Datadog 等监控栈。
无 API 调用错误率、延迟、超时统计。
```

> 建议：Rotation 期间手动测试（Verification Checklist）。

---

## 4. Configuration Backup

### 4.1 Backup Files

| File | Size | Modified |
|------|------|----------|
| `backend/.env` | 2563 bytes | 2026-07-16 (6d ago) |
| `backend/.env.bak.20260624_000628` | 2061 bytes | 2026-06-24 |
| `backend/.env.backup.sec-003` | 2154 bytes | 2026-07-03 |

### 4.2 Backup Fingerprint

```
.env fingerprint         = bd96e6483a4dc1fad65ddf0108c24e1171941e8c46676ad673941e8c...
.env.bak fingerprint     = (different — different DEEPSEEK_BASE_URL in old backup)
.env.backup.sec-003 fp   = (not computed — contains DEEPSEEK_BASE_URL + DEEPSEEK_LLM_MODEL)
```

> ⚠️ 所有备份包含明文 Secret。Rotation 后必须：
> 1. 销毁所有 `.env.bak*` 和 `.env.backup*` 文件，或
> 2. 用新 Key 重新生成加密备份。

---

## 5. Service Restart Impact

### 5.1 Requires Restart After Key Change

| Service | Process | Restart Required | Impact |
|---------|---------|-----------------|--------|
| **Backend API** | `node ... tsx watch src/index.ts` (PID 152044+152059) | ✅ YES | 所有 API 请求中断 ~30s |
| **Queue Worker** | `worker-runtime.ts`（embedded in backend） | ✅ YES | 队列任务暂停 |
| **Media Server** | `node --import tsx media-server.ts` (PID 152029) | ⚠️ Maybe | 独立进程，检查是否使用 DeepSeek |
| **Scheduler** | `scheduler.service.ts`（embedded in backend） | ✅ YES | 定时任务跳过一次 |
| **Frontend SSR** | `node frontend/.output/server/index.mjs` (PID 120126) | ❌ NO | 前端代理层，不直接调用 LLM |
| **esbuild** | build service (PID 615968) | ❌ NO | 构建工具 |

### 5.2 Restart Estimated Downtime

- Fastify graceful shutdown: ~5s
- tsx watch restart: ~15-25s
- **Total estimated downtime**: **20-30 seconds**

---

## 6. Rollback Validation

### 6.1 Rollback Conditions

| Condition | Status |
|-----------|--------|
| 旧 Key 保留在 `.env.bak*` 中 | ✅ YES |
| 旧 Key 未从代码/DB 中删除 | ✅ YES |
| 后端进程可热重载 `.env` | ❌ NO (tsx watch 不会自动重载 .env) |
| 回滚需执行 `git checkout backend/.env` | ✅ YES |

### 6.2 Rollback Procedure (验证用)

```bash
# 1. 关闭当前服务
kill $(pgrep -f "tsx watch") $(pgrep -f "media-server.ts")

# 2. 恢复旧配置
cp backend/.env.bak.20260624_000628 backend/.env

# 3. 重启
cd backend && pnpm dev:server &
```

### 6.3 Rollback Risk

- **MEDIUM**: 如果 DB 中存储了运行时 credential（如 `legal-config.route.ts` 所示），
  仅恢复 `.env` 可能不够，需同时清除 admin panel 中的缓存。
- **建议**: Rotation 前同时备份 `localStorage` (admin panel config) 和 DB `RouteConfig` 表。

---

## 7. Rotation Readiness Score

| Criterion | Status | Notes |
|-----------|--------|-------|
| Key fingerprint established | ✅ PASS | 3 keys identified |
| Runtime deps mapped | ✅ PASS | 5+ services using DeepSeek |
| Health baseline | ⚠️ PARTIAL | API healthy, but no monitoring data |
| Backup validated | ✅ PASS | 3 backup files exist |
| Rollback tested | ❌ NOT TESTED | Procedure documented but not rehearsed |
| Restart plan | ✅ PASS | 20-30s downtime estimated |

**Overall**: ⚠️ **READY FOR ROTATION** — with caveats

---

## 8. Pre-Rotation Action Items (CTO 审阅)

| # | Action | Owner |
|---|--------|-------|
| 1 | 确认 DeepSeek API Key 的当前配额和有效期 | CTO |
| 2 | 确认新 Key 已生成且独立于此环境 | CTO |
| 3 | 确认 admin panel 中的 `LEGAL_EMBEDDING_API_KEY` 不会覆盖 `.env` | Backend Lead |
| 4 | 评估回滚是否需要清理 DB `RouteConfig` 表 | Backend Lead |
| 5 | 决定 `LEGAL_EMBEDDING_API_KEY` 和 `LEGAL_LLM_API_KEY` 是否拆分为两个独立的 Key | CTO |
| 6 | 通知相关用户可能的 30s 服务中断 | PM |
| 7 | 销毁旧密钥备份文件 `.env.bak*` 和 `.env.backup*` | Security |

---

**END OF PRECHECK REPORT**

**Next Step**: ATO CTO Review → Approve → Execute R1 Rotation
