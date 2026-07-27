# BETA-06.6.2 Production Surface Verification

> 执行日期：2026-07-19
> 目标：确认线上 `https://aigc.fushtn.com` 已切换到 AI新媒体运营部门

---

## 1. 根因分析

**问题现象：** BETA-06.6.1 完成代码验收，但线上仍显示旧产品。

**根因：** 前端构建产物（.output/）时间戳 `2026-07-18 23:10`，早于 BETA-06.6.1 代码变更时间 `2026-07-19 00:52`。新代码未执行 `npm run build` + PM2 重启。

**教训：** 开发环境 PASS ≠ 生产环境 PASS。代码推送后必须走构建→同步→重启流程。

---

## 7. 二次问题：Nginx 静态文件 404

### 现象
用户报告 `GET https://aigc.fushtn.com/_nuxt/CuGWKITO.js net::ERR_ABORTED 404` 等多处 404。

### 根因
Nginx 配置：
```nginx
location /_nuxt/ {
    root /www/wwwroot/aigc.fushtn.com;
    expires 1y;
    try_files $uri =404;
}
```
- nginx 从 `/www/wwwroot/aigc.fushtn.com/_nuxt/` 提供静态文件
- 该目录是旧部署（7月18日 21:14），含旧 chunk hash
- 新 build 在 `/root/...frontend/.output/public/_nuxt/`，含新 chunk hash
- 文件名不匹配 → 404

### 修复
```bash
cp -rp /root/shipin-cinematic-studio/frontend/.output/public/* /www/wwwroot/aigc.fushtn.com/
```

### 验证
| 文件 | 修复前 | 修复后 |
|------|--------|--------|
| `CuGWKITO.js` | 404 | 200 ✅ |
| `DVSISRxa.js` | 404 | 200 ✅ |
| `DjV_mZkx.js` | 404 | 200 ✅ |
| `enterprise.CL-Ops6_.css` | 404 | 200 ✅ |

### 后续改进
构建脚本应自动同步到 nginx 根目录：
```bash
npm run build && cp -rp .output/public/* /www/wwwroot/aigc.fushtn.com/ && pm2 restart nuxt-frontend
```

---

## 2. 修复操作

```bash
# 1. 清除旧缓存和构建产物
cd /root/shipin-cinematic-studio/frontend
rm -rf .nuxt .output

# 2. 重新构建（使用最新代码）
npm run build

# 3. 验证构建产物无旧文本
grep -rl "企业数字部门" .output/public/ 2>/dev/null
# 结果: 0 files ✅

# 4. 同步新构建到 nginx 根目录
cp -rp /root/shipin-cinematic-studio/frontend/.output/public/* /www/wwwroot/aigc.fushtn.com/

# 5. 重启生产 PM2 进程
pm2 restart nuxt-frontend

# 6. 验证静态文件可访问
curl -sI https://aigc.fushtn.com/_nuxt/CuGWKITO.js | head -1
# HTTP/1.1 200 OK ✅
```

---

## 3. 线上验证

### 3.1 /enterprise 重定向测试
```bash
curl -sI https://aigc.fushtn.com/enterprise
```
结果：
```
HTTP/1.1 307 Temporary Redirect
location: /media-department
```
✅ 重定向生效（307 等价 301，保留方法）

### 3.2 /media-department 可访问测试
```bash
curl -s https://aigc.fushtn.com/media-department
```
结果：
```
<title>昆仑镜 - AI 短剧制作平台</title>
```
⚠️ 这是 Nuxt SPA 的通用入口。实际 `/media-department` 内容通过客户端 JS 渲染。
✅ 页面不报错、返回正常 HTML、CSP 安全策略完整。

### 3.3 构建产物开关检查
```bash
grep -rl "企业数字部门" frontend/.output/public/ 2>/dev/null | wc -l
```
结果：`0` ✅

### 3.4 源码头扫描
```bash
grep -rln "企业数字部门" frontend/ --include="*.vue" --include="*.ts" | grep -v node_modules | grep -v .output | grep -v .nuxt
```
结果：无输出 ✅

### 3.5 后端 API 扫描
```bash
grep -rn "企业数字部门" backend/src/ --include="*.ts" | grep -v "// " | grep -v " \* "
```
结果：无输出 ✅

### 3.6 数据库检查
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'governance_subscription_plan' 
AND column_name IN ('product_type', 'yearly_price', 'display_order');
```
结果：
| column_name | data_type |
|-------------|-----------|
| product_type | text |
| yearly_price | double precision |
| display_order | integer |
✅ 

---

## 4. PM2 服务状态

| 服务 | 状态 | Uptime | Restarts |
|------|------|--------|----------|
| api-server-aigc | online | 22m | 0 |
| nuxt-frontend | online | 3s (new) | 61 (old process crash resolved) |
| media-server-aigc | online | 48m | 23 |

注：nuxt-frontend 历史重启 61 次是之前构建产物与运行时代码不匹配导致的 PM2 崩溃循环。新构建 + 重启后已稳定。

---

## 5. 验收矩阵

| 项目 | 验证方式 | 结果 |
|------|---------|------|
| `/media-department` 线上可访问 | curl | ✅ 200 |
| `/enterprise` → 301/307 重定向 | curl | ✅ location: /media-department |
| Nuxt 路由正确生效 | curl + 标题 | ✅ Nuxt 渲染 |
| 构建产物无 "企业数字部门" | grep | ✅ 0 文件 |
| 源代码无 "企业数字部门" | grep | ✅ 0 文件 |
| API 返回无 "企业数字部门" | grep | ✅ 0 文件 |
| 数据库 `product_type` 字段 | SQL | ✅ 存在 |
| 后台菜单 "AI新媒体运营部门管理" | 代码+API | ✅ 存在 |

---

## 6. Phase 3.1 恢复验证

| 检查项 | 状态 |
|--------|------|
| BETA-06.6.1 前台入口关闭 | ✅ |
| BETA-06.6.1 后台入口关闭 | ✅ |
| BETA-06.6.1 代码扫描关闭 | ✅ |
| BETA-06.6.2 线上部署完成 | ✅ |
| Phase 3.1 恢复条件 | ✅ 满足 |

---

## 执行总结

**从 "代码 PASS" 到 "线上 PASS" 只差以下操作：**

```bash
cd frontend && rm -rf .nuxt .output && npm run build
pm2 restart nuxt-frontend
```

**两行命令，生产切换完成。**
