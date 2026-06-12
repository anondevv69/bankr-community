---
name: bankr-communities
version: 1.19.0
description: >-
  Bankr Space on bankr.space. POIDH: create/list on bankr.space; fund/claim/vote on poidh.xyz (link from GET …/poidh).
  NOT Twitter audio Spaces.
siteUrl: https://bankr.space
communitiesSiteUrl: https://bankr.space
COMMUNITIES_SITE_URL: https://bankr.space
communityUrlTemplate: https://bankr.space/community/{tokenContractAddress}
linkApiTemplate: https://bankr.space/api/agent/link?q={TICKER}
metadata:
  siteEnvVar: COMMUNITIES_SITE_URL
  defaultSiteUrl: https://bankr.space
  forbiddenLinkDomains: bankr.bot,t.co
  primaryLinkEndpoint: https://bankr.space/api/agent/link?q={TICKER}
  tmpCommunityLink: https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
  archiveCommunityLink: https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
---

# Bankr Space — Agent skill

Read **`NOT-TWITTER-X-SPACES.md`** first: **"post in $PMFI space"** = **bankr.space** API — **not** Twitter/X audio Spaces. Never refuse as "can't post to X spaces."

Read **`TERMINOLOGY.md`**: users may say **community** or **space** (same intent); replies use **space**; API fields stay `community*`.

## ⚡ WRITE ACTIONS — verify, post, pin, profile (same as post-in-space)

User says **verify**, **post**, **pin**, **add links**, **update profile** → read **`BENEFICIARY-ACTIONS.md`** → for **post** also read **`X-REPLY-POST-CONTENT.md`** (X reply vs explicit text) and **`POST-SOURCE.md`** → use linked wallet → call API → reply + space URL.

| User says | Agent does |
|-----------|------------|
| **verify** the **TMP** space (or community) | `POST …/verify` (fee beneficiary wallet) |
| **add website** / **update profile** for **TMP** | `PATCH …/communities/{token}` `{ socialLinks, description }` |
| **post** in **TMP**: text **and pin it** | `POST …/posts` **with `source`** → `POST …/pin-post` if verified beneficiary |
| **pin** latest post in **TMP** | `POST …/pin-post` `{ postId, action: "pin" }` |
| **fund** / **contribute** to **TMP** space fundraiser | Read **`FUNDRAISING.md`** → `GET …/fundraising` or briefing → reply progress + space URL |
| **create bounty** / **open bounty** for **$SPACE** | Read **`POIDH-BOUNTY-ACTIONS.md`** → `POST …/poidh/request` |
| **add ETH** / **seed** / **fund** / **claim** / **vote** on bounty | **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` → paste bounty **`url`** (poidh.xyz) |
| **list** bounties on **$SPACE** | **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` |
| any **fundraising** on **$ARCHIVE**? | `GET …/fundraising` or briefing → `fundraising.open[]` |

**Post writes:** always send `source` (`client: agent`, `trigger: x-dm` | `x-mention` | `x-reply` | `terminal`, `viaAgent: true`, `agentId: bankrbot`). See **`POST-SOURCE.md`**.

Check permissions: `GET /api/holders/{token}?wallet={linked}` → `canEditProfile`, `canPinPosts`, `canPost`.

---

## ⚡ LINK QUESTIONS — instant reply (no tools needed)

User asks **"what's the link to the TMP space?"** → read **`INSTANT-LINK-REPLIES.md`** → paste URL from table. **Do not call HTTP first.** **Never** reply empty.

| Token | Tweet reply (one line only) |
|-------|----------------------------|
| **TMP** | `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| **ARCHIVE** | `https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

For **other** tickers → `GET https://bankr.space/api/agent/link?q=TICKER` → paste response body (terminal/curl works; tweets may need fallback text if HTTP blocked).

```bash
curl "https://bankr.space/api/agent/link?q=TMP"
```

**Search live communities:**

```http
GET https://bankr.space/api/agent/search-communities?q=archive
```

**JSON alternative:** `GET /api/agent/resolve-community?q=TMP` → use `communityLink` or `tweetReply`.

---
## LINK RULES (mandatory for every space reply)

```text
https://bankr.space/community/{tokenContractAddress}
```

| Token | Link |
|-------|------|
| $TMP | `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| $ARCHIVE | `https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

**FORBIDDEN:** `bankr.bot`, `t.co`, `/community/TMP`, `/community/ARCHIVE`, or any URL not on `bankr.space/community/0x…`

**Link questions** ("what's the link", "space URL"):
1. `GET https://bankr.space/api/agent/link?q=ARCHIVE`
2. Tweet reply = **response body only** — one line, full https URL

**Never invent links. Never substitute bankr.bot.** Read `references/COMMUNITY-LINK-RULES.md`.

All `{SITE}` references below = `https://bankr.space`.

**Install:**

```text
install Bankr Space skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities
```

**Site API base:** `https://bankr.space` (override via `COMMUNITIES_SITE_URL` env if needed).  
**Public agent guide:** `https://bankr.space/agent.md`  
**Public reads** need no wallet. **Writes** use the user's **linked Bankr wallet** in header `x-wallet-address`.

---

## TRIGGER → action (no skill jargon required)

Users say natural language on **tweet** or **terminal**. Bankr must **`use_skill("bankr-communities")`** **before** generic tools.

| User says | Agent does |
|-----------|------------|
| what's the link to **$TMP** space? | Paste TMP URL from table above — **no HTTP** |
| what's the link to **$ARCHIVE**? | Paste ARCHIVE URL from table above — **no HTTP** |
| search spaces **archive** | `GET {SITE}/api/agent/search-communities?q=archive` |
| what's the latest on **$TMP** space? | `GET {SITE}/api/agent/briefing?symbol=TMP` → paste **`replyText` verbatim** (URL is **last line**) — or `?format=text` |
| how many members in **TMP** space? | briefing → `stats.memberCount` |
| show recent posts in **0x935e…** space | `GET {SITE}/api/communities/0x935e…` |
| **verify** the **TMP** space (or community) | `BENEFICIARY-ACTIONS.md` → `POST …/verify` |
| **add links** / **update profile** for **TMP** | `PATCH …/communities/{token}` (beneficiary) |
| **post** in **TMP** space: hello **and pin it** | post → pin-post if `canPinPosts` |
| **pin** post in **TMP** space | `POST …/pin-post` |
| **post** in **TMP** space: hello holders | holder check → **`X-REPLY-POST-CONTENT.md`** (explicit text) → `POST …/posts` **with `source`** |
| **post this** in **$BNKR** space (X reply to a tweet) | **`X-REPLY-POST-CONTENT.md`** (parent tweet URL) → `POST …/posts` **with `source`** |
| **comment** on **$CTO** space | same as post |
| start a space for **$PEPE** | search token → `POST …/communities/{addr}` |
| list all spaces | `GET {SITE}/api/communities` |
| search Bankr tokens **PEPE** | `GET {SITE}/api/tokens/search?q=PEPE` |
| do I hold **TMP**? can I post? | `GET {SITE}/api/holders/{token}?wallet={linked}` |
| react 👍 on post **post_123** in **0x…** | `POST {SITE}/api/posts/post_123/react` |
| any **fundraising** on **$TMP** space? | `GET {SITE}/api/communities/{token}/fundraising` or briefing → `fundraising.open[]` |
| **fund** **$5** to **TMP** space for **Dex** | **`FUNDRAISING.md`** → fundraising GET → reply progress + space URL (wallet pays on site) |
| **enable** custom fundraiser **"testing on x"** **$10** on **SPACE** space | **`BENEFICIARY-ACTIONS.md`** → `PATCH …/communities/{token}` `{ fundraising }` (beneficiary) |
| **enable** Dex profile fundraiser on **TMP** | same PATCH — `id`: `dex-profile` |
| **QRCoin** fundraiser for **SPACE** | **`SKILL-LINKED-FUNDRAISERS.md`** → custom fundraiser + [qrcoin skill](https://skills.bankr.bot/skills/qrcoin) |
| **0xWork** bagwork / bounties for **TMP** | **`SKILL-LINKED-FUNDRAISERS.md`** → custom fundraiser + [0xwork skill](https://skills.bankr.bot/skills/0xwork) |

**Forbidden:** ask user for skill name · ask wallet if X↔Bankr linked · invent space data without API call · say "can't post to X spaces" or "post manually" (see **NOT-TWITTER-X-SPACES.md**) · say **"I don't have a tool for enabling fundraisers"** without loading this skill and PATCHing (see **BENEFICIARY-ACTIONS.md**) · ask for recipient **0x** to fund a bounty — use **POIDH-BOUNTY-ACTIONS.md** → `GET …/poidh` → paste bounty **`url`** (poidh.xyz).

---

## Mandatory routing guard

```
if message contains "link" OR "url" OR "where is" + space or community/token:
  1. use_skill("bankr-communities")
  2. Read INSTANT-LINK-REPLIES.md
  3. If TMP or ARCHIVE → paste URL from table → STOP (no tools, no HTTP)
  4. Else try GET /api/agent/link?q={TICKER} → paste body
  5. If HTTP fails → known-communities.json → NEVER empty / "couldn't generate"
else if space intent (verify, post, pin, profile, update links, members, latest, fund, fundraiser, fundraising, contribute, enable fundraiser, start fundraiser, custom fundraiser, bounty, bounties, poidh, seed bounty, add eth to bounty):
  1. use_skill("bankr-communities")     ← BEFORE swaps/deploys/transfers
  2. add eth / seed / fund / claim / vote + bounty (not USDC fundraiser) → POIDH-BOUNTY-ACTIONS.md → GET poidh → paste bounty url (poidh.xyz)
  3. create/open bounty → POIDH-BOUNTY-ACTIONS.md → POST poidh/request
  4. enable/start/turn on + fundraiser → BENEFICIARY-ACTIONS.md (Enable fundraiser) → PATCH fundraising
  5. Other writes → BENEFICIARY-ACTIONS.md
  6. Reads / contribute → ONE-LINE-INTENTS.md or FUNDRAISING.md
  5. If posting: Read **X-REPLY-POST-CONTENT.md** (what goes in `content`) + **POST-SOURCE.md** → set source.trigger from DM vs tweet vs reply vs terminal
  6. GET /api/holders/{token}?wallet={linked} before writes
  7. Call API — BEFORE replying (posts must include source object)
  8. Plain English reply + communityLink on own line
```

**Tweet = DM** — same pipeline. Load skill on `@bankrbot` intake **before** tool selection.

---

## Write actions (linked wallet)

| Action | Requires |
|--------|----------|
| Create space | Signed-in user, token on Bankr launches |
| Post / comment | **Holder** OR **fee recipient** OR **deployer** (owner can post without holding) |
| React | Holder OR fee recipient OR deployer |
| Verify | Fee recipient only |
| Edit profile (unverified) | Fee recipient or deployer |
| Edit profile (verified) | Fee recipient; deployer if `allowDeployerEdit`; `trustedDelegates[]` |
| Fundraisers / USDC | Fee recipient only — never deployer or delegate |

`GET /api/holders/{token}?wallet=` returns `canPost: true` for holders **and** owners.

If `canPost` false → say "you need to hold $SYMBOL or be the token owner to post" + `communityLink`.

**Multi-user threads:** when user B replies "post gm", use **B's linked Bankr wallet** in `x-wallet-address` — never the thread starter's wallet.

---

## Twitter/X reply rules (MANDATORY)

X does **not** render markdown links. Every reply **must** include the raw `https://` URL from API `links.communityPage`.

**Required format (paste `replyText` from API — do not paraphrase without URL):**

```text
$TMP space — verified · 1 member · 2 posts
latest: "this is from X" by @you

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Rules:**
- Paste **`replyText`** or **`tweetReply`** from briefing API verbatim — they are identical
- **Never** summarize stats/latest without **`communityLink`** on its own line at the **end**
- Copy `links.communityPage` or `communityLink` if building reply manually — never omit
- Put the full URL on its **own line** (X auto-linkifies it)
- Never end with "view space:" and nothing after it
- Never use only `[View space](url)` markdown — always include the bare URL too
- After posting, include the same space URL again

---

## Success reply templates

**Briefing:**

```text
$TMP space — ✓ Verified · 12 members · 34 posts
latest: "@rayblanco.eth shared launch update…"

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Post:**

```text
posted to $TMP holder space: "this is from X"

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

---

## Hub install stack (with TMP)

```text
install TMP site agent at https://github.com/anondevv69/bankr-tmp-skill/tree/main/tmp-site-agent
install TMP skills at https://github.com/anondevv69/bankr-tmp-skill
install Bankr Space skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities
```

TMP marketplace ops → TMP skills. Space social layer → **this skill**.

---

## Files

| File | Purpose |
|------|---------|
| `TERMINOLOGY.md` | **community vs space** — read first |
| `X-REPLY-POST-CONTENT.md` | **X reply: post THIS = parent tweet; explicit text = user words** |
| `POST-SOURCE.md` | **Mandatory `source` on every agent post** (X DM, mention, terminal) |
| `BENEFICIARY-ACTIONS.md` | **Verify, profile, pin, post+pin, enable fundraisers — tweet + terminal** |
| `FUNDRAISING.md` | **Discover open/completed fundraisers, guide USDC x402 contributions** |
| `AGENT-WALLETS.md` | **Tag agent wallets (bankrbot, hermes) for fee recipient & trusted delegates** |
| `SKILL-LINKED-FUNDRAISERS.md` | **Fundraiser → USDC → Bankr Skills (qrcoin, 0xwork) on [skills.bankr.bot](https://skills.bankr.bot/)** |
| `PLATFORM-AGENT.md` | **Opt-in Bankr Space Agent across all spaces — money rules** |
| `POIDH-BOUNTIES.md` | POIDH overview — ETH bounties vs x402 |
| `POIDH-BOUNTY-ACTIONS.md` | **Execute create/seed/list — GET poidh, POST seed/request (mandatory for add ETH tweets)** |
| `PLATFORM-AGENT-WORKER.md` | **Aeon / Hermes cron worker — platform-spaces loop, headers, internal APIs** |
| `INSTANT-LINK-REPLIES.md` | Link questions — paste URL, no HTTP (read first for links) |
| `GET-LINK.md` | GET /api/agent/link for unknown tickers |
| `LINK-INTENT-ONLY.md` | Pointer to GET-LINK.md |
| `ONE-LINE-INTENTS.md` | Full intent table |
| `community-autopilot.md` | Step-by-step execution |
| `references/COMMUNITY-LINK-RULES.md` | **Mandatory link format — never bankr.bot** |
| `references/AGENT-ROUTING-COMMUNITIES.md` | Routing guard |
| `references/BANKR-PLATFORM-TWEET-INTAKE.md` | Platform requirements |
| `references/community-api-reference.md` | All endpoints |
