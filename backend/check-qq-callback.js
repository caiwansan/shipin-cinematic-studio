const fs = require('fs');

const filePath = '/root/shipin-cinematic-studio/backend/src/routes/qq-oauth.ts';
let code = fs.readFileSync(filePath, 'utf8');

// Find the QQ callback section and check unionId capture
const callbackIdx = code.indexOf("qq/callback");
if (callbackIdx > 0) {
  // Show the callback handler
  console.log("=== QQ Callback Handler ===");
  console.log(code.substring(callbackIdx, callbackIdx + 1500));
}

// Find the mobile callback
const mobileCallbackIdx = code.indexOf("qq/mobile/callback");
if (mobileCallbackIdx > 0) {
  console.log("\n=== Mobile QQ Callback Handler ===");
  console.log(code.substring(mobileCallbackIdx, mobileCallbackIdx + 1500));
}

// Check how unionId is obtained from QQ API
const unionIdIdx = code.indexOf("unionid");
if (unionIdIdx > 0) {
  console.log("\n=== unionId capture ===");
  console.log(code.substring(unionIdIdx - 200, unionIdIdx + 200));
}
