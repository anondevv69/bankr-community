# Bankr Communities — Agent guide

**Site:** {{SITE_URL}}  
**Chain:** Base (8453) — holder checks via on-chain `balanceOf`  
**Bankr token data:** [api.bankr.bot](https://api.bankr.bot)  
**Human UI:** same origin as this file — browse communities, connect wallet, post if holder.

This document is for **any AI agent** (Bankr, Cursor, custom bots) that should read communities, post, verify, or summarize token-gated discussions.

**Bankr users:** also install the skill pack:

```text
install Bankr Communities skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities
```

**Live mirror (always current):** `{{SITE_URL}}/agent.md`

---

## Golden rules

1. **One sentence from the user → run the full flow** in one thread. Do not ask unnecessary clarifying questions.
2. **Call site APIs first** — never fabricate member counts, posts, or verification status.
3. **Briefing endpoint first** for "latest / members / opportunities" → `GET /api/agent/briefing`.
4. **Post / react gate** — `GET /api/holders/{token}?wallet=` → `canPost` is true for holders **or** fee recipient / deployer (owners can post without holding).
5. **Owner-only verify** — fee recipient or deployer from Bankr launch metadata.
6. **Reply with full URLs** — paste `replyText` or `communityLink` from API; never ask for site URL.
7. **Human vs agent — same APIs** — agents use HTTP; humans use the website. Same backend.

---

## Human vs agent

| Step | Human on website | Agent (Bankr, Cursor, bot) |
|------|------------------|----------------------------|
| Browse communities | Home page | `GET /api/communities` |
| What's latest on $TMP? | Click community | `GET /api/agent/briefing?symbol=TMP` |
| Create community | Search token → Create | `POST /api/communities/{token}` + `x-wallet-address` |
| Post | Connect wallet → write post | Same POST if holder |
| Verify | Owner clicks Verify | `POST /api/communities/{token}/verify` |
| React | Click emoji | `POST /api/posts/{id}/react` |

---

## What users can do (intent → first API)

| User says | Meaning | First API |
|-----------|---------|---------|
| What's latest on **$TMP** community? | Summary + recent posts | `GET /api/agent/briefing?symbol=TMP` |
| How many **members** in **CTO**? | Member count | briefing → `stats.memberCount` |
| **List** all communities | All active communities | `GET /api/communities` |
| **Search** Bankr token PEPE | Find launch | `GET /api/tokens/search?q=PEPE` |
| **Start** community for $TMP | Create if not exists | search → `POST /api/communities/{token}` |
| **Verify** $TMP community | Owner marks official | `POST /api/communities/{token}/verify` |
| **Post** in TMP: hello holders | `canPost` check → `POST …/posts` (holder OR owner) |
| **React** 👍 on post | Holder-only reaction | `POST /api/posts/{id}/react` |
| Can I **post** in $TMP? | Holder check | `GET /api/holders/{token}?wallet=` |

---

## Agent briefing (start here)

```http
GET {{SITE_URL}}/api/agent/briefing?symbol=TMP
GET {{SITE_URL}}/api/agent/briefing?token=0x935e13a28849095db45e63040f109c34b757aba3
GET {{SITE_URL}}/api/agent/briefing?q=search
```

**Returns:** `community`, `stats` (postCount, memberCount, verified), `recentPosts`, `opportunities[]`, `links.communityPage`.

**Example curl:**

```bash
curl "{{SITE_URL}}/api/agent/briefing?symbol=TMP"
```

---

## API reference

**Base:** `{{SITE_URL}}`  
**Writes:** header `x-wallet-address: 0x…` (linked Bankr wallet or connected user wallet).

### Communities

```http
GET  /api/communities
GET  /api/communities/{tokenAddress}
POST /api/communities/{tokenAddress}
     Body: { "description": "optional" }
POST /api/communities/{tokenAddress}/verify
POST /api/communities/{tokenAddress}/posts
     Body: { "content": "max 2000 chars" }
```

### Tokens & holders

```http
GET /api/tokens/search?q=PEPE
GET /api/holders/{tokenAddress}?wallet=0x…
```

### Reactions

```http
POST /api/posts/{postId}/react
Body: { "tokenAddress": "0x…", "reaction": "👍" | "❤️" | "🔥" }
```

### Cron (platform)

```http
POST /api/cron/sync-tokens
Header: Authorization: Bearer {CRON_SECRET}
```

Syncs token launches from `https://api.bankr.bot/token-launches` (hourly on Vercel cron).

---

## Write action requirements

| Action | Who |
|--------|-----|
| Create community | Any connected wallet; token must be Bankr-launched |
| Post / react | Must hold token on Base (on-chain balance > 0) |
| Verify | Token owner (fee recipient or deployer) |

If not holder → reply: "You need to hold $SYMBOL to post" + community link.

---

## Tweet / @bankrbot examples (no skill jargon)

```text
@bankrbot what's the latest on the TMP community?
@bankrbot how many members in the CTO community?
@bankrbot post in TMP community: gm holders
@bankrbot verify the TMP community
@bankrbot start a community for 0x935e13a28849095db45e63040f109c34b757aba3
```

Bankr platform must load `bankr-communities` skill **before** tool selection (same pattern as TMP fee-rights skill).

---

## Combined with Token Marketplace (TMP)

| Domain | Where |
|--------|--------|
| List, buy, claim fees, launch, petition | [tokenmarketplace.shop/agent.md](https://www.tokenmarketplace.shop/agent.md) + TMP skills |
| Community posts, verify, members, latest | **This guide** + Bankr Communities skill |

Example:

```text
@bankrbot claim fees for CTO           → TMP skill
@bankrbot what's new in CTO community  → this site /api/agent/briefing
```

---

## Success reply templates

**Briefing:**

> **$TMP** community — ✓ Verified · **12** members · **34** posts. Latest: "@user shared update…" [View]({{SITE_URL}}/community/0x935e…)

**Post:**

> Posted to **$TMP** holder community. [View thread]({{SITE_URL}}/community/0x935e…)

**Verify:**

> Verified the **$TMP** community as official.

---

## Error codes

| HTTP | Meaning |
|------|---------|
| 401 | Missing `x-wallet-address` |
| 403 | Not holder / not owner |
| 404 | Community not found |
| 409 | Community already exists |
| 503 | Database (KV) not configured |

---

## Install stack (Bankr)

```text
install TMP site agent at https://github.com/anondevv69/bankr-tmp-skill/tree/main/tmp-site-agent
install TMP skills at https://github.com/anondevv69/bankr-tmp-skill
install Bankr Communities skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities
```

Set `COMMUNITIES_SITE_URL={{SITE_URL}}` on Bankr.

---

## Source

- GitHub: [github.com/anondevv69/bankr-community](https://github.com/anondevv69/bankr-community)
- Skill pack: `skills/bankr-communities/`
- Web app: `web/`

*When editing, update `web/content/agent.md` then redeploy. Keep in sync with `skills/bankr-communities/agent-guide.md`.*
