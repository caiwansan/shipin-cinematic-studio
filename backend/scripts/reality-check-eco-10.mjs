/**
 * SPRINT-ECO-10 — Reality Gate
 * Plugin Marketplace Discovery MVP（掌柜批准 2026-08-04）
 *
 * 范围：插件目录 + 搜索 + 分类 + 详情 + 安装 + License + 运行检查
 * 禁止：支付页面 / 提现 / 推广入口 / 排行榜 / 推荐算法 / 评分造假 / 新表
 *
 * G1 官方内置插件种子（5 款 PUBLISHED + 官方开发者 VERIFIED）
 * G2 发现列表仅官方商品 LISTED（历史测试商品已下架不污染）
 * G3 搜索 / 分类过滤生效
 * G4 详情结构化（manifest 权限 + billing + 需要应用）
 * G5 安装 → License ACTIVE 联动 + 幂等
 * G6 运行检查（已装 allowed / 未装 NOT_INSTALLED）
 * G7 前端 /ecosystem/plugins 页面就绪（搜索/分类/安装按钮/无商城元素）
 * G8 零污染（无新表 / 结构未变 / 无推荐与评分造假）
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';

const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const API = 'http://127.0.0.1:4002';
const LOGIN = { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' };

const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(LOGIN),
});
const { accessToken: token } = await login.json();
const H = { Authorization: `Bearer ${token}` };
const jfetch = async (url, opts = {}) => {
  const res = await fetch(`${API}${url}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  return { status: res.status, body: await res.json() };
};

// ── G1 种子 ─────────────────────────────────────────────
const dev = await prisma.ecologyDeveloper.findFirst({ where: { developerId: 'kunlun-official' } });
ok('G1 官方开发者存在且 VERIFIED', !!dev && dev.status === 'VERIFIED', dev?.status);
const official = await prisma.ecologyPlugin.findMany({ where: { author: 'kunlun-official' } });
ok('G1 官方插件 5 款', official.length === 5, `count=${official.length}`);
ok('G1 全部 PUBLISHED/ACTIVE', official.every(p => p.status === 'PUBLISHED' && p.lifecycleState === 'ACTIVE'));
const expectIds = ['ai-content-ops-manager', 'ai-viral-analyst', 'ai-video-director', 'ai-comment-ops', 'ai-matrix-ops'];
ok('G1 pluginId 齐全', expectIds.every(id => official.some(p => p.pluginId === id)));
// manifest 符合 ECO-02 schema（关键字段）
ok('G1 manifest 标准（billing/runtime/permissions）',
  official.every(p => p.manifest?.billing?.subscription === true && p.manifest?.runtime?.kaor === true && p.manifest?.permissions?.length >= 1));
// 价格登记正确（与掌柜商业模型一致）
const priceOf = (id) => official.find(p => p.pluginId === id)?.manifest?.billing?.price;
ok('G1 价格登记 599/299/399/299/999',
  priceOf('ai-content-ops-manager') === 599 && priceOf('ai-viral-analyst') === 299 &&
  priceOf('ai-video-director') === 399 && priceOf('ai-comment-ops') === 299 && priceOf('ai-matrix-ops') === 999,
  JSON.stringify(expectIds.map(id => [id, priceOf(id)])));

// ── G2 列表 ─────────────────────────────────────────────
const list = await jfetch('/api/ecosystem/marketplace/items');
ok('G2 发现列表仅 5 款官方商品', list.body.data?.total === 5, `total=${list.body.data?.total}`);
ok('G2 全部官方 LISTED', list.body.data?.items?.every(i => i.developer?.developerId === 'kunlun-official'));
ok('G2 列表含价格/类型/版本', list.body.data?.items?.every(i => i.price && i.type === 'agent' && i.latestVersion === '1.0.0'));
const dbListed = await prisma.ecologyMarketplaceItem.count({ where: { status: 'LISTED' } });
ok('G2 DB LISTED = 5（测试商品已下架不污染）', dbListed === 5, `count=${dbListed}`);

// ── G3 搜索 / 分类 ─────────────────────────────────────
const q = await jfetch('/api/ecosystem/marketplace/items?q=爆款');
ok('G3 搜索「爆款」命中 1 条', q.body.data?.total === 1 && q.body.data?.items?.[0]?.pluginId === 'ai-viral-analyst', `total=${q.body.data?.total}`);
const q2 = await jfetch('/api/ecosystem/marketplace/items?q=不存在的插件xyz');
ok('G3 搜索无结果返回 0', q2.body.data?.total === 0);
const t = await jfetch('/api/ecosystem/marketplace/items?type=agent');
ok('G3 分类 type=agent 命中 5 条', t.body.data?.total === 5);
const tw = await jfetch('/api/ecosystem/marketplace/items?type=workflow');
ok('G3 分类 type=workflow 命中 0 条（诚实空结果）', tw.body.data?.total === 0);

// ── G4 详情 ─────────────────────────────────────────────
const det = await jfetch('/api/ecosystem/marketplace/items/ai-viral-analyst');
const d = det.body.data?.item;
ok('G4 详情返回成功', det.status === 200 && !!d);
ok('G4 详情含 manifest 权限', JSON.stringify(d?.manifest?.permissions) === '["analytics"]');
ok('G4 详情含 billing 价格', d?.manifest?.billing?.price === 299 && d?.manifest?.billing?.currency === 'CNY');
ok('G4 详情含需要应用（Kunlun Media）', d?.application?.name === 'Kunlun Media' && d?.application?.workspaceEntry === '/workspace/media', JSON.stringify(d?.application));

// ── G5 安装 → License 联动 ─────────────────────────────
// 幂等安装（可能已装）
const inst1 = await jfetch('/api/ecosystem/marketplace/install', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginId: 'ai-viral-analyst' }),
});
ok('G5 安装成功 INSTALLED', inst1.body.data?.install?.status === 'INSTALLED', inst1.body.data?.install?.status);
ok('G5 License ACTIVE + subscription', inst1.body.data?.license?.status === 'ACTIVE' && inst1.body.data?.license?.licenseType === 'subscription');
const inst2 = await jfetch('/api/ecosystem/marketplace/install', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginId: 'ai-viral-analyst' }),
});
ok('G5 重复安装幂等', inst2.body.data?.idempotent === true && inst2.body.data?.install?.status === 'INSTALLED');
const licTarget = official.find(p => p.pluginId === 'ai-viral-analyst');
const licRow = await prisma.ecologyLicense.count({ where: { pluginId: licTarget.id, status: 'ACTIVE' } });
ok('G5 License 落库（按 ecology UUID）', licRow >= 1, `count=${licRow}`);

// ── G6 运行检查 ─────────────────────────────────────────
const lc1 = await jfetch('/api/ecosystem/marketplace/launch-check', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginId: 'ai-viral-analyst' }),
});
ok('G6 已安装插件可运行', lc1.body.data?.allowed === true, JSON.stringify(lc1.body.data));
const lc2 = await jfetch('/api/ecosystem/marketplace/launch-check', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginId: 'ai-matrix-ops' }),
});
ok('G6 未安装插件拒绝运行', lc2.body.data?.allowed === false && lc2.body.data?.reason === 'NOT_INSTALLED', JSON.stringify(lc2.body.data));

// ── G7 前端页面 ─────────────────────────────────────────
const pageSrc = fs.readFileSync('/root/shipin-cinematic-studio/frontend/pages/ecosystem/plugins.vue', 'utf8');
// 只检查 UI 区域（<template> 起），顶部注释是纪律声明不算 UI
const uiSrc = pageSrc.slice(pageSrc.indexOf('<template>'));
ok('G7 页面文件存在且含搜索框', pageSrc.includes('search-input') && pageSrc.includes('placeholder="搜索插件名称'));
ok('G7 页面含分类 tab（全部/AI员工/工具/Workflow）', ['全部', 'AI员工', '工具', 'Workflow'].every(t => pageSrc.includes(t)));
ok('G7 页面含安装按钮', pageSrc.includes('btn-install') && pageSrc.includes('marketplace/install'));
ok('G7 页面含运行检查', pageSrc.includes('launch-check') && pageSrc.includes('运行检查'));
ok('G7 页面诚实：暂无评分（不造假）', pageSrc.includes('暂无评分'));
ok('G7 页面诚实：支付接入中标注', pageSrc.includes('支付接入中'));
ok('G7 无商城 UI 元素（立即购买/购物车/去支付/钱包/排行榜）',
  !uiSrc.includes('立即购买') && !uiSrc.includes('加入购物车') && !uiSrc.includes('去支付') && !uiSrc.includes('我的钱包') && !uiSrc.includes('排行榜'));

// ── G8 零污染 ─────────────────────────────────────────
const ecoTables = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology%'`);
ok('G8 无新增表（25 张不变）', ecoTables.length === 25, `tables=${ecoTables.length}`);
const pluginCols = await prisma.$queryRawUnsafe(
  `SELECT column_name FROM information_schema.columns WHERE table_name='ecology_plugins'`);
ok('G8 ecology_plugins 结构未变', pluginCols.length === 12, `cols=${pluginCols.length}`);
ok('G8 无评分/推荐表', !ecoTables.some(t => t.table_name.includes('review') || t.table_name.includes('rating') || t.table_name.includes('recommend')));

console.log(`\n════════ ECO-10 Reality Gate: ${pass} PASS / ${fail} FAIL ════════`);
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
