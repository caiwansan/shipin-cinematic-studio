# Evidence: C2 — 25 条路由文件无认证

- **问题**: 路由文件完全没有任何认证/鉴权
- **严重等级**: CRITICAL
- **所在文件**: `backend/src/routes/*.ts` 
- **涉及模块**: 路由 / 安全
- **调用链**: 外部请求 → 路由 → 业务逻辑 (无 auth check)
- **影响范围**: 25 个路由文件可能暴露敏感操作
- **原因分析**: 未在路由注册时添加 `requireAdmin` 或 JWT 验证
- **修复建议**: 逐条评估是否需要 auth, 添加认证中间件
- **预计工作量**: 2-3 天
- **风险等级**: CRITICAL

**无认证路由清单**:
1. `api-video-optimize.ts`
2. `desktop-comfy.ts`
3. `desktop-update.ts`
4. `desktop-video.ts`
5. `director-v2.ts`
6. `export.ts`
7. `fight-templates-meta.ts`
8. `models.ts`
9. `novel-cleanup.ts`
10. `novel-cron.ts`
11. `observability.ts`
12. `p0-gateway-route.ts`
13. `p1.8-evaluate.ts`
14. `pipeline-jobs.ts`
15. `projects-v2.ts`
16. `prompt-registry.ts`
17. `proxy-image.ts`
18. `r11-console.ts`
19. `script-breakdown.ts`
20. `sms.ts`
21. `style-profiles.ts`
22. `system-version.ts`
23. `tasks-telemetry.ts`
24. `video-merge.ts`
25. `workbench-director.ts`

**验证命令**:
```bash
cd /root/shipin-cinematic-studio/backend/src
for f in routes/*.ts; do
  has_admin=$(grep -c "requireAdmin\|adminOnly" "$f")
  has_auth=$(grep -c "jwt\|auth\|verifyToken\|token" "$f")
  if [ "$has_admin" -eq 0 ] && [ "$has_auth" -eq 0 ]; then
    echo "NO AUTH: $(basename $f)"
  fi
done | wc -l
```
