# Evidence: C4 — API Keys 明文在 .env

- **问题**: 12 个 Provider API keys 明文存储在 `.env`
- **严重等级**: CRITICAL
- **所在文件**: `backend/.env`
- **涉及模块**: 安全 / 配置
- **影响范围**: 所有 Provider 凭据泄露风险
- **原因分析**: .env 文件被版本控制
- **修复建议**: 使用密钥管理服务 / Vault
- **预计工作量**: 2-3 天
- **风险等级**: CRITICAL

**暴露的 Keys**:
```
JWT_SECRET=lu1FJxkENKZ2EUFovxt+FC6TQdsMQPuJA4ccKqqV8YjjmB6bNMxK3LIxa+FdNf0/T7dxOS5V2X2LTvBO5tL9IQ==
MINIO_SECRET_KEY=e7f3a8b66eaf0ebcce6d9b5b98ef6a56475d4b6a34a1fb3d
CRYPTO_ENCRYPTION_KEY=f535f7bcb360367cf03441091090227f7b9de011d65044fd0b7b83fe90099596
SUNO_API_KEY, MUREKA_API_KEY, MUSIC15_API_KEY 等 (空值但占位)
```

`.env.bak.20260624_000628` 和 `.env.backup.sec-003` 也存在相同密钥。
