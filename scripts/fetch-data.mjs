// Builds site/data/portfolios.json from two public sources:
//   1. SEC EDGAR 13F-HR filings (what each fund holds)
//   2. Robinhood's stock token registry (what can be bought on Robinhood Chain)
// Holdings are matched to tokens by CUSIP, which is embedded in each token's ISIN.
// Run: node scripts/fetch-data.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// SEC requires a descriptive User-Agent with contact details.
const SEC_UA = process.env.SEC_USER_AGENT || 'Ferret filings tracker contact@ferretcheck.com';
const ASSETS_URL = 'https://api.robinhood.com/rhj/assets';
const FEEDS_URL = 'https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json';
const CHAIN_ID = 4663;

const FUNDS = [
  { id: 'berkshire', cik: '0001067983', manager: 'Berkshire Hathaway', tagline: 'The house Warren Buffett built' },
  { id: 'ackman', cik: '0001336528', manager: 'Bill Ackman', tagline: 'Pershing Square: a handful of concentrated bets' },
  { id: 'druckenmiller', cik: '0001536411', manager: 'Stan Druckenmiller', tagline: "Duquesne: the macro legend's family office" },
  { id: 'tepper', cik: '0001656456', manager: 'David Tepper', tagline: 'Appaloosa: distressed-debt roots, big-tech book' },
  { id: 'wood', cik: '0001697748', manager: 'Cathie Wood', tagline: 'ARK: disruptive innovation or bust' },
  { id: 'bridgewater', cik: '0001350694', manager: 'Bridgewater', tagline: 'One of the largest hedge funds on earth' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sec(url) {
  await sleep(150); // stay well under SEC's 10 req/s limit
  const res = await fetch(url, { headers: { 'User-Agent': SEC_UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

async function loadTokens() {
  const res = await fetch(ASSETS_URL);
  if (!res.ok) throw new Error(`${res.status} ${ASSETS_URL}`);
  const { assets } = await res.json();
  const byCusip = new Map();
  for (const a of assets) {
    if (a.status !== 'ASSET_STATUS_ACTIVE' || !a.isin) continue;
    const dep = a.deployments?.find((d) => d.chainId === CHAIN_ID);
    if (!dep) continue;
    // ISIN = 2-letter country + 9-char national id (the CUSIP for US/CA issuers) + check digit
    byCusip.set(a.isin.slice(2, 11).toUpperCase(), {
      symbol: a.tokenSymbol,
      name: a.tokenName.replace(/\s*•\s*Robinhood Token$/, ''),
      address: dep.contractAddress,
      // underlying shares per token; moves away from 1 on splits and dividends
      multiplier: Number(a.currentMultiplier) || 1,
    });
  }
  return byCusip;
}

// Chainlink publishes live USD feeds for some stock tokens; the rest fall back to filing prices.
async function loadFeeds() {
  const res = await fetch(FEEDS_URL);
  if (!res.ok) throw new Error(`${res.status} ${FEEDS_URL}`);
  const bySymbol = new Map();
  for (const f of await res.json()) {
    const m = f.name.match(/^Robinhood ([A-Z.]+)\s*[-/]\s*USD$/);
    if (m && f.proxyAddress && f.decimals === 8) bySymbol.set(m[1], f.proxyAddress);
  }
  return bySymbol;
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`));
  return m ? m[1].trim().replace(/&amp;/g, '&') : '';
};

function parseInfoTable(xml) {
  const positions = new Map();
  for (const [block] of xml.matchAll(/<(?:\w+:)?infoTable>[\s\S]*?<\/(?:\w+:)?infoTable>/g)) {
    if (tag(block, 'putCall')) continue; // options are not copyable with spot tokens
    if (tag(block, 'sshPrnamtType') !== 'SH') continue; // skip bonds reported by principal amount
    const cusip = tag(block, 'cusip').toUpperCase();
    const prev = positions.get(cusip) || { cusip, issuer: tag(block, 'nameOfIssuer'), value: 0, shares: 0 };
    prev.value += Number(tag(block, 'value'));
    prev.shares += Number(tag(block, 'sshPrnamt'));
    positions.set(cusip, prev);
  }
  // Some filers still report value in thousands of dollars (the pre-2023 convention).
  // No US-listed share is worth under $1 at the median, so a sub-$1 median price gives them away.
  const prices = [...positions.values()].filter((p) => p.shares > 0).map((p) => p.value / p.shares).sort((a, b) => a - b);
  if (prices.length && prices[prices.length >> 1] < 1) {
    for (const p of positions.values()) p.value *= 1000;
  }
  return positions;
}

async function loadFiling(cik, accession) {
  const dir = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}`;
  const index = await (await sec(`${dir}/index.json`)).json();
  const xmlFiles = index.directory.item.map((i) => i.name).filter((n) => n.endsWith('.xml') && n !== 'primary_doc.xml');
  for (const name of xmlFiles) {
    const xml = await (await sec(`${dir}/${name}`)).text();
    if (/infoTable/i.test(xml)) return { positions: parseInfoTable(xml), url: `${dir}/${name}` };
  }
  throw new Error(`no information table in ${accession}`);
}

async function loadFund(fund, tokens) {
  const sub = await (await sec(`https://data.sec.gov/submissions/CIK${fund.cik}.json`)).json();
  const r = sub.filings.recent;
  const filings = [];
  const seen = new Set();
  for (let i = 0; i < r.form.length && filings.length < 2; i++) {
    // 13F-HR only: amendments (13F-HR/A) are often partial and would look like mass sells
    if (r.form[i] !== '13F-HR' || seen.has(r.reportDate[i])) continue;
    seen.add(r.reportDate[i]);
    filings.push({ accession: r.accessionNumber[i], filed: r.filingDate[i], period: r.reportDate[i] });
  }
  if (!filings.length) throw new Error('no 13F-HR filings');

  const latest = await loadFiling(fund.cik, filings[0].accession);
  const prior = filings[1] ? (await loadFiling(fund.cik, filings[1].accession)).positions : null;

  const total = [...latest.positions.values()].reduce((s, p) => s + p.value, 0);
  const change = (p) => {
    if (!prior) return null;
    const before = prior.get(p.cusip);
    if (!before) return { type: 'new' };
    if (p.shares === before.shares) return { type: 'hold' };
    return { type: p.shares > before.shares ? 'add' : 'trim', pct: (p.shares / before.shares - 1) * 100 };
  };

  const holdings = [...latest.positions.values()]
    .sort((a, b) => b.value - a.value)
    .map((p) => ({
      issuer: p.issuer,
      cusip: p.cusip,
      value: p.value,
      shares: p.shares,
      weight: (p.value / total) * 100,
      change: change(p),
      token: publicToken(tokens.get(p.cusip)),
    }));

  // Quarter-end share prices implied by the filing, used to value wallets for the copy score.
  for (const p of latest.positions.values()) {
    const known = prices.get(p.cusip);
    if (tokens.has(p.cusip) && p.shares > 0 && (!known || filings[0].period > known.asOf)) {
      prices.set(p.cusip, { price: p.value / p.shares, asOf: filings[0].period });
    }
  }

  const exits = prior
    ? [...prior.values()]
        .filter((p) => !latest.positions.has(p.cusip))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .map((p) => ({ issuer: p.issuer, value: p.value, token: publicToken(tokens.get(p.cusip)) }))
    : [];

  return {
    id: fund.id,
    manager: fund.manager,
    tagline: fund.tagline,
    firm: sub.name,
    period: filings[0].period,
    filed: filings[0].filed,
    source: latest.url,
    total,
    positions: holdings.length,
    coverage: holdings.filter((h) => h.token).reduce((s, h) => s + h.weight, 0),
    holdings: holdings.slice(0, 40),
    // every on-chain match, so the copy calculator is not limited to the top 40
    copyable: holdings.filter((h) => h.token).map((h) => ({ ...h.token, weight: h.weight })),    exits,
  };
}

const publicToken = (t) => (t ? { symbol: t.symbol, name: t.name, address: t.address } : null);
const prices = new Map();
const tokens = await loadTokens();
const feeds = await loadFeeds().catch((err) => (console.error(`no live feeds: ${err.message}`), new Map()));
console.log(`${tokens.size} stock tokens on chain ${CHAIN_ID}, ${feeds.size} with a live price feed`);

const portfolios = [];
for (const fund of FUNDS) {
  try {
    const p = await loadFund(fund, tokens);
    portfolios.push(p);
    console.log(`${p.manager} — ${p.firm}: ${p.positions} positions, ${p.coverage.toFixed(1)}% copyable, period ${p.period}`);
  } catch (err) {
    console.error(`skipped ${fund.manager}: ${err.message}`);
  }
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site', 'data');
await mkdir(out, { recursive: true });
await writeFile(
  path.join(out, 'portfolios.json'),
  JSON.stringify({
    updated: new Date().toISOString(),
    chainId: CHAIN_ID,
    tokenCount: tokens.size,
    tokens: [...tokens].map(([cusip, t]) => ({
      ...t,
      ...(prices.get(cusip) || { price: null, asOf: null }),
      feed: feeds.get(t.symbol) || null,
    })),
    portfolios,
  }),
);
console.log(`wrote ${portfolios.length} portfolios`);
