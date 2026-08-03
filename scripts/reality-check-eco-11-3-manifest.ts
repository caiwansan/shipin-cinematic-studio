/**
 * SPRINT-ECO-11.3 — G6 插件执行边界：manifest 校验强约束单测
 * 掌柜冻结：runtime.local=true 必须 runtime.kaor=true；strict 白名单拒绝未知字段
 * 用法: npx tsx scripts/reality-check-eco-11-3-manifest.ts
 */
import { validatePluginManifest } from '../backend/src/ecosystem/plugin-manifest.schema.js';

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { failed++; console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

function base() {
  return {
    id: 'test-plugin',
    name: '测试插件',
    type: 'agent',
    version: '1.0.0',
    author: 'kunlun-official',
    permissions: ['content'],
  };
}

console.log('══ SPRINT-ECO-11.3 G6 manifest 校验强约束 ══\n');

// 1. 合法：local:true + kaor:true（掌柜批准的组合）
const ok = validatePluginManifest({ ...base(), runtime: { kaor: true, local: true } });
check('G6-1: runtime{kaor:true, local:true} 合法', ok.valid === true);

// 2. 非法：local:true + kaor:false（掌柜强约束：必须拒绝）
const bad1 = validatePluginManifest({ ...base(), runtime: { kaor: false, local: true } });
check('G6-2: runtime{kaor:false, local:true} 拒绝', bad1.valid === false, bad1.errors?.[0] ?? '');
check('G6-2b: 拒绝原因含 local 必须 kaor', (bad1.errors?.[0] ?? '').includes('local=true 必须'));

// 3. 非法：只有 local:true 无 kaor（缺省 false 亦拒绝）
const bad2 = validatePluginManifest({ ...base(), runtime: { local: true } });
check('G6-3: runtime{local:true}（无 kaor）拒绝', bad2.valid === false);

// 4. 兼容：存量 manifest 只有 kaor:true（无 local，缺省 false）仍合法
const ok2 = validatePluginManifest({ ...base(), runtime: { kaor: true } });
check('G6-4: 存量 runtime{kaor:true} 兼容合法', ok2.valid === true);

// 5. 非法：未知运行时字段（strict 白名单防线）
const bad3 = validatePluginManifest({ ...base(), runtime: { kaor: true, local: true, evil: true } });
check('G6-5: runtime 未知字段拒绝（strict）', bad3.valid === false);

// 6. 非法：完全无 runtime（本地插件必须声明 kaor，但普通插件可不带 runtime——保持 ECO-02 语义）
//    local 缺省 = false，无 runtime 的插件不具本地能力（由 start 端点 NOT_LOCAL_CAPABLE 拦截）
const noRuntime = validatePluginManifest(base());
check('G6-6: 无 runtime 合法（默认非本地）', noRuntime.valid === true);

console.log(`\n结果: ${passed} PASS / ${failed} FAIL`);
if (failed > 0) process.exit(1);
console.log('✅ G6 manifest 强约束全部通过');
