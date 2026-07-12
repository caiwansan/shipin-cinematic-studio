import { b3 as setResponseHeader, R as freezeApp } from './h3.mjs';
export { H as H3, a as H3Core, b as H3Error, c as H3Event, d as HTTPError, e as HTTPResponse, f as appendCorsHeaders, g as appendCorsPreflightHeaders, h as appendHeader, i as appendHeaders, j as appendResponseHeader, k as appendResponseHeaders, l as assertBodySize, m as assertMethod, n as basicAuth, o as bodyLimit, p as callMiddleware, q as clearResponseHeaders, r as clearSession, s as createApp, t as createError, u as createEventStream, v as createRouter, w as defaultContentType, x as defineEventHandler, y as defineHandler, z as defineJsonRpcHandler, A as defineJsonRpcWebSocketHandler, B as defineLazyEventHandler, C as defineMiddleware, D as defineNodeHandler, E as defineNodeListener, F as defineNodeMiddleware, G as definePlugin, I as defineRoute, J as defineValidatedHandler, K as defineWebSocket, L as defineWebSocketHandler, M as deleteChunkedCookie, N as deleteCookie, O as dynamicEventHandler, P as eventHandler, Q as fetchWithEvent, S as fromNodeHandler, T as fromNodeMiddleware, U as fromWebHandler, V as getBodyStream, W as getChunkedCookie, X as getCookie, Y as getEventContext, Z as getHeader, _ as getHeaders, $ as getMethod, a0 as getProxyRequestHeaders, a1 as getQuery, a2 as getRequestFingerprint, a3 as getRequestHeader, a4 as getRequestHeaders, a5 as getRequestHost, a6 as getRequestIP, a7 as getRequestPath, a8 as getRequestProtocol, a9 as getRequestURL, aa as getRequestWebStream, ab as getResponseHeader, ac as getResponseHeaders, ad as getResponseStatus, ae as getResponseStatusText, af as getRouterParam, ag as getRouterParams, ah as getSession, ai as getValidatedCookies, aj as getValidatedQuery, ak as getValidatedRouterParams, al as handleCacheHeaders, am as handleCors, an as html, ao as isCorsOriginAllowed, ap as isError, aq as isEvent, ar as isHTTPEvent, as as isMethod, at as isPreflightRequest, au as iterable, av as lazyEventHandler, aw as mockEvent, ax as noContent, ay as onError, az as onRequest, aA as onResponse, aB as parseCookies, aC as proxy, aD as proxyRequest, aE as readBody, aF as readFormData, aG as readFormDataBody, aH as readMultipartFormData, aI as readRawBody, aJ as readValidatedBody, aK as redirect, aL as redirectBack, aM as removeResponseHeader, aN as removeRoute, aO as requestWithBaseURL, aP as requestWithURL, aQ as requireBasicAuth, aR as sanitizeStatusCode, aS as sanitizeStatusMessage, aT as sealSession, aU as sendIterable, aV as sendNoContent, aW as sendProxy, aX as sendRedirect, aY as sendStream, aZ as sendWebResponse, a_ as serveStatic, a$ as setChunkedCookie, b0 as setCookie, b1 as setHeader, b2 as setHeaders, b4 as setResponseHeaders, b5 as setResponseStatus, b6 as setServerTiming, b7 as toEventHandler, b8 as toMiddleware, b9 as toNodeListener, ba as toRequest, bb as toResponse, bc as toWebHandler, bd as unsealSession, be as updateSession, bf as useBase, bg as useSession, bh as withBase, bi as withServerTiming, bj as writeEarlyHints } from './h3.mjs';
import { serve as serve$1, toNodeHandler as toNodeHandler$1 } from 'srvx/node';
import 'rou3';
import 'srvx';

function serve(app, options) {
	freezeApp(app);
	return serve$1({
		fetch: app.fetch,
		...options
	});
}
function toNodeHandler(app) {
	return toNodeHandler$1(app.fetch);
}

export { serve, setResponseHeader, toNodeHandler };
//# sourceMappingURL=node.mjs.map
