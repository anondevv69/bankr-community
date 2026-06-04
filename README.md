# Bankr Communities

A native [Bankr app](https://docs.bankr.bot/apps/overview/) for token-gated community discussions around Bankr-deployed tokens.

## How it works

1. **Token Launches** — A scheduled script syncs all deployments from the [Bankr Token Launch API](https://docs.bankr.bot/token-launching/api-reference/list-token-launches/) hourly.
2. **Create Community** — The fee recipient (or deployer) of a token can create a community for it.
3. **View** — Anyone can browse launches, communities, and read posts (public `appKV` keys).
4. **Post & React** — Only wallets that hold the token can post and react (verified server-side via `bankr.wallet.balances()`).

## Deploy to Bankr

1. Ask Bankr to install this app, or copy the `apps/bankr-communities/` folder into your Bankr file storage at `/apps/bankr-communities/`.
2. Run the **syncTokens** script once from the Scripts drawer to populate token launches.
3. Open the app — fee recipients will see a **Create Community** button on their tokens.
4. Make the app public when ready: `make this app public`

## File structure

```
apps/bankr-communities/
├── manifest.json          # Permissions, schedule, public data keys
├── index.html             # Frontend UI (runs in Bankr iframe)
└── scripts/
    ├── syncTokens.ts      # Fetch token launches from api.bankr.bot
    ├── createCommunity.ts # Fee recipient creates a community
    ├── verifyHolder.ts    # Check if viewer holds the token
    ├── createPost.ts      # Token-gated posting
    └── addReaction.ts     # Token-gated reactions
```

## Permissions

| Permission | Purpose |
|---|---|
| `read:wallet` | Identify the connected wallet |
| `read:portfolio` | Verify token holdings for gating |
| `read:appdata` / `write:appdata` | Community and post storage |
| `fetch:http` | Pull token launches from Bankr API |

`frontendIdentity` is set to `"viewer"` so holder checks run against each visitor's wallet, not the app owner's.

## Push to GitHub

```bash
git init
git add .
git commit -m "Add Bankr Communities native app"
git remote add origin https://github.com/anondevv69/bankr-community.git
git push -u origin main
```

## Docs

- [Apps Overview](https://docs.bankr.bot/apps/overview/)
- [Permissions](https://docs.bankr.bot/apps/permissions/)
- [SDK Reference](https://docs.bankr.bot/apps/sdk/)
- [List Token Launches API](https://docs.bankr.bot/token-launching/api-reference/list-token-launches/)
