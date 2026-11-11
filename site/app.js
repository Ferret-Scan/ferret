// FERRET site script, shared by every page. Each page only has some of the elements,
// so every block starts by checking that its element exists.
// Wrapped in an IIFE so nothing collides with globals that wallets inject.
(() => {
  const cfg = window.FERRET_CONFIG;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const usd = (n) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    const digits = n < 1000 ? 2 : 0;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  };
  const pct = (n, digits = 1) => `${n.toFixed(digits)}%`;
  const date = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const shortDate = (iso) => date(iso).replace(/, \d{4}$/, '');
  const quarter = (iso) => `Q${Math.ceil(Number(iso.slice(5, 7)) / 3)} ${iso.slice(0, 4)}`;
  const tokenUrl = (address) => `${cfg.explorer}/token/${address}`;
  const ext = 'target="_blank" rel="noopener"';
  const pageUrl = () => location.origin + location.pathname;
  const shareLink = (text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl())}`;

  let data; // portfolios.json
  const cache = {};
  async function load(name) {
    cache[name] ||= fetch(`data/${name}.json`).then((res) => {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    });
    return cache[name];
  }

  async function copy(text, button) {
    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy failed';
    }
    setTimeout(() => (button.textContent = label), 1500);
  }

  const tokenChip = (token) => token
    ? `<a class="chip" href="${tokenUrl(token.address)}" ${ext} title="${esc(token.address)}">${esc(token.symbol)}</a>`
    : '<span class="chip off">no token</span>';

  function changeLabel(c) {
    if (!c) return '';
    if (c.type === 'new') return '<span class="chg up">NEW</span>';
    if (c.type === 'hold') return '<span class="chg flat">same</span>';
    const sign = c.pct > 0 ? '+' : '';
    return `<span class="chg ${c.type === 'add' ? 'up' : 'down'}">${sign}${pct(c.pct, Math.abs(c.pct) < 10 ? 1 : 0)}</span>`;
  }

  // Weights rescaled across the positions that exist as tokens.
  function allocation(fund) {
    const sum = fund.copyable.reduce((s, t) => s + t.weight, 0);
    return fund.copyable.map((t) => ({ ...t, share: t.weight / sum }));
  }

  // ---- left rail and token links, on every page ----

  function renderRail() {
    const { x, telegram, pons, github } = cfg.links;
    const live = Boolean(cfg.tokenAddress);
    $('rail-ca').innerHTML = live
      ? `<span>$${esc(cfg.ticker)}</span><button id="rail-copy" title="${esc(cfg.tokenAddress)}">${esc(cfg.tokenAddress.slice(0, 8))}…${esc(cfg.tokenAddress.slice(-6))}</button>`
      : `<span>$${esc(cfg.ticker)}</span><em>not launched yet</em>`;
    $('rail-copy')?.addEventListener('click', (e) => copy(cfg.tokenAddress, e.target));
    const links = [live && pons && ['Buy on Pons', pons], x && ['X', x], telegram && ['Telegram', telegram], github && ['GitHub', github]].filter(Boolean);
    $('rail-links').innerHTML = links.map(([label, href]) => `<a href="${esc(href)}" ${ext}>${label}</a>`).join('');
  }

  // ---- home ----

  function fundMoves() {
    const moves = [];
    for (const fund of data.portfolios) {
      for (const h of fund.holdings) {
        if (!h.token || !h.change || h.change.type === 'hold') continue;
        // rank by how much of the book moved: a new 5% position beats a 2% tweak to a 1% one
        const size = h.change.type === 'new' ? h.weight : h.weight * Math.min(Math.abs(h.change.pct) / 100, 1);
        moves.push({ fund, token: h.token, change: h.change, weight: h.weight, size });
      }
      for (const e of fund.exits) {
        if (e.token) moves.push({ fund, token: e.token, change: { type: 'exit' }, weight: 0, size: (e.value / fund.total) * 100 });
      }
    }
    return moves.sort((a, b) => b.size - a.size);
  }
  const VERB = { new: 'opened a new position in', add: 'added to', trim: 'trimmed', exit: 'sold out of' };

  async function renderHome() {
    const insiders = await load('insiders').catch(() => null);
    const trades = insiders?.trades || [];
    const stats = [
      [data.portfolios.length, 'fund books opened'],
      [data.tokenCount, 'stock tokens matched'],
      [usd(data.portfolios.reduce((s, p) => s + p.total, 0)), 'held in those books'],
      [trades.length, `insider trades, last ${insiders?.windowDays ?? 0} days`],
    ];
    $('stats').innerHTML = stats.map(([v, k]) => `<div><strong>${esc(v)}</strong><span>${esc(k)}</span></div>`).join('');
    $('updated').textContent = `Last dig: ${date(data.updated)}`;

    const buys = trades.filter((t) => t.type === 'buy').sort((a, b) => b.filed.localeCompare(a.filed)).slice(0, 5).map((t) => `
      <li>
        <span class="src">FORM 4</span>
        <a class="chip" href="${tokenUrl(t.address)}" ${ext}>${esc(t.symbol)}</a>
        <p><a href="${esc(t.url)}" ${ext}><strong>${esc(t.owner)}</strong></a>, ${esc(t.role)} at ${esc(t.company)}, bought <b>${usd(t.value)}</b> of their own stock</p>
        <time>${shortDate(t.filed)}</time>
      </li>`);
    const moves = fundMoves().slice(0, 5).map((m) => `
      <li>
        <span class="src alt">13F</span>
        ${tokenChip(m.token)}
        <p><a href="funds.html#${esc(m.fund.id)}"><strong>${esc(m.fund.manager)}</strong></a> ${VERB[m.change.type]} ${esc(m.token.name)}${m.change.type === 'exit' ? '' : `, now <b>${pct(m.weight)}</b> of the book`}</p>
        <time>${quarter(m.fund.period)}</time>
      </li>`);
    $('digs').innerHTML = [...buys, ...moves].join('') || '<li><p>Nothing dug up yet.</p></li>';
  }

  // ---- fund books ----

  const ROWS_COLLAPSED = 12;
  let activeId;
  let expanded = false;
  let amount = 1000;

  function renderFundList() {
    $('fund-list').innerHTML = data.portfolios.map((p) => `
      <button data-id="${esc(p.id)}" aria-pressed="${p.id === activeId}">
        <span>${esc(p.manager)}</span><small>${pct(p.coverage, 0)} on-chain</small>
      </button>`).join('');
  }

  function renderAlloc() {
    const fund = data.portfolios.find((p) => p.id === activeId);
    $('alloc').innerHTML = allocation(fund)
      .map((t) => `<li><span><a class="chip" href="${tokenUrl(t.address)}" ${ext}>${esc(t.symbol)}</a> <small>${pct(t.share * 100)}</small></span><b>${usd(amount * t.share)}</b></li>`)
      .join('');
  }

  function renderFund() {
    const fund = data.portfolios.find((p) => p.id === activeId);
    const rows = expanded ? fund.holdings : fund.holdings.slice(0, ROWS_COLLAPSED);
    const alloc = allocation(fund);
    const shareText = `${fund.manager}, ${quarter(fund.period)}: ${pct(fund.coverage, 0)} of the book exists as stock tokens on Robinhood Chain.\n\nBiggest ones: ${alloc.slice(0, 5).map((t) => `$${t.symbol}`).join(' ')}`;

    $('fund').innerHTML = `
      <div class="book-head">
        <div>
          <h2>${esc(fund.manager)}</h2>
          <p class="muted">${esc(fund.tagline)}</p>
        </div>
        <a class="btn small" ${ext} href="${shareLink(shareText)}">Share on X</a>
      </div>
      <ul class="facts">
        <li><span>Firm</span>${esc(fund.firm)}</li>
        <li><span>Period</span>${quarter(fund.period)}</li>
        <li><span>Filed</span>${date(fund.filed)}</li>
        <li><span>Book</span>${fund.positions} positions, ${usd(fund.total)}</li>
        <li><span>Source</span><a href="${esc(fund.source)}" ${ext}>SEC filing</a></li>
      </ul>
      <div class="meter">
        <div><span>Exists as stock tokens</span><b>${pct(fund.coverage)} of the book, ${fund.copyable.length} tokens</b></div>
        <div class="bar"><i style="width:${Math.min(fund.coverage, 100)}%"></i></div>
      </div>
      <div class="book-grid">
        <div class="sheet">
          <div class="scroll">
            <table>
              <thead><tr><th>Holding</th><th>Token</th><th class="num">Weight</th><th class="num">Value</th><th class="num">vs last qtr</th></tr></thead>
              <tbody>
                ${rows.map((h) => `
                  <tr class="${h.token ? '' : 'dim'}">
                    <td>${esc(h.issuer)}</td>
                    <td>${tokenChip(h.token)}</td>
                    <td class="num">${pct(h.weight)}</td>
                    <td class="num">${usd(h.value)}</td>
                    <td class="num">${changeLabel(h.change)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          ${fund.holdings.length > ROWS_COLLAPSED ? `<button class="more" id="show-more">${expanded ? 'Show fewer' : `Show all ${fund.holdings.length} rows`}</button>` : ''}
        </div>
        <div class="sheet calc">
          <h3>Basket calculator</h3>
          <label for="amount">Amount to split</label>
          <div class="money"><span>$</span><input id="amount" type="number" min="0" step="100" inputmode="decimal" value="${amount}"></div>
          <ul class="alloc" id="alloc"></ul>
          <button class="btn small" id="copy-alloc">Copy list</button>
          <p class="fine">Weights are rescaled across the ${alloc.length} positions that exist on-chain, so this is a partial copy. You buy the tokens yourself on any Robinhood Chain DEX.</p>
        </div>
      </div>`;

    renderAlloc();
    $('amount').addEventListener('input', (e) => {
      amount = Math.max(0, Number(e.target.value) || 0);
      renderAlloc();
    });
    $('copy-alloc').addEventListener('click', (e) => {
      const lines = allocation(fund).map((t) => `${t.symbol}\t${usd(amount * t.share)}\t${t.address}`);
      copy(`${fund.manager} basket, ${usd(amount)}\n${lines.join('\n')}`, e.target);
    });
    $('show-more')?.addEventListener('click', () => {
      expanded = !expanded;
      renderFund();
    });
  }

  function renderMoves() {
    $('moves-list').innerHTML = fundMoves().slice(0, 12).map((m) => `
      <li>
        ${tokenChip(m.token)}
        <p><strong>${esc(m.fund.manager)}</strong> ${VERB[m.change.type]} ${esc(m.token.name)}</p>
        <span class="muted">${m.change.type === 'exit' ? `was ${pct(m.size)}` : `now ${pct(m.weight)}`} of the book</span>
        ${m.change.type === 'exit' ? '<span class="chg down">SOLD</span>' : changeLabel(m.change)}
      </li>`).join('');
  }

  function initFunds() {
    const pick = (id) => {
      activeId = data.portfolios.some((p) => p.id === id) ? id : data.portfolios[0].id;
      expanded = false;
      renderFundList();
      renderFund();
    };
    pick(location.hash.slice(1));
    renderMoves();
    $('fund-list').addEventListener('click', (e) => {
      const id = e.target.closest('button')?.dataset.id;
      if (!id || id === activeId) return;
      history.replaceState(null, '', `#${id}`);
      pick(id);
    });
    window.addEventListener('hashchange', () => pick(location.hash.slice(1)));
  }

  // ---- insiders ----

  const INSIDER_ROWS = 20;
  async function initInsiders() {
    let insiders;
    try {
      insiders = await load('insiders');
    } catch {
      $('insider-list').innerHTML = '<p class="notice">The insider feed failed to load. Try again in a moment.</p>';
      return;
    }
    const filters = {
      buys: ['Buys', (t) => t.type === 'buy'],
      sells: ['Unplanned sells', (t) => t.type === 'sell' && !t.planned],
      all: ['Everything', () => true],
    };
    // buys are the rare, interesting signal; fall back if the window has none
    let filter = insiders.trades.some(filters.buys[1]) ? 'buys' : 'all';
    let open = false;

    const render = () => {
      const list = insiders.trades.filter(filters[filter][1]);
      const rows = open ? list : list.slice(0, INSIDER_ROWS);
      $('insiders-note').textContent = `SEC Form 4, last ${insiders.windowDays} days, trades over $25K in companies that have a stock token. Refreshed ${date(insiders.updated)}.`;
      $('insider-tabs').innerHTML = Object.entries(filters)
        .map(([id, [label, test]]) => `<button data-filter="${id}" aria-pressed="${id === filter}">${label} <b>${insiders.trades.filter(test).length}</b></button>`)
        .join('');
      $('insider-list').innerHTML = `
        <div class="scroll">
          <table>
            <thead><tr><th>Token</th><th>Who</th><th>Did</th><th class="num">Value</th><th class="num">Price</th><th class="num">Filed</th></tr></thead>
            <tbody>
              ${rows.map((t) => `
                <tr>
                  <td><a class="chip" href="${tokenUrl(t.address)}" ${ext}>${esc(t.symbol)}</a></td>
                  <td><a href="${esc(t.url)}" ${ext}>${esc(t.owner)}</a><br><span class="muted">${esc(t.role)}, ${esc(t.company)}</span></td>
                  <td><span class="chg ${t.type === 'buy' ? 'up' : 'down'}">${t.type === 'buy' ? 'BOUGHT' : 'SOLD'}</span>${t.planned ? ' <span class="chip off" title="Sold under a pre-arranged 10b5-1 plan">planned</span>' : ''}</td>
                  <td class="num">${usd(t.value)}</td>
                  <td class="num">${usd(t.price)}</td>
                  <td class="num">${shortDate(t.filed)}</td>
                </tr>`).join('') || '<tr><td colspan="6" class="muted">Nothing in this window.</td></tr>'}
            </tbody>
          </table>
        </div>
        ${list.length > INSIDER_ROWS ? `<button class="more" id="insider-more">${open ? 'Show fewer' : `Show all ${list.length} rows`}</button>` : ''}`;
    };
    render();
    $('insiders-page').addEventListener('click', (e) => {
      const next = e.target.closest('[data-filter]')?.dataset.filter;
      if (next) {
        filter = next;
        open = false;
      } else if (e.target.id === 'insider-more') {
        open = !open;
      } else {
        return;
      }
      render();
    });
  }

  // ---- wallet check: read-only balances through Multicall3 ----
  // A JSON-RPC batch would be simpler, but the public RPC answers batches with a duplicated
  // CORS header, which browsers reject.

  const BALANCE_OF = '0x70a08231';
  const LATEST_ROUND_DATA = '0xfeaf968c';
  const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
  const CALLS_PER_REQUEST = 100;
  const isAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const word = (n) => BigInt(n).toString(16).padStart(64, '0');
  let connected = null;

  // aggregate3((address target, bool allowFailure, bytes callData)[])
  function encodeAggregate3(calls) {
    const tuples = calls.map((c) => {
      const bytes = c.data.slice(2);
      const padded = bytes.padEnd(Math.ceil(bytes.length / 64) * 64, '0');
      return c.to.slice(2).toLowerCase().padStart(64, '0') + word(1) + word(0x60) + word(bytes.length / 2) + padded;
    });
    let offset = calls.length * 32;
    const heads = tuples.map((t) => {
      const head = word(offset);
      offset += t.length / 2;
      return head;
    });
    return '0x82ad56cb' + word(0x20) + word(calls.length) + heads.join('') + tuples.join('');
  }

  // returns (bool success, bytes returnData)[] as hex strings, null where a call failed
  function decodeAggregate3(hex) {
    const d = hex.slice(2);
    const at = (byte) => parseInt(d.slice(byte * 2, byte * 2 + 64), 16);
    const base = 64; // offsets are relative to the first word after the array length
    return Array.from({ length: at(32) }, (_, i) => {
      const tuple = base + at(base + i * 32);
      const bytes = tuple + at(tuple + 32);
      return at(tuple) === 1 ? '0x' + d.slice((bytes + 32) * 2, (bytes + 32 + at(bytes)) * 2) : null;
    });
  }

  async function ethCalls(calls) {
    const results = [];
    for (let i = 0; i < calls.length; i += CALLS_PER_REQUEST) {
      const params = [{ to: MULTICALL3, data: encodeAggregate3(calls.slice(i, i + CALLS_PER_REQUEST)) }, 'latest'];
      const res = await fetch(cfg.rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params }),
      });
      if (!res.ok) throw new Error(`RPC ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      results.push(...decodeAggregate3(json.result));
    }
    return results;
  }

  async function loadHoldings(address) {
    const arg = address.slice(2).toLowerCase().padStart(64, '0');
    const balances = await ethCalls(data.tokens.map((t) => ({ to: t.address, data: BALANCE_OF + arg })));
    const held = data.tokens
      .map((t, i) => ({ ...t, units: balances[i] && balances[i] !== '0x' ? Number(BigInt(balances[i])) / 1e18 : 0 }))
      .filter((t) => t.units > 0);

    const withFeed = held.filter((t) => t.feed);
    const rounds = await ethCalls(withFeed.map((t) => ({ to: t.feed, data: LATEST_ROUND_DATA })));
    withFeed.forEach((t, i) => {
      // latestRoundData() returns (roundId, answer, ...); the answer is the second 32-byte word, 8 decimals
      const answer = rounds[i] && rounds[i].length >= 130 ? Number(BigInt('0x' + rounds[i].slice(66, 130))) / 1e8 : 0;
      if (answer > 0) t.live = answer;
    });

    for (const t of held) {
      // The live feed is already per token; filing prices are per share, so apply the multiplier.
      if (t.live) t.value = t.units * t.live;
      else if (t.price) t.value = t.units * t.multiplier * t.price;
      else t.value = null;
    }
    return held.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  }

  // Overlap between two weightings: 100% means the wallet matches the on-chain part of the fund exactly.
  function overlap(holdings, fund) {
    const priced = holdings.filter((t) => t.value);
    const total = priced.reduce((s, t) => s + t.value, 0);
    if (!total) return 0;
    const target = new Map(allocation(fund).map((t) => [t.address.toLowerCase(), t.share]));
    return priced.reduce((s, t) => s + Math.min(t.value / total, target.get(t.address.toLowerCase()) || 0), 0) * 100;
  }

  function renderScore(address, holdings) {
    const box = $('score-result');
    if (!holdings.length) {
      box.innerHTML = `<p class="notice"><strong>${short(address)} holds no stock tokens.</strong> Open a <a href="funds.html">fund book</a> and the calculator gives you a shopping list.</p>`;
      return;
    }
    const priced = holdings.filter((t) => t.value);
    const total = priced.reduce((s, t) => s + t.value, 0);
    const scores = data.portfolios.map((fund) => ({ fund, score: overlap(holdings, fund) })).sort((a, b) => b.score - a.score);
    const best = scores[0];
    const unpriced = holdings.length - priced.length;
    const stale = priced.some((t) => !t.live);
    const shareText = best.score >= 1
      ? `The ferret went through my Robinhood Chain wallet. It smells ${pct(best.score, 0)} like ${best.fund.manager}.`
      : 'The ferret went through my Robinhood Chain wallet. It smells like no fund on Wall Street.';

    box.innerHTML = `
      <div class="verdict">
        <div>
          <p class="muted">${short(address)}, ${holdings.length} stock token${holdings.length > 1 ? 's' : ''}${total ? `, about ${usd(total)}` : ''}</p>
          <p class="big">${best.score >= 1 ? `This wallet is <span class="circled">${pct(best.score, 0)}</span> ${esc(best.fund.manager)}` : 'This wallet copies <span class="circled">nobody</span>'}</p>
        </div>
        <a class="btn small" ${ext} href="${shareLink(shareText)}">Share on X</a>
      </div>
      <ul class="bars">
        ${scores.map((s) => `<li><span>${esc(s.fund.manager)}</span><div class="bar"><i style="width:${Math.min(s.score, 100)}%"></i></div><b>${pct(s.score, 0)}</b></li>`).join('')}
      </ul>
      <div class="held">
        ${holdings.slice(0, 12).map((t) => `<a class="chip" href="${tokenUrl(t.address)}" ${ext}>${esc(t.symbol)}${t.value && total ? ` ${pct((t.value / total) * 100, 0)}` : ''}</a>`).join('')}
        ${holdings.length > 12 ? `<span class="muted">+${holdings.length - 12} more</span>` : ''}
      </div>
      <p class="fine">Score is the overlap between this wallet's stock token weights and the part of each fund book that exists on-chain.${stale ? ' Tokens without a live Chainlink feed are valued at the quarter-end price from the last filing.' : ''}${unpriced ? ` ${unpriced} token${unpriced > 1 ? 's have' : ' has'} no price and ${unpriced > 1 ? 'are' : 'is'} left out.` : ''}</p>`;
  }

  async function check(address) {
    const box = $('score-result');
    if (!isAddress(address)) {
      box.innerHTML = '<p class="notice">That is not a valid address. It should be 0x followed by 40 hex characters.</p>';
      return;
    }
    box.innerHTML = '<p class="notice muted">Reading balances…</p>';
    try {
      renderScore(address, await loadHoldings(address));
    } catch (err) {
      box.innerHTML = `<p class="notice">Could not read balances from Robinhood Chain (${esc(err.message)}). Try again in a moment.</p>`;
    }
  }

  async function connect(messageBox) {
    if (!window.ethereum) {
      if (messageBox) messageBox.innerHTML = '<p class="notice">No wallet found in this browser. Paste an address instead, or open this page in your wallet\'s browser.</p>';
      return null;
    }
    try {
      const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      connected = account;
      return account;
    } catch {
      return null; // the wallet prompt was closed
    }
  }

  function initWallet() {
    $('connect').addEventListener('click', async () => {
      const account = await connect($('score-result'));
      if (!account) return;
      $('connect').textContent = short(account);
      $('address').value = account;
      check(account);
    });
    $('wallet-form').addEventListener('submit', (e) => {
      e.preventDefault();
      check($('address').value.trim());
    });
  }

  // ---- token page and holder vote ----

  function renderToken() {
    const { x, telegram, pons } = cfg.links;
    const live = Boolean(cfg.tokenAddress);
    const t = cfg.tokenomics || {};
    $('tokenomics').innerHTML = [['Supply', t.supply], ['Launch', t.launch], ['Liquidity', t.liquidity], ['Fees', t.fees], ['Team', t.team]]
      .filter(([, v]) => v).map(([k, v]) => `<li><span>${k}</span>${esc(v)}</li>`).join('');
    $('token-status').textContent = live ? 'Live on Robinhood Chain' : 'Not launched yet';
    $('ca').innerHTML = live
      ? `<code>${esc(cfg.tokenAddress)}</code><button class="btn small" id="copy-ca">Copy</button>`
      : 'The contract address will be printed here on launch day. Until then, any token using this name is somebody else\'s.';
    $('copy-ca')?.addEventListener('click', (e) => copy(cfg.tokenAddress, e.target));
    const links = [
      live && pons && ['Buy on Pons', pons, 'solid'],
      live && ['Explorer', tokenUrl(cfg.tokenAddress), ''],
      x && ['X', x, ''],
      telegram && ['Telegram', telegram, ''],
    ].filter(Boolean);
    $('token-links').innerHTML = links.map(([label, href, cls]) => `<a class="btn ${cls}" href="${esc(href)}" ${ext}>${label}</a>`).join('');
  }

  const vote = cfg.vote;
  function renderVote(results, note) {
    const totals = results?.totals || {};
    const sum = Object.values(totals).reduce((s, n) => s + n, 0);
    const open = Boolean(vote.api);
    $('vote-status').textContent = note || (open
      ? `Round ${vote.round}, ${results?.voters ?? 0} voter${results?.voters === 1 ? '' : 's'}, ${results?.weighted ? `weighted by $${cfg.ticker} balance` : 'one wallet one vote until the token is live'}`
      : `Opens when $${cfg.ticker} launches. A vote counts by how much the wallet holds.`);
    $('vote-list').innerHTML = vote.candidates.map((c) => {
      const share = sum ? ((totals[c.id] || 0) / sum) * 100 : 0;
      return `
        <li>
          <div><strong>${esc(c.name)}</strong><span class="muted">${esc(c.note)}</span></div>
          <div class="bar"><i style="width:${share}%"></i></div>
          <b>${open ? pct(share, 0) : ''}</b>
          <button class="btn small" data-vote="${esc(c.id)}" ${open ? '' : 'disabled'}>Vote</button>
        </li>`;
    }).join('');
  }

  async function loadResults(note) {
    if (!vote.api) return renderVote(null);
    try {
      const res = await fetch(`${vote.api}/results?round=${vote.round}`);
      if (!res.ok) throw new Error(res.status);
      renderVote(await res.json(), note);
    } catch {
      renderVote(null, 'Results are unavailable right now.');
    }
  }

  async function castVote(choice) {
    const account = connected || (await connect());
    if (!account) return renderVote(null, 'Connect a wallet to vote. Voting needs a signature, which is free and sends no transaction.');
    const message = `${cfg.name} vote\nRound: ${vote.round}\nChoice: ${choice}\nTime: ${new Date().toISOString()}`;
    const hex = '0x' + [...new TextEncoder().encode(message)].map((b) => b.toString(16).padStart(2, '0')).join('');
    try {
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [hex, account] });
      const res = await fetch(`${vote.api}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: account, message, signature }),
      });
      const body = await res.json().catch(() => ({}));
      await loadResults(res.ok ? 'Vote counted. You can change it any time this round.' : `Vote rejected: ${body.error || res.status}`);
    } catch {
      await loadResults('Vote cancelled.');
    }
  }

  function initToken() {
    renderToken();
    $('vote-list').addEventListener('click', (e) => {
      const choice = e.target.closest('[data-vote]')?.dataset.vote;
      if (choice) castVote(choice);
    });
    loadResults();
  }

  // ---- start ----

  async function init() {
    renderRail();
    document.querySelectorAll('.ticker').forEach((el) => (el.textContent = cfg.ticker));
    if ($('token-status')) initToken();

    const needsData = ['digs', 'fund', 'wallet-form'].some($);
    if (needsData) {
      try {
        data = await load('portfolios');
      } catch {
        const box = $('digs') || $('fund') || $('score-result');
        box.innerHTML = '<p class="notice">The filing data failed to load. Try again in a moment.</p>';
        return;
      }
    }
    if ($('digs')) renderHome();
    if ($('fund')) initFunds();
    if ($('wallet-form')) initWallet();
    if ($('insider-list')) initInsiders();
  }

  init();
})();
