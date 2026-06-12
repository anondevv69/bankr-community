# Bankr platform — tweet intake for Bankr Space skill

> **Audience:** Bankr engineering. Skill content is correct if loaded; tweets fail when skill is not in execution path.

---

## User tweet wording (sufficient TRIGGER)

```text
@bankrbot what's the latest on the TMP space?
@bankrbot how many members in CTO space?
@bankrbot post in TMP space: hello holders
@bankrbot verify the TMP space
@bankrbot add website https://example.com to TMP space profile
@bankrbot post in TMP space: hello holders — pin it
@bankrbot pin the latest post in TMP space
@bankrbot enable custom fundraiser "testing on x" $10 on SPACE space
@bankrbot add 0.01 ETH to the $SPACE Test bounty
```

Users must **NOT** need: `use_skill bankr-communities`, API paths, or wallet paste (if X↔Bankr linked).

**Fundraiser writes are NOT swaps/deploys/transfers** — route to `bankr-communities` + PATCH fundraising.

**POIDH fund/claim are NOT wallet transfers** — route to `bankr-communities` + **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` → paste bounty **`url`** (poidh.xyz).

---

## Required platform behavior

On tweet/DM matching space intent (user may say community):

```
1. MATCH trigger (link, verify, post in, pin, update profile, add links, members, latest on $TICKER, **enable/start fundraiser**, **custom fundraiser**, contribute, fundraising + space)
2. use_skill("bankr-communities")     ← BEFORE tool selection (before swaps/deploys)
3. Writes → BENEFICIARY-ACTIONS.md → GET /api/holders?wallet= → POST/PATCH/pin-post
4. Link question → GET /api/agent/link?q={TICKER} or instant table
5. Other reads → GET /api/agent/briefing?...
6. Plain English reply + **bankr.space/community/0x{contract}** URL
```

**Write acceptance test:** `@bankrbot verify the TMP space`  
Must log: `POST …/api/communities/0x935e…/verify` with linked wallet header.

**Write acceptance test:** `@bankrbot post in TMP space: update — pin it`  
Must log: `POST …/posts` **with `source`** (see POST-SOURCE.md) then `POST …/pin-post` if verified beneficiary.

**Write acceptance test (X reply — implicit):** User replies to a status with `@bankrbot post this in $BNKR space`  
Must log: `POST …/posts` with `content` = parent status URL, `source.trigger` = `x-reply`. See **X-REPLY-POST-CONTENT.md**.

**Write acceptance test (explicit inline text):** `@bankrbot post xxxxx ewrwe xx test test in $xxx space`  
Must log: `POST …/posts` with `content` = `xxxxx ewrwe xx test test` — **not** parent tweet.

**Write acceptance test:** `@bankrbot enable custom fundraiser "testing on x" $10 on SPACE space`  
Must log: `PATCH …/api/communities/{token}/` with `fundraising.campaigns` including `{ "id": "custom", "label": "testing on x", "goalUsd": 10, "enabled": true }` and linked wallet header.

**Fail:** "I don't currently have a tool available for enabling custom fundraisers" — wrong; skill must load first.

**Write acceptance test:** `@bankrbot add 0.01 ETH to the $SPACE Test bounty`  
Must log: `GET …/api/communities/0xef703…/poidh` then reply with matching bounty **`url`** (https://poidh.xyz/base/bounty/…).  
**Fail:** "what's the recipient address?" or "raw contract call" — wrong; link to POIDH.

**Link acceptance test:** `@bankrbot what's the link to the TMP space?`

Must log: `GET …/api/agent/link?q=TMP`  
Must reply: `https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3`

**Fail:** "I wasn't able to generate a response" (use known-communities.json fallback instead)

**Same pipeline for tweet and DM.**

---

## Acceptance test

**Tweet:** `@bankrbot how many members in TMP space?`

**Pass:**
- Log shows skill load before reply
- `GET …/api/agent/briefing?symbol=TMP`
- Reply: "TMP space has N members, M posts…" + link

**Fail:**
- Generic "I can't access communities"
- **"I don't have the ability to post to X spaces"** — wrong product; means **bankr.space** (see **NOT-TWITTER-X-SPACES.md**)
- No HTTP call to communities site
- Asks user to install skill manually

**Production failure example (must NOT repeat):**

Tweet: `@bankrbot post this in $pmfi space` (reply to a status)

Wrong reply: "I don't have the ability to post to X spaces or communities directly… post manually."

Pass: skill load → `POST …/communities/0xd77ce6d3137342bb5174673bdab5f51db16fcba3/posts` with parent status URL + confirmation + space link.

---

## Env

Bankr agent wallet / deployment should set:

`COMMUNITIES_SITE_URL=https://bankr.space` (optional — this is the skill default)
