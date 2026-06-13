<p align="center">
  <img src="assets/logo.png" alt="Bankr Space logo" width="160" />
</p>

# Bankr Space

A native [Bankr app](https://docs.bankr.bot/apps/overview/) for token-gated discussions around Bankr-deployed tokens.

## How it works

1. **Spaces** — Browse active token spaces on the home page.
2. **Create Space** — Search any Bankr token by name, symbol, or contract address, then start a space.
3. **Owner Verification** — The token owner verifies the space as official (auto-verified if the owner creates it).
4. **View** — Anyone can browse spaces and read posts.
5. **Post & React** — Only token holders can post and react.

## Deploy to Bankr (v13 — recommended for Bankr sign-in)

Native Bankr app UI backed by the Vercel API (no iframe — Bankr sandbox blocks Next.js/wagmi).

→ **[apps/bankr-communities-v2/INSTALL-BANKR.md](./apps/bankr-communities-v2/INSTALL-BANKR.md)** — update `bankr-communities-v2` to v13

Legacy v11 appKV install: [INSTALL.md](./INSTALL.md) (deprecated).

## Deploy as a website (Vercel)

**Recommended** if Bankr app storage is broken. Full Next.js app in `web/`:

→ **[web/DEPLOY.md](./web/DEPLOY.md)** — step-by-step Vercel setup

Quick summary:
1. Import repo on Vercel with **Root Directory: `web`**
2. Add **Vercel KV** storage
3. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `CRON_SECRET`
4. Deploy

## Bankr skill (tweet / terminal)

Install alongside TMP skills so users can `@bankrbot` space actions:

```text
install Bankr Space skill at https://github.com/anondevv69/bankr-space/tree/main/skills/bankr-communities
```

Set `COMMUNITIES_SITE_URL=https://bankr.space` on Bankr. See [skills/bankr-communities/ONE-LINE-INTENTS.md](./skills/bankr-communities/ONE-LINE-INTENTS.md).

Example tweets:

```text
@bankrbot what's the latest on the TMP space?
@bankrbot post in TMP space: gm holders
@bankrbot verify the TMP space
```

**Public agent guide:** `https://bankr.space/agent.md` (linked in site footer).

## File structure

```
apps/bankr-communities-v2/     ← install this (canonical)
├── bankr-install.json         ← install manifest for Bankr agent
├── manifest.json
├── index.html
└── scripts/
    ├── syncTokens.ts
    ├── searchTokens.ts
    ├── lookupLaunch.ts
    ├── resolveUserProfiles.ts
    ├── verifyHolder.ts
    ├── createPost.ts
    ├── createCommunity.ts
    ├── verifyCommunity.ts
    └── addReaction.ts

apps/bankr-communities/        ← legacy slug (deprecated if storage corrupted)

web/                           ← Vercel Next.js site
skills/bankr-communities/      ← Bankr agent skill (tweet/terminal)
```

## Permissions

| Permission | Purpose |
|---|---|
| `read:wallet` | Identify the connected wallet |
| `read:portfolio` | Verify token holdings for gating |
| `read:chain` | On-chain balanceOf fallback for holder checks |
| `read:appdata` / `write:appdata` | Space and post storage |
| `fetch:http` | Pull token launches from Bankr API |

`frontendIdentity` is set to `"viewer"` so holder checks run against each visitor's wallet, not the app owner's.

## Docs

- [Apps Overview](https://docs.bankr.bot/apps/overview/)
- [Permissions](https://docs.bankr.bot/apps/permissions/)
- [SDK Reference](https://docs.bankr.bot/apps/sdk/)
- [List Token Launches API](https://docs.bankr.bot/token-launching/api-reference/list-token-launches/)
