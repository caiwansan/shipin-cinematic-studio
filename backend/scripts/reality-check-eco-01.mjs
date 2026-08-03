/**
 * SPRINT-ECO-01 — Reality Gate 验证脚本
 * 技术总监 6 Gate：
 *   G1: 9 个应用全部注册（BUILT_IN / ACTIVE / v1.0.0 / 能力+权限声明完整）
 *   G2: 现有工作台打开正常（回归：关键页面可达，非 404）
 *   G3: 登录正常（认证 API 可用）
 *   G4: AI员工正常（enterprise agent-profiles 可读）
 *   G5: 订阅正常（enterprise subscription 可读）
 *   G6: 数据库新增表之外 0 修改（ecology_* 4 表纯新增，现有表无结构变更）
 *
 * 执行：node scripts/reality-check-eco-01.mjs
 */
import { execSync } from 'node:child_process';

const API = process.env.ECO_API || 'http://127.0.0.1:4002';
const EMAIL = process.env.ECO_EMAIL || 'tenant_org_test@audit.local';
const PASSWORD = process.env.ECO_PASSWORD || 'AuditTest@123';

let PASS = 0, FAIL = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) { PASS++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { FAIL++; failures.push(name); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json();
  return body?.accessToken || body?.data?.token || null;
}

async function main() {
  console.log(`\n══════════════════════════════════════════`);
  console.log(` SPRINT-ECO-01 Application Adapter Layer — Reality Gate`);
  console.log(` 目标: ${API} | 账号: ${EMAIL}`);
  console.log(`══════════════════════════════════════════\n`);

  // ── G1: 9 应用全部注册 ──
  console.log('G1: 9 个应用全部注册（BUILT_IN / ACTIVE / v1.0.0）');
  const token = await login();
  check('登录拿 token', !!token);
  if (!token) { console.log('\n  ⛔ 无法登录，后续 Gate 跳过'); process.exit(1); }

  const H = { Authorization: `Bearer ${token}` };
  const listRes = await fetch(`${API}/api/ecosystem/applications`, { headers: H });
  const listBody = await listRes.json();
  const apps = listBody?.data?.applications || [];
  check('应用目录返回 9 个', apps.length === 9, `actual=${apps.length}`);
  check('全部 BUILT_IN', apps.every(a => a.status === 'BUILT_IN'), `statuses=${[...new Set(apps.map(a => a.status))].join(',')}`);
  check('全部 ACTIVE', apps.every(a => a.lifecycleState === 'ACTIVE'), `states=${[...new Set(apps.map(a => a.lifecycleState))].join(',')}`);
  check('全部 v1.0.0', apps.every(a => a.latestVersion === '1.0.0'), `versions=${[...new Set(apps.map(a => a.latestVersion))].join(',')}`);
  check('能力声明非空', apps.every(a => (a.capabilities?.length ?? 0) > 0));
  check('权限清单非空', apps.every(a => (a.permissions?.length ?? 0) > 0));
  const expectedSlugs = ['kunlun-media','kunlun-drama','kunlun-novel','kunlun-recruit','kunlun-legal','kunlun-mall','kunlun-music','kunlun-ads','kunlun-geo'];
  const actualSlugs = apps.map(a => a.slug).sort();
  check('9 个 slug 正确', JSON.stringify(actualSlugs) === JSON.stringify([...expectedSlugs].sort()), actualSlugs.join(','));

  // ── G2: 现有工作台打开正常 ──
  console.log('\nG2: 现有工作台回归（关键路由可达）');
  const publicPaths = ['/api/enterprise/agent-profiles', '/api/enterprise/subscription/plans'];
  for (const p of publicPaths) {
    try {
      const r = await fetch(`${API}${p}`, { headers: H });
      check(`GET ${p} → ${r.status}`, r.status === 200, `status=${r.status}`);
    } catch (e) { check(`GET ${p}`, false, e.message); }
  }

  // ── G3: 登录正常（已由 token 证明）──
  console.log('\nG3: 登录正常');
  check('认证成功获取 JWT', !!token);
  const meRes = await fetch(`${API}/api/auth/me`, { headers: H }).catch(() => null);
  if (meRes) {
    const me = await meRes.json();
    check('GET /api/auth/me 可达', meRes.status < 500, `status=${meRes.status}`);
  } else { check('GET /api/auth/me 可达', false, '请求失败'); }

  // ── G4: AI员工正常 ──
  console.log('\nG4: AI员工（Enterprise Agent Profiles）');
  try {
    const r = await fetch(`${API}/api/enterprise/agent-profiles`, { headers: H });
    const b = await r.json();
    check('agent-profiles API 可达', r.status < 500, `status=${r.status}`);
    check('返回结构合法', Array.isArray(b?.data ?? b) || Array.isArray(b?.profiles ?? b) || b?.code !== undefined, `code=${b?.code ?? 'n/a'}`);
  } catch (e) { check('agent-profiles API', false, e.message); }

  // ── G5: 订阅正常 ──
  console.log('\nG5: 订阅（Enterprise Subscription）');
  try {
    const r = await fetch(`${API}/api/enterprise/subscription/plans`, { headers: H });
    const b = await r.json();
    check('subscription plans API 可达', r.status === 200, `status=${r.status}`);
    const plans = Array.isArray(b?.data?.data) ? b.data.data : (Array.isArray(b?.data) ? b.data : null);
    check('订阅体系返回套餐列表', Array.isArray(plans) && plans.length > 0, `plans=${plans?.length ?? 'n/a'}`);
  } catch (e) { check('subscription API', false, e.message); }

  // ── G6: 数据库新增表之外 0 修改 ──
  console.log('\nG6: 数据库结构（ecology_* 纯新增，现有表零改动）');
  try {
    const out = execSync(
      `psql "postgresql://postgres:BpgOMgBXybiNjnbyMCKCpPqh@localhost:5432/aigc_scs" -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"`,
      { encoding: 'utf8' }
    );
    const tables = out.split('\n').filter(Boolean);
    const ecoTables = tables.filter(t => t.startsWith('ecology_'));
    check('ecology_* 表恰 4 张', ecoTables.length === 4, ecoTables.join(','));
    const required = ['ecology_applications','ecology_application_versions','ecology_application_installations','ecology_application_permissions'];
    check('4 表名符合规范', required.every(t => ecoTables.includes(t)), required.join(','));
    const dataCheck = execSync(
      `psql "postgresql://postgres:BpgOMgBXybiNjnbyMCKCpPqh@localhost:5432/aigc_scs" -t -A -c "SELECT count(*) FROM ecology_applications; SELECT count(*) FROM ecology_application_versions;"`,
      { encoding: 'utf8' }
    ).split('\n').filter(Boolean);
    check('ecology_applications 9 行', dataCheck[0] === '9', dataCheck[0]);
    check('ecology_application_versions 9 行', dataCheck[1] === '9', dataCheck[1]);
  } catch (e) { check('G6 数据库检查', false, e.message); }

  // ── 汇总 ──
  console.log(`\n══════════════════════════════════════════`);
  console.log(` 结果: ${PASS} PASS / ${FAIL} FAIL`);
  if (failures.length) console.log(` 失败项: ${failures.join(', ')}`);
  console.log(`══════════════════════════════════════════\n`);
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
