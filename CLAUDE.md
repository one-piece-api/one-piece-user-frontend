# one-piece-user-frontend

Angular back-office: account/profile, user and role management, editorial workflow for content. Runs behind oauth2-proxy in every environment. Setup: `README.md`. UI rules: `../.claude/rules/ui.md` (load with UI files).

## Commands

```bash
npm test                                   # Vitest
npm run lint && npm run format:check       # CI "Lint & format" runs BOTH: check both
npm run build
./scripts/deploy-local.sh                  # ALWAYS after a change, then check on http://localhost:4180
```

`npm start` (port 4200) is for layout only: no login there.

## Map (`src/app`)

| Folder | Holds |
|---|---|
| `content/entity` | Generic entity pages (ADR-0003): list, detail, editor, card, comparison, `field-kinds.ts`, relation/image pickers, `entity-routes.ts` |
| `content/entity/entities.ts` | `ENTITIES`: the one switch for an entity's routes, menu entry and dashboard rows |
| `content/<entity>/<entity>.model.ts` | One `EntityDefinition` per entity: type, natural key, route, API path, i18n prefix, icon, fields, sections |
| `content/dashboard`, `content/block-words.ts` | Dashboard per status; wording of each backend `BlockReason` |
| `shared/{ui,nav,mascot,i18n,http}` | Components, sidebar registry (`nav-items.ts`), Lumacofono, Transloco setup |
| `identity`, `admin`, `config` | Current user and permissions, user/role admin, runtime config |
| `public/i18n/{it,en}.json` | Translations: every key in both files |

## Key ideas (ADRs in `docs/adr/`)

- 0001 runtime config injected at container start (`docker-entrypoint.d/`); 0002 runtime i18n with Transloco, language from the browser.
- 0003 generic entity pages driven by `EntityDefinition`; 0004 relation fields and sidebar sections; 0005 image fields and multipart save; 0006 subcategory fields.
- Permissions, never role names, decide what is shown.

Adding an entity type: skill `new-content-type`.

## Gotchas

- New field shapes go into `field-kinds.ts` as a field kind, not as entity-specific branches in the generic pages.
- Shell scripts in the image must keep LF endings (`.claude/rules/this-machine.md`).
