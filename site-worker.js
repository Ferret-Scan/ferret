// Serves the static site and one extra route: POST /rpc.
// /rpc forwards read-only eth_call requests to the keyed Robinhood Chain RPC (secret RH_RPC_URL),
// so the key never appears in the page. Only calls to Multicall3 are let through, which is all
// the wallet check needs.
const MULTICALL3 = '0xca11bde05977b3631167028862be2a173976ca11';
const MAX_BODY = 60_000;
const DATA_SOURCE = 'https://raw.githubusercontent.com/Ferret-Scan/ferret/main/site';
const DATA_FILES = new Set(['/data/portfolios.json', '/data/insiders.json']);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Filing data is rebuilt daily by a GitHub Action that commits to the repo, so serve the
    // repo's copy when it can be fetched and the deployed snapshot when it cannot.
    if (DATA_FILES.has(url.pathname)) {
      const fresh = await fetch(DATA_SOURCE + url.pathname, { cf: { cacheTtl: 600, cacheEverything: true } }).catch(() => null);
      if (fresh?.ok) return new Response(fresh.body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
      return env.ASSETS.fetch(request);
    }
    if (url.pathname !== '/rpc') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'request too large' }, 413);
    let call;
    try {
      call = JSON.parse(text);
    } catch {
      return json({ error: 'bad json' }, 400);
    }
    const to = call?.params?.[0]?.to;
    if (call?.method !== 'eth_call' || typeof to !== 'string' || to.toLowerCase() !== MULTICALL3) {
      return json({ error: 'only eth_call to Multicall3 is allowed' }, 403);
    }

    // a secret piped in from a shell can carry a byte-order mark or a line break
    const rpc = String(env.RH_RPC_URL || '').replace(/^﻿/, '').trim();
    if (!rpc) return json({ error: 'RPC is not configured' }, 503);
    try {
      const upstream = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: call.id ?? 1, method: 'eth_call', params: [{ to, data: call.params[0].data }, 'latest'] }),
      });
      return new Response(await upstream.text(), { status: upstream.status, headers: { 'content-type': 'application/json' } });
    } catch (err) {
      // never echo the RPC url: it holds the key
      return json({ error: 'RPC unreachable', kind: err?.name || 'Error', length: rpc.length, scheme: rpc.slice(0, 8) }, 502);
    }
  },
};
