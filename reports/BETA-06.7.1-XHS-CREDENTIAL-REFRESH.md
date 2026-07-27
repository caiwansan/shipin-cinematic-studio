# BETA-06.7.1 — XHS Credential Refresh

> 日期：2026-07-19
> 目标：将 demo_xhs_creator 从 Capability PASS 提升为 Production PASS

---

## 当前状态

| 检查项 | 状态 |
|--------|------|
| 账号授权机制 | ✅ |
| 凭证加密存储 | ✅ |
| Browser Runtime 恢复能力 | ✅ |
| Cookie 生命周期管理 | ✅ |
| 真实账号状态 | ⚠️ Cookie 已过期，需刷新 |

### 数据库
```
media_platform_account:
  id: c0562c6c-a89c-43d9-af60-57efd4f065ac
  account_name: demo_xhs_creator
  status: active
  credential_vault_id: 6512e573-ec5c-4f36-ba28-aecb02e3d9a3

media_credential_vault:
  id: 6512e573-ec5c-4f36-ba28-aecb02e3d9a3
  status: EXPIRED
  last_error: "Cookie expired on 2026-07-19, needs fresh login"
```

---

## 新增基础设施

### API Endpoints
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/media/accounts/refresh-cookies` | 刷新 XHS cookies |
| GET | `/media/accounts/health` | 账号健康检查 |

### Cookie Refresh Script
路径：`scripts/refresh-xhs-cookies.py`

用户在本地 Chrome 登录小红书后运行此脚本，自动：
1. 从 Chrome SQLite DB 提取 XHS cookies
2. Base64 编码
3. POST 到 API 更新 credential_vault

### 数据库 Schema 升级
```sql
ALTER TABLE media_credential_vault ADD COLUMN expires_at TIMESTAMP;
ALTER TABLE media_credential_vault ADD COLUMN last_verified_at TIMESTAMP;
ALTER TABLE media_credential_vault ADD COLUMN auto_refresh_enabled BOOLEAN DEFAULT false;
ALTER TABLE media_credential_vault ADD COLUMN refresh_count INTEGER DEFAULT 0;
ALTER TABLE media_credential_vault ADD COLUMN last_error TEXT;
```

状态枚举：`active`, `expired`, `invalid`, `revoked`

---

## 待办（需用户操作）

1. **在本地 Chrome 登录小红书** → https://creator.xiaohongshu.com
2. **运行脚本** → `python3 scripts/refresh-xhs-cookies.py`
3. **验证** → `curl https://aigc.fushtn.com/api/enterprise/media-department/media/accounts/health?organizationId=demo-org-001`

## Gate 2 热点分析 AI — 可并行启动

热点分析是内部分析能力，不依赖 Cookie。可立即开发：
- 品牌信息 + 行业 → 热点分析师 AI → media_hotspot 表
- LLM 生成今日热点选题建议
- 输出：{ 标题, 热度, 关联标签, 建议选题 }
