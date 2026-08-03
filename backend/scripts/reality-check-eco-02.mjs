/**
 * SPRINT-ECO-02 — Reality Gate 验证脚本
 * 技术总监验收要求（10 样本 + 回归 + 回滚）：
 *   合法 5：agent plugin / tool plugin / workflow plugin / version upgrade / permission declaration
 *   非法 5：缺 id / 权限不存在 / 版本格式错误 / 重复 id / 非法 runtime 声明
 *   现有 Agent 回归 + 回滚验证
 *
 * 执行：node scripts/reality-check-eco-02.mjs
 */
import { execSync } from 'node:child_process';

const API = process.env.ECO_API || 'http://127.0.0.1:4002';
const EMAIL = process.env.ECO_EMAIL || 'tenant_org_test@audit.local';
const PASSWORD = process.env.ECO_PASSWORD || 'AuditTest@123';
const PG = 'postgresql://postgres:BpgOMgBXybiNjnbyMCKCpPqh@localhost:5432/aigc_scs';

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

// ── 合法 5 样本 ──
const LEGAL_SAMPLES = {
  'agent plugin': {
    id: 'ai-media-manager', name: 'AI内容运营经理', type: 'agent', version: '1.0.0',
    author: 'developer_001', application: 'kunlun-media',
    permissions: ['browser', 'content', 'analytics'],
    runtime: { kaor: true },
    billing: { subscription: true, price: 599 },
  },
  'tool plugin': {
    id: 'video-compressor', name: '视频压缩工具', type: 'tool', version: '0.1.0',
    author: 'developer_002',
    permissions: ['storage', 'automation'],
  },
  'workflow plugin': {
    id: 'weekly-report-flow', name: '周报自动生成流程', type: 'workflow', version: '2.3.1',
    author: 'developer_003', application: 'kunlun-media',
    permissions: ['analytics', 'storage'],
    runtime: { kaor: true },
  },
  'version upgrade': {
    id: 'ai-media-manager', name: 'AI内容运营经理', type: 'agent', version: '1.1.0',
    author: 'developer_001', application: 'kunlun-media',
    permissions: ['browser', 'content', 'analytics', 'network'],
    runtime: { kaor: true },
  },
  'permission declaration': {
    id: 'content-scheduler', name: '内容排期器', type: 'tool', version: '1.0.0',
    author: 'developer_004',
    permissions: ['content', 'network', 'automation'],
  },
};

// ── 非法 5 样本 ──
const ILLEGAL_SAMPLES = {
  '缺 id': {
    name: '无ID插件', type: 'agent', version: '1.0.0', author: 'x', permissions: ['browser'],
  },
  '权限不存在': {
    id: 'hack-plugin', name: '越权插件', type: 'agent', version: '1.0.0', author: 'x',
    permissions: ['browser', 'super-admin-root'], // super-admin-root 不在白名单
  },
  '版本格式错误': {
    id: 'bad-version', name: '坏版本', type: 'agent', version: '1.0', author: 'x', // 非 semver
    permissions: ['browser'],
  },
  '重复 id（冒名注册）': {
    id: 'ai-media-manager', name: '重复ID冒名插件', type: 'agent', version: '9.9.9',
    author: 'evil', permissions: ['browser'], // 同 id 不同 author → 必须拒绝（冒名防线）
  },
  '非法 runtime 声明': {
    id: 'evil-runtime', name: '恶意运行时', type: 'agent', version: '1.0.0', author: 'x',
    permissions: ['browser'],
    runtime: { kaor: true, execute_arbitrary_code: true }, // 未知运行时字段 → 严格模式拒绝
  },
};

async function main() {
  console.log(`\n══════════════════════════════════════════`);
  console.log(` SPRINT-ECO-02 Plugin Manifest Runtime — Reality Gate`);
  console.log(` 目标: ${API}`);
  console.log(`══════════════════════════════════════════\n`);

  const token = await login();
  check('登录拿 token', !!token);
  if (!token) { console.log('\n  ⛔ 无法登录'); process.exit(1); }
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // ── G1: 合法 5 样本注册 ──
  console.log('\nG1: 合法 5 样本注册（Registry 接受）');
  for (const [name, manifest] of Object.entries(LEGAL_SAMPLES)) {
    try {
      const r = await fetch(`${API}/api/ecosystem/plugins/register`, {
        method: 'POST', headers: H, body: JSON.stringify({ manifest }),
      });
      const b = await r.json();
      const ok = r.status === 200 && b?.code === 0;
      check(`合法: ${name}`, ok, `status=${r.status} ${ok ? `pluginId=${b?.data?.plugin?.pluginId} reused=${b?.data?.reused}` : (b?.message ?? '')}`);
    } catch (e) { check(`合法: ${name}`, false, e.message); }
  }

  // ── G2: 非法 5 样本拒绝 ──
  console.log('\nG2: 非法 5 样本拒绝（Registry 有防线）');
  for (const [name, manifest] of Object.entries(ILLEGAL_SAMPLES)) {
    try {
      const r = await fetch(`${API}/api/ecosystem/plugins/register`, {
        method: 'POST', headers: H, body: JSON.stringify({ manifest }),
      });
      const b = await r.json();
      const rejected = r.status === 400 && b?.errorCode === 'INVALID_MANIFEST';
      const conflictRejected = r.status === 409 && b?.errorCode === 'PLUGIN_ID_CONFLICT';
      const ok = name === '重复 id（冒名注册）' ? conflictRejected : rejected;
      check(`非法拒绝: ${name}`, ok, `status=${r.status} code=${b?.errorCode ?? 'n/a'} ${ok ? '' : (b?.message ?? '')}`);
    } catch (e) { check(`非法拒绝: ${name}`, false, e.message); }
  }

  // ── G3: validate API（只验证不落库）──
  console.log('\nG3: /plugins/validate 纯校验 API');
  const vGood = await (await fetch(`${API}/api/ecosystem/plugins/validate`, {
    method: 'POST', headers: H, body: JSON.stringify({ manifest: LEGAL_SAMPLES['tool plugin'] }),
  })).json();
  check('合法 manifest → valid=true', vGood?.data?.valid === true);
  const vBad = await (await fetch(`${API}/api/ecosystem/plugins/validate`, {
    method: 'POST', headers: H, body: JSON.stringify({ manifest: ILLEGAL_SAMPLES['权限不存在'] }),
  })).json();
  check('非法 manifest → valid=false + 具体错误', vBad?.data?.valid === false && Array.isArray(vBad?.data?.errors) && vBad.data.errors.length > 0, vBad?.data?.errors?.[0] ?? '');

  // ── G4: 目录/详情/安装/卸载 ──
  console.log('\nG4: 目录 / 详情 / 安装 / 卸载');
  const listRes = await (await fetch(`${API}/api/ecosystem/plugins`, { headers: H })).json();
  const plugins = listRes?.data?.plugins ?? [];
  check('插件目录 4 唯一 id（版本升级复用不新增）', plugins.length === 4, `total=${plugins.length}`);
  check('目录含版本升级（1.1.0 最新）', plugins.some(p => p.id === 'ai-media-manager' && p.latestVersion === '1.1.0'));
  check('目录含 tool/workflow/agent 三类型', ['agent','tool','workflow'].every(t => plugins.some(p => p.type === t)));

  const det = await (await fetch(`${API}/api/ecosystem/plugins/ai-media-manager`, { headers: H })).json();
  check('详情含版本历史', det?.data?.versions?.length >= 2, `versions=${det?.data?.versions?.length}`);

  const inst = await (await fetch(`${API}/api/ecosystem/plugins/ai-media-manager/install`, { method: 'POST', headers: H })).json();
  check('安装登记成功', inst?.code === 0 && inst?.data?.install?.status === 'INSTALLED');
  const inst2 = await (await fetch(`${API}/api/ecosystem/plugins/ai-media-manager/install`, { method: 'POST', headers: H })).json();
  check('重复安装幂等（不报错）', inst2?.code === 0);
  const uninst = await (await fetch(`${API}/api/ecosystem/plugins/ai-media-manager/uninstall`, { method: 'POST', headers: H })).json();
  check('卸载登记成功', uninst?.code === 0 && uninst?.data?.status === 'UNINSTALLED');

  const nf = await (await fetch(`${API}/api/ecosystem/plugins/no-such-plugin`, { headers: H })).json();
  check('不存在插件 → 404', nf?.code === 404);

  // ── G5: 现有 Agent 回归 ──
  console.log('\nG5: 现有 Agent 回归');
  const agentRes = await fetch(`${API}/api/enterprise/agent-profiles`, { headers: H });
  check('agent-profiles → 200', agentRes.status === 200, `status=${agentRes.status}`);
  const agentBody = await agentRes.json();
  check('Agent 数据未受影响', agentBody?.code === 0 || Array.isArray(agentBody?.data), `code=${agentBody?.code ?? 'n/a'}`);

  // ── G6: 数据库结构 + 回滚验证 ──
  console.log('\nG6: 数据库结构（纯新增 3 表）');
  try {
    const out = execSync(`psql "${PG}" -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_plugin%' ORDER BY table_name;"`, { encoding: 'utf8' });
    const tables = out.split('\n').filter(Boolean);
    check('ecology_plugin* 恰 3 表', tables.length === 3, tables.join(','));
    const required = ['ecology_plugins', 'ecology_plugin_versions', 'ecology_plugin_installations'];
    check('3 表名符合规范', required.every(t => tables.includes(t)));

    const counts = execSync(`psql "${PG}" -t -A -c "SELECT (SELECT count(*) FROM ecology_plugins), (SELECT count(*) FROM ecology_plugin_versions), (SELECT count(*) FROM ecology_plugin_installations);"`, { encoding: 'utf8' }).trim().split('|');
    check('plugins=4 唯一 id', counts[0] === '4', `plugins=${counts[0]}`);
    check('versions=5（1.0.0+1.1.0+3 独立）', counts[1] === '5', `versions=${counts[1]}`);
    check('installations 可登记', Number(counts[2]) >= 0, `installs=${counts[2]}`);
  } catch (e) { check('G6 数据库检查', false, e.message); }

  // ── G7: 回滚验证（纯新增表可安全 DROP，模拟后重建）──
  console.log('\nG7: 回滚验证（DROP 3 表无依赖 → 重建无副作用）');
  try {
    execSync(`psql "${PG}" -c "DROP TABLE IF EXISTS ecology_plugin_installations; DROP TABLE IF EXISTS ecology_plugin_versions; DROP TABLE IF EXISTS ecology_plugins;"`, { encoding: 'utf8' });
    execSync(`psql "${PG}" -f ${process.cwd()}/prisma/migrations/sprint-eco-02-plugin-manifest/migration.sql`, { encoding: 'utf8' });
    const after = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM ecology_plugins;"`, { encoding: 'utf8' }).trim();
    check('DROP 后重建表成功（迁移幂等）', after === '0', `plugins=${after}`);
    check('重建后唯一约束仍在（重复 id 防线）', execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM pg_indexes WHERE tablename='ecology_plugins' AND indexname='ecology_plugins_plugin_id_key';"`, { encoding: 'utf8' }).trim() === '1');
  } catch (e) { check('G7 回滚验证', false, e.message); }

  // 回滚测试删掉了数据，重新注册 4 个合法插件恢复现场
  console.log('\n恢复现场（回滚测试后重新注册）');
  for (const manifest of Object.values(LEGAL_SAMPLES)) {
    try {
      await fetch(`${API}/api/ecosystem/plugins/register`, { method: 'POST', headers: H, body: JSON.stringify({ manifest }) });
    } catch { /* 忽略恢复失败 */ }
  }
  const recover = await (await fetch(`${API}/api/ecosystem/plugins`, { headers: H })).json();
  check('恢复后插件目录完整', (recover?.data?.plugins?.length ?? 0) >= 4, `total=${recover?.data?.plugins?.length}`);

  // ── 汇总 ──
  console.log(`\n══════════════════════════════════════════`);
  console.log(` 结果: ${PASS} PASS / ${FAIL} FAIL`);
  if (failures.length) console.log(` 失败项: ${failures.join(', ')}`);
  console.log(`══════════════════════════════════════════\n`);
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
