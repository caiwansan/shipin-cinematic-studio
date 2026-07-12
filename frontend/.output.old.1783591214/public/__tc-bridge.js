/* __tc-init.js — token-cache bridge for Nuxt SPA */
(function(){if(window.__tc)return;
var M={},w=typeof window!='undefined'?window:null,ls=w?w.localStorage:null;
function g(k){try{return ls?ls.getItem(k)||'':''}catch(e){return ''}}
function s(k,v){try{if(ls)ls.setItem(k,v)}catch(e){}}
function r(k){try{if(ls)ls.removeItem(k)}catch(e){}}
var TK=['user_auth_token','auth_token','accessToken','token'],UK='auth_user';
M.getToken=function(){if(M._t)return M._t;
for(var i=0;i<TK.length;i++){var v=g(TK[i]);if(v){M._t=v;return v}}return ''};
M.setToken=function(t){M._t=t;for(var i=0;i<TK.length;i++)s(TK[i],t)};
M.getUser=function(){if(M._u)return M._u;var u=g(UK);if(u){try{M._u=JSON.parse(u)}catch(e){}}
return M._u||null};
M.setUser=function(u){M._u=u;u?s(UK,JSON.stringify(u)):r(UK)};
M.clearAuth=function(){M._t='';M._u=null;
for(var i=0;i<TK.length;i++)r(TK[i]);r(UK);
if(typeof document!='undefined'){document.cookie='auth_token=; path=/; max-age=0';
document.cookie='auth_user=; path=/; max-age=0'}};
M.isAuthenticated=function(){return!!M.getToken()};
window.__tc=M;
/* TC-COOKIE-SYNC: new tokens in cookies trigger re-read */
(function(){if(!w||!document)return;
var ck='__tc_ck_';setInterval(function(){
if(!M._t){var t=M.getToken();if(t)M._t=t}},5e3)})();
})();

/* -- require polyfill for Nuxt SPA (prevents "require is not defined") -- */
(function(){if(typeof window.require==='undefined'){
  window.require=function(m){ 
    console.warn('[require-polyfill] require("'+m+'") called in browser — returning empty object');
    return {};
  };
  window.require.cache={};
  window.require.resolve=function(){return null};
  console.log('[require-polyfill] ✅ window.require polyfill installed');
}})();
