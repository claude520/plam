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

export async function onRequest({ request, env }) {
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
    // 隧道已经失效（Cloudflare 收回了临时网址）时也显示离线页
    if (resp.status === 530 || resp.status === 1033) return offline();
    return new Response(resp.body, resp);  // 原样流式转发，回答一个字一个字地出来
  } catch (e) {
    return offline();
  }
}
