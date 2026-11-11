// Local vote API without the Workers runtime; votes live in memory and vanish on restart.
// Run: node dev.mjs   then set vote.api to http://localhost:8787 in ../config.js
import { createServer } from 'node:http';
import worker from './src/index.js';
import { memoryKV } from './memory-kv.mjs';

const env = {
  VOTES: memoryKV(),
  ROUND: '1',
  CANDIDATES: 'soros,tiger,thirdpoint,baupost,rentech,sa',
  RPC_URL: 'https://rpc.mainnet.chain.robinhood.com',
  TOKEN_ADDRESS: '',
};
const port = 8787;

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const response = await worker.fetch(
    new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined }),
    env,
  );
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`vote API on http://localhost:${port}`));
