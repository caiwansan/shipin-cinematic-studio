#!/usr/bin/env node
/**
 * SPRINT-ECO-11.2 — Kunlun Desktop Shell Reality Gate
 * 掌柜冻结验收（2026-08-04）：G1 安装 / G2 登录 / G3 设备注册 / G4 重启恢复 / G5 License 预演 / G6 工作台回归
 *
 * 用法: node scripts/reality-check-eco-11-2.cjs
 * 前置: api-server 运行中（4002），测试账号可用
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:4002';

// 测试账号（保留测试账号，见 MEMORY: 多租户隔离测试）
const ORG_A = { account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }; // org 11111111-2222-4333-8444-555555555555
const ORG_B = { account: 'tenant_iso_test@audit.local', password: 'AuditTest@123' }; // 组织隔离测试账号（不同 org）

let passed = 0, failed = 0;
const results = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; results.push(`✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { failed++; results.push(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
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

async function main() {
  console.log('══════════════════════════════════════════════════════');
  console.log('ECO-11.2 Kunlun Desktop Shell Reality Gate');
  console.log('══════════════════════════════════════════════════════\n');

  // ── G2 登录（JWT 链路不改）──────────────────────────────
  const tokenA = await login(ORG_A.account, ORG_A.password);
  const tokenB = await login(ORG_B.account, ORG_B.password);
  check('G2 登录: 组织 A 账号 JWT', !!tokenA);
  check('G2 登录: 组织 B 账号 JWT（隔离测试）', !!tokenB);
  if (!tokenA || !tokenB) { console.log('\n⚠️ 登录失败，终止'); process.exit(1); }

  // ── G3 设备注册（随机 device_id + token + 用户确认=登录 JWT）──
  const regA = await api('/api/ecosystem/devices/register', {
    method: 'POST', token: tokenA,
    body: { deviceName: 'RG 设备 A', os: 'windows-11', deviceFingerprint: `rg-fp-a-${Date.now()}` },
  });
  const deviceA = regA.json?.data?.device;
  const tokenA_dev = regA.json?.data?.token;
  check('G3 设备注册: 设备 A 返回 deviceId', !!deviceA?.deviceId && deviceA.status === 'ACTIVE');
  check('G3 设备注册: 返回一次性 deviceToken', !!tokenA_dev && tokenA_dev.length >= 32);
  check('G3 设备注册: 响应不含明文指纹（服务端只存哈希化 token）', deviceA && !('deviceFingerprint' in deviceA));
  check('G3 设备注册: 无硬件序列号字段（冻结：禁 CPU/硬盘/MAC 绑定）',
    !deviceA || !('cpuSerial' in deviceA) && !('diskSerial' in deviceA) && !('macAddress' in deviceA));

  const regB = await api('/api/ecosystem/devices/register', {
    method: 'POST', token: tokenB,
    body: { deviceName: 'RG 设备 B（其他组织）', os: 'windows-11', deviceFingerprint: `rg-fp-b-${Date.now()}` },
  });
  const deviceB = regB.json?.data?.device;
  const tokenB_dev = regB.json?.data?.token;
  check('G3 设备注册: 组织 B 设备 B 注册成功', !!deviceB?.deviceId);

  // ── G4 重启恢复（设备状态保持）──────────────────────────
  const meA = await api(`/api/ecosystem/devices/me?deviceId=${deviceA.deviceId}`, { token: tokenA });
  check('G4 重启恢复: /devices/me 恢复设备 A（状态保持）', meA.json?.data?.device?.status === 'ACTIVE');

  const hb = await api(`/api/ecosystem/devices/${deviceA.deviceId}/heartbeat`, {
    method: 'POST', token: tokenA, body: { token: tokenA_dev },
  });
  check('G4 重启恢复: 心跳后 allowed:true', hb.json?.data?.allowed === true && hb.json?.data?.status === 'ACTIVE');

  const hbBad = await api(`/api/ecosystem/devices/${deviceA.deviceId}/heartbeat`, {
    method: 'POST', token: tokenA, body: { token: 'wrong-token' },
  });
  check('G4 安全: 错误设备 token 心跳被拒（403）', hbBad.status === 403);

  // 组织隔离：组织 B 查设备 A 状态 → 拒绝
  const crossOrg = await api(`/api/ecosystem/devices/me?deviceId=${deviceA.deviceId}`, { token: tokenB });
  check('G4 隔离: 组织 B 查询设备 A → 403 DEVICE_ORG_MISMATCH', crossOrg.status === 403);

  // ── G1 安装（本地应用安装记录）──────────────────────────
  const install = await api(`/api/ecosystem/devices/${deviceA.deviceId}/apps/install`, {
    method: 'POST', token: tokenA,
    body: { applicationSlug: 'kunlun-media', version: '1.0.0', installPath: '%LOCALAPPDATA%\\Kunlun Desktop\\apps\\kunlun-media' },
  });
  check('G1 安装: kunlun-media 本地安装记录 INSTALLED', install.json?.data?.app?.status === 'INSTALLED');
  const installAgain = await api(`/api/ecosystem/devices/${deviceA.deviceId}/apps/install`, {
    method: 'POST', token: tokenA,
    body: { applicationSlug: 'kunlun-media', version: '1.0.1' },
  });
  check('G1 安装: 重复安装幂等 + 版本更新 1.0.1', installAgain.json?.data?.idempotent === true && installAgain.json?.data?.app?.version === '1.0.1');

  const apps = await api('/api/ecosystem/applications', { token: tokenA });
  check('G1 应用目录: 9 内置应用可读', Array.isArray(apps.json?.data?.applications) && apps.json.data.applications.length >= 9);

  // ── G5 License 预演（设备隔离）──────────────────────────
  // 设备 A 的组织已有 ACTIVE license（ai-content-*），取其 pluginId
  const mine = await api('/api/ecosystem/license/mine', { token: tokenA });
  const licenses = mine.json?.data?.licenses || [];
  check('G5 前置: 组织 A 存在 ACTIVE License', licenses.some((l) => l.status === 'ACTIVE'));
  const targetPlugin = licenses.find((l) => l.status === 'ACTIVE')?.plugin?.pluginId;

  if (targetPlugin) {
    const lcA = await api(`/api/ecosystem/devices/${deviceA.deviceId}/launch-check`, {
      method: 'POST', token: tokenA, body: { pluginId: targetPlugin },
    });
    check('G5 预演: 设备 A 启动插件 → allowed:true', lcA.json?.data?.allowed === true && lcA.json?.data?.reason === 'OK');

    // 设备 B（其他组织）对同一插件 → denied（NO_LICENSE）
    const lcB = await api(`/api/ecosystem/devices/${deviceB.deviceId}/launch-check`, {
      method: 'POST', token: tokenB, body: { pluginId: targetPlugin },
    });
    check('G5 预演: 设备 B（其他组织）启动插件 → denied', lcB.json?.data?.allowed === false && lcB.json?.data?.reason === 'NO_LICENSE');

    // 设备 A 授权状态读取（Shell「已安装插件 + 授权状态」）
    const authP = await api(`/api/ecosystem/devices/${deviceA.deviceId}/authorized-plugins`, { token: tokenA });
    check('G5 预演: 设备 A 授权插件列表含目标插件', Array.isArray(authP.json?.data?.plugins) && authP.json.data.plugins.some((p) => p.pluginId === targetPlugin && p.allowed === true));

    // 组织 B 读取设备 A 授权 → 403
    const crossP = await api(`/api/ecosystem/devices/${deviceA.deviceId}/authorized-plugins`, { token: tokenB });
    check('G5 隔离: 组织 B 读设备 A 授权列表 → 403', crossP.status === 403);
  } else {
    check('G5 预演: 组织 A 无 ACTIVE License（跳过）', false, '需先 grant License');
  }

  // ── 吊销（REVOKED → heartbeat 403）─────────────────────
  const revoke = await api(`/api/ecosystem/devices/${deviceA.deviceId}/revoke`, { method: 'POST', token: tokenA });
  check('吊销: 设备 A 吊销成功', revoke.json?.data?.device?.status === 'REVOKED');
  const hbAfter = await api(`/api/ecosystem/devices/${deviceA.deviceId}/heartbeat`, {
    method: 'POST', token: tokenA, body: { token: tokenA_dev },
  });
  check('吊销: 吊销后心跳 → allowed:false（本地强制登出信号）', hbAfter.json?.data?.allowed === false && hbAfter.json?.data?.status === 'REVOKED');

  // ── G6 工作台回归（9 工作台 + 前端服务 + 线上入口）──────────
  // 本次 Sprint 未动前端/工作台业务；回归 = 应用目录 9 应用 + 核心 API + 线上入口可达
  const apps2 = await api('/api/ecosystem/applications', { token: tokenA });
  const appList = apps2.json?.data?.applications || [];
  const slugs = appList.map((a) => a.slug);
  const needSlugs = ['kunlun-media', 'kunlun-drama', 'kunlun-novel', 'kunlun-recruit', 'kunlun-legal', 'kunlun-mall', 'kunlun-music', 'kunlun-ads', 'kunlun-geo'];
  const missing = needSlugs.filter((s) => !slugs.includes(s));
  check('G6 回归: 9 工作台应用全部注册（短剧/小说/招聘/法律/商城/音乐/广告/GEO/新媒体）', missing.length === 0, missing.length ? `缺: ${missing.join(',')}` : '');

  const wb = await api('/api/enterprise/workspaces', { token: tokenA });
  check('G6 回归: 企业工作台核心 API 正常（200/业务码）', wb.status === 200 || wb.json?.code === 0 || wb.json?.code === 200, `status=${wb.status} code=${wb.json?.code}`);

  // 前端服务与线上入口（本次未改动，冒烟确认）
  const fe = await fetch('http://127.0.0.1:3000/').catch(() => null);
  const live = await fetch('https://aigc.fushtn.com/').catch(() => null);
  check('G6 回归: 前端服务 3000 可达', fe?.status === 200);
  check('G6 回归: 线上入口 aigc.fushtn.com 可达', live?.status === 200);

  // ── 汇总 ───────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────');
  for (const r of results) console.log(r);
  console.log('──────────────────────────────────────────────');
  console.log(`\n📊 结果: ${passed} PASS / ${failed} FAIL（共 ${passed + failed} 项）`);
  console.log(failed === 0 ? '\n🎉 ECO-11.2 Reality Gate 全绿' : `\n⚠️ ${failed} 项失败，需修复`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('脚本异常:', e); process.exit(1); });
