#!/usr/bin/env node
/**
 * SPRINT-ECO-11.3 — Local Plugin Runtime Reality Gate（G1–G7）
 * 掌柜验收冻结（2026-08-04）：
 *   G1 Windows 安装包（本机静态校验 + 真机清单）
 *   G2 设备隔离（设备 A 有授权可启动；设备 B 拒绝）
 *   G3 订阅过期（应用继续打开，插件不可用 — ECO-04 原则）
 *   G4 插件恢复（renew → ACTIVE → 插件恢复）
 *   G5 线上工作台独立（不被 Desktop 影响）
 *   G6 插件执行边界（本地零代码执行证明）
 *   G7 双端一致性（Web/Desktop 同一授权源）
 *
 * 用法: node scripts/reality-check-eco-11-3.cjs
 * 前置: api-server 运行中（4002），测试账号可用
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = process.env.API_BASE || 'http://127.0.0.1:4002';
const ONLINE_BASE = process.env.ONLINE_BASE || 'https://aigc.fushtn.com';

// 测试账号（与 ECO-11.2 同一套保留账号）
const ORG_A = { account: 'tenant_org_test@audit.local', password: 'AuditTest@123' };
const ORG_B = { account: 'tenant_iso_test@audit.local', password: 'AuditTest@123' };

const TARGET_PLUGIN = 'ai-content-ops-manager'; // ECO-11.3 Task04 唯一本地插件

let passed = 0, failed = 0;
const results = [];
function check(name, cond, detail = '') {
  if (cond) { passed++; results.push(`✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { failed++; results.push(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function login(account, password) {
  const { json } = await api('/api/auth/login', { method: 'POST', body: { account, password } });
  return json.accessToken || json.data?.token || json.token || null;
}

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('SPRINT-ECO-11.3 Local Plugin Runtime Reality Gate (G1-G7)');
  console.log('══════════════════════════════════════════════════════════\n');

  // ── 登录 ────────────────────────────────────────────────
  const tokenA = await login(ORG_A.account, ORG_A.password);
  const tokenB = await login(ORG_B.account, ORG_B.password);
  check('前置: 组织 A JWT', !!tokenA);
  check('前置: 组织 B JWT（隔离测试）', !!tokenB);
  if (!tokenA || !tokenB) { console.log('\n⚠️ 登录失败，终止'); process.exit(1); }

  // 组织 A 确保目标插件 License（幂等 grant）+ KAOR 绑定（ECO-03 语义：
  // 插件必须先绑定 KAOR runtime 才能本地启动——G6 边界的一部分）
  await api('/api/ecosystem/license/grant', {
    method: 'POST', token: tokenA,
    body: { pluginId: TARGET_PLUGIN, durationDays: 365 },
  });
  await api(`/api/ecosystem/runtime/mapping/${TARGET_PLUGIN}/bind`, { method: 'POST', token: tokenA });

  // 设备 A（org A）+ 设备 B（org B）
  const regA = await api('/api/ecosystem/devices/register', {
    method: 'POST', token: tokenA,
    body: { deviceName: 'ECO11.3 设备 A', os: 'windows-11', deviceFingerprint: `lpr-a-${Date.now()}` },
  });
  const deviceA = regA.json?.data?.device;
  const tokenA_dev = regA.json?.data?.token;

  const regB = await api('/api/ecosystem/devices/register', {
    method: 'POST', token: tokenB,
    body: { deviceName: 'ECO11.3 设备 B', os: 'windows-11', deviceFingerprint: `lpr-b-${Date.now()}` },
  });
  const deviceB = regB.json?.data?.device;
  const tokenB_dev = regB.json?.data?.token;
  check('前置: 设备 A 注册（org A）', !!deviceA?.deviceId);
  check('前置: 设备 B 注册（org B）', !!deviceB?.deviceId);
  if (!deviceA || !deviceB) { console.log('\n⚠️ 设备注册失败，终止'); process.exit(1); }

  // 安装 kunlun-media 应用（G3 应用不受影响断言的基础）
  await api(`/api/ecosystem/devices/${deviceA.deviceId}/apps/install`, {
    method: 'POST', token: tokenA,
    body: { applicationSlug: 'kunlun-media', version: '1.0.0' },
  });

  // ═════════════════════════════════════════════════════════
  // G2 设备隔离：设备 A 启动成功；设备 B（无授权）拒绝
  // ═════════════════════════════════════════════════════════
  const startA = await api(`/api/ecosystem/devices/${deviceA.deviceId}/plugins/${TARGET_PLUGIN}/start`, {
    method: 'POST', token: tokenA, body: { version: '1.0.0' },
  });
  check('G2 设备 A: 插件启动 allowed:true', startA.json?.data?.allowed === true, `reason=${startA.json?.data?.reason}`);
  check('G2 设备 A: 运行时实例 RUNNING', startA.json?.data?.runtime?.status === 'RUNNING');
  check('G2 设备 A: startedAt 已记录', !!startA.json?.data?.runtime?.startedAt);

  const startB = await api(`/api/ecosystem/devices/${deviceB.deviceId}/plugins/${TARGET_PLUGIN}/start`, {
    method: 'POST', token: tokenB, body: { version: '1.0.0' },
  });
  check('G2 设备 B: 无授权拒绝（NO_LICENSE）', startB.json?.data?.allowed === false && startB.json?.data?.reason === 'NO_LICENSE',
    `reason=${startB.json?.data?.reason}`);

  const crossOrg = await api(`/api/ecosystem/devices/${deviceA.deviceId}/plugins/${TARGET_PLUGIN}/start`, {
    method: 'POST', token: tokenB,
  });
  check('G2 组织隔离: 组织 B 无法启动组织 A 设备插件（403）', crossOrg.status === 403, `status=${crossOrg.status}`);

  // ═════════════════════════════════════════════════════════
  // G3 订阅过期：应用继续打开，插件不可用（ECO-04 原则）
  // ═════════════════════════════════════════════════════════
  const mine = await api('/api/ecosystem/license/mine', { token: tokenA });
  const license = mine.json?.data?.licenses?.find((l) => l.plugin?.pluginId === TARGET_PLUGIN);
  check('G3 前置: 目标插件 License ACTIVE', license?.status === 'ACTIVE', `licenseId=${license?.id}`);
  if (!license) { console.log('\n⚠️ 未找到目标插件 License，终止'); process.exit(1); }

  await api(`/api/ecosystem/license/${license.id}/expire`, { method: 'POST', token: tokenA, body: { reason: 'ECO11.3_G3_TEST' } });

  const startExpired = await api(`/api/ecosystem/devices/${deviceA.deviceId}/plugins/${TARGET_PLUGIN}/start`, {
    method: 'POST', token: tokenA, body: { version: '1.0.0' },
  });
  check('G3 订阅过期: 插件启动拒绝 EXPIRED', startExpired.json?.data?.allowed === false && startExpired.json?.data?.reason === 'EXPIRED',
    `reason=${startExpired.json?.data?.reason}`);

  // 应用继续打开（ECO-04 原则：应用本体与 License 解耦）
  const apps = await api('/api/ecosystem/applications', { token: tokenA });
  check('G3 应用继续打开: 9 应用目录可读', Array.isArray(apps.json?.data?.applications) && apps.json.data.applications.length >= 9);
  const appDetail = await api(`/api/ecosystem/applications/kunlun-media`, { token: tokenA }).catch(() => ({ json: {} }));
  check('G3 应用继续打开: kunlun-media 应用信息可读', !!appDetail.json?.data?.application || !!appDetail.json?.data);

  // authorized-plugins 灰态（插件不可用但列表可读）
  const authExpired = await api(`/api/ecosystem/devices/${deviceA.deviceId}/authorized-plugins`, { token: tokenA });
  const hasExpiredPlugin = authExpired.json?.data?.plugins?.some((p) => p.pluginId === TARGET_PLUGIN);
  check('G3 插件不可用: authorized-plugins 不再返回目标插件', hasExpiredPlugin === false);

  // ═════════════════════════════════════════════════════════
  // G4 插件恢复：续费 → ACTIVE → 插件恢复运行
  // ═════════════════════════════════════════════════════════
  await api(`/api/ecosystem/license/${license.id}/renew`, { method: 'POST', token: tokenA, body: { durationDays: 365 } });
  const startRenewed = await api(`/api/ecosystem/devices/${deviceA.deviceId}/plugins/${TARGET_PLUGIN}/start`, {
    method: 'POST', token: tokenA, body: { version: '1.0.0' },
  });
  check('G4 续费恢复: 插件启动 allowed:true', startRenewed.json?.data?.allowed === true, `reason=${startRenewed.json?.data?.reason}`);
  check('G4 续费恢复: 运行时恢复 RUNNING', startRenewed.json?.data?.runtime?.status === 'RUNNING');

  const hb = await api(`/api/ecosystem/devices/${deviceA.deviceId}/plugins/${TARGET_PLUGIN}/heartbeat`, {
    method: 'POST', token: tokenA, body: { token: tokenA_dev },
  });
  check('G4 心跳: 插件运行时心跳续命', hb.json?.data?.allowed === true && hb.json?.data?.pluginStatus === 'RUNNING');

  const hbBad = await api(`/api/ecosystem/devices/${deviceA.deviceId}/plugins/${TARGET_PLUGIN}/heartbeat`, {
    method: 'POST', token: tokenA, body: { token: 'wrong-token' },
  });
  check('G4 安全: 错误设备凭据插件心跳被拒（403）', hbBad.status === 403, `status=${hbBad.status}`);

  // stop / uninstall（生命周期闭环）
  const stop = await api(`/api/ecosystem/devices/${deviceA.deviceId}/plugins/${TARGET_PLUGIN}/stop`, { method: 'POST', token: tokenA });
  check('G4 停止: DISABLED + stoppedAt', stop.json?.data?.runtime?.status === 'DISABLED' && !!stop.json?.data?.runtime?.stoppedAt);
  const uninstall = await api(`/api/ecosystem/devices/${deviceA.deviceId}/plugins/${TARGET_PLUGIN}/uninstall`, { method: 'POST', token: tokenA });
  check('G4 卸载: UNINSTALLED 不删行', uninstall.json?.data?.runtime?.status === 'UNINSTALLED');

  // ═════════════════════════════════════════════════════════
  // G7 双端一致性：Web /license/mine 与 Desktop authorized-plugins 同源
  // ═════════════════════════════════════════════════════════
  const mine2 = await api('/api/ecosystem/license/mine', { token: tokenA });
  const webLicense = mine2.json?.data?.licenses?.find((l) => l.plugin?.pluginId === TARGET_PLUGIN);
  const authRenewed = await api(`/api/ecosystem/devices/${deviceA.deviceId}/authorized-plugins`, { token: tokenA });
  const desktopPlugin = authRenewed.json?.data?.plugins?.find((p) => p.pluginId === TARGET_PLUGIN);
  check('G7 Web 端: License ACTIVE（单一授权源）', webLicense?.status === 'ACTIVE');
  check('G7 Desktop 端: authorized-plugins 返回 ACTIVE 同源', desktopPlugin?.licenseStatus === 'ACTIVE' && desktopPlugin?.allowed === true);
  check('G7 Desktop 端: 能力信息完整（runtimeLocal+kaorBound）', desktopPlugin?.runtimeLocal === true && desktopPlugin?.kaorBound === true,
    `runtimeLocal=${desktopPlugin?.runtimeLocal} kaorBound=${desktopPlugin?.kaorBound}`);

  // 过期后双端一致（再次 expire 验证两端同步降级）
  await api(`/api/ecosystem/license/${license.id}/expire`, { method: 'POST', token: tokenA, body: { reason: 'ECO11.3_G7_TEST' } });
  const mine3 = await api('/api/ecosystem/license/mine', { token: tokenA });
  const webExpired = mine3.json?.data?.licenses?.find((l) => l.plugin?.pluginId === TARGET_PLUGIN);
  const authExpired2 = await api(`/api/ecosystem/devices/${deviceA.deviceId}/authorized-plugins`, { token: tokenA });
  const desktopExpired = authExpired2.json?.data?.plugins?.find((p) => p.pluginId === TARGET_PLUGIN);
  check('G7 双端一致: 过期后 Web EXPIRED', webExpired?.status === 'EXPIRED');
  check('G7 双端一致: 过期后 Desktop 不再提供插件', desktopExpired === undefined);

  // 恢复现场（G4 后续用例用）
  await api(`/api/ecosystem/license/${license.id}/renew`, { method: 'POST', token: tokenA, body: { durationDays: 365 } });

  // ═════════════════════════════════════════════════════════
  // G5 线上工作台独立（新媒体不被 Desktop 影响）
  // ═════════════════════════════════════════════════════════
  const online = await fetch(`${ONLINE_BASE}/workspace/media`, { method: 'GET', redirect: 'follow' }).then((r) => r.status).catch(() => 0);
  check('G5 线上工作台: 新媒体工作台可达', online === 200, `status=${online}`);
  // Desktop 心跳链路走本地 API，不依赖线上会话/线上域（解耦断言）
  const devHb = await api(`/api/ecosystem/devices/${deviceA.deviceId}/heartbeat`, {
    method: 'POST', token: tokenA, body: { token: tokenA_dev },
  });
  check('G5 线上工作台: Desktop 心跳本地独立（不依赖线上会话）', devHb.json?.data?.allowed === true,
    `status=${devHb.json?.data?.status}`);

  // ═════════════════════════════════════════════════════════
  // G6 插件执行边界：本地零代码执行证明（静态检查）
  // ═════════════════════════════════════════════════════════
  const uiHtml = fs.readFileSync(path.join(ROOT, 'desktop/ui/index.html'), 'utf8');
  const rustLib = fs.readFileSync(path.join(ROOT, 'desktop/src-tauri/src/lib.rs'), 'utf8');
  const deviceSvc = fs.readFileSync(path.join(ROOT, 'backend/src/ecosystem/device.service.ts'), 'utf8');
  const manifestSchema = fs.readFileSync(path.join(ROOT, 'backend/src/ecosystem/plugin-manifest.schema.ts'), 'utf8');
  const builtin = fs.readFileSync(path.join(ROOT, 'backend/src/ecosystem/builtin-plugins.ts'), 'utf8');

  check('G6 边界: Desktop UI 无动态加载插件代码（dll/exe/node/python）',
    !/dlopen|LoadLibrary|require\(['"]|import\(['"]|child_process|spawn|exec\(/i.test(uiHtml));
  check('G6 边界: Rust 壳无插件执行通道',
    !/dlopen|LoadLibrary|Command::new|std::process/i.test(rustLib));
  check('G6 边界: 后端 start 仅写运行时记录，无进程/代码执行',
    !/child_process|spawnSync|execSync|execFile|vm\.runIn/i.test(deviceSvc));
  check('G6 边界: manifest 校验含 local 必须 kaor 强约束（superRefine）',
    /superRefine/.test(manifestSchema) && /local=true 必须/.test(manifestSchema));
  check('G6 边界: ai-content-ops-manager 白名单启用 runtimeLocal',
    /ai-content-ops-manager[\s\S]*runtimeLocal: true/.test(builtin));
  const tauriConf = JSON.parse(fs.readFileSync(path.join(ROOT, 'desktop/src-tauri/tauri.conf.json'), 'utf8'));
  check('G6 边界: 安装包 NSIS 配置（Windows 优先）',
    tauriConf?.bundle?.targets?.includes('nsis') === true, `targets=${JSON.stringify(tauriConf?.bundle?.targets)}`);

  // ═════════════════════════════════════════════════════════
  // G1 Windows 安装包（本机静态校验 + 真机清单输出）
  // ═════════════════════════════════════════════════════════
  check('G1 安装包: productName 就绪', !!tauriConf?.productName, `productName=${tauriConf?.productName}`);
  check('G1 安装包: WebView2 bootstrapper（Win10/11 自动装）',
    /downloadBootstrapper|WebView2/i.test(fs.readFileSync(path.join(ROOT, 'desktop/src-tauri/tauri.conf.json'), 'utf8')));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'desktop/package.json'), 'utf8'));
  check('G1 安装包: 构建脚本就绪（tauri build）', /tauri/.test(pkg?.scripts?.build || ''));
  console.log('\n  📦 G1 真机清单（掌柜 Windows 机执行）:');
  console.log('    1. cd desktop && npm install && npm run tauri build（NSIS 产物 target/release/bundle/nsis/*.exe）');
  console.log('    2. 安装 → 启动 → 登录 → 我的应用/插件授权 → 启动工作台');
  console.log('    3. 卸载 → 重装（升级）→ 数据保留');

  // ═════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`结果: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) {
    console.log('\n失败明细:');
    results.filter((r) => r.startsWith('❌')).forEach((r) => console.log(r));
    process.exit(1);
  }
  console.log(results.join('\n'));
  console.log('\n✅ SPRINT-ECO-11.3 Reality Gate 全部通过');
}

main().catch((e) => { console.error('脚本异常:', e); process.exit(1); });
