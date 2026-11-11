// Builds site/data/insiders.json: open-market buys and sells by company insiders (SEC Form 4)
// for every company that has a stock token on Robinhood Chain.
// Needs site/data/portfolios.json, so run fetch-data.mjs first.
// Run: node scripts/fetch-insiders.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SEC_UA = process.env.SEC_USER_AGENT || 'Ferret filings tracker contact@ferretcheck.com';
const WINDOW_DAYS = 30;
const MAX_FILINGS_PER_COMPANY = 15;
const MIN_VALUE = 25_000;
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site', 'data');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sec(url) {
  await sleep(120); // stay under SEC's 10 req/s limit
  const res = await fetch(url, { headers: { 'User-Agent': SEC_UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}>\\s*(?:<value>)?\\s*([^<]*?)\\s*(?:</value>|</${name}>)`));
  return m ? m[1].replace(/&amp;/g, '&') : '';
};
const flag = (block, name) => /^(1|true)$/i.test(tag(block, name));

// "HUANG JEN HSUN" -> "Huang Jen Hsun"; filings give names in upper case, surname first
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-'.])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());

// Form 4 lists people surname first ("COHEN RYAN"); entities keep their name as filed.
const ENTITY = /\b(L\.?P\.?|LLC|INC|LTD|TRUST|FUND|PARTNERS|CORP|HOLDINGS|CAPITAL|MANAGEMENT|FINANCIAL|GROUP|SPV|CO)\b/i;
const displayName = (raw) => {
  const name = titleCase(raw.trim());
  if (ENTITY.test(raw)) return name;
  const [last, ...rest] = name.split(/\s+/);
  return rest.length ? `${rest.join(' ')} ${last}` : name;
};

function role(xml) {
  const title = tag(xml, 'officerTitle');
  if (title) return title;
  if (flag(xml, 'isDirector')) return 'Director';
  if (flag(xml, 'isTenPercentOwner')) return '10% owner';
  return 'Insider';
}

// One filing can hold many fills of the same order, so trades are summed per direction.
function parseForm4(xml) {
  const sides = {};
  for (const [block] of xml.matchAll(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g)) {
    const code = tag(block, 'transactionCode');
    // P and S are open-market trades; grants, option exercises, tax withholding and gifts say little
    if (code !== 'P' && code !== 'S') continue;
    const shares = Number(tag(block, 'transactionShares'));
    const price = Number(tag(block, 'transactionPricePerShare'));
    if (!(shares > 0) || !(price > 0)) continue;
    const side = (sides[code] ||= { shares: 0, value: 0, date: '' });
    side.shares += shares;
    side.value += shares * price;
    const date = tag(block, 'transactionDate');
    if (date > side.date) side.date = date;
  }
  // small tickets are mostly employee purchase plans, not conviction
  return Object.entries(sides).filter(([, s]) => s.value >= MIN_VALUE).map(([code, s]) => ({
    type: code === 'P' ? 'buy' : 'sell',
    shares: s.shares,
    value: s.value,
    price: s.value / s.shares,
    date: s.date,
    owner: displayName(tag(xml, 'rptOwnerName')),
    role: role(xml),
    // sales under a pre-arranged 10b5-1 plan were scheduled months earlier
    planned: flag(xml, 'aff10b5One'),
  }));
}

const { tokens } = JSON.parse(await readFile(path.join(dataDir, 'portfolios.json'), 'utf8'));
const tickers = Object.values(await (await sec('https://www.sec.gov/files/company_tickers.json')).json());
const cikByTicker = new Map(tickers.map((t) => [t.ticker, String(t.cik_str).padStart(10, '0')]));

const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString().slice(0, 10);
const trades = [];
let companies = 0;

for (const token of tokens) {
  const cik = cikByTicker.get(token.symbol) || cikByTicker.get(token.symbol.replace('.', '-'));
  if (!cik) continue;
  try {
    const r = (await (await sec(`https://data.sec.gov/submissions/CIK${cik}.json`)).json()).filings.recent;
    let taken = 0;
    for (let i = 0; i < r.form.length && r.filingDate[i] >= cutoff && taken < MAX_FILINGS_PER_COMPANY; i++) {
      if (r.form[i] !== '4') continue;
      taken++;
      const dir = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${r.accessionNumber[i].replace(/-/g, '')}`;
      // primaryDocument points at the styled view (xslF345X06/file.xml); the raw XML sits beside it
      const xml = await (await sec(`${dir}/${r.primaryDocument[i].replace(/^xsl[^/]+\//, '')}`)).text();
      for (const t of parseForm4(xml)) {
        trades.push({
          ...t,
          symbol: token.symbol,
          company: token.name,
          address: token.address,
          filed: r.filingDate[i],
          url: `${dir}/${r.primaryDocument[i]}`,
        });
      }
    }
    if (taken) companies++;
  } catch (err) {
    console.error(`skipped ${token.symbol}: ${err.message}`);
  }
}

trades.sort((a, b) => b.filed.localeCompare(a.filed) || b.value - a.value);
await writeFile(path.join(dataDir, 'insiders.json'), JSON.stringify({ updated: new Date().toISOString(), windowDays: WINDOW_DAYS, trades }));

const buys = trades.filter((t) => t.type === 'buy');
console.log(`${trades.length} insider trades (${buys.length} buys) at ${companies} companies in the last ${WINDOW_DAYS} days`);
