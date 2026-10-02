# Specs for Copilot — placement & usage

Everything goes in the **project root** (next to `package.json`), NOT inside a sub-folder:

```
watches_website/
├── .github/
│   ├── copilot-instructions.md      ← from this pack (must be directly in .github/)
│   └── prompts/                     ← created by `uipro init` (skills)
├── .vscode/mcp.json
├── docs/                            ← all files from this pack
│   ├── i18n/en.json, ar.json
│   └── *.md
├── supabase/                        ← migrations + seed + README (setup steps)
├── public/                          ← placeholders/ and brand/ (merge with existing public/)
├── .env.example
├── src/
└── package.json
```

Order: 1) place files  2) read OPEN_DECISIONS.md and answer the BLOCKER rows  3) give Copilot one slice at a time.

Suggested build order:
1. Config + types + money + i18n setup + design tokens
2. `inventory.ts`, `orderStateMachine.ts`, `permissions.ts` + tests
3. Supabase migrations (tables, RLS, RPC) — owner creates project first
4. Auth  5. Catalog + product page  6. Cart  7. Checkout + orders  8. Account  9. Admin  10. Motion polish
