# Bankr Space Platform Agent — one agent, all spaces

A single **Bankr Space Agent** works across every opted-in community. Fee recipients **or deployers** can enable it — USDC never flows to the deployer; x402 always settles to the fee recipient.

**Public info:** `GET https://bankr.space/api/agent/platform`  
**Worker list (cron):** `GET https://bankr.space/api/agent/platform-spaces` (Bearer `CRON_SECRET`)

---

## How to hook up a community (end-to-end)

```text
1. Deployer OR fee recipient enables agent on the space
      Edit profile → Community agent → "Use Bankr Space Agent"
      OR PATCH usePlatformAgent: true
      OR @bankrbot enable Bankr Space Agent on TMP space

2. Fee recipient verifies the space (required for agent to post/pin)

3. Fee recipient enables fundraisers (optional — fee recipient only)
      Custom goal e.g. "0xWork bagwork for $SPACE"

4. Holders fund via x402 ($1/click) → fee recipient USDC wallet

5. Fee recipient enables skill execution (optional — fee recipient only)
      "Run skill-linked fundraisers" → platformAgentSkills: true
      Requires fee recipient Bankr API for on-chain spend

6. Cron worker polls platform-spaces → runs skills when fundedCampaigns matched
      Posts on space + 0xJobs tab when 0xWork tasks exist
```

| Step | Who | API / UI |
|------|-----|----------|
| Enable agent | **Deployer** or **fee recipient** (verified) | `usePlatformAgent: true` |
| Verify space | Fee recipient | `POST …/verify` |
| Enable fundraiser | Fee recipient only | `PATCH` `fundraising` |
| Fund pool | Holders | x402 on space page |
| Enable skills | Fee recipient only | `platformAgentSkills: true` |
| Execute | Platform worker | Cron + Bankr API |

---

## Opt-in permissions

| Setting | Who can enable | Effect |
|---------|----------------|--------|
| **Use Bankr Space Agent** | Deployer **or** verified fee recipient | Agent can post, pin, edit profile (after verify) |
| **Run skill-linked fundraisers** | Verified fee recipient **only** | Agent may run QRCoin / 0xWork after x402 goal matched |

Deployer rationale: funds never go to deployer; agent helps the community with moderation and tasks.

```http
PATCH /api/communities/{token}
x-wallet-address: {deployer or fee recipient}

{ "usePlatformAgent": true }
```

```http
PATCH /api/communities/{token}
x-wallet-address: {fee recipient only}

{
  "usePlatformAgent": true,
  "platformAgentSkills": true
}
```

Tweet: `@bankrbot enable Bankr Space Agent on TMP space`

---

## Money & authorization (non-negotiable)

| Rule | Detail |
|------|--------|
| **x402 USDC** | Always → **fee recipient wallet** — platform agent **never** receives USDC |
| **Enable fundraisers** | **Fee recipient only** — agent never PATCHes fundraising |
| **Request fundraisers** | Fee recipient **or trusted delegate** may ask the agent which skill pool to run |
| **Skill execution** | Only when `platformAgentSkills` **and** campaign **matched** (`raisedUsd ≥ goalUsd` via x402) |
| **Skill spend** | QRCoin / 0xWork txs sign from **fee recipient's Bankr account** — not agent wallet |
| **Agent wallet** | Social moderation + orchestration — does **not** custody community USDC |

```text
Deployer OR fee recipient  →  enables usePlatformAgent
Fee recipient OR delegate  →  "run 0xWork pool for $SPACE"
Fee recipient              →  enables fundraiser + platformAgentSkills
Holders                    →  x402 USDC ($1/click) → fee recipient wallet
When raised ≥ goal (matched):
  Platform agent           →  executes QRCoin / 0xWork (fee recipient Bankr API)
  Platform agent           →  posts tx + update on space (0xJobs tab, feed)
```

---

## Platform worker setup (operations)

**Recommended host:** [Aeon](https://github.com/aaronjmars/aeon) — `install-skill-pack anondevv69/bankr-space --path aeon-skill-pack`. See `aeon-skill-pack/README.md`.

**Env (bankr.space deployment):**

| Variable | Purpose |
|----------|---------|
| `PLATFORM_AGENT_WALLET` | Wallet that posts/pins on opted-in spaces (default: @bankrbot agent) |
| `CRON_SECRET` | Protects `GET /api/agent/platform-spaces` |
| Fee recipient `BANKR_API_KEY` | Scoped spend for QRCoin / 0xWork (per fee recipient, not platform) |

**Cron loop (every 5–15 min):**

```http
GET https://bankr.space/api/agent/platform-spaces
Authorization: Bearer {CRON_SECRET}
```

For each space in `spaces[]`:

1. **Social** — post briefing / milestone updates while `openFundraisers` exist
2. **Skills** — for each `fundedCampaigns[]` where `readyForSkillExecution: true`:
   - Load `SKILL-LINKED-FUNDRAISERS.md` (QRCoin vs 0xWork from campaign label)
   - Sign txs with **fee recipient** Bankr API
   - Post result on space (`source.client: agent`, `viaAgent: true`)
3. Never send USDC to `platformAgentWallet`

**Agent posts as:** `PLATFORM_AGENT_WALLET` with `x-wallet-address` header (must match platform agent wallet + `usePlatformAgent` + `verified`).

---

## vs bring-your-own agent

| | Platform agent | User's agent (bankrbot, custom) |
|--|----------------|----------------------------------|
| Setup | Deployer or fee recipient checkbox | Install skills + API key |
| Scope | All opted-in spaces | Per fee recipient config |
| Wallet | Platform agent wallet posts | User's trusted delegate |
| USDC | Fee recipient always | Fee recipient always |

Fee recipient can use **both**: platform agent + own trusted delegate wallets (max 3).

---

## Agent discovery

| User says | Agent does |
|-----------|------------|
| enable Bankr Space Agent on **TMP** | PATCH `usePlatformAgent: true` (deployer or fee recipient) |
| deployer enable agent on **SPACE** | same — deployer wallet header |
| run QRCoin agent for **SPACE** | fee recipient opt-in + custom fundraiser + platformAgentSkills |
| list platform agent spaces | `GET …/platform-spaces` (cron) |

Load **`bankr-communities`** + **`PLATFORM-AGENT.md`** + **`SKILL-LINKED-FUNDRAISERS.md`** as needed.
