// plam.pages.dev 的固定入口：把所有请求转发到分身电脑当前的 Cloudflare 隧道。
// 电脑每次开机隧道网址会变，分身启动时会把新网址写进 KV（键 target），这里每次读出来转发过去。
// 同时带上访问者的真实 IP 和一个口令（KV 键 secret），分身凭口令才相信这个 IP，用来限速防爆破。

const OFFLINE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Claude MAX</title>
<style>body{font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif;background:#f7f5f0;color:#2b2924;display:flex;
min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;text-align:center}</style></head>
<body><div><h2>服务暂时离线</h2><p>主机正在重启或网络中断，请过几分钟再刷新。</p>
<p>Service is temporarily offline. Please refresh in a few minutes.</p></div></body></html>`;

function offline() {
  return new Response(OFFLINE, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" },
  });
}

// 门卫：在 Cloudflare 这边就挡掉爬虫、脚本工具和黑客扫描，请求到不了分身电脑
const BAD_UA = /(curl|wget|python-requests|python-urllib|python\/|aiohttp|httpx|scrapy|go-http-client|java\/|okhttp|libwww|httpclient|node-fetch|axios|undici|headlesschrome|phantomjs|selenium|puppeteer|playwright|crawler|spider|scrapy|bot\b|bot\/|masscan|nmap|nikto|sqlmap|zgrab)/i;
const BAD_PATH = /^\/(\.env|\.git|\.svn|\.ds_store|wp-|wordpress|phpmyadmin|pma|xmlrpc|cgi-bin|vendor\/|actuator|server-status|config\.json|backup|.*\.(php|asp|aspx|jsp|bak|sql)$)/i;

function forbidden() {
  return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

export async function onRequest({ request, env }) {
  const ua = request.headers.get("User-Agent") || "";
  const path = new URL(request.url).pathname;
  if (path === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!ua || BAD_UA.test(ua) || BAD_PATH.test(path)) return forbidden();

  const [target, secret] = await Promise.all([
    env.FENSHEN.get("target", { cacheTtl: 60 }),
    env.FENSHEN.get("secret", { cacheTtl: 300 }),
  ]);
  if (!target) return offline();

  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set("X-Fenshen-Proxy", secret || "");
  headers.set("X-Fenshen-Client-IP", request.headers.get("CF-Connecting-IP") || "");
  headers.set("X-Fenshen-Host", url.host);

  try {
    const resp = await fetch(target + url.pathname + url.search, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
    // 隧道断了或已失效（电脑关机、网络中断、临时网址被收回）时显示离线页，不露出 Cloudflare 的英文错误页
    if ([502, 503, 504].includes(resp.status) || (resp.status >= 520 && resp.status <= 530)) return offline();
    return new Response(resp.body, resp);  // 原样流式转发，回答一个字一个字地出来
  } catch (e) {
    return offline();
  }
}
