// FERRET vote API (Cloudflare Worker + KV).
//   POST /vote     { address, message, signature }  -> stores one vote per wallet per round
//   GET  /results  ?round=N                          -> totals weighted by token balance
// A vote is a signed message, so it costs nothing and proves wallet ownership.

import { recoverMessageAddress, isAddress } from 'viem';

const BALANCE_OF = '0x70a08231';
const MAX_AGE_MS = 10 * 60 * 1000;
const RESULTS_TTL = 60;
const MESSAGE = /^.+ vote\nRound: (\d+)\nChoice: ([a-z0-9-]+)\nTime: (\S+)$/;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

async function vote(request, env) {
  const { address, message, signature } = await request.json().catch(() => ({}));
  if (!isAddress(address ?? '') || typeof message !== 'string' || typeof signature !== 'string') return json({ error: 'bad request' }, 400);

  const m = message.match(MESSAGE);
  if (!m) return json({ error: 'bad message' }, 400);
  const [, round, choice, time] = m;
  if (round !== String(env.ROUND)) return json({ error: 'this round is closed' }, 400);
  if (!env.CANDIDATES.split(',').includes(choice)) return json({ error: 'unknown candidate' }, 400);
  const signedAt = Date.parse(time);
  if (!(Math.abs(Date.now() - signedAt) < MAX_AGE_MS)) return json({ error: 'signature expired, try again' }, 400);

  const signer = await recoverMessageAddress({ message, signature }).catch(() => null);
  if (!signer || signer.toLowerCase() !== address.toLowerCase()) return json({ error: 'signature does not match address' }, 401);

  const key = `r${round}:${signer.toLowerCase()}`;
  const previous = await env.VOTES.getWithMetadata(key);
  // an older signature must not overwrite a newer vote if someone replays it
  if (previous.metadata && previous.metadata.signedAt >= signedAt) return json({ error: 'a newer vote already exists' }, 409);

  await env.VOTES.put(key, signature, { metadata: { choice, signedAt } });
  await env.VOTES.delete(`results:${round}`);
  return json({ ok: true, choice });
}

async function balances(env, voters) {
  const out = new Map();
  for (let i = 0; i < voters.length; i += 100) {
    const chunk = voters.slice(i, i + 100);
    const res = await fetch(env.RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(chunk.map((v, j) => ({
        jsonrpc: '2.0',
        id: j,
        method: 'eth_call',
        params: [{ to: env.TOKEN_ADDRESS, data: BALANCE_OF + v.slice(2).padStart(64, '0') }, 'latest'],
      }))),
    });
    for (const r of await res.json()) out.set(chunk[r.id], r.result && r.result !== '0x' ? Number(BigInt(r.result)) / 1e18 : 0);
  }
  return out;
}

async function results(request, env) {
  const round = new URL(request.url).searchParams.get('round') || String(env.ROUND);
  const cached = await env.VOTES.get(`results:${round}`, 'json');
  if (cached) return json(cached);

  const votes = [];
  let cursor;
  do {
    const page = await env.VOTES.list({ prefix: `r${round}:`, cursor });
    for (const k of page.keys) votes.push({ voter: k.name.split(':')[1], choice: k.metadata.choice });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  // Before the token exists every wallet counts once; afterwards weight is the live balance,
  // so tokens sold after voting stop counting.
  const weighted = Boolean(env.TOKEN_ADDRESS);
  const weights = weighted ? await balances(env, votes.map((v) => v.voter)) : null;
  const totals = {};
  for (const v of votes) totals[v.choice] = (totals[v.choice] || 0) + (weighted ? weights.get(v.voter) : 1);

  const body = { round: Number(round), voters: votes.length, weighted, totals };
  await env.VOTES.put(`results:${round}`, JSON.stringify(body), { expirationTtl: RESULTS_TTL });
  return json(body);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'POST' && pathname === '/vote') return vote(request, env);
    if (request.method === 'GET' && pathname === '/results') return results(request, env);
    return json({ error: 'not found' }, 404);
  },
};
