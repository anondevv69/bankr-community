# Community agent pool (Lane B)

Holders fund **what the Bankr Space Agent should do** for a space — without waiting on the fee recipient to run QRCoin, 0xWork, etc.

## Two x402 lanes

| Lane | Who enables | x402 pay-to | Agent does |
|------|-------------|-------------|------------|
| **A — Beneficiary** | Fee recipient | Fee recipient wallet | Milestones; optional skills from their Bankr wallet |
| **B — Community pool** | Deployer or fee recipient (agent pool menu) | **Platform agent wallet** | Milestones + QRCoin / 0xWork from agent wallet when matched |

## Member flow

1. Space has **Use Bankr Space Agent** + verified
2. Admin enables goals in Edit profile → **Community agent pool** (QRCoin, 0xWork)
3. Holders see **Fund the community agent** on the space page
4. $1 USDC per x402 click → `PLATFORM_AGENT_WALLET`
5. When `raisedUsd ≥ goalUsd` and **Authorize agent skill execution** is on → worker runs skill
6. **0xWork:** worker parses admin `workBrief` (one task per line) into `0xwork post` calls
7. Worker posts result + `POST /api/agent/pool-executed` to mark done

## APIs

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/communities/{token}/agent-pool` | Public | Open community goals |
| `POST /api/communities/{token}/agent-pool/x402` | Wallet | Pay Lane B |
| `GET /api/agent/platform-spaces` | Bearer `CRON_SECRET` | Worker queue |
| `POST /api/agent/pool-executed` | Bearer `CRON_SECRET` | Mark skill executed |

## Worker priority per space

1. **Lane B ready** (`agentPool.readyForExecution`) — spend from platform agent wallet
2. **Lane B open** — post milestone (max 1/day per skillId)
3. **Lane A open** — beneficiary fundraiser milestones
4. **Lane A funded** — legacy skill path (fee recipient wallet) if still configured

## Skills

- `qrcoin` — [skills.bankr.bot/skills/qrcoin](https://skills.bankr.bot/skills/qrcoin)
- `0xwork` — [skills.bankr.bot/skills/0xwork](https://skills.bankr.bot/skills/0xwork)

See `SKILL-LINKED-FUNDRAISERS.md` for execution details.
