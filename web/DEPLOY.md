# Deploy Bankr Space to Vercel

This is the standalone web version — no Bankr app sandbox required.

## Prerequisites

1. [GitHub repo](https://github.com/anondevv69/bankr-space) pushed (includes `web/` folder)
2. [Vercel account](https://vercel.com)
3. [WalletConnect Project ID](https://cloud.walletconnect.com) (free)
4. Vercel KV store (free tier via Upstash)

---

## Step 1 — Connect GitHub to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import **bankr-community** repo
3. Set **Root Directory** to `web`
4. Framework: **Next.js** (auto-detected)
5. Do **not** deploy yet — add env vars first

---

## Step 2 — Add Vercel KV (database)

1. In Vercel project → **Storage** → **Create Database** → **KV**
2. Name it (e.g. `bankr-communities-kv`)
3. Connect it to your project
4. Vercel auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`

This replaces Bankr's `appKV` storage.

---

## Step 3 — Environment variables

In Vercel → **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://bankr.space` (custom domain; or your `*.vercel.app` URL during setup) |
| `CRON_SECRET` | Random string (e.g. `openssl rand -hex 32`) |
| `PINATA_JWT` | [Pinata](https://pinata.cloud) JWT — banner/icon uploads **and** mirroring Bankr/Dex default images to IPFS (optional; URL paste still works without it) |
| `NEXT_PUBLIC_X402_FUND_URL` | Shared Bankr x402 fund endpoint, e.g. `https://x402.bankr.bot/0x…/fund` — see [x402/README.md](../x402/README.md) |
| `X402_FUND_WEBHOOK_SECRET` | Shared secret for legacy/manual credit route `/api/communities/{token}/fundraising/credit` |
| `PLATFORM_AGENT_WALLET` | Base Account for Lane B community agent pool (same as Aeon) |
| `PLATFORM_AGENT_BANKR_API_KEY` | `bk_…` Bankr Agent API key on that wallet — **executes funded 0xWork/QRCoin goals** via Vercel cron (`/api/cron/agent-pool-worker` every 10 min). Same value as Aeon `BANKR_API_KEY`. |
| `POIDH_ISSUER_WALLET` | EOA address for POIDH issuer txs (must match private key) |
| `POIDH_ISSUER_PRIVATE_KEY` | EOA private key — `createOpenBounty`, `acceptClaim`, and `submitClaimForVote`. Fund with ETH on Base (~0.001 ETH/bounty + gas). |
| `BASE_RPC_URL` | **Required for production POIDH** — Alchemy/Infura Base URL. Without it, Vercel hits `mainnet.base.org` rate limits on `eth_call`. |
| `NEXT_PUBLIC_PLATFORM_AGENT_UI` | `true` — show community agent UI on spaces |

`KV_*` vars are set automatically when you connect KV.

**Wallet connect:** uses **browser extension wallets only** (MetaMask, Rabby, etc.) — no WalletConnect Cloud account needed.

---

## Step 4 — Deploy

Click **Deploy**. Vercel builds `web/` and gives you a URL like `https://bankr-community-xyz.vercel.app`.

---

## Step 4b — Custom domain (bankr.space)

1. Vercel → **Settings** → **Domains** → add `bankr.space` (and `www` if desired)
2. Point DNS at Vercel per their instructions
3. Set `NEXT_PUBLIC_SITE_URL=https://bankr.space` and redeploy
4. On Bankr, set `COMMUNITIES_SITE_URL=https://bankr.space`
5. Reinstall the Bankr app v13 so `index.html` / `apiGet.ts` use `https://bankr.space`

---

## Step 5 — Seed token launches

After first deploy, run sync once:

```bash
curl -X POST "https://YOUR-APP.vercel.app/api/cron/sync-tokens" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or wait for the hourly cron (configured in `vercel.json`).

---

## Step 6 — Verify

1. Open your Vercel URL
2. Click **Connect Wallet** (Base network)
3. Spaces list loads (empty until someone creates one)
4. Search a Bankr token under **Create Space**
5. Create a space → open it → post if you hold the token

Footer should say: `made with love <3 rayblanco.eth · web v1`

**Agent guide:** `https://YOUR-APP.vercel.app/agent.md` (public markdown for bots)

---

## Local development

```bash
cd web
cp .env.example .env.local
# Fill in KV_REST_API_URL, KV_REST_API_TOKEN, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

For local KV, create a free [Upstash Redis](https://upstash.com) database and paste REST credentials into `.env.local`.

---

## Custom domain

Vercel → **Settings** → **Domains** → add your domain.

---

## What runs where

| Feature | Implementation |
|---------|----------------|
| UI | Next.js on Vercel |
| Data | Vercel KV |
| Token search | `api.bankr.bot` |
| Holder checks | On-chain `balanceOf` on Base (viem) |
| Hourly sync | Vercel Cron → `/api/cron/sync-tokens` |
| Wallet | RainbowKit + WalletConnect |

---

## Troubleshooting

**"Database not configured"** — Connect Vercel KV and redeploy.

**Wallet won't connect** — Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

**Cron not running** — Vercel Cron requires Pro plan on some accounts; use manual curl sync instead.

**Posts fail "must hold token"** — Holder check reads on-chain balance on Base; ensure wallet holds the token on Base.
