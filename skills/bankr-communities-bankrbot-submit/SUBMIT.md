# Submit `bankr-communities` to BankrBot/skills

This folder is a PR-ready copy of the Bankr Space agent skill, structured exactly like [BankrBot/skills](https://github.com/BankrBot/skills) expects.

## Quick steps

1. Fork https://github.com/BankrBot/skills
2. Clone your fork and create a branch:
   ```bash
   git checkout -b add-bankr-communities
   ```
3. Copy the skill folder into the repo root:
   ```bash
   cp -R skills/bankr-communities-bankrbot-submit/bankr-communities/ /path/to/skills/bankr-communities/
   ```
4. Commit and push:
   ```bash
   git add bankr-communities/
   git commit -m "Add bankr-communities skill — token-gated holder spaces"
   git push -u origin add-bankr-communities
   ```
5. Open a PR on GitHub. Suggested description:

   **Summary**
   - Token-gated holder spaces for Bankr-launched tokens
   - Read: briefing, member counts, search, community links
   - Write: verify, post, pin, update profile/social links (beneficiary)
   - Live API: https://bankr.space

   **Install (after merge)**
   ```text
   install the bankr-communities skill from https://github.com/BankrBot/skills/tree/main/bankr-communities
   ```

## Folder layout

```
bankr-communities/
├── SKILL.md                    ← required
├── known-communities.json      ← TMP/ARCHIVE fallback when HTTP blocked
├── references/
│   ├── beneficiary-actions.md
│   ├── instant-link-replies.md
│   ├── get-link.md
│   ├── one-line-intents.md
│   ├── community-autopilot.md
│   ├── community-link-rules.md
│   ├── agent-routing-communities.md
│   ├── bankr-platform-tweet-intake.md
│   ├── community-api-reference.md
│   ├── dm-intents.md
│   └── agent-guide.md
└── scripts/
    └── get-community-link.sh
```

## Provider info (for PR table)

| Field | Value |
|-------|-------|
| Provider | [Bankr Space](https://bankr.space) |
| Skill | `bankr-communities/` |
| Description | Token-gated spaces for Bankr-launched tokens — links, briefing, posts, verify, pin, beneficiary profile updates |
| Source repo | https://github.com/anondevv69/bankr-space |

## Test before submitting

```bash
# Link lookup (plain text)
./bankr-communities/scripts/get-community-link.sh TMP

# Briefing (JSON)
curl "https://bankr.space/api/agent/briefing?symbol=TMP"
```

Expected TMP link:
`https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3`
