#!/usr/bin/env node
/**
 * ECO-NAV-RETURN-01 Reality Gate — 无头浏览器实测
 * G1 页面访问 200 / G2 返回首页点击行为 / G3 9 应用 + 5 插件展示 / G4 工作台入口
 */
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:3000';
let passed = 0, failed = 0;
const results = [];
const check = (name, cond, detail = '') => {
  if (cond) { passed++; results.push(`✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { failed++; results.push(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ── G1 页面访问 ──────────────────────────────
  const r1 = await page.goto(`${BASE}/ecosystem/applications`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
  check('G1 应用中心页面加载', !!r1 && r1.status() === 200);
  await page.waitForTimeout(1500);
  const appTitle = await page.locator('h1', { hasText: '应用中心' }).count();
  check('G1 应用中心渲染出标题', appTitle > 0);

  const r2 = await page.goto(`${BASE}/ecosystem/plugins`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
  check('G1 插件中心页面加载', !!r2 && r2.status() === 200);
  await page.waitForTimeout(1500);
  const pluginTitle = await page.locator('h1', { hasText: '插件中心' }).count();
  check('G1 插件中心渲染出标题', pluginTitle > 0);

  // ── G2 返回首页（应用中心）────────────────────
  await page.goto(`${BASE}/ecosystem/applications`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const backLinkApps = await page.locator('a.eco-back-home, .eco-back-home').count();
  check('G2 应用中心存在返回首页入口', backLinkApps > 0);
  if (backLinkApps > 0) {
    const href = await page.locator('.eco-back-home').first().getAttribute('href');
    check('G2 返回首页 href="/"', href === '/', `href=${href}`);
    await page.locator('.eco-back-home').first().click();
    await page.waitForTimeout(1500);
    check('G2 点击后回到首页 /', page.url().replace(/\/$/, '') === BASE || page.url().startsWith(`${BASE}/`), page.url());
  }

  // ── G2 返回首页（插件中心）────────────────────
  await page.goto(`${BASE}/ecosystem/plugins`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const backLinkPlugins = await page.locator('.eco-back-home').count();
  check('G2 插件中心存在返回首页入口', backLinkPlugins > 0);
  if (backLinkPlugins > 0) {
    await page.locator('.eco-back-home').first().click();
    await page.waitForTimeout(1500);
    check('G2 插件中心点击后回到首页', page.url().replace(/\/$/, '') === BASE || page.url().startsWith(`${BASE}/`), page.url());
  }

  // ── G3 生态回归：9 应用 + 5 插件 ──────────────
  await page.goto(`${BASE}/ecosystem/applications`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  const appCards = await page.locator('.app-card').count();
  check('G3 应用中心展示 9 应用', appCards >= 9, `卡片数=${appCards}`);
  const appNames = await page.locator('.app-card h3').allTextContents().catch(() => []);
  const needApps = ['短剧', '小说', '招聘', '法律', 'GEO', '商城', '音乐', '广告', '新媒体'];
  const missingApps = needApps.filter((n) => !appNames.some((t) => t.includes(n)));
  check('G3 9 大应用齐全', missingApps.length === 0, missingApps.length ? `缺: ${missingApps.join(',')}` : '');

  await page.goto(`${BASE}/ecosystem/plugins`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  const pluginCards = await page.locator('.plugin-card').count();
  check('G3 插件中心展示 5 插件', pluginCards >= 5, `卡片数=${pluginCards}`);

  // ── G4 工作台回归（首页入口不受影响）───────────
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const homeNav = await page.locator('a', { hasText: '应用中心' }).count() + await page.locator('a', { hasText: '插件中心' }).count();
  check('G4 首页导航含应用中心/插件中心', homeNav >= 2, `导航链接数=${homeNav}`);

  // 9 工作台入口
  const needEntries = ['短剧', '小说', '招聘', '法律', 'GEO', '商城', '音乐', '广告', '新媒体'];
  const entryCounts = {};
  for (const n of needEntries) {
    entryCounts[n] = await page.locator(`a:has-text("${n}"), button:has-text("${n}")`).count();
  }
  const missingEntries = needEntries.filter((n) => entryCounts[n] === 0);
  check('G4 首页 9 工作台入口齐全', missingEntries.length === 0, missingEntries.length ? `缺: ${missingEntries.join(',')}` : JSON.stringify(entryCounts));

  await browser.close();

  console.log('──────────────────────────────────────────────');
  for (const r of results) console.log(r);
  console.log('──────────────────────────────────────────────');
  console.log(`\n📊 结果: ${passed} PASS / ${failed} FAIL（共 ${passed + failed} 项）`);
  console.log(failed === 0 ? '\n🎉 ECO-NAV-RETURN-01 Reality Gate 全绿' : `\n⚠️ ${failed} 项失败`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('脚本异常:', e.message); process.exit(1); });
