# Install Bankr Space (slug: `bankr-communities`)

> **Source release** in GitHub `manifest.json` (e.g. `"17"`) is **not** the Bankr platform app version. Bankr auto-increments its own version (v10, v11, …) on each publish. Use the **footer** in `index.html` (`Bankr Space · v17`) to confirm the UI file loaded.

> **Stuck on "dry run app script"?** Skip dry-run during install. Install files only, open the app, test manually.

**Raw base:** `https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities`

---

## Why dry-run hangs

1. Bankr runs dry-run **before** `apiGet` is fully registered
2. One-shot install tries to write 4 files + dry-run + make public in one step → timeout
3. ~~`bankr.space` 308 redirect~~ — v16 uses **`www.bankr.space`** directly in scripts (no redirect)

**Do NOT include dry-run in the create-app paste.**

---

## Step 1 — Create app + manifest ONLY

```text
Create a NEW public Bankr app slug bankr-communities titled "Bankr Space".

Write ONLY manifest.json from:
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities/manifest.json

Confirm source release "17" in manifest, scripts ONLY ["apiGet","apiWrite"], schedule [].
Do NOT write index.html yet. Do NOT run dry-run yet.
Stop after manifest is written.
```

---

## Step 2 — Scripts ONLY

```text
For app bankr-communities, write ONLY these two files:

scripts/apiGet.ts from:
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities/scripts/apiGet.ts

scripts/apiWrite.ts from:
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities/scripts/apiWrite.ts

Stop. Do not run dry-run yet.
```

---

## Step 3 — index.html ONLY

```text
For app bankr-communities, write ONLY index.html from:
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities/index.html

Footer must contain "Bankr Space · v17".
Make the app public.
Do NOT run dry-run.
```

---

## Step 4 — Manual test (separate message, optional)

```text
For app bankr-communities, run script apiGet with args { "path": "/api/communities" }.
Report ok:true or the error message. Do nothing else.
```

If this hangs too, **skip it** — open the app in Bankr UI. If spaces load, apiGet works.

---

## Success checklist

| Check | Good |
|-------|------|
| Footer | `Bankr Space · v17` |
| Title | Bankr Space + TV logo |
| Create | **Create Space** button |
| Spaces list | Loads (not black screen) |

---

## Outside Bankr (curl)

```bash
curl -sL "https://www.bankr.space/api/communities" | head -c 120
```

Must return `"communities"`.

---

## Broken old slug?

See **`RECREATE-IF-BROKEN.md`** — do not update `bankr-communities` if File not found.
