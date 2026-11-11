// Writes the six site pages into site/ from one shared frame, so the rail, head tags and footer
// never drift apart. Run: node build.mjs   (set SITE_URL once the domain is known)
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITE = (process.env.SITE_URL || 'https://ferret.example').replace(/\/$/, '');
const V = 4; // bump to refresh cached css, js and the preview image
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');

const NAV = [
  ['index', 'Front page'],
  ['insiders', 'Insider trades'],
  ['funds', 'Fund books'],
  ['wallet', 'Wallet check'],
  ['token', '$FERRET'],
  ['how', 'How it works'],
];
const href = (id) => (id === 'index' ? './' : `${id}.html`);

const pages = {
  index: {
    title: 'FERRET: SEC filings, matched to stock tokens on Robinhood Chain',
    desc: 'FERRET reads fund portfolios and insider trades in SEC filings and shows which of them exist as stock tokens on Robinhood Chain.',
    body: `
    <section class="hero">
      <p class="kicker">SEC filings &rarr; stock tokens on Robinhood Chain</p>
      <h1>Nobody reads the filings. <span class="circled">The ferret does.</span></h1>
      <p class="lede">FERRET goes down into SEC paperwork, the fund portfolios and the insider trades, and comes back with the ones you can hold as a stock token on Robinhood Chain.</p>
      <div class="cta">
        <a class="btn solid" href="insiders.html">What insiders bought</a>
        <a class="btn" href="wallet.html">Check a wallet</a>
      </div>
    </section>

    <section>
      <div class="head"><h2>Dug up lately</h2><p class="muted" id="updated"></p></div>
      <ol class="printout" id="digs"><li><p class="muted">Digging…</p></li></ol>
    </section>

    <section class="stats" id="stats"></section>

    <section>
      <div class="head"><h2>Where to look</h2></div>
      <div class="doors">
        <a href="insiders.html"><i>01</i><h3>Insider trades</h3><p>Executives buying and selling their own stock. Form 4, filed within two business days.</p></a>
        <a href="funds.html"><i>02</i><h3>Fund books</h3><p>Berkshire, Ackman, Tepper, Cathie Wood and others, position by position, with the tokens marked.</p></a>
        <a href="wallet.html"><i>03</i><h3>Wallet check</h3><p>Paste any address and see which fund it trades like. Read-only, nothing to sign.</p></a>
        <a href="token.html"><i>04</i><h3>$FERRET</h3><p>Holders pick the next fund to track. The site itself stays free.</p></a>
      </div>
    </section>`,
  },

  insiders: {
    title: 'Insider trades with a stock token | FERRET',
    desc: 'Executives buying and selling their own stock, from SEC Form 4, limited to companies that have a stock token on Robinhood Chain.',
    body: `
    <section id="insiders-page">
      <p class="kicker">Form 4</p>
      <h1 class="page-title">Insider trades</h1>
      <p class="lede" id="insiders-note">Executives buying and selling their own stock.</p>
      <div class="pills" id="insider-tabs"></div>
      <div class="sheet" id="insider-list"><p class="notice muted">Digging…</p></div>
      <p class="fine">A buy is an open-market purchase with the insider's own money. "Planned" marks sales made under a pre-arranged 10b5-1 plan, which say little about what the insider thinks today.</p>
    </section>`,
  },

  funds: {
    title: 'Fund books, matched to stock tokens | FERRET',
    desc: 'What the big funds held last quarter, from their 13F filings, with every position that exists as a stock token on Robinhood Chain marked.',
    body: `
    <section>
      <p class="kicker">Form 13F</p>
      <h1 class="page-title">Fund books</h1>
      <p class="lede">What each fund held at the end of the quarter, and how much of it exists as stock tokens.</p>
      <div class="books">
        <div class="book-list" id="fund-list"></div>
        <div id="fund"><p class="notice muted">Digging…</p></div>
      </div>
    </section>
    <section>
      <div class="head"><h2>Biggest changes since last quarter</h2><p class="muted">Only stocks that exist as tokens.</p></div>
      <ul class="moves" id="moves-list"></ul>
    </section>`,
  },

  wallet: {
    title: 'Which fund does this wallet trade like? | FERRET',
    desc: 'Paste any Robinhood Chain address and FERRET compares its stock tokens with the books of the big funds. Read-only.',
    body: `
    <section>
      <p class="kicker">Read-only</p>
      <h1 class="page-title">Wallet check</h1>
      <p class="lede">Paste any address. The ferret reads its stock token balances and tells you which fund it trades like. Nothing is signed and nothing is spent.</p>
      <form class="wallet-form" id="wallet-form">
        <input id="address" type="text" placeholder="0x address" spellcheck="false" autocomplete="off" aria-label="Wallet address">
        <button type="submit" class="btn solid">Check</button>
        <button type="button" class="btn" id="connect">Use my wallet</button>
      </form>
      <div id="score-result"></div>
    </section>
    <section>
      <div class="head"><h2>How the score works</h2></div>
      <ol class="steps">
        <li><h3>Balances</h3><p>The page asks Robinhood Chain for the balance of every stock token in the official registry.</p></li>
        <li><h3>Prices</h3><p>Each balance is valued with its Chainlink feed, or with the last filing price where there is no feed.</p></li>
        <li><h3>Overlap</h3><p>The weights are compared with the on-chain part of every fund book. 100% means an exact copy.</p></li>
      </ol>
    </section>`,
  },

  token: {
    title: '$FERRET token | FERRET',
    desc: '$FERRET launches on Pons on Robinhood Chain. Holders vote on which fund the site tracks next.',
    body: `
    <section>
      <p class="kicker" id="token-status"></p>
      <h1 class="page-title">$<span class="ticker">FERRET</span></h1>
      <div class="token-grid">
        <div class="sheet pad">
          <h3>Contract address</h3>
          <div class="ca" id="ca"></div>
          <div class="cta" id="token-links"></div>
        </div>
        <ul class="facts tall" id="tokenomics"></ul>
      </div>
    </section>
    <section>
      <div class="head"><h2>What holding it does</h2></div>
      <div class="uses">
        <article><span class="tag live">At launch</span><h3>Vote</h3><p>Holders choose which fund gets added next. A vote is a free signature, weighted by balance.</p></article>
        <article><span class="tag live">At launch</span><h3>Buyback</h3><p>The creator share of Pons trading fees is set to buy $<span class="ticker">FERRET</span> off the market.</p></article>
        <article><span class="tag">Later</span><h3>Alerts</h3><p>Insider buys and fund changes sent to holders in Telegram as they are filed.</p></article>
        <article><span class="tag">Later</span><h3>Baskets</h3><p>A fund's on-chain book bought in one transaction, with a lower fee for holders.</p></article>
      </div>
      <p class="fine">Bought-back tokens sit in the Pons buyback vault, which releases them over five years. They are not burned. The "later" items are not built and may change. The token gives no claim on any asset or revenue, and the site is free without it.</p>
    </section>
    <section>
      <div class="head"><h2>Which fund next?</h2><p class="muted" id="vote-status"></p></div>
      <ul class="vote" id="vote-list"></ul>
    </section>`,
  },

  how: {
    title: 'How FERRET works',
    desc: 'Where the FERRET data comes from, how fresh it is, what is planned, and answers to common questions.',
    body: `
    <section>
      <p class="kicker">Method</p>
      <h1 class="page-title">How it works</h1>
      <p class="lede">Three public sources, joined by ticker. No account, no wallet connection needed to read anything.</p>
      <ol class="steps">
        <li><h3>Read the filing</h3><p>FERRET pulls 13F reports (what a fund holds) and Form 4 reports (what an insider traded) from SEC EDGAR.</p></li>
        <li><h3>Find the token</h3><p>Each stock is looked up in Robinhood's official stock token registry. If a token exists, the row gets its address.</p></li>
        <li><h3>Show the match</h3><p>You see the filing and the token side by side, with a link to the SEC document and to the token on the explorer.</p></li>
      </ol>
    </section>

    <section>
      <div class="head"><h2>How fresh is it</h2></div>
      <ul class="facts tall">
        <li><span>Fund books</span>Funds file a 13F up to 45 days after the quarter ends. A book shows what the fund held then, not today.</li>
        <li><span>Insider trades</span>Form 4 is due within two business days of the trade. The feed keeps trades over $25K.</li>
        <li><span>Wallet balances</span>Read live from Robinhood Chain when you press Check.</li>
        <li><span>Refresh</span>The filing data is rebuilt once a day.</li>
      </ul>
    </section>

    <section>
      <div class="head"><h2>What comes next</h2></div>
      <ol class="plan">
        <li class="now"><span>Now</span><h3>Reading</h3><p>Fund books, insider trades, the wallet check, the $FERRET launch and the holder vote.</p></li>
        <li><span>Next</span><h3>Acting</h3><p>Baskets that buy a fund's on-chain book in one transaction, and Telegram alerts for holders.</p></li>
        <li><span>Later</span><h3>Explaining</h3><p>An AI reader for 8-K filings, and watchlists for the stocks you follow.</p></li>
      </ol>
    </section>

    <section>
      <div class="head"><h2>Questions</h2></div>
      <div class="faq">
        <details><summary>Do I need $FERRET to use the site?</summary><p>No. Everything on it is free. The token gives a vote on which fund is added next.</p></details>
        <details><summary>Where does the data come from?</summary><p>SEC EDGAR for 13F and Form 4 filings, Robinhood's stock token registry for token addresses, and Robinhood Chain for balances and prices.</p></details>
        <details><summary>Why are some holdings marked "no token"?</summary><p>That stock has no stock token on Robinhood Chain yet. It stays in the table so the book is complete.</p></details>
        <details><summary>Who can buy stock tokens?</summary><p>Stock tokens are issued by Robinhood Assets (Jersey) Limited. They are not available to US persons or in several other places, including the UK and Canada.</p></details>
        <details><summary>Is this investment advice?</summary><p>No. FERRET shows what public filings say. Copying a fund or an insider can lose money, and nothing here tells you to buy or sell.</p></details>
      </div>
    </section>`,
  },
};

const frame = (id, p) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${p.title}</title>
  <meta name="description" content="${p.desc}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="FERRET">
  <meta property="og:title" content="${p.title}">
  <meta property="og:description" content="${p.desc}">
  <meta property="og:url" content="${SITE}/${id === 'index' ? '' : `${id}.html`}">
  <meta property="og:image" content="${SITE}/og-image.png?v=${V}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${p.title}">
  <meta name="twitter:description" content="${p.desc}">
  <meta name="twitter:image" content="${SITE}/og-image.png?v=${V}">
  <link rel="icon" href="logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="styles.css?v=${V}">
</head>
<body>
  <div class="shell">
    <aside class="rail">
      <a class="brand" href="./"><img src="logo.png" alt="" width="44" height="44"><span>FERRET</span></a>
      <nav>
        ${NAV.map(([n, label], i) => `<a href="${href(n)}"${n === id ? ' aria-current="page"' : ''}><i>${String(i + 1).padStart(2, '0')}</i>${label}</a>`).join('\n        ')}
      </nav>
      <div class="rail-foot">
        <div class="rail-ca" id="rail-ca"></div>
        <div class="rail-links" id="rail-links"></div>
      </div>
    </aside>
    <main>${p.body}

      <footer>
        <p>FERRET is not affiliated with Robinhood, Pons, the SEC, or any fund or company shown. Data: SEC EDGAR, the Robinhood stock token registry and Robinhood Chain. Nothing here is investment advice.</p>
      </footer>
    </main>
  </div>
  <script src="config.js?v=${V}"></script>
  <script src="app.js?v=${V}"></script>
</body>
</html>
`;

for (const [id, p] of Object.entries(pages)) await writeFile(path.join(out, `${id}.html`), frame(id, p));
console.log(`wrote ${Object.keys(pages).length} pages for ${SITE}`);
