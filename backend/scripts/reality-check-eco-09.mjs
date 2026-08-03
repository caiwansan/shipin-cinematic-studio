/**
 * SPRINT-ECO-09 — Reality Gate
 * Application Center Navigation（掌柜批准 2026-08-04）
 *
 * 范围：应用生态入口展示（导航入口 + 9 应用 + 点击进入工作台）
 * 禁止：商城 UI / 支付 / 推荐算法 / 搜索排名 / 运营位 / 工作台业务改动
 *
 * G1 首页导航出现应用中心入口（社区后）
 * G2 API 返回 9 应用且全部 BUILT_IN/ACTIVE
 * G3 每应用 workspaceEntry 指向真实前端路由（点击不 404）
 * G4 JWT 权限正常（带 token 200 / 无 token 401）
 * G5 应用中心页含「进入工作台」CTA（卡片可点击跳转）
 * G6 零污染（无新表；ecology_applications 结构未变；不做商城）
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const API = 'http://127.0.0.1:4002';
const PAGES = '/root/shipin-cinematic-studio/frontend/pages';
const LOGIN = { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' };

// ── G1 导航入口（社区后） ─────────────────────────────
const navSrc = fs.readFileSync('/root/shipin-cinematic-studio/frontend/config/navigation.ts', 'utf8');
const primaryNav = navSrc.split('export const primaryNav')[1].split('= [')[1].split('\n]')[0];
const navIdx = primaryNav.indexOf('应用中心');
const commIdx = primaryNav.indexOf('社区');
const navHas = primaryNav.includes(`to: '/ecosystem/applications'`);
ok('G1 导航 primaryNav 含应用中心入口', navHas && navIdx > -1 && commIdx > -1 && navIdx > commIdx,
  `应用中心位置=${navIdx} 社区位置=${commIdx}`);

// ── 登录拿 token（G4 准备） ───────────────────────────
const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(LOGIN),
});
const loginBody = await loginRes.json();
const token = loginBody.accessToken || '';
ok('G4a 测试账号登录成功', !!token);

// ── G2 API 返回 9 应用 ────────────────────────────────
const appRes = await fetch(`${API}/api/ecosystem/applications`, { headers: { Authorization: `Bearer ${token}` } });
const appBody = await appRes.json();
const apps = appBody.data?.applications || [];
ok('G2 API 返回 9 应用', apps.length === 9, `count=${apps.length}`);
ok('G2 全部 BUILT_IN/ACTIVE', apps.every(a => a.status === 'BUILT_IN' && a.lifecycleState === 'ACTIVE'),
  apps.map(a => `${a.slug}:${a.status}/${a.lifecycleState}`).join(','));
const expectSlugs = ['kunlun-media', 'kunlun-drama', 'kunlun-novel', 'kunlun-recruit',
  'kunlun-legal', 'kunlun-mall', 'kunlun-music', 'kunlun-ads', 'kunlun-geo'];
ok('G2 9 应用 slug 齐全', expectSlugs.every(s => apps.some(a => a.slug === s)));

// ── G3 workspaceEntry 真实路由（点击不 404） ──────────
function routeExists(route) {
  if (!route || !route.startsWith('/')) return false;
  const parts = route.split('/').filter(Boolean);
  let cur = PAGES;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    const file = path.join(cur, seg + '.vue');
    const dir = path.join(cur, seg);
    if (fs.existsSync(file)) return true;
    if (fs.existsSync(dir)) { cur = dir; continue; }
    return false;
  }
  return fs.existsSync(path.join(cur, 'index.vue')) || fs.existsSync(cur + '.vue');
}
const badRoutes = apps.filter(a => !routeExists(a.workspaceEntry));
ok('G3 9 应用 workspaceEntry 全部指向真实路由', badRoutes.length === 0,
  badRoutes.map(a => `${a.slug}→${a.workspaceEntry}`).join(','));
// 数据页兜底：DB 与 API 一致
const dbApps = await prisma.ecologyApplication.findMany({ where: { status: 'BUILT_IN' } });
ok('G3 DB 9 应用 workspaceEntry 同步', dbApps.length === 9 &&
  dbApps.every(a => a.workspaceEntry?.startsWith('/')));

// ── G4 JWT 权限 ───────────────────────────────────────
const noAuth = await fetch(`${API}/api/ecosystem/applications`);
ok('G4 无 token 401（JWT 保护正常）', noAuth.status === 401, `status=${noAuth.status}`);
ok('G4 带 token 200', appRes.status === 200, `status=${appRes.status}`);

// ── G5 页面 CTA ───────────────────────────────────────
const pageSrc = fs.readFileSync('/root/shipin-cinematic-studio/frontend/pages/ecosystem/applications.vue', 'utf8');
ok('G5 页面含「进入工作台」CTA', pageSrc.includes('进入工作台') && pageSrc.includes('btn-enter'));
ok('G5 卡片可点击跳转 workspaceEntry', pageSrc.includes('@click="enter(app)"') && pageSrc.includes('window.location.href = app.workspaceEntry'));

// ── G6 零污染 ─────────────────────────────────────────
const ecoTables = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology%'`);
ok('G6 无新增表（25 张 ecology 表不变）', ecoTables.length === 25, `tables=${ecoTables.length}`);
const appCols = await prisma.$queryRawUnsafe(
  `SELECT column_name FROM information_schema.columns WHERE table_name='ecology_applications'`);
ok('G6 ecology_applications 结构未变', appCols.length === 15, `cols=${appCols.length}`);
ok('G6 页面无商城元素', !pageSrc.includes('price') && !pageSrc.includes('购买') && !pageSrc.includes('¥'));

console.log(`\n════════ ECO-09 Reality Gate: ${pass} PASS / ${fail} FAIL ════════`);
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
