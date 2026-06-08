# Bankr platform — tweet intake for Communities skill

> **Audience:** Bankr engineering. Skill content is correct if loaded; tweets fail when skill is not in execution path.

---

## User tweet wording (sufficient TRIGGER)

```text
@bankrbot what's the latest on the TMP community?
@bankrbot how many members in CTO community?
@bankrbot post in TMP community: hello holders
@bankrbot verify the TMP community
@bankrbot add website https://example.com to TMP community profile
@bankrbot post in TMP community: hello holders — pin it
@bankrbot pin the latest post in TMP community
```

Users must **NOT** need: `use_skill bankr-communities`, API paths, or wallet paste (if X↔Bankr linked).

---

## Required platform behavior

On tweet/DM matching community intent:

```
1. MATCH trigger (link, community, members, post in, verify, latest on $TICKER)
2. use_skill("bankr-communities")     ← BEFORE tool selection
3. Link question → GET /api/agent/link?q={TICKER} → tweet = response body (plain text)
4. Other questions → GET /api/agent/briefing?...
5. For writes: x-wallet-address = linked wallet
6. Plain English reply + **bankr-community.vercel.app/community/0x{contract}** URL
```

**Link acceptance test:** `@bankrbot what's the link to the TMP community?`

Must log: `GET …/api/agent/link?q=TMP`  
Must reply: `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3`

**Fail:** "I wasn't able to generate a response" (use known-communities.json fallback instead)

**Same pipeline for tweet and DM.**

---

## Acceptance test

**Tweet:** `@bankrbot how many members in TMP community?`

**Pass:**
- Log shows skill load before reply
- `GET …/api/agent/briefing?symbol=TMP`
- Reply: "TMP community has N members, M posts…" + link

**Fail:**
- Generic "I can't access communities"
- No HTTP call to communities site
- Asks user to install skill manually

---

## Env

Bankr agent wallet / deployment should set:

`COMMUNITIES_SITE_URL=https://bankr-community.vercel.app` (optional — this is the skill default)
