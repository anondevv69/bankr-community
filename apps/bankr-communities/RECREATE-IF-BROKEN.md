# Bankr app broken? — "File not found" on read/update

If `list_apps` shows **`bankr-communities`** but every **read / update / set schedule** returns **"File not found"**, the app record on Bankr is **corrupted or orphaned**. GitHub is fine — this is platform-side.

**Do not keep retrying the same slug.** Create a **fresh app** on slug **`bankr-communities-v2`** (recommended), or delete and recreate `bankr-communities` in the Bankr dashboard.

---

## Symptoms (what you saw)

- `list_apps` → `bankr-communities` exists, public, old version, 9 scripts
- `read manifest.json` → **File not found**
- `update manifest.json` → **File not found**
- `set schedule []` → **File not found**

The listing is stale; the storage backing that app id is missing or mismatched.

---

## Option A — New app `bankr-communities-v2` (recommended)

Use this slug going forward. Paste in **Bankr terminal**:

```text
Create a NEW public Bankr app slug bankr-communities-v2 titled "Bankr Space".

Write these files in order from GitHub raw (do not modify):

1. manifest.json
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/manifest.json

2. scripts/apiGet.ts
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/apiGet.ts

3. scripts/apiWrite.ts
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/apiWrite.ts

4. index.html
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/index.html

Confirm:
- manifest version "15"
- scripts ONLY ["apiGet","apiWrite"]
- schedule []
- footer contains "Bankr Space · v15"
- UI shows Create Space button, not "Create Community"

Run script apiGet with args { "path": "/api/communities" } — expect ok:true.

Make the app public. Hide or uninstall the broken bankr-communities app if the dashboard allows.
```

---

## Option B — Recreate same slug `bankr-communities`

Only if you **must** keep the old slug:

1. Open **Bankr dashboard → Apps**
2. **Delete** (or archive) the broken `bankr-communities` app
3. **Create new app** with slug exactly `bankr-communities`
4. Paste install using paths under `apps/bankr-communities/` (same 4 files as Option A but `-v2` → `-communities` in URLs)

```text
Create NEW app slug bankr-communities titled "Bankr Space" (replace deleted broken app).

Files from:
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities/

Order: manifest.json → scripts/apiGet.ts → scripts/apiWrite.ts → index.html
Version 15, scripts only apiGet+apiWrite, schedule [].
```

---

## Verify GitHub (outside Bankr)

These should return HTTP 200:

```bash
curl -sL -o /dev/null -w "%{http_code}\n" \
  "https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/manifest.json"
```

Expected: `200`

```bash
curl -sL "https://bankr.space/api/communities" | head -c 120
```

Expected: JSON with `"communities"`

---

## Success checklist (open app in Bankr)

| Check | Good | Broken (old) |
|-------|------|----------------|
| Title | Bankr Space | Bankr Communities |
| Footer | `Bankr Space · v15` | `v13` or `Vercel API` |
| Create | **Create Space** button | Inline "Create Community" form |
| Filters | All / Verified / Unverified | Search only |
| Logo | TV icon top-left | Text only |

---

## Why the old app had 9 scripts

Legacy v11 app used `syncTokens`, `createPost`, `createCommunity`, etc. with **appKV** storage. v15 uses **only** `apiGet` + `apiWrite` proxying **bankr.space** — no cron, no local KV.

Trying to "update in place" on a corrupted record fails before any file write. **Fresh create** avoids that.

---

## Support

If **both** create-new on `bankr-communities-v2` **and** dashboard delete+recreate fail with File not found, contact Bankr support with:

- Slug: `bankr-communities`
- Error: File not found on read/update
- `list_apps` still shows the app with 9 scripts

Repo install reference: `apps/bankr-communities-v2/bankr-install.json`
