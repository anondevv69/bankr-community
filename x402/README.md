# Bankr Space — x402 fundraising (Model B)

Optional USDC contributions toward DexScreener or custom goals. **Posts stay free.**

## Architecture

```text
Donor → x402.bankr.bot/{wallet}/space-fund?token=0x…&campaign=dex-profile&amount=25
     → Bankr verifies USDC payment
     → space-fund handler POSTs to bankr.space/api/communities/{token}/fundraising/credit
     → KV updates raisedUsd → progress bar on space page
```

USDC settles to the **x402 service owner wallet** (configure `payTo` / beneficiary routing in Bankr x402 dashboard). For direct-to-fee-recipient routing, deploy the x402 service from the **beneficiary’s Bankr wallet** instead.

## Deploy the x402 handler

1. Install [Bankr CLI](https://docs.bankr.bot/) and `bankr login`
2. From this repo:

```bash
cp -R x402/space-fund ~/.bankr/x402/space-fund   # or your bankr x402 project
cp x402/bankr.x402.json ~/.bankr/bankr.x402.json # merge services if needed
```

3. Set secrets:

```bash
bankr x402 env set SPACE_SITE_URL=https://www.bankr.space
bankr x402 env set X402_FUND_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

Note: do **not** use `BANKR_*` env names on x402 Cloud — that prefix is reserved by Bankr.

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
| `dex-profile` | $299 | yes |
| `dex-boost` | $99 | no |
| `custom` | $500 | no |

Beneficiary toggles in **Edit profile → Fundraising campaigns**.

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
