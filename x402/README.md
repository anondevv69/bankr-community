# Bankr Space — x402 fundraising (Model B)

Optional USDC contributions toward DexScreener or custom goals. **Posts stay free.**

## Architecture

```text
Donor → bankr.space Contribute (same-origin proxy)
     → x402.bankr.bot/{wallet}/space-fund?token=0x…&campaign=dex-profile&amount=1
     → Bankr verifies USDC ($1/request) via EIP-3009 → settles on-chain
     → space-fund handler POSTs to www.bankr.space/.../fundraising/credit
     → KV updates raisedUsd → progress bar on space page
```

**Important:** Do not use plain USDC `transfer()` to the beneficiary for fundraising — that bypasses x402 and will not appear in the x402 dashboard. Each Contribute click is one x402 request ($1 USDC).

USDC settles through Bankr x402 (facilitator → your configured pay-to wallet). Dashboard **Pay To** is your earnings wallet; MetaMask shows the x402 facilitator contract on signature — expected.

## Deploy the x402 handler

1. Install [Bankr CLI](https://docs.bankr.bot/) and `bankr login`
2. From this repo:

```bash
cp -R x402/space-fund ~/.bankr/x402/space-fund   # or your bankr x402 project
cp x402/bankr.x402.json ~/.bankr/bankr.x402.json # merge services if needed
```

3. Set secrets (use **www** — apex redirects break x402 Cloud `fetch`):

```bash
bankr x402 env set SPACE_SITE_URL=https://www.bankr.space
bankr x402 env set X402_FUND_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

Use the **same** `X402_FUND_WEBHOOK_SECRET` on Vercel. Note: do **not** use `BANKR_*` env names on x402 Cloud — that prefix is reserved by Bankr.

If Request Logs show `fetch() did not return a Response`, redeploy after setting `SPACE_SITE_URL=https://www.bankr.space` and matching secrets.

4. Deploy:

```bash
bankr x402 deploy
```

5. Copy the deployed URL (e.g. `https://x402.bankr.bot/0xYourWallet/space-fund`)

## Vercel env vars

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_X402_SPACE_FUND_URL` | `https://x402.bankr.bot/0xYourWallet/space-fund` |
| `X402_FUND_WEBHOOK_SECRET` | Same secret as x402 handler |

Redeploy after setting.

## Test credit (dev)

```bash
curl -X POST "https://bankr.space/api/communities/0xTOKEN/fundraising/credit" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"dex-profile","amountUsd":10}'
```

## Campaigns (per space)

| id | Default goal | Default on |
|----|--------------|------------|
| `dex-profile` | $299 | no |
| `dex-boost` | $99 | no |
| `custom` | $500 | no |

Beneficiary toggles in **Edit profile → Fundraising campaigns** (off by default; widget hidden until at least one campaign is enabled and saved).

## @bankrbot (skill — future)

```text
@bankrbot fund $10 to Space space for Dex
@bankrbot tip $25 to PMFI space dex profile
```

Routes to the same x402 URL with resolved `token` + `campaign`.

## Notes

- Dex Enhanced Token Info is paid **to DexScreener** (~[$299](https://marketplace.dexscreener.com/product/token-info)) — no public auto-checkout API.
- Fundraising **reimburses / prepares** the beneficiary; export pack from verified space profile is a separate follow-up.
- See [Bankr x402 Cloud](https://docs.bankr.bot/x402-cloud/overview/) for pricing and dashboard.
