#!/usr/bin/env node
/**
 * ECO-NAV-RETURN-01 Reality Gate — G3 数据展示（线上环境 + 登录态）
 * 说明：生态页面 fetch 不带 Authorization（既有行为，本次未改）；浏览器注入 auth_token 后验证真实展示。
 */
const { chromium } = require('playwright');

const LIVE = 'https://aigc.fushtn.com';
const API = 'http://127.0.0.1:4002';
let passed = 0, failed = 0;
const results = [];
const check = (name, cond, detail = '') => {
  if (cond) { passed++; results.push(`✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { failed++; results.push(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

(async () => {
  // 登录拿 token（测试账号）
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }),
  }).then((r) => r.json());
  const token = login.accessToken;
  check('前置: 测试账号登录', !!token);

  const browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 注入 token（同域 localStorage）
  await page.goto(`${LIVE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.evaluate((t) => { localStorage.setItem('auth_token', t); }, token);
  // 双写（部分组件读 token 或 accessToken）
  await page.evaluate((t) => { localStorage.setItem('accessToken', t); localStorage.setItem('token', t); }, token);

  // ── G3 应用中心 9 应用 ────────────────────────
  await page.goto(`${LIVE}/ecosystem/applications`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3500);
  const errText = await page.locator('.state-box.error, .error').allTextContents().catch(() => []);
  const appCards = await page.locator('.app-card').count();
  check('G3 应用中心展示应用卡片', appCards >= 9, `卡片数=${appCards}${errText.length ? ' | error: ' + errText[0].slice(0, 80) : ''}`);
  // 卡片全文匹配中文类别（h3 为英文名，类别在 meta 区）
  const cardTexts = await page.locator('.app-card').allTextContents().catch(() => []);
  const needApps = ['短剧', '小说', '招聘', '法律', 'GEO', '商城', '音乐', '广告', '新媒体'];
  const missingApps = needApps.filter((n) => !cardTexts.some((t) => t.includes(n)));
  check('G3 9 大应用齐全（卡片含全部中文类别）', missingApps.length === 0, missingApps.length ? `缺: ${missingApps.join(',')}` : `卡片=${cardTexts.length}个`);

  // 返回入口在数据态下仍存在
  const backApps = await page.locator('.eco-back-home').count();
  check('G3 应用中心数据态下返回入口仍在', backApps > 0);

  // ── G3 插件中心 5 插件 ────────────────────────
  await page.goto(`${LIVE}/ecosystem/plugins`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3500);
  const pErr = await page.locator('.state-box.error, .error').allTextContents().catch(() => []);
  const pluginCards = await page.locator('.plugin-card').count();
  check('G3 插件中心展示插件卡片', pluginCards >= 5, `卡片数=${pluginCards}${pErr.length ? ' | error: ' + pErr[0].slice(0, 80) : ''}`);
  const backPlugins = await page.locator('.eco-back-home').count();
  check('G3 插件中心数据态下返回入口仍在', backPlugins > 0);

  // ── G4 工作台入口（应用中心→9 工作台链路，线上）──────
  // 9 应用 workspaceEntry（后端 SSOT）逐个可达验证
  const entries = [
    ['短剧', '/studio/v2'], ['小说', '/hdz'], ['招聘', '/workspace/recruitment'],
    ['法律', '/workspace/legal'], ['GEO', '/workspace/geo/dashboard'], ['商城', '/mall'],
    ['音乐', '/workspace/music'], ['广告', '/workspace/ad-create'], ['新媒体', '/workspace/media'],
  ];
  const dead = [];
  for (const [name, entry] of entries) {
    const r = await page.goto(`${LIVE}${entry}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => null);
    if (!r || r.status() >= 400) { dead.push(`${name}(${entry}:${r ? r.status() : 'ERR'})`); continue; }
    // 内容渲染判定：页面有实际业务内容（部分工作台标题非 h1，用 body 文本量判定）
    await page.waitForTimeout(2500);
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const is404 = bodyText.includes('404') || bodyText.includes('页面不存在') || bodyText.includes('Not Found');
    if (bodyText.trim().length < 30 || is404) dead.push(`${name}(${entry}:内容空或404页)`);
  }
  check('G4 9 工作台入口可达（短剧/小说/招聘/法律/GEO/商城/音乐/广告/新媒体）', dead.length === 0, dead.length ? `异常: ${dead.join(', ')}` : '9/9 可达');

  await browser.close();

  console.log('──────────────────────────────────────────────');
  for (const r of results) console.log(r);
  console.log('──────────────────────────────────────────────');
  console.log(`\n📊 结果: ${passed} PASS / ${failed} FAIL（共 ${passed + failed} 项）`);
  console.log(failed === 0 ? '\n🎉 ECO-NAV-RETURN-01 Reality Gate 全绿' : `\n⚠️ ${failed} 项失败`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('脚本异常:', e.message); process.exit(1); });
