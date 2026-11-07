# Action plan for v0.9: matcher accuracy

* **Author:** 5842055734thperson
* **Date:** 2026-11-05
* **Input:** an external audit of v0.8.3 that tested all 143 skills on the author's machine (286 positive prompts in English and Turkish, 50 negative prompts, 20 `/search` queries). The audit itself is not in this repository.

This plan lists what the audit found, what was checked again before planning, and the fixes in priority order. Nothing in it is built yet.

## What was re-checked

The audit's headline figures (62% rank-1, 28% false hints, 12 unreachable skills) come from its own harness and were not re-run. Its examples were re-run against the current matcher on the author's install. Every example below reproduced:

| Draft | Expected | Got |
|---|---|---|
| plot twist: the test passed on local machine but failed on CI | no hint | hint `claude-seo:seo-local` (13) |
| convert this callback based method to return a native Promise | no hint | hint `mobile-native` (13) |
| clean up unused import statements in this typescript file | no hint | hint `anthropic-skills:import-memory` (13) |
| fare üzerine gelince butonun arka plan rengini mavi yap | no hint | hint `claude-seo:seo-plan` (9) |
| refactor this loop to use array reduce | no hint | hint `egm:egm-review-loop` (9) |
| design a relational database schema for orders | no hint | hint `claude-seo:seo-schema` (9) |
| build a simple CLI calculator in Go | no hint | hint `vercel-cli-with-tokens` (9) |
| kasa iş akışını döngü diyagramı yap | hint `diagram-design` | matched (31), hint suppressed |
| my scroll animation is janky, make it 60fps | hint `animation-performance` | matched (17), hint suppressed |
| kart açılınca hafif zıplayan efektin adı ne | hint `animation-vocabulary` | matched (24), hint suppressed |
| generate several variants so I can choose one | hint `variant` | matched (13), hint suppressed |
| aralıklı tekrar ile çalışma planı yap | `learning-framework:spaced-repetition` | no match |

The re-check also found one problem the audit did not report: the while-typing matcher scores every installed slash command, not only skills. "add a unit test to verify that divide by zero throws" suggested an MCP prompt, `mcp__claude_ai_Scite__verify-bibliography`.

## Fixes, in priority order

### 1. Question detection silences real requests (high)

**Cause.** `isConfidentHint` treats a draft as a question if any word anywhere is in `QUESTION_WORDS`. That list holds `is`, `are`, `can` and `ne`. It also runs on folded text, where Turkish `iş` becomes `is`.

**Fix.**
- Match question words on the lowercased draft before folding, so `iş` stays `iş`.
- Count `what`, `why`, `how`, `is`, `are`, `can` and similar only as the first word. Count Turkish `ne`, `nedir`, `mi`/`mı`/`mu`/`mü` only as the last word, or when the draft ends with `?`.
- Let a strong match (score of at least 20) show a hint even on a question, so "efektin adı ne" still reaches `animation-vocabulary`.

**Done when:** all four suppressed drafts in the table show their hint, and the 18 negative drafts from the v0.8.2 fuzz set stay at 0 false hints.

### 2. One common word triggers a hint (high)

**Cause.** One matching name part scores 9. One matching description word adds 4. A score of 12 or more skips the action-word check. Common words such as `local`, `native`, `import`, `plan`, `loop`, `schema` and `cli` are also skill-name parts.

**Fix.**
- A match that rests on a single name part, with no alias phrase, needs an action word even when it scores 12 or more.
- Name parts of fewer than 5 letters, other than known acronyms, need a second signal: another name part or an alias.

**Done when:** none of the 7 negative drafts in the table shows a hint, and the positive drafts from fix 1 still do.

### 3. The matcher scores commands that are not skills (high)

**Cause.** The description pass loops over every installed command, MCP prompts included.

**Fix.** Score only entries of the skill library (`buildLibrary`), not the raw command list.

**Done when:** the "verify that divide by zero" draft suggests nothing, and the library-only test passes.

### 4. Skills without a SKILL.md are missing from the library (medium)

**Cause.** `buildLibrary` drops any command that has neither a `SKILL.md` on disk nor an alias. That removes 19 built-in or bundled skills, among them `code-review`, `debug`, `simplify`, `verify`, `loop` and `schedule`.

**Fix.** Read skill names from the host's `skill_listing` attachment, which the mod already intercepts. Add the listed skills that have no file, using the listing's own description.

**Done when:** `/whisper-help` lists `code-review` and `loop` on an install that has them.

### 5. Compound names made of generic words never match (medium)

**Cause.** `code-review` splits into `code` and `review`. Both are in `GENERIC_SKILL_WORDS`, so the name scores 0. An alias on `ponytail:ponytail-review` also claims "code review". That second part no longer applies on the author's machine, where ponytail is turned off.

**Fix.** When the draft contains the whole name as a phrase ("code review" for `code-review`), add the full-name score even if each part is generic. Remove "code review" from the ponytail alias.

**Done when:** "do a code review of this git diff" ranks `code-review` first on an install that has it.

### 6. Turkish drafts miss skills that have no alias (medium)

**Cause.** 89 of 143 skills have no alias, and every skill description on disk is English.

**Fix.**
- Add Turkish aliases for the most-used groups first: `learning-framework:*`, `claude-seo:*`, `ponytail:*`, `ui-ux-pro-max:*`.
- Keep the README honest: matching works best in English, and aliases are how other languages are added.

**Done when:** the Turkish prompts for those groups in the audit set reach top 3.

### 7. Near-duplicate skills lose ties by name (low)

**Cause.** Ties are broken alphabetically. That is how `ui-ux-pro-max:design`, `claude-seo:seo-images` and `learning-framework:interleaving` lose to neighbors.

**Fix.** Break ties by the share of the skill's name parts that matched, then by name.

### 8. Keep the audit as a regression test (supports all of the above)

Turn the audit's prompts into `eval/matcher_cases.jsonl` (draft, expected skill or none) and add a test that runs the matcher on a fixed fixture library. The test needs no model calls and no quota. Fixes 1 to 7 are measured against it, and later changes cannot quietly undo them.

## Order of work

1. Fix 8 first, so every change has a measured before and after.
2. Fixes 3, 1 and 2, in that order. They change what users see most often.
3. Fixes 4 and 5.
4. Fixes 6 and 7.

## Not planned

- A model-based ranker. It was measured in v0.3 and costs quota on every request.
- Matching all 143 skills perfectly in Turkish. Aliases make Turkish coverage grow, but they are hand-made.

## Status (2026-11-07)

Built in v0.9.0, measured with `hooks/matcher.test.ts` (no model calls) and an outside re-check on all 144 Claude skills:

| Fix | State |
|---|---|
| 1. Question detection | Done. Question words count only at the start (English) or as markers (Turkish); "iş" is read before folding; polite "can you/we…" and "do a…" are requests; a Turkish draft ending in an action verb is a request. |
| 2. One common word | Done. A match needs two signals, an alias, or the whole name before it shows unasked. |
| 3. Only skills are scored | Done. |
| 4. Built-ins without SKILL.md | Done, from the host's skill listing. |
| 5. Compound names | Done: "code review" ranks `code-review` first. |
| 6. Turkish aliases | Done for the listed groups; the alias file now covers 144 skills. |
| 7. Ties | Done: name coverage, then a bonus for longer exact alias phrases. |
| 8. Regression test | Done: `hooks/matcher.test.ts`. |

Also fixed in this pass: a UTF-8 BOM hid a skill's front matter (so a manual-only skill lost its flag), macOS decomposed letters split Turkish words, "case study … in ;;" disabled `;;`, and a 50 KB paste took about 230 ms per key (now about 4 ms).

Known gap: a Turkish question that ends in a question word ("efektin adı ne") stays quiet even when a skill fits.
