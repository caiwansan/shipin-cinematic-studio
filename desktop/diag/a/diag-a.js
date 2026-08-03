// Diag-A: 外部 JS 执行检测（同源外部脚本，script-src 'self' 应放行）
(function () {
  try {
    var el = document.getElementById('js-status');
    if (el) {
      el.textContent = 'JS 执行 OK（外部脚本）';
      el.className = 'status ok';
    }
    var env = document.getElementById('env');
    if (env) {
      env.textContent = 'UA: ' + navigator.userAgent;
    }
    // 给诊断证据：CSP 若拦截内联但放行同源外部，这里会成功
    document.title = 'DiagA-JS-OK';
  } catch (e) {
    var el2 = document.getElementById('js-status');
    if (el2) { el2.textContent = 'JS 执行失败: ' + e.message; el2.className = 'status fail'; }
  }
})();
