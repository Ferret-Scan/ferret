# FERRET

Nobody reads SEC filings. The ferret does.

FERRET reads two kinds of public SEC filings and checks every stock in them against the stock tokens that exist on Robinhood Chain:

- **Form 4**: executives buying and selling their own company's stock, filed within two business days.
- **Form 13F**: what the big funds held at the end of the quarter, position by position.

If a stock has a token, the row shows it, with a link to the SEC document and to the token on the explorer. A wallet check compares any address with the fund books and says which fund it trades like.

- Site: https://ferretcheck.com
- X: https://x.com/ferretscan
- $FERRET: [`0xbd863910d4718c3fcc9a534dfd37a36315dd5fa6`](https://robinhoodchain.blockscout.com/token/0xbd863910d4718c3fcc9a534dfd37a36315dd5fa6) on [Pons](https://ponsfamily.com/launchpad/0xbd863910d4718c3fcc9a534dfd37a36315dd5fa6), Robinhood Chain (4663). Holders vote on which fund is tracked next.

The site is free and needs no account, no wallet connection and no token.

## Where the data comes from

| What | Source |
|---|---|
| Fund books | 13F filings on SEC EDGAR |
| Insider trades | Form 4 filings on SEC EDGAR, trades over $25K, last 30 days |
| Token addresses | Robinhood's stock token registry on Robinhood Chain (chain 4663) |
| Wallet balances and prices | Robinhood Chain, read through Multicall3 and Chainlink feeds |

Fund books are as old as the filing: a 13F is due up to 45 days after the quarter ends. Insider trades are days old. Wallet balances are read live.

## Layout

```
site/            the six pages, one stylesheet, one script, config.js, data/*.json
build.mjs        writes the pages from one shared frame
site-worker.js   Cloudflare Worker: serves the site, /rpc and fresh /data
scripts/         fetch-data.mjs (13F + token registry), fetch-insiders.mjs (Form 4)
worker/          holder vote API (signed messages, Cloudflare KV)
brand/           logo, avatar, header, and the script that renders the demo clip
```

## Run it

```
node scripts/fetch-data.mjs       # fund books and the token list  -> site/data/portfolios.json
node scripts/fetch-insiders.mjs   # insider trades                 -> site/data/insiders.json
node build.mjs                    # pages                          -> site/*.html
npx serve site                    # open it locally
```

The SEC asks automated clients to name themselves. Set `SEC_USER_AGENT` to a name and a contact address before running the fetch scripts.

Locally the wallet check needs `rpc` in `site/config.js` set to a Robinhood Chain RPC URL, because `/rpc` only exists on the deployed Worker.

## Deploy

```
npx wrangler secret put RH_RPC_URL   # a keyed Robinhood Chain RPC
npx wrangler deploy
```

`/rpc` forwards only `eth_call` requests addressed to Multicall3, so the RPC key stays on the server and cannot be used for anything else. `/data/*.json` is served from this repository's `main` branch, where a daily GitHub Action commits the rebuilt files, so the site stays current without a redeploy.

## What it is not

FERRET shows what public filings say. It is not investment advice, and copying a fund or an insider can lose money. Stock tokens are issued by Robinhood Assets (Jersey) Limited and are not available to US persons or in several other places. FERRET is not affiliated with Robinhood, Pons, the SEC, or any fund or company shown.

## License

MIT
