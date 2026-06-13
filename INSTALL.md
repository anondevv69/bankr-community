# Install Bankr Communities — Piece by Piece

Send **one piece at a time** to Bankr. Wait for each to finish before sending the next.

**Slug:** `bankr-communities-v2`  
**Version:** `11` (footer must show `v11`)  
**Do NOT update** the broken `bankr-communities` app.

---

## Piece 1 of 12 — Read install manifest

```text
Fetch and read this file using http.fetch (NOT curl):

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/bankr-install.json

Confirm slug is bankr-communities-v2 and list all files to install. Do not write anything yet.
```

---

## Piece 2 of 12 — Create app + manifest.json

```text
Create a NEW Bankr app (do not update bankr-communities):
- slug: bankr-communities-v2
- title: Bankr Communities
- visibility: public

Write ONLY manifest.json using http.fetch from:
https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/manifest.json

Do not modify content. Confirm version is "11" and slug is "bankr-communities-v2".
```

---

## Piece 3 of 12 — index.html

```text
For app bankr-communities-v2, write ONLY index.html using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/index.html

Do not modify, merge, or redesign the UI. Confirm footer contains "rayblanco.eth · v11".
```

---

## Piece 4 of 12 — syncTokens.ts

```text
For app bankr-communities-v2, write ONLY scripts/syncTokens.ts using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/syncTokens.ts

Do not modify content. Confirm file was written.
```

---

## Piece 5 of 12 — searchTokens.ts

```text
For app bankr-communities-v2, write ONLY scripts/searchTokens.ts using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/searchTokens.ts

Do not modify content. Confirm file was written.
```

---

## Piece 6 of 12 — lookupLaunch.ts

```text
For app bankr-communities-v2, write ONLY scripts/lookupLaunch.ts using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/lookupLaunch.ts

Do not modify content. Confirm file was written.
```

---

## Piece 7 of 12 — resolveUserProfiles.ts

```text
For app bankr-communities-v2, write ONLY scripts/resolveUserProfiles.ts using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/resolveUserProfiles.ts

Do not modify content. Confirm file was written.
```

---

## Piece 8 of 12 — verifyHolder.ts

```text
For app bankr-communities-v2, write ONLY scripts/verifyHolder.ts using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/verifyHolder.ts

Do not modify content. Confirm file was written.
```

---

## Piece 9 of 12 — createPost.ts

```text
For app bankr-communities-v2, write ONLY scripts/createPost.ts using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/createPost.ts

Do not modify content. Confirm file was written.
```

---

## Piece 10 of 12 — createCommunity.ts

```text
For app bankr-communities-v2, write ONLY scripts/createCommunity.ts using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/createCommunity.ts

Do not modify content. Confirm file was written.
```

---

## Piece 11 of 12 — verifyCommunity.ts + addReaction.ts

```text
For app bankr-communities-v2, write these 2 scripts using http.fetch (do not modify content):

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/verifyCommunity.ts

https://raw.githubusercontent.com/anondevv69/bankr-space/main/apps/bankr-communities-v2/scripts/addReaction.ts

Confirm both files were written.
```

---

## Piece 12 of 12 — Verify install

```text
For app bankr-communities-v2:

1. List all files that exist in the app
2. Dry-run syncTokens — must return ok:true, NOT "File not found"
3. Dry-run createCommunity — should return tokenAddress required (NOT SyntaxError, NOT File not found)
4. Confirm index.html footer says "rayblanco.eth · v11"
5. Enable syncTokens schedule: 0 * * * *
6. Make the app public
```

---

## After all 12 pieces

1. Open **bankr-communities-v2** in Apps panel
2. Click **Refresh**
3. Run **syncTokens** once
4. Search for a token in Create Community

## Expected results

| Check | Expected |
|-------|----------|
| App slug | `bankr-communities-v2` |
| Footer | `made with love <3 rayblanco.eth · v11` |
| syncTokens | `{ "ok": true, "totalLaunches": ... }` |
| App panel | Loads — no "Failed to load app" |

## If a piece fails with "File not found"

Stop and tell Bankr:

```text
App bankr-communities-v2 storage is broken. The registry exists but runtime files are missing.
Please create a fresh app storage bucket or escalate to platform support.
Do not write to CLI sandbox /apps/ — that does not reach runtime storage.
```
