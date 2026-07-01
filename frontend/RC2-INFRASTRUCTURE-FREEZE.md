# RC2 Infrastructure Freeze — 发布基础设施冻结声明

**冻结日期**: 2026-06-30
**冻结范围**: 发布基础设施，不再做功能性调整

## 冻结清单

| 模块 | 状态 | 后续仅允许 |
|------|------|-----------|
| Build Pipeline (`nuxt build`) | ✅ 冻结 | Bug Fix |
| Build Validator (`scripts/build-validator.mjs`) | ✅ 冻结 | Bug Fix |
| Manifest Patch (`scripts/patch-manifest.mjs`) | ✅ 冻结 | Bug Fix |
| Asset Sync (`scripts/asset-sync.mjs`) | ✅ 冻结 | Bug Fix |
| Release Metadata (`scripts/release-meta.mjs`) | ✅ 冻结 | Bug Fix |
| Smoke Test (`scripts/deployment-check.mjs`) | ✅ 冻结 | Bug Fix |
| Doctor Health Check (`scripts/doctor.mjs`) | ✅ 冻结 | Bug Fix |
| PM2 Release Flow (`npm run release`) | ✅ 冻结 | Bug Fix |
| Nginx Static Sync Mechanism | ✅ 冻结 | Bug Fix |

## 发布流程（冻结）

```
nuxt build → build-validator(Set Diff) → patch-manifest → 
asset-sync(计数校验) → release-meta → pm2 restart → 
deployment-check(Smoke Test)
```

## 快捷命令

| 命令 | 用途 |
|------|------|
| `npm run build` | 编译 |
| `npm run validate` | 仅校验产物 |
| `npm run sync` | 仅同步到 Nginx |
| `npm run meta` | 生成 release.json |
| `npm run smoke` | 线上 Smoke Test |
| `npm run doctor` | 全链路健康检查 |
| `npm run deploy` | validate + patch + sync + meta |
| `npm run release` | build → deploy → restart → smoke |

## 例外条款

仅以下情况可修改冻结部分：
1. 阻塞发布的缺陷（如 404、500、部署失败）
2. 安全性更新
3. 熊大明确要求修改
