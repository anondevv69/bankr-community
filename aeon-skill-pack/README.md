# Bankr Space — Aeon skill pack

Run the [bankr.space](https://bankr.space) platform agent on [Aeon](https://github.com/aaronjmars/aeon) (GitHub Actions cron, self-healing, optional Base MCP).

## Where Aeon lives (not your laptop 24/7)

```text
┌─────────────────────────────────────────────────────────────┐
│  YOUR GITHUB REPO (fork of aaronjmars/aeon)                 │
│  • skills/bankr-space-worker/SKILL.md                       │
│  • aeon.yml (schedules, model, enabled flags)               │
│  • memory/ (run history, anti-spam state)                   │
│  • GitHub Secrets: CRON_SECRET, BANKR_LLM_KEY, …            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS (cloud — runs even when your Mac is off)    │
│  • messages.yml — cron every 5–15 min, picks due skills     │
│  • aeon.yml workflow — spins runner, runs Claude Code skill │
│  • Calls bankr.space APIs from the runner                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    bankr.space (Vercel)
                    posts, queue, fundraisers

┌─────────────────────────────────────────────────────────────┐
│  YOUR LOCAL COMPUTER (optional, for setup only)             │
│  • ./aeon → dashboard http://localhost:5555                 │
│  • Toggle skills, set secrets, "Run now", Push to GitHub    │
│  • Closes when you quit — worker keeps running in Actions   │
└─────────────────────────────────────────────────────────────┘
```

**Summary:** Config lives in **your GitHub fork**. The worker runs in **GitHub Actions** (free on public repos). Your Mac is only the **control panel**, not the server.

## What you get

| Skill | Schedule | Role |
|-------|----------|------|
| **bankr-space-worker** | Every 15 min | Polls opted-in spaces, posts milestones, runs funded skills |
| **bankr-communities** | Reference only | API rules, terminology, fundraising model |

## Prerequisites (bankr.space)

On **Vercel** (bankr.space deployment):

| Env var | Example |
|---------|---------|
| `PLATFORM_AGENT_WALLET` | `0x…` (Aeon/Base account or dedicated agent wallet) |
| `CRON_SECRET` | Long random string — same value in Aeon secrets |

Per space: deployer or fee recipient enables **Use Bankr Space Agent** → fee recipient **verifies**.

**Platform wallet:** dedicated **Base Account** — see [BASE-ACCOUNT-SETUP.md](./BASE-ACCOUNT-SETUP.md) (not @bankrbot).

## 1. Fork Aeon

```bash
gh repo fork aaronjmars/aeon --clone
cd aeon && ./aeon
```

Open http://localhost:5555 — authenticate (Claude OAuth/API key or `BANKR_LLM_KEY`).

## LLM brain & cost (recommended)

Aeon uses **one billing path** for GitHub Actions runs — not Max subscription + Bankr at the same time.

| Use case | Auth | Model |
|----------|------|-------|
| **Production worker** (cron) | `BANKR_LLM_KEY` (`bk_…`) | **Haiku** or **Sonnet** |
| Local dashboard / debugging | Claude Max OAuth *or* Bankr | Your choice |

**Do not use Opus** for `bankr-space-worker` — it only polls HTTP and posts milestones.

**Cheapest route (recommended for this skill):** `gemini-2.5-flash` via Bankr gateway — task-following, not deep reasoning. Aeon passes whatever `model:` you set to `claude -p`; Bankr routes Gemini on the Anthropic-compatible surface.

```yaml
# aeon.yml (after pasting BANKR_LLM_KEY in dashboard — sets gateway: bankr)
gateway:
  provider: bankr

model: claude-sonnet-4-6   # default for other skills

skills:
  bankr-space-worker:
    enabled: true
    schedule: "*/15 * * * *"
    model: gemini-2.5-flash   # ultra-cheap; try gemini-3-flash if Bankr deprecates 2.5
```

**Fallback** if a run fails or tool loops act weird: `claude-haiku-4-5` (still cheap, more tested in Aeon).

**Phase 2 note:** Base MCP on-chain skills may behave better with Haiku/Sonnet than Gemini — switch model only when you enable skill execution.

Fund the gateway at [bankr.bot/llm](https://bankr.bot/llm) (`bankr llm credits add 25`). Enable **auto top-up** if you want hands-off.

**bankr.space fees → LLM credits:** not wired automatically today. Space x402 USDC goes to **fee recipient** wallets per community. To fund the worker brain, either (1) top up `BANKR_LLM_KEY` from platform ops budget, (2) use Bankr **launch fee allocation** on a token you control, or (3) future: platform skim → LLM credits.

Track spend: Aeon `cost-report` skill + `memory/token-usage.csv`.

## 2. Install this pack

From your Aeon repo:

```bash
./install-skill-pack anondevv69/bankr-space --path aeon-skill-pack --yes
./add-skill anondevv69/bankr-space bankr-communities --force
```

Or worker only:

```bash
./add-skill anondevv69/bankr-space bankr-space-worker --force
```

## 3. Secrets (Aeon dashboard or `gh secret set`)

```bash
gh secret set CRON_SECRET          # same as bankr.space Vercel
gh secret set PLATFORM_AGENT_WALLET  # same as bankr.space Vercel
# optional:
gh secret set BANKR_SPACE_URL --body "https://bankr.space"
```

## 4. Enable Base MCP (optional — Phase 2 on-chain skills)

Dashboard → **MCP** tab → install **Base** (`https://mcp.base.org`).

Approve your Base Account once. Align the wallet with `PLATFORM_AGENT_WALLET` on bankr.space.

## 5. Enable worker in `aeon.yml`

```yaml
skills:
  bankr-space-worker:
    enabled: true
    schedule: "*/15 * * * *"
```

Push from dashboard (**Push**) or commit manually.

## 6. Verify

```bash
./onboard --remote
```

Or **Run now** on `bankr-space-worker` in the dashboard.

Check GitHub Actions → latest `aeon` workflow run.

Manual queue check:

```bash
curl -sS "https://bankr.space/api/agent/platform-spaces" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Architecture

```text
Aeon (GitHub Actions, */15 cron)
  ├─ bankr-space-worker     → bankr.space HTTP APIs
  ├─ bankr-communities      → rules / terminology
  └─ base-mcp (built-in)    → QRCoin / 0xWork when funded (fee recipient wallet)
```

**Phase 1 (now):** HTTP posts + milestones — fully unattended.  
**Phase 2:** Base MCP skill execution after x402 goals matched — needs fee recipient wallet auth.

## Notifications (optional)

Add Telegram / Discord in Aeon dashboard if you want alerts when the worker posts or hits errors.

## Docs in this repo

- `bankr-space-worker/SKILL.md` — Aeon skill prompt
- `skills/bankr-communities/PLATFORM-AGENT.md` — opt-in & money rules
- `skills/bankr-communities/PLATFORM-AGENT-WORKER.md` — full API reference
- `skills/bankr-communities/SKILL-LINKED-FUNDRAISERS.md` — QRCoin / 0xWork
