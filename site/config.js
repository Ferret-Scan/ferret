// Everything you change on launch day lives here.
window.FERRET_CONFIG = {
  name: 'FERRET',
  ticker: 'FERRET',
  // Paste the token contract address after launching on Pons. Empty = "launching soon".
  tokenAddress: '0xbd863910d4718c3fcc9a534dfd37a36315dd5fa6',
  // Leave a link empty to hide its button.
  links: {
    x: 'https://x.com/ferretscan',
    telegram: '',
    pons: 'https://ponsfamily.com/launchpad/0xbd863910d4718c3fcc9a534dfd37a36315dd5fa6',
    github: 'https://github.com/Ferret-Scan/ferret',
  },
  // Pons v2 launches mint a fixed 1,000,000,000.
  tokenomics: {
    supply: '1,000,000,000',
    launch: 'Fair launch on Pons',
    liquidity: 'Locked for good at graduation',
    fees: 'Creator share buys back $FERRET',
    team: 'No team mint, no presale',
  },
  explorer: 'https://robinhoodchain.blockscout.com',
  // The site's own /rpc route forwards balance reads to a keyed RPC (see ../site-worker.js).
  // For a plain static host without that route, use 'https://rpc.mainnet.chain.robinhood.com'.
  rpc: '/rpc',
  vote: {
    // URL of the deployed worker (see ../worker). Empty = voting shown as "opens at launch".
    api: '',
    // Bump the round to start a fresh vote; must match ROUND in worker/wrangler.toml.
    round: 1,
    candidates: [
      { id: 'soros', name: 'Soros Fund Management', note: 'The man who broke the Bank of England' },
      { id: 'tiger', name: 'Tiger Global', note: 'Chase Coleman, growth at any scale' },
      { id: 'thirdpoint', name: 'Third Point', note: 'Dan Loeb, activist with a sharp pen' },
      { id: 'baupost', name: 'Baupost Group', note: 'Seth Klarman, deep value' },
      { id: 'rentech', name: 'Renaissance Technologies', note: 'The quant machine' },
      { id: 'sa', name: 'Situational Awareness', note: 'Leopold Aschenbrenner, the AI trade' },
    ],
  },
};
