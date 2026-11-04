# Goldfish Review Report

**Target:** [`test_report.md`](test_report.md) (full file)
**Round:** 1

## Reviewer Status

| Reviewer | Standard | Status |
| --- | --- | --- |
| `egm-zoom-out` | zoom-out-standard.md | completed |
| `egm-design` | feature-spec-standard.md | completed |
| `egm-implementation-readiness` | implementation-readiness-standard.md | completed |
| `egm-codebase-details` | (none; checked against code and data) | completed |

Severity breakdown after deduplication: 🔴 4 Blockers, 🟡 17 Major, 🟢 7 Nits.

Finding ids are `<reviewer>-1-<n>`. Each merged finding uses the id of one reviewer that raised it. The other reviewers that raised it are listed under "Also raised by". When reviewers rated a finding differently, the highest rating is used.

## Answers to the key questions

- **Do the data support the conclusions?** The tallies do. Every headline number in §2 matches `out/*/scores.json`: baseline 8/16, v0.3 15/16, Haiku v1 14+2, v2 15+3, v2 top-1 17, about $0.0027 per call. The interpretations in §3.1, §3.3 and §3.4 do not hold (findings codebase-details-1-1, zoom-out-1-2, design-1-4, codebase-details-1-2).
- **Are the caveats complete?** No. The report does not disclose that 13 of 30 baseline runs and 16 of 30 v0.3 runs were cut off by the 2-turn cap. It also leaves out the hand-written OVERRIDES in rank.py, the tools that stayed live and the user hooks that were active, the v1-to-v2 regression on case 18, a pick sitting exactly on the threshold, and a stale scorer output.
- **Is v1 the smallest fix?** No. The manual-skill line (I1) on its own has not been measured, and the v0.3 0/4 manual score comes from v0.3's own prompt. `/pilot <text>` and the generated router (I2) should wait until a measured gap shows they are needed.
- **Can it be built on this host API as written?** Not fully. `$.command.list()` has no manual flag and does not mark which entries are skills. The host's skill listing can in fact be rewritten through `prompt.attachment` (`skill_listing`), which the report says is impossible. `/pilot` is already registered as a command.
- **What is missing before building?** An alternatives section, a risks section, a build plan with phases and tests, acceptance gates, a rollback switch, the exact `model.complete` call with its failure handling, the surface and state for showing picks, and the fill rules.

## Prioritized Findings (Blockers -> Major -> Nits)

### zoom-out-1-1. `$.command.list()` cannot tell manual skills apart, or skills from commands - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out`. Also raised by: `egm-design` (B1), `egm-implementation-readiness` (2), `egm-codebase-details` (M6).
* **Affected Scope:** §5 I1/I2, §6 part 1, §4 last caveat, §7.4
* **Discrepancy Description:** `CommandInfo` is `{name, description, source, plugin?}` (claude-code.d.ts:1766-1786). `description` is only the one-line typeahead text, which may be truncated. `source: 'plugin'` covers skills, markdown commands and `$.command.register` commands alike (d.ts:1911-1917). There is no disable-model-invocation flag. `list()` also returns `/clear`, `/compact`, MCP commands and the mod's own `/pilot*` commands (d.ts:3186-3194; seen in pilot_v03/17.jsonl:8). The prototype got its `manual` flag from SKILL.md frontmatter (build_catalog.py:69, rank.py:44), and the mod has no equivalent path.
* **Rationale & Recommendation:** Answer §7.4 now from the types. Name the source of the manual flag: read SKILL.md frontmatter at session start, keep a hand-maintained manual list, or read the `skill_listing` attachment. Write out the exact filter that turns `CommandInfo[]` into the skill catalog. Until then, do not build I2 as written.

### codebase-details-1-1. The host skill listing can be rewritten, and §3.4 and I3 say it cannot - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-codebase-details`. Also raised by: `egm-design` (B2), `egm-implementation-readiness` (3), `egm-zoom-out` (4).
* **Affected Scope:** §3.4, §5 I3, §5 I6, §6, §7.4
* **Discrepancy Description:** The skill listing reaches the model as a `prompt.attachment` of type `skill_listing`. A hook can rewrite it with `next({...e, text})` or drop it (d.ts ~4366-4377, 15822-15840). `prompt.compose` only covers system-prompt sections (d.ts 8741-8779), and single sections can be replaced, moved or dropped (d.ts 8762-8771, `prompt.section` 9548-9566). `$.context` exposes `ContextSkills{totalSkills, includedSkills, tokens}` (d.ts 2297-2314). The report's own data also contradicts "No mod can change that order": v0.3 beat the Artifact rules on cases 2 and 4 (out/run1 ids 2 and 4 = NO_SKILL; out/pilot_v03 ids 2 and 4 = INVOKED).
* **Rationale & Recommendation:** Rewrite §3.4 as "the Artifact rules win unless the router names the skill clearly: won case 13, lost cases 2 and 4". Re-scope I3 to a `prompt.attachment` hook on `skill_listing`, and verify it on 2.1.316. Evaluate rewriting the listing (restore the 53 dropped descriptions, tag `[manual]`) as an alternative to a second, parallel router table. Drop or rework the `/pilot`-only note in I6.

### design-1-3. v1 is a single path with no alternatives, and is not the smallest fix - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-design`. Also raised by: `egm-zoom-out` (3).
* **Affected Scope:** §5, §6 (and "Out of v1", line ~110)
* **Discrepancy Description:** The feature-spec standard requires alternatives considered and rejected, and the report has none. Options that were never evaluated:
  * (a) rewrite `skill_listing`;
  * (b) run the ranker automatically on `prompt.submit` and inject its picks;
  * (c) `$.model.classify` or `$.model.fork` (d.ts 2705-2739);
  * (d) keep the curated table and generate entries only for skills it lacks;
  * (e) ship I1 alone, with no `/pilot`.

  On auto skills, `/pilot` v2 ties the router at 15/16. Its only extra value is 3/4 on manual skills, measured with rules tuned on the same prompts. The router was never given a fair test on manual skills (see zoom-out-1-2).
* **Rationale & Recommendation:** Add an "Alternatives considered" section. For each option, give its per-turn cost, latency, expected hit rate from the existing data, and the reason it was rejected. Make v1 the router plus the `[manual]` line. Hold `/pilot <text>` for v2, and build it only if the I1 router scores clearly below about 3/4 on manual skills, or if the held-out set shows misses on skills outside the table.

### implementation-readiness-1-1. The `/pilot` command name is already taken - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-implementation-readiness`. Also raised by: `egm-design` (M3), `egm-zoom-out` (7), `egm-codebase-details` (M5).
* **Affected Scope:** §5 I1, §6 part 2
* **Discrepancy Description:** register.tsx:107 and 116-122 register `/pilot full|lite|off`. Any other argument returns "Bilinmeyen seviye" ("unknown level"). Requests such as "/pilot full redesign..." or "/pilot off-by-one bug" would be ambiguous. The report also does not mention the existing `/pilot-help`, `/pilot-ui` or the pane that opens at session start (line 112).
* **Rationale & Recommendation:** Pick one design. Either rename the level command (for example `/pilot-level`), or use a separate ranker command (for example `/pilot-find <text>`). Alternatively, set the level only when the argument is exactly one token from `full|lite|off`, and add a test for each case. Give the new `description` and `argumentHint`, and update HELP (register.tsx:97).

### codebase-details-1-2. About half the headless runs were cut off by the 2-turn cap, and this is not disclosed - Severity: 🟡 Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** §1 Headless runs, §2 per-case table, §3.3, §4
* **Discrepancy Description:** `terminal_reason:"max_turns"` appears in 13 of 30 baseline runs and 16 of 30 v0.3 runs. Baseline cases 18-20 and v0.3 cases 18-19 have no final text, so "0 named" for manual skills is partly an artifact of the cutoff. "Asked for the file" (baseline case 20) is unsupported: the run did a Glob plus `Artifact list`, then hit the cap. v0.3 case 13 was also cut off after Artifact quickstart.
* **Rationale & Recommendation:** Add a caveat with the per-run cutoff counts. Re-run the manual-skill and Artifact cases with a higher `--max-turns`. Count "named" only on completed runs, and correct the description of case 20.

### zoom-out-1-2. v0.3 tells the model to invoke four manual-only skills, so its 0/4 does not show what a router can do - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`. Also raised by: `egm-codebase-details` (M4).
* **Affected Scope:** §2 v0.3 row and Notes, §3.2, §3.3, §5 I1
* **Discrepancy Description:** register.tsx:12 says manual skills are left out of the router. Yet `egm-brainstorm`, `egm-draft` and `egm-review` (register.tsx:67-71) and `review-animations` (:51) sit in auto groups, and all four are `manual: true` in catalog.json (lines 363-390, 573-575). The `full` text (:90) says "invoke it with the Skill tool". `variant` is removed from the table entirely (:82). The 0/4 result is the expected outcome of that prompt.
* **Rationale & Recommendation:** Record this as a v0.3 bug. Rewrite §3.3 as "untested for the router". In I1, move these skills into a `[manual]` group with "tell the user" wording, then run §7 measurement 2 before deciding the scope of v1.

### design-1-4. §3.1 "knowledge is not the weak point" is confounded - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** §3.1
* **Discrepancy Description:** v0.3 adds two things at once: salience (an instruction to invoke) and knowledge (descriptions for skills whose text the host drops, such as humanizer, case 9). The design choice depends on which one does the work: rewriting the listing if it is knowledge, or a single short line if it is salience.
* **Rationale & Recommendation:** Cross-tabulate the 8 baseline misses against the 53 description-less skills. Soften the claim to "v0.3's table (salience plus descriptions) fixes 7 of 8."

### design-1-5. The `/pilot` and router rows measure different things - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** §2 table, §3.3
* **Discrepancy Description:** The router rows count end-to-end invocations with no user action. The `/pilot` rows count "a candidate was shown after the user typed a command and waited 7-12 s". The gap the report measured is that the model does not choose a skill on its own, and an opt-in command does not help users who never think to run it.
* **Rationale & Recommendation:** Label the `/pilot` columns "candidate shown (needs user action)". State the assumption about how users will discover `/pilot`.

### design-1-6. Rules v2 regression, knife-edge threshold and a top-1 sibling are hidden - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`. Also raised by: `egm-zoom-out` (5, 6), `egm-implementation-readiness` (12), `egm-codebase-details` (N4).
* **Affected Scope:** §2 per-case table and Notes, §4, §5 I8
* **Discrepancy Description:**
  * Case 18: v1 showed `egm:egm-draft` at 0.6 and v2 dropped it (rank_haiku_run1 vs rank_haiku_v2, id 18). This contradicts I8's "already the design".
  * Case 17's v2 hit is exactly 0.6, the threshold, and so was v1's hallmark hit on case 4. Haiku's confidences cluster on values like 0.6, 0.7, 0.85 and 0.9, so one borderline score decides the manual 3/4.
  * Case 19 is marked ✔, but its top-1 is `egm:egm-review-loop` (0.85), with `egm-review` second (0.7).
  * Case 20 flipped from no pick (v1) to 0.9 (v2).
* **Rationale & Recommendation:** Add a v1 column to the per-case table. Report the case 18 regression in §2 and §4, and change I8 to an open problem. Set the threshold between the common confidence values (for example 0.55 or 0.65) and test it at ±0.1. Say whether `egm-review-loop` counts as correct.

### codebase-details-1-3. Hand-written descriptions in the prototype are not disclosed - Severity: 🟡 Major
* **Reviewer Lens:** `egm-codebase-details`. Also raised by: `egm-zoom-out` (6).
* **Affected Scope:** §1 /pilot prototype, §4 last caveat
* **Discrepancy Description:** `OVERRIDES` in rank.py:16-22 injects hand-written text for `dataviz`, the target of case 2, and for `ui-ux-pro-max:ui-ux-pro-max`, which is a plugin skill, not a built-in. catalog.json has 21 empty descriptions, and 19 are still empty after the overrides. The caveat says the built-ins simply had empty descriptions.
* **Rationale & Recommendation:** Disclose the overrides and the 21/19 counts, and note that the case 2 hit depended on author-written text.

### codebase-details-1-4. The description of the test environment is inaccurate - Severity: 🟡 Major
* **Reviewer Lens:** `egm-codebase-details`. Also raised by: `egm-zoom-out` (6).
* **Affected Scope:** §1 Headless runs, §4
* **Discrepancy Description:**
  * Only Bash, PowerShell, Write, Edit, NotebookEdit, Agent, WebSearch and WebFetch were blocked (run_baseline.py:22). The Artifact tool published documents (run1/18.jsonl:21, pilot_v03/18.jsonl:23, run1/02.jsonl:21), and a Firecrawl MCP tool scraped pages (run1/11, pilot_v03/11).
  * User SessionStart hooks (ponytail, HANDOFF) were active in every run (run1/10.jsonl:3-4, run_baseline.py:56).
  * One `mkdtemp` is shared by all 30 runs of a condition, run 5 at a time.
  * Latency was measured with 5 CLI processes running at once (rank.py:75).
  * Only level `full` was tested, and the scorer reads only Skill tool calls, never the reply text (run_baseline.py:55-58). So the false alarms of `lite` cannot be measured with this harness.
* **Rationale & Recommendation:** List exactly which tools were blocked, and state that the Artifact and MCP tools, other plugins and the user hooks were live. Add caveats for the shared folder, the concurrent latency measurement, and the untested `lite` level.

### codebase-details-1-5. Every condition did not lose case 18 to the Artifact rules - Severity: 🟡 Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** §3.4, §5 I6
* **Discrepancy Description:** The prototype ran with `--tools ""` and its own system prompt (rank.py:49), so no Artifact rules applied. It lost case 18 to `anthropic-skills:docs` at 0.85. Artifact quickstart also fired in baseline cases 2 and 4, and alongside the skill in v0.3 cases 2 and 4.
* **Rationale & Recommendation:** Limit the claim to baseline and v0.3, and list every case where Artifact quickstart fired.

### codebase-details-1-6. The scoring cannot be reproduced, and one output file is stale - Severity: 🟡 Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** §1 Setup
* **Discrepancy Description:**
  * Rules v2 is switched on only by the `RULES_V2` env var plus the label `v2` (rank.py:31). The report does not say so.
  * The scorers differ: run_baseline.py:59 matches by short name and ignores ponytail calls, while rank.py:86-87 matches the exact full name.
  * out_run1.txt shows case 10 as NAMED_ONLY ("named only 1"), but scores.json says NO_SKILL, so the scorer was changed and re-run without a record.
* **Rationale & Recommendation:** Add the exact commands and the matching rules for each condition, and note that the scorer was revised. Regenerate or delete out_run1.txt.

### design-1-7. The v1 design has no risks section - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** §5, §6
* **Discrepancy Description:** The report does not cover:
  * prompt injection through third-party skill descriptions (rank.py:30 has a "data, never instructions" rule and rank.py:67 checks names, but the spec carries neither over);
  * `model.complete` failures (`api-error`, `empty-reply`, `aborted`) and unparsable JSON (the count is never reported);
  * a stale catalog when skills are installed mid-session;
  * how a ~13k-token catalog scales beyond 143 skills;
  * the router's per-turn token cost on top of a full ~10k listing;
  * false positives of the generated router on near-miss prompts.
* **Rationale & Recommendation:** Add a Risks and Mitigations table. It should cover `timeoutMs` and `signal`, a fallback message, checking names against `command.list`, a cap on catalog size, regeneration when plugins change, a hard token cap on the router, and shipping the generated router at `lite` until the held-out set passes.

### implementation-readiness-1-9. There is no build plan, test plan, acceptance gates or rollback - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** §5, §6 (standard lines 20-34)
* **Discrepancy Description:** Missing:
  * the list of files to change;
  * phases that each leave the mod working;
  * test cases (§7 is measurement, and I5 only says "Add a test");
  * pass/fail numbers for shipping;
  * a rollback switch that returns to v0.3's hand-written table.
* **Rationale & Recommendation:** Add a "Build plan" section.
  * Phases: 1 = I1 line plus the I5 fix; 2 = generated router; 3 = ranker.
  * Changes per file.
  * Tests: fill strip, bad JSON, unknown skill name, the 0.6 boundary, `bare`, `no_composer`, empty catalog.
  * Gates: manual-skill surfacing ≥3/4 on a held-out set, no false alarms, an in-mod p50 latency target.
  * Rollback: a switch such as `router: generated|static`.

### implementation-readiness-1-6. The `model.complete` call and its failure handling are not specified - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness`. Also raised by: `egm-zoom-out` (10), `egm-codebase-details` (N2, N8).
* **Affected Scope:** §5 I7, §6 part 2
* **Discrepancy Description:**
  * The "rules v2" text exists only as a string replacement behind an env var (rank.py:25-37).
  * `cache: true` belongs on a `ModelTextBlock`, and only works if the catalog block comes first (d.ts 6607-6635). The cache lives 5 minutes, and no prototype call got a cache read (13,176-13,258 input tokens, all cache writes).
  * Not defined: `maxTokens`, `effort`, `timeoutMs`, how each `isAnswered:false` reason is handled, JSON that fails to parse (rank.py:66), unknown names, picks below the threshold, an empty result, and cancel.
* **Rationale & Recommendation:** Put the final RULES text in the report verbatim. Give the request literally, for example `{model:'haiku', system: RULES, prompt:[{text: CATALOG, cache:true},{text: request}], maxTokens: 300, effort:'low', timeoutMs: 15000}`. Add a table mapping each failure to the message the user sees. Measure both cold and warm calls before adding cache or cancel UI.

### implementation-readiness-1-4. Where picks are shown, and how they are stored, is not decided - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** §6 part 2 ("in the pane or as command output", "clicking a pick")
* **Discrepancy Description:** A `command.run` result is plain transcript text, so only the pane can hold clickable picks (register.tsx:138-169). Not defined: where picks are stored, whether the pane opens itself, what to do when `ui.open` returns `isPlaced:false`, and how a new `/pilot` replaces old picks.
* **Rationale & Recommendation:** Make the pane the main surface and plain text the fallback. Define the state, for example `atom({plugin:'skill-pilot', key:'picks'})` holding `{request, picks:[{skill, confidence, reason}]}`. Give the pane layout and the format of the fallback text.

### implementation-readiness-1-5. The fill logic mixes two flows and leaves edge cases open - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness`. Also raised by: `egm-design` (N5), `egm-codebase-details` (N9), `egm-zoom-out` (11).
* **Affected Scope:** §5 I5, §6 ("fills `/skill <text>` without wiping the draft")
* **Discrepancy Description:** After `/pilot <text>` is sent, the prompt box is empty, so the text must come from the stored `e.args`. For a click on the pane list, these cases are open:
  * a draft that starts with `/pilot`;
  * a draft that already starts with `/<same skill>`;
  * multi-line, empty or leading-space drafts;
  * `prompt.read()` returning `''` when headless or unreadable;
  * a refusal with `isFilled:false`, `no_composer` or `dialog` (register.tsx:141; d.ts 9065-9146).

  The zoom-out reviewer adds that the I5 pane bug should ship as a separate small fix, not inside v1.
* **Rationale & Recommendation:** Give one function and its rules:
  * `/pilot` pick: `fill({text:'/'+skill+' '+storedRequest, mode:'replace'})`.
  * Pane pick: `draft.replace(/^\/\S+\s*/, '')`, then fill with `replace`.
  * Refusal: show a notice through `ui.status`.

### implementation-readiness-1-7. The generated router is underspecified, and the fate of CATALOG/help/pane is not stated - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness`. Also raised by: `egm-zoom-out` (8).
* **Affected Scope:** §5 I2, §6 part 1
* **Discrepancy Description:** The report does not say:
  * where the "when" text comes from, given that `command.list` gives only the typeahead line and the current text is hand-written (register.tsx:17-78);
  * what "grouped" means;
  * the token cap and which skills are cut first;
  * when the router is rebuilt.

  One `CATALOG`, including the Turkish `tr` and `example` fields, feeds the router, `/pilot-help` and the pane (register.tsx:15, 95-97, 156-166). Generating only the router splits this into two sources of truth.
* **Rationale & Recommendation:** Either describe the generation algorithm in full (grouping key, cap, truncation order, rebuild trigger) or keep the hand catalog for all three surfaces and add only `[manual]` lines.

### design-1-8. The data do not support generating the router table - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`. Also raised by: `egm-zoom-out` (9).
* **Affected Scope:** §5 I2
* **Discrepancy Description:** The 15/16 came from a hand-curated 40-skill table with disambiguation text written for it (register.tsx:23, 30). A table generated from typeahead one-liners for 143 skills is a different intervention. The only skill outside the table, `docx`, was invoked anyway, so no measured miss justifies I2, and I2 adds per-turn tokens.
* **Rationale & Recommendation:** Defer I2 until the held-out set (§7.1) shows misses on skills outside the table. If I2 goes ahead, keep the curated entries and generate entries only for unlisted skills, and A/B the result against the curated table.

### implementation-readiness-1-8. The trigger for the I6 Artifact note is undefined - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness`. The zoom-out reviewer (4) recommends dropping I6 instead.
* **Affected Scope:** §5 I6
* **Discrepancy Description:** "When a pick is a chart, page, slide or document skill" needs a classification, and nothing defines one.
* **Rationale & Recommendation:** Either list the skill names and the exact note text, or drop I6 and fix case 13 in the router (add pptx to the "when" line for slides), then re-measure.

### design-1-9. The latency figures are blended and the explanation is uncited - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-design`. Also raised by: `egm-codebase-details` (N1).
* **Affected Scope:** §2 latency
* **Discrepancy Description:** "7-8 s" blends the medians (8.2 s for v1, 7.1 s for v2; max 12.5 s). "Mostly CLI start-up" is asserted without a citation.
* **Rationale & Recommendation:** Report the two medians separately, and cite rank_haiku_v2/01.json (`duration_api_ms` 1681 against 7.1 s wall time).

### codebase-details-1-7. The prompt size is understated - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** §2
* **Discrepancy Description:** "Roughly 10,000 tokens" is low. The actual input was 13,176-13,258 tokens per call.
* **Rationale & Recommendation:** Correct the figure, and note that every call paid the cache-write price.

### design-1-10. The rules v1 note omits case 20 - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-design`. Also raised by: `egm-zoom-out` (6), `egm-codebase-details` (N3).
* **Affected Scope:** §2 table, Notes for rules v1
* **Discrepancy Description:** The note lists humanizer, learn and brainstorm as no-pick cases, but `variant` (case 20) also got no pick under v1.
* **Rationale & Recommendation:** Add case 20 to the list.

### design-1-11. The skill counts are not reconciled - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-design`. Also raised by: `egm-codebase-details` (N6).
* **Affected Scope:** §1 Environment, §2 truncation
* **Discrepancy Description:** The report gives 125 listed against 143 installed, and catalog.json has 128 non-manual entries. No artifact backs "53 name-only / 10k budget".
* **Rationale & Recommendation:** Explain the split, and attach the `/context` output.

### design-1-12. The breakdown of baseline misses is incomplete - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-design`. Also raised by: `egm-zoom-out` (12).
* **Affected Scope:** §2 Baseline note
* **Discrepancy Description:** The note says only "did the task itself in 4 cases". The 8 misses split as 4 done itself, 3 to Artifact quickstart and 1 file search.
* **Rationale & Recommendation:** State the full split. Re-check it after the max_turns fix in codebase-details-1-2.

### codebase-details-1-8. The 300-character cut is attributed to the wrong script - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** §1 catalog
* **Discrepancy Description:** The 300-character cut happens in rank.py:43. build_catalog.py cuts at 600 (line 68).
* **Rationale & Recommendation:** Correct the attribution.

### implementation-readiness-1-11. The tested and reviewed host versions differ - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-implementation-readiness`. Also raised by: `egm-codebase-details` (N7).
* **Affected Scope:** §1 Environment
* **Discrepancy Description:** The tests ran on 2.1.316, and the API claims were checked against the 2.1.317 d.ts.
* **Rationale & Recommendation:** Name the target host version for v1, and re-verify `skill_listing` on that version.

## Coverage notes

- No reviewer read `concepts_brief.md`, so the report was not cross-checked against the earlier Turkish brief.
- The implementation-readiness reviewer did not open the score files or the raw transcripts. The other three reviewers did, and their counts agree.

## Elephant Resolution (round 1)

**Target:** `test_report.md` (full file). The author spot-checked the two biggest claims before resolving:
- `CommandInfo` really is `{name, description, source, plugin?}`: there is no manual flag.
- `prompt.attachment` with type `skill_listing` really is rewritable (`next({ ...e, text })`).
- The cutoff counts are right: 13/30 baseline runs and 15/30 v0.3 runs hit `error_max_turns`.

No finding is contested. Most fixes need **new measurements**, not only text edits. They are grouped below into the work they need.

| Finding | Category | Fix |
|---|---|---|
| zoom-out-1-1 | PROPOSE FIX | Get the manual flag from SKILL.md frontmatter via `$.fs.read` (the path comes from the plugin and skill dirs). A cheaper alternative: a skill is manual-only if it is in `$.command.list()` but absent from the host's `skill_listing` attachment. Use whichever proves reliable; record the filter. |
| codebase-details-1-1 | PROPOSE FIX | Rewrite §3.4, I3 and I6. A `prompt.attachment` hook on `skill_listing` becomes the main lever: append manual-only skills as "tell the user to run /name" and restore dropped descriptions within a token cap. Measure it as condition D. |
| design-1-3 | PROPOSE FIX | Add §Alternatives with measured hit rate, per-turn tokens and latency for each condition: A baseline, B v0.3, C v0.3 + `[manual]` line, D listing rewrite, E `/pilot-find`. v1 = the smallest condition that meets the gate. `/pilot-find` is built only if C/D leave manual or long-tail misses. |
| implementation-readiness-1-1 | PROPOSE FIX | Keep `/pilot full\|lite\|off` and add `/pilot-find <text>`. No name collision, and HELP is updated. |
| codebase-details-1-2, zoom-out-1-2 | PROPOSE FIX (measure) | Re-run A and B with `--max-turns 4`, then run C and D. Count a manual skill as a hit when the final text tells the user to run `/name`. |
| design-1-4 | PROPOSE FIX | Cross-tabulate the baseline misses against the 53 skills listed without a description. |
| design-1-5 | PROPOSE FIX | Label `/pilot` columns "shown to user (needs a click)". They are not comparable to auto-invoke. |
| design-1-6 | PROPOSE FIX | Show both v1 and v2 columns. Report results at thresholds 0.5, 0.6 and 0.7. Case 18 and siblings (egm-review vs egm-review-loop) become an open problem, not "by design". |
| codebase-details-1-3, -1-4, -1-5, -1-6 | PROPOSE FIX | Rewrite §1 and §4 so they match what ran: MCP and hooks were live, one shared temp folder, 5 runs in parallel, OVERRIDES were used, `RULES_V2`. Add a reproduce section, regenerate stale outputs, and list every Artifact quickstart case. |
| design-1-7, implementation-readiness-1-4/-1-5/-1-6/-1-7/-1-8/-1-9 | PROPOSE FIX (after measurements) | Write a build plan once v1 is chosen. It covers files, the request literal, a failure-to-UX table, display (pane + atom, text fallback), fill rules with edge cases, tests, acceptance gates, a `router: generated\|static` rollback switch, and risks. Writing this before the choice would spec a design that may be dropped. |
| design-1-8 | PROPOSE FIX | Defer the fully generated router. Condition D only adds what the host leaves out. |
| design-1-9, codebase-details-1-7, -1-8, design-1-10, -1-11, -1-12 | PROPOSE FIX | Fix the figures: separate latency medians plus `duration_api_ms`, about 13.2k tokens, correct script attribution, case 20, count reconciliation, full miss split. |
| implementation-readiness-1-11 | DECLINE | Add one line noting the version. No action beyond that. |
