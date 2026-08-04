// Diag-B: 外部脚本执行检测（与 DiagA 的 diag-a.js 同机制，script-src 'self' 应放行）
// 目的：把「外部 JS 是否执行」从 inline script 中独立出来，逐环节定位白屏根因
(function () {
  try {
    window.__diagBCheck = true;
    var el = document.getElementById('check-status');
    if (el) {
      el.textContent = '✅ 外部脚本 diag-b-check.js 执行 OK';
      el.className = 'status ok';
    }
    var env = document.getElementById('env');
    if (env) {
      env.textContent = 'UA: ' + navigator.userAgent;
    }
  } catch (e) {
    var el2 = document.getElementById('check-status');
    if (el2) { el2.textContent = '❌ 外部脚本异常: ' + e.message; el2.className = 'status fail'; }
  }
})();
