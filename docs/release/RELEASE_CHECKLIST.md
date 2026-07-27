# Release Checklist

**用途**: 每个版本发布前必须完成的检查清单  
**适用范围**: 所有产品线（企业招聘、AI新媒体、AI音乐、AI小说、AI广告）

---

## 一、Pre-Build

- [ ] PRD 已评审通过
- [ ] 技术方案已确认
- [ ] 数据库变更（如有）已记录回滚方案
- [ ] API 变更（如有）已记录兼容性影响

## 二、Build

- [ ] `npm run build` 无 Error
- [ ] 无新增 TypeScript 编译错误
- [ ] 无新增 ESLint Warning（Critical 级别）
- [ ] 构建产物大小无异常增长（>20% 需说明原因）

## 三、Reality Gate（技术验收）

- [ ] API Smoke Test 全量通过
- [ ] 数据库迁移成功（如有）
- [ ] 路由注册完整（Route Registry Audit）
- [ ] 跨租户隔离验证通过
- [ ] 异常输入返回正确 HTTP 状态码（400/401/403/404/500）
- [ ] 日志无 Critical 级别错误

## 四、Product Gate（业务验收）

- [ ] Happy Path 端到端通过
- [ ] 历史数据加载正常
- [ ] 边界场景处理正确
- [ ] UI 无阻塞性显示问题
- [ ] 核心指标计算正确

## 五、Deploy

- [ ] 部署脚本已更新（如有变更）
- [ ] 环境变量已配置
- [ ] PM2 进程正常启动
- [ ] 健康检查端点返回 200
- [ ] 回滚方案已准备

## 六、Post-Deploy

- [ ] 生产环境 Smoke Test 通过
- [ ] 关键页面可正常打开
- [ ] 监控无异常告警
- [ ] CHANGELOG 已更新
- [ ] Phase Report 已归档

---

*任何一项未通过，不得进入下一阶段。*
