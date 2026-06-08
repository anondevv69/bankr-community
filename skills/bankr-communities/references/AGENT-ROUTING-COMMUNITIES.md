# Agent routing — Bankr Communities

> Load with skill install. Overrides generic "I don't know about communities" replies.

## TRIGGER

**Link (highest priority):** link, URL, "where is the community" → **`INSTANT-LINK-REPLIES.md`** first (TMP/ARCHIVE need no HTTP).

**Writes (same routing as post-in-community):** verify, post, pin, update profile, add links → **`BENEFICIARY-ACTIONS.md`**.

**Other reads:** community, members, posts, latest on $TICKER community, start community.

**Load:** `bankr-communities` → **`INSTANT-LINK-REPLIES.md`** (links) or **`ONE-LINE-INTENTS.md`** (everything else).

---

## ROUTING GUARD

```
if message matches link intent:
  1. use_skill("bankr-communities")
  2. TMP or ARCHIVE mentioned → paste instant URL from INSTANT-LINK-REPLIES.md → STOP
  3. Other ticker → GET /api/agent/link?q=… → paste body
  4. NEVER "I wasn't able to generate a response"

if message matches other community intent:
  1. use_skill("bankr-communities")
  2. GET /api/agent/briefing or specific endpoint
  3. Include communityLink (NEVER bankr.bot)
```

---

## Hard rules

1. **Link for TMP/ARCHIVE** — instant paste, no tool call required.
2. **Never** skip API call for stats/posts/members (non-link intents).
3. **Never** require `use_skill` in user tweet text.
4. **Never** link `bankr.bot` or `t.co` for communities.
5. **Tweet = DM** — same skill load order.

---

## TMP coexistence

| Intent | Route to |
|--------|----------|
| claim fees, list, buy, launch | TMP skills |
| community social | **this skill** |
