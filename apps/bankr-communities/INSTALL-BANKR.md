# Install Bankr Space v15 (slug: `bankr-communities`)

If the one-shot update **gets stuck**, install **one file at a time** (order matters).

**Raw base:** `https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities`

---

## Why updates hang

1. **Dry-run before scripts exist** — `apiGet` must be installed before any dry-run.
2. **Old manifest** still lists 10+ legacy scripts — Bankr tries to reconcile them slowly.
3. **Large `index.html`** — fetching/writing in one mega-step can timeout.

**Fix:** manifest + scripts first, then UI, then verify.

---

## Step 1 — manifest only

```text
For app bankr-communities, replace ONLY manifest.json from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities/manifest.json

Confirm version is "15", title "Bankr Space", scripts are ONLY ["apiGet","apiWrite"], schedule is [].
Remove/delete all other scripts from this app (syncTokens, createPost, createCommunity, etc.).
Do not change index.html yet.
```

---

## Step 2 — apiGet + apiWrite

```text
For app bankr-communities, write these two files only:

scripts/apiGet.ts from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities/scripts/apiGet.ts

scripts/apiWrite.ts from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities/scripts/apiWrite.ts

Then run script apiGet with args { "path": "/api/communities" }.
Expect ok:true and data.communities array.
```

---

## Step 3 — index.html

```text
For app bankr-communities, replace ONLY index.html from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities/index.html

Footer must contain: Bankr Space · v15
```

---

## Step 4 — verify in Bankr UI

Open the app. You should see:

- **Bankr Space** title + TV logo
- **Create Space** button (top right)
- **All / Verified / Unverified** filters
- Footer: `rayblanco.eth · Bankr Space · v15`

NOT: "Bankr Communities", "Create Community", or `v13`.

---

## One-shot (if your Bankr agent handles it)

```text
Update app bankr-communities to v15 in this order:

1. manifest.json
2. scripts/apiGet.ts
3. scripts/apiWrite.ts
4. index.html

URLs under:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities/

Delete legacy scripts. schedule []. Only apiGet + apiWrite.
Footer must say Bankr Space · v15. Then dry-run apiGet path /api/communities.
```

---

## Manual API check (outside Bankr)

```bash
curl -sL "https://bankr.space/api/communities" | head -c 200
```

Should return JSON with `"communities"`.
