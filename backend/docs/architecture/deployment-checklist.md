# Phase 7A — Production Deployment Checklist

## 🔴 Pre-Deployment Gate

- [ ] SAT 验证: `npx tsx tests/kernel/sat-phase7a.runner.ts` → **PASS**
- [ ] 全测试套件: `bash tests/run.sh` → **12/12 passed**
- [ ] 编译: `npx tsc --noEmit` → **zero errors**
- [ ] dist/ 构建: `bash scripts/build-dist.sh` → **no errors**

## 🟢 Runtime Boot

- [ ] `node dist/entry/server.js` → 输出 "boot complete"
- [ ] 模式设置正确（safe/shadow/evolve）
- [ ] `dist/config/` 存在且可读
- [ ] `dist/config/safety.constraints.json` 加载成功
- [ ] Kernel bundle 存在

## 🟡 Observability

- [ ] Event stream 已启动
- [ ] Metrics 采集中
- [ ] Transport layer 可达
- [ ] Persistence 目录可写

## 🔵 Rollback

- [ ] execution.store 可回滚
- [ ] checkpoint.store 可回滚
- [ ] policy 版本可回滚
- [ ] graph 版本可回滚

## 🟠 Mode-Specific

### SAFE mode
- [ ] mutation = OFF
- [ ] optimization = OFF
- [ ] policy = FROZEN

### SHADOW mode
- [ ] mutation = OFF
- [ ] optimization = ON (shadow)
- [ ] policy = FROZEN

### EVOLVE mode
- [ ] mutation = ON (FORKED only)
- [ ] formal guard = STRICT
- [ ] policy = bounded evolution

## 🚨 Failure Response

| Symptom | Action |
|---------|--------|
| cross-plane leakage > 0 | 立即终止，隔离泄漏源 |
| mutation breaks DAG | 回滚到上一个 graph version |
| drift > threshold | 回滚 policy 到基线版本 |
| async hang | 超时强制终止 tick loop |
| replay mismatch | 标记执行为不可信 |

## ✅ Deployment Sign-off

- [ ] SAT Gate: PASS
- [ ] dist/built: PASS
- [ ] Runtime boot: PASS
- [ ] Mode configured correctly
- [ ] Observability active
- [ ] Rollback capable
- [ ] Team notified

---

*Phase 7A — Production Deployment Gate*
*完成以上所有项后，系统可进入生产环境。*
