# Review of the Antigravity changes (2026-11-04)

Scope: everything in `antigravity/`. Checks run:
- read every file;
- diffed `register_fixed.tsx` against the installed `my-mods/skill-pilot/hooks/register.tsx`;
- ran `claude plugin validate` on a copy of the mod with that file in place: it passes, with one warning (no icon);
- ran `node --test test_draft.ts`: 5/5 pass;
- reproduced the pane-click bug in node.

I did not run tsc (it is not installed) or `claude plugin test`, and I made no live model runs.

## Code bugs (fix before installing)

1. **Clicking a skill in the pane throws, so nothing is filled** (`register_fixed.tsx`, `pick`).
   - `$.prompt.read()` returns `{ text, cursor }` (d.ts `PromptBox`), not a string, so `currentDraft.replace` is "not a function".
   - This makes the pane worse than v0.3, which at least filled `/name `.
   - Fix: `const { text } = await $.prompt.read()`.
2. **`/pilot-find` is registered and advertised in HELP, but has no `command.run` handler.** Running it does nothing useful.
   - Fix: remove it until it is built, or add the handler.
3. **Two manual-only skills sit in the auto table.**
   - `review-animations` is in the Animation group, and its SKILL.md has `disable-model-invocation: true`. The router tells the model to invoke it, which is the same bug class as v0.3's egm entries.
   - Five manual skills are not listed at all: `break`, `explain-interface`, `prototype`, `pick-ui-library` and `egm:egm-review-loop`. The diff silently dropped `break` and `explain-interface` from v0.3.
4. **The `lite` text still hard-codes a Turkish sentence** ("Bu görev için /<skill> komutunu çalıştırabilirsiniz."). This contradicts the report's "in the user's language" fix. The live run happened before that fix: `summary.json` is from 17:06 and the fix is from 17:07, and the run outputs show Turkish "🧭 Öneri" lines in answers to English prompts.
5. **The tests do not cover the mod.**
   - `test_draft.ts` tests `pilot_engine.ts`, which `register_fixed.tsx` does not import. The mod re-implements the fill inline, with bug 1, and no test catches it.
   - Test 4 only asserts that the catalog contains the answers to the benchmark: it checks that the table was written for the test set, not that routing works.
6. Minor: the fill regex `^\/\S+\s*` also strips a leading file path (for example `/etc/hosts changed, explain`). Strip only a leading token that is a known command name.

## Claims in `evaluation_and_plan.md` that the data do not support

- **"16/16 · 4/4 · 11/11, %100" is a merged number, not a measurement.** Condition C ran only 6 cases. The other 15 auto passes and 10 quiet passes are v0.3 results under a different setup. C was never run on them, so a regression there would not show.
- **The setups are not comparable to the baseline.**
  - C ran on **Sonnet**; A and B ran on Opus.
  - C ran with ponytail off; A and B had it on.
  - C used `--strict-mcp-config`.
  - Manual cases ran at `--max-turns 1`.
  - C fed the router text through `--append-system-prompt`. That tests the prompt text, not the mod code (`prompt.compose`).
- **The manual wins are in-sample.** The table names exactly the four tested manual skills with descriptions written around the test prompts, and `pptx`/`docx` were added after cases 13 and 14. Whether a manual or long-tail skill **outside** the table gets surfaced is untested. That is the main problem for a mod published to people with other skills installed.
- **n = 1 run, 6 cases.** "Kanıtlandı / proven" is too strong; "promising" fits.
- **"0 ms, $0.00" is only the router's cost.** The table still adds ~700 tokens to every turn.

## What holds up

- Splitting auto and manual skills, and telling the model "you cannot invoke it, tell the user to run `/name`", is the right direction. 4/4 manual cases worked live, including case 18, which beat the Artifact rule.
- The alternatives matrix (A–E) and the decision to defer `/pilot-find` (Haiku) match the evidence.
- `listing_hook.ts` / `enrichSkillListing` is the right lever for D. It is still a hard-coded list, though: it should build the manual list from `$.command.list()` plus SKILL.md frontmatter, so it works on other people's installs.
- The rollback through `/pilot off` is real.

## Recommended next step

1. Fix bugs 1–4.
2. Test the mod itself: `claude plugin test` with a test that clicks a skill on a non-empty draft.
3. Re-run all 30 prompts plus 10 new held-out prompts, written to target skills **not** in the table, on the same model and setup as the baseline. Use the real mod, not `--append-system-prompt`.
4. Then decide whether to install. Before publishing, the static table must become generated (D), or it will list skills other users don't have.

---

# Re-review: v0.4 (`antigravity/skill-pilot/`, 2026-11-04 17:56)

Checks run:
- read `register.tsx`, `logic.ts`, `catalog.ts`, the manifest, README, `run_mod_eval.mjs`, the smoke outputs and the updated `evaluation_and_plan.md`;
- `claude plugin validate`: passes, with only the icon warning;
- **`claude plugin test`: 5/5 pass on the real mod.**

## Earlier findings: status

| # | Finding | Status |
|---|---|---|
| 1 | Pane click threw on `prompt.read()` | **Fixed.** It uses `{ text }`, and a test clicks on a non-empty draft. |
| 2 | Dead `/pilot-find` | **Fixed.** Removed; a test asserts only working commands are registered. |
| 3 | `review-animations` in the auto table, 5 manual skills missing | **Fixed.** All 15 manual skills are in manual groups. Manual skills are also discovered from SKILL.md through `prompt.attachment`. |
| 4 | Hard-coded Turkish in `lite` | **Fixed.** Both levels say "in the user's language". |
| 5 | Tests did not cover the mod | **Fixed.** `register.test.tsx` drives the real hooks. |
| 6 | Fill stripped leading file paths | **Fixed.** It strips only a known command (`buildFilledDraft` + `buildKnownCommands`). |
| — | "%100" merged claim | **Withdrawn** in the plan. The conditions are now reported in separate rows with their setups. |

## Still open

1. **No control for the held-out wins.** `ask-sonner` and `write-swift` (cases 101 and 102) were invoked with v0.4, but nobody ran them with the mod off. Their descriptions are not dropped by the host, so plain Claude may pick them too. Run 101–110 once with the mod off before crediting the mod.
2. **Description restore is untested live.** Case 103 (`pdf`, a dropped description) was not in the smoke run. The `skill_listing` line format the parser expects (`- name` / `- name: desc`) is assumed in the test, not read from a real attachment. Cheap check: in a `claude --plugin-dir` session, log `e.text` of one `skill_listing` once.
3. **Smoke = 4 cases, Sonnet, ponytail off, n = 1.** The full Opus run (`node run_mod_eval.mjs --full`) has not happened yet; the plan says so plainly.
4. **Manual skills reach the model twice.** The `prompt.compose` table lists them, and the `skill_listing` append lists them again. That costs tokens every turn, with no measured need for both. Once (2) is verified, keep one of them.
5. **Disk index by short name.** The index is a `Map` keyed by `name`, and the last file wins. If two plugins share a short name, or old plugin versions sit in the cache (here only playwright has several), the wrong description or manual flag can win. Prefer the `plugin:name` key, and for the same plugin take the newest version folder. Minor.
6. **Publish readiness, not install readiness.**
   - Help, the pane and the catalog's `tr` and example fields are Turkish, and `pilot-help` still says "(Turkish)".
   - The README has no install line and no note that the mod reads `~/.claude` skill files locally.
   - The curated table is still hand-picked from this machine (it is filtered to installed skills, which is the right fallback).

## Verdict

- **Personal install:** OK. The code is correct as far as the tests reach, and `/pilot off` rolls it back.
- **Publishing:** after the control run (1), the live listing check (2) and English UI strings (6).
