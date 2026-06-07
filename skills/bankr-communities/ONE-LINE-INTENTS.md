# One-line intents — Bankr Communities

> User gives **one sentence** → agent runs **full flow** without interview.

**Site base:** `https://bankr-community.vercel.app` (or `{COMMUNITIES_SITE_URL}` env override)

---

## Read-only (no wallet tx)

| User says | API | Reply |
|-----------|-----|-------|
| what's the link to **$TMP** community? | `GET /api/agent/briefing?symbol=TMP` → reply with `communityLink` only |
| what's the latest on **$TMP** community? | briefing → paste `replyText` verbatim |
| how many **members** in **CTO** community? | `GET /api/agent/briefing?symbol=CTO` → `stats.memberCount` | "N members in $CTO community" |
| show **recent posts** for **0x935e…** | `GET /api/communities/0x935e…` | summarize last 5 posts |
| **list** all communities | `GET /api/communities` | count + top symbols |
| search Bankr token **PEPE** | `GET /api/tokens/search?q=PEPE` | launches found |
| is there a community for **$TMP**? | `GET /api/agent/briefing?symbol=TMP` | yes/no + link |
| what **opportunities** on communities? | briefing → `opportunities[]` | unverified, first post, create community |

---

## Write (linked wallet + API)

| User says | Flow |
|-----------|------|
| **start** / **create** community for **$TMP** | search → `POST /api/communities/{token}` `{ description? }` + header `x-wallet-address: {linked}` |
| **verify** **$TMP** community | briefing → owner check → `POST /api/communities/{token}/verify` |
| **post** in **TMP** community: {text} | `GET /api/holders/{token}?wallet={linked}` → if `canPost` → `POST …/posts` `{ content }` |
| **comment** in **0x935e…** community: {text} | same as post |
| react **👍** on post **{id}** in **TMP** | `POST /api/posts/{id}/react` `{ tokenAddress, reaction: "👍" }` |

---

## Tweet examples (sufficient — no "use skill")

```text
@bankrbot what's the latest on the TMP community?
@bankrbot how many members in the CTO community?
@bankrbot post in TMP community: gm holders
@bankrbot verify the TMP community
@bankrbot start a community for 0x935e13a28849095db45e63040f109c34b757aba3
@bankrbot comment in 0xb6fB5AE1eb79AA628aeEC8E1dFD6e736CC624ba3 community: bullish
```

---

## Forbidden

- Reply without calling site API first
- Ask "which skill?" or "paste use_skill"
- Ask wallet if user is X↔Bankr linked
- Say "open the website" when API write is available
- Fabricate member counts or posts

---

## Combined with TMP

| Domain | Skill |
|--------|-------|
| List / buy / claim fees / launch | `bankr-tmp-skill` |
| Community posts / verify / members | `bankr-communities` (this) |

Example thread:

```text
@bankrbot claim fees for CTO          → TMP skill
@bankrbot what's new in CTO community → Communities skill
```
