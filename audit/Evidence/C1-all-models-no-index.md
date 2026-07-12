# Evidence: C1 — 所有数据库表无索引

- **问题**: 324 个数据库模型无任何自定义索引
- **严重等级**: CRITICAL
- **所在文件**: `backend/prisma/schema.prisma`
- **涉及模块**: Database - Prisma Schema
- **调用链**: 所有 DB 查询
- **影响范围**: 全局 - 所有查询全表扫描
- **原因分析**: 未在 schema 中添加 `@@index` 或 `@@unique`
- **修复建议**: 为所有外键和查询字段添加索引
- **预计工作量**: 2-3 天
- **风险等级**: CRITICAL

**验证命令**:
```bash
cd /root/shipin-cinematic-studio/
models=$(grep -E '^model [A-Z]' backend/prisma/schema.prisma | awk '{print $2}')
count=0
for m in $models; do
  has_index=$(awk "/^model $m/,/^model [A-Z]|^}/" backend/prisma/schema.prisma | grep -c "index\|@@unique\|@id\|@@id")
  if [ "$has_index" -eq 0 ]; then count=$((count+1)); fi
done
echo "NO INDEX: $count out of $(echo "$models" | wc -l)"
```

**结果**: 324 out of 324 models have index=0 (100%)
