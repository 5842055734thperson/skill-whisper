# Skill Pilot v0.4: Fixed Architecture, Mod Verification and Measurement Report

**Author:** 5842055734thperson (updated with Antigravity)
**Date:** 2026-11-04

> Historical document. It describes v0.4 under the old name **skill-pilot**, with the commands `/pilot`, `/pilot-help` and `/pilot-ui`. In this repository the mod lives at the repository root ([`hooks/`](../../hooks/)), and the eval scripts are in [`eval/`](../../eval/). File names below are written as they are in this repository.
>
> One correction from later testing: in the Claude desktop app, the ghost hint and Tab completion added in v0.5 do not work. The desktop app paints no prompt decorations and fires no `prompt.autocomplete`. v0.6 added the status-line hint and the `;;` shortcut instead.

---

## 1. How the findings in `antigravity_review.md` were resolved

All **6 code bugs** found in the previous draft were fixed, and the overstated claims in the report were removed:

| # | Bug found ([`antigravity_review.md`](antigravity_review.md)) | Fix | Verification |
|---|---|---|---|
| **1** | Clicking in the pane crashed (`.replace is not a function`), because `$.prompt.read()` returns `{ text, cursor }`, not a string. | Changed to `const { text } = await $.prompt.read()` in [`register.tsx`](../../hooks/register.tsx), and added a `$.ui.status` notice for `isFilled: false`. | Verified in `claude plugin test` with a real `<Pane>` mount and `pane.press({ key: 'skill-dataviz' })`. |
| **2** | `/pilot-find` was registered, but had no `command.run` handler. | Removed the dead `/pilot-find` registration and its help line. Only the working `/pilot`, `/pilot-help` and `/pilot-ui` are registered. | The `session.start` test checks that the registered commands are `['pilot', 'pilot-help', 'pilot-ui']`. |
| **3** | `review-animations` (manual-only) was in the Animation group of the automatic table, and 5 manual-only skills were missing: `break`, `explain-interface`, `prototype`, `pick-ui-library`, `egm:egm-review-loop`. | All 15 manual-only skills were moved into `manual: true` groups in `catalog.ts` (removed in v0.8), so the automatic table has none. [`register.tsx`](../../hooks/register.tsx) also filters out skills that are not installed, and the `prompt.attachment` hook finds manual-only skills from `SKILL.md` files on disk (`disable-model-invocation: true`). | Verified in `claude plugin test` and in a live `--plugin-dir` run (case #106, `pick-ui-library`). |
| **4** | A hard-coded Turkish sentence (`"Bu görev için..."`, "For this task...") was left in `lite` mode, and the live test ran before the language fix. | Both the `full` and `lite` texts in [`logic.ts`](../../hooks/logic.ts) now say "in the user's language". No fixed Turkish output template is left. | Verified in the English live mod test (#18 and #106): the answers came back fully in English. |
| **5** | The tests checked a separate `pilot_engine.ts` file, not the mod itself. | The duplicate draft files were deleted, so [`hooks/`](../../hooks/) is the only source. [`register.test.tsx`](../../hooks/register.test.tsx) tests the real mod through `claude plugin test` (**5/5 passed**). | `claude plugin validate` (**Validation passed**) and `claude plugin test` (**5 pass, 0 fail**). |
| **6** | The pattern `^\/\S+\s*` also removed file paths such as `/etc/hosts changed`. | [`buildFilledDraft`](../../hooks/logic.ts) removes a leading `/token` only when the token is a known command or skill name (`knownCommands.has(token)`), so `/etc/hosts` is kept. | The `pane.press` test checks `'/etc/hosts changed, explain why'` -> `'/dataviz /etc/hosts changed, explain why'`. |

---

## 2. Measurements, reported separately

The merged "100%" claim in the previous report is withdrawn. Measurements made with different models and setups are reported in separate rows and **not mixed**:

| Condition | Model and setup | How it was loaded | Scope (`n`) | Results | Extra tokens per turn |
|---|---|---|---|---|---|
| **A: Baseline (`run1`)** | Opus 5.5 · `ponytail` on · `max-turns 2` | Mod off | 30 cases (`n=1`) | Auto: 8/16 · Manual: 0/4 · Quiet: 10/10 *(13 runs cut off at turn 2)* | 0 |
| **B: v0.3 (`pilot_v03`)** | Opus 5.5 · `ponytail` on · `max-turns 2` | Installed v0.3 mod | 30 cases (`n=1`) | Auto: 15/16 · Manual: 0/4 · Quiet: 10/10 *(15 runs cut off at turn 2)* | ~450 tokens |
| **Haiku prototype v2** | Haiku 5.5 · `RULES_V2` + 2 `OVERRIDES` | External CLI ([`rank.py`](../../eval/rank.py)) | 30 cases (`n=1`, tuned on the test set) | Auto candidate: 15/16 · Manual candidate: 3/4 · Quiet: 10/10 *(needs a user command, ~7.1 s latency)* | ~13,260 tokens per call ($0.0027) |
| **C: prompt-only pre-test** | Sonnet 5.5 · `ponytail` off · `strict-mcp` | `--append-system-prompt` (no mod) | Only the 6 open cases (#13, #17–20, #31) | #13 `pptx` called (1/1) · manual skills recommended (4/4, with a Turkish heading) · CSS near-miss stayed quiet (1/1) | ~685 tokens |
| **v0.4 real mod smoke test** | Sonnet 5.5 · `ponytail` off · `strict-mcp` | **Real mod (`--plugin-dir`)** | **4 cases** (2 auto skills outside the table, 2 manual, English) | **4/4 passed:** `ask-sonner` and `write-swift` (outside the table) were called; `pick-ui-library` and `egm:egm-draft` were recommended in English | ~700 tokens (`compose`) + dynamic `skill_listing` patch |

Result files: [`eval/results/`](../../eval/results/).

### What the live v0.4 smoke test showed
Case #106 asked: `"Which React library should I pick for accessible command menus and virtualized 50k-row tables?"`. The group description in the `CATALOG` table does **not** contain the words "command menus" or "virtualization". The model still answered:
> `Skill: /pick-ui-library. It picks a library for a frontend task from a curated, opinionated list, and command menus and virtualization are both on it. I can't invoke it myself...`

The phrases the model used ("curated, opinionated list... command menus... virtualization") come straight from the front matter description of the `pick-ui-library` skill's `SKILL.md`. This supports, in a live session, that the `on('prompt.attachment')` hook read `SKILL.md` from disk and enriched the `skill_listing` attachment at runtime (condition D).

(A later review noted that this does not rule out the host listing the description itself. A run with the mod off is still needed. See [`antigravity_review.md`](antigravity_review.md).)

---

## 3. Known limits and what is not measured yet

1. **A fully comparable 40-case Opus run has not been done.**
   - The user's weekly Claude quota was nearly used up, so v0.4 has not been compared on all 30 original cases plus the 10 new cases outside the table ([`held_out_prompts.jsonl`](../../eval/held_out_prompts.jsonl)).
   - The planned run is Opus with `ponytail` on, repeated 3 times (`n=3`).
   - [`run_mod_eval.mjs`](../../eval/run_mod_eval.mjs) (`node eval/run_mod_eval.mjs --full`) is ready, so it can run with one command when the quota resets.
2. **Notes for other users:**
   * `prompt.compose` intersects the table with `$.command.list()`, so **skills the user does not have are removed from the table automatically**.
   * The `prompt.attachment` (`skill_listing`) hook scans `SKILL.md` files in the user's own `~/.claude/skills` and `~/.claude/plugins` folders. It adds manual-only skills that are not in the table, and descriptions that were cut, within a character budget.
3. **Static type check:** `tsc` is not installed, so instead of a full TypeScript build, `claude plugin validate` (static hook and permission check) and `claude plugin test` (runtime hook tests) were run. Both pass without errors.

---

## 4. File map

* [`.claude-plugin/plugin.json`](../../.claude-plugin/plugin.json): plugin manifest.
* `hooks/catalog.ts` (removed in v0.8): the catalog that separates automatic skills from the 15 manual-only skills.
* [`hooks/logic.ts`](../../hooks/logic.ts):
  - `buildFilledDraft`, which keeps paths such as `/etc/hosts`;
  - `parseFrontmatter`, `filterGroups`, `buildRouterSection` and `enrichSkillListing`.
* [`hooks/register.tsx`](../../hooks/register.tsx): the mod's hooks (`session.start`, `command.run`, `prompt.attachment`, `prompt.compose`, `ui.render`).
* [`hooks/register.test.tsx`](../../hooks/register.test.tsx): mod tests run by `claude plugin test`.
* [`eval/held_out_prompts.jsonl`](../../eval/held_out_prompts.jsonl) and [`eval/run_mod_eval.mjs`](../../eval/run_mod_eval.mjs): 10 new test cases outside the table, and the `--plugin-dir` evaluation runner.
