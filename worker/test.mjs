// Exercises the worker's request handler in Node with an in-memory stand-in for KV.
// Run: node test.mjs
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import worker from './src/index.js';
import { memoryKV } from './memory-kv.mjs';

const env = { VOTES: memoryKV(), ROUND: '1', CANDIDATES: 'soros,tiger,thirdpoint,baupost,rentech,sa', RPC_URL: '', TOKEN_ADDRESS: '' };

const call = async (path, init) => {
  const res = await worker.fetch(new Request(`https://vote.test${path}`, init), env);
  return [res.status, await res.json()];
};
const post = (body) => call('/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const message = (choice, time = new Date(), round = 1) => `FERRET vote\nRound: ${round}\nChoice: ${choice}\nTime: ${time.toISOString()}`;

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(detail)}`);
};
const expect = (name, [status, body], want) => check(name, status === want, [status, body]);

const alice = privateKeyToAccount(generatePrivateKey());
const bob = privateKeyToAccount(generatePrivateKey());
const sign = async (account, msg) => ({ address: account.address, message: msg, signature: await account.signMessage({ message: msg }) });

const first = await sign(alice, message('soros', new Date(Date.now() - 5000)));
expect('valid vote', await post(first), 200);
expect('second voter', await post(await sign(bob, message('tiger'))), 200);
expect('change of vote', await post(await sign(alice, message('tiger'))), 200);
expect('replay of older signature', await post(first), 409);
expect('signature from another wallet', await post({ ...(await sign(bob, message('soros'))), address: alice.address }), 401);
expect('unknown candidate', await post(await sign(alice, message('pelosi'))), 400);
expect('wrong round', await post(await sign(alice, message('soros', new Date(), 2))), 400);
expect('expired signature', await post(await sign(alice, message('soros', new Date(Date.now() - 3600_000)))), 400);
expect('garbage body', await post({ hello: 'world' }), 400);

const [, results] = await call('/results?round=1');
check('tally', results.voters === 2 && results.totals.tiger === 2 && !results.totals.soros && results.weighted === false, results);

process.exit(failed ? 1 : 0);
