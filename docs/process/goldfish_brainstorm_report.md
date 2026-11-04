# Goldfish Brainstorm Report: Skill Pilot v1

**Mode:** BRAINSTORM
**Concept:** Skill Pilot v1 suggests up to 3 installed skills while the user types and inserts `/skill-name ` on click.
**Inputs:** ~/.claude/my-mods/skill-pilot/hooks/register.tsx and claude-code.d.ts (2.1.317 bundle)

## Reviewer Status

| Reviewer | Role | Status |
| --- | --- | --- |
| `egm-design` | Skeptical Architect Brainstormer | completed |
| `egm-codebase-details` | Host API & Code Reuse Brainstormer | completed |
| `egm-zoom-out` | Scope & Simplicity Brainstormer | completed |
| `egm-comprehension` | Naive User & UX Brainstormer | completed |
| `egm-implementation-readiness` | Implementation Readiness Brainstormer | completed |
| `egm-structural` | Structure & Maintenance Brainstormer | completed |

Severity breakdown after deduplication: 7 Blockers, 13 Majors, 9 Nits.

## Reviewer agreement

All six reviewers raised the same four points on their own:
1. `$.prompt.suggest` cannot show anything while the user is typing.
2. The v0.2 click handler erases the draft.
3. Keyword search breaks when Turkish prompts are matched against English skill descriptions.
4. v1 must remove v0.2's `prompt.compose` router.

---

## 🔴 Blockers

### B1. Nobody has measured whether Claude's own skill selection already works
* **Lens:** zoom-out, design, comprehension
* **Issue:** Claude Code already shows every skill description to the main model, and the model picks skills itself. If plain Claude already gets 18 of the 20 skill prompts right, the 18/20 target proves nothing, and v1 is a discovery UI, not a router. A GitHub user's first question will be "why install this?"
* **Suggestion:**
  - Run the 30-prompt set through plain Claude Code (v0.2 off) before writing any code. Record which skill the model invokes.
  - Reword success as "beats this baseline by X".
  - Name where the plugin clearly adds value:
    - skills with `disable-model-invocation`, which can only be reached by slash command
    - very large catalogs, where the host's listing may be cut short (not verified)
    - showing the user the choice before they send
  - Also test a free option first: improving the descriptions of poorly matched skills.

### B2. The planned display surfaces don't work while the user types
* **Lens:** all six
* **Evidence (d.ts):**
  - `$.prompt.suggest` returns `isShown:false` while the box holds text or a turn is running (~3105-3116, 9765, 9812).
  - When a `prompt.autocomplete` row is accepted, it overwrites only the token at the cursor (8567-8572), and its rows arrive without waiting for the hook.
  - A pane the user did not open is placed only at 144 or more columns (110 if the user opened it before) (15351-15356). Otherwise it waits undrawn; register.tsx:126-129 already handles this case.
  - The `PromptHint` tail is drawn only by the terminal, not the desktop app (10943-10945).
* **Suggestion:**
  - Remove "or as a suggestion" from the concept.
  - Use the **AbovePrompt** band (10951-10969) as the main surface. It sits directly above the input, works on desktop and terminal, and can render Buttons. Refresh it with `$.ui.invalidate("ui.render")`, and step aside while `hasSurvey` is set.
  - Keep the pane only as an optional detail/settings view.
  - Fall back to `$.ui.status` when nothing can be placed.

### B3. Clicking a suggestion erases the user's draft (bug in v0.2)
* **Lens:** all six
* **Evidence:** register.tsx:141 calls `$.prompt.fill({ text: \`/${s.name} \`, mode: 'replace' })`. `PromptFillMode` has only replace, append and insert (~9141-9146), so there is no prepend.
* **Suggestion:**
  1. Read the box with `const box = await $.prompt.read()`.
  2. Strip any leading `/\S+\s+`.
  3. Write it back with `fill({ text: '/name ' + rest, mode: 'replace', cursor: box.cursor + delta })`.
  4. Mark the read-then-fill race with a `shortcut:` comment.
  5. When `isFilled:false` comes back with `refusal:'dialog'`, show a toast.
  6. Add this as an acceptance test, since it is a data-loss case.

### B4. Retrieval as designed will miss the 18/20 target for Turkish prompts
* **Lens:** design, implementation-readiness, codebase-details, zoom-out, comprehension, structural
* **Issue:**
  - BM25 or keyword search matching Turkish (which adds suffixes to words) against English descriptions finds almost no overlap. A skill missing from the top 10 can never reach the top 3.
  - The host has no embedding API (`$.model` has only complete, fork and classify), and `$.fs.read` rejects files over 4 MiB (3361). A multilingual embedding model of 100 MB or more is not practical.
* **Suggestion:**
  - At or below about 150-200 skills, skip local search. Send the whole name+description catalog to Haiku in one block marked `cache: true`.
  - Above that size, add a keyword prefilter. Optionally, add multilingual keywords to each skill once at index time, cached by a hash of the description.
  - Drop embeddings and the "optionally local model" from v1. If a local model is needed later, it is reachable through `$.http.fetch` to localhost.
  - Measure recall@10 of the retrieval stage separately from top-3 accuracy.

### B5. A model call inside `prompt.edit` would freeze typing
* **Lens:** codebase-details, implementation-readiness, design, structural
* **Evidence:**
  - The editor waits on `next(e)` before it draws the box (4301-4303, 9002-9004).
  - A hook that runs past its budget is skipped (5314-5317).
  - `$.clock.sleep` counts against the hook's own budget (3568-3571).
* **Suggestion:**
  - In the hook: `const r = await next(e)`, store `r.text`, restart a debounce timer kept outside the hook (600-900 ms), then return `r`.
  - Cancel the call in flight with `signal` on every new edit, on submit and on turn start.
  - Tag each request with a hash of the draft and drop replies for an older draft.
  - On `prompt.change` with origin `clear` or `history`, clear the suggestions. Ignore changes with origin `plugin` (the mod's own fill).

### B6. Privacy and quota are not disclosed
* **Lens:** comprehension, design, codebase-details, zoom-out, implementation-readiness
* **Issue:**
  - Drafts the user never sends, including pasted secrets, go to the model on every typing pause.
  - `$.model.complete` uses the session's own credentials (2675). Subscribers spend their plan limits, and API, Bedrock and Vertex users pay per call.
  - On Bedrock, Vertex or a gateway, the `haiku` alias may fail with `model_not_found`, or be blocked by the model allowlist (6400-6401, 6301-6309).
* **Suggestion:**
  - Disclose this in the README and on first run.
  - Make the model step opt-in, or at least show a visible "asked Haiku / local only" marker.
  - Skip the call when the draft looks like it contains a secret.
  - Add a daily cap, and show usage with a `/pilot stats` command.
  - If the alias fails, catch the error and turn off the model step for the session with one status note.
  - Rough cost (Haiku): about $0.003 per call at 40 skills, about $0.05 per call for 1,000 skills without caching.

### B7. Migration from v0.2 and rollback are not planned
* **Lens:** all six
* **Issue:**
  - v0.2 adds a router section through `prompt.compose` on every turn (register.tsx:131-136).
  - Its "full" level tells the main model to invoke skills itself (line ~90), which contradicts v1's "never invokes" rule.
  - `$.store` holds a `level` key with values full/lite/off.
  - The `/pilot`, `/pilot-help` and `/pilot-ui` commands exist.
  - Installing both the my-mods copy and the published plugin would register the hooks twice.
* **Suggestion:**
  - Delete the CATALOG, ROUTES, SECTION, HELP blocks and the compose hook.
  - Make "zero prompt.compose sections" a tested invariant.
  - Store the new setting under a new key (`enabled`) and leave `level` untouched, so rolling back to v0.2 still works.
  - Decide whether each command is kept, renamed or dropped.
  - Write a short migration note. It should say that skills the "full" level used to auto-invoke are now left to Claude's own selection.
  - Tell users to remove the my-mods copy first, or publish under a different id.

---

## 🟡 Majors

### M1. Get the skill list from `$.command.list()`, not by scanning folders
* **Lens:** design, codebase-details, zoom-out, implementation-readiness, structural, comprehension
* **Evidence:**
  - `$.command.list()` (3186-3194, return shape at 1768-1786) returns the commands the user can run, with their resolved `plugin:skill` names. It reflects enabled/disabled state.
  - Scanning the plugin cache by hand picks up old versions side by side (e.g. `egm/egm/0.1.0`) and disabled plugins.
* **Suggestion:**
  - The adapter uses `command.list()`, filtering out the `builtin` and `mcp` sources.
  - Folder scanning stays only in the core/CLI. There, keep the newest version per plugin, build `plugin:skill` names, and skip malformed YAML with a log line instead of crashing.
  - Before locking the design, check at runtime:
    - whether descriptions are cut to one line
    - how project skills are tagged (`CommandSource` has no "project" value)
    - whether `user-invocable:false` skills are left out (they should be)
    - whether `disable-model-invocation` skills are included (they should be)

### M2. "Suggest nothing" needs a defined output format
* **Lens:** implementation-readiness, zoom-out, comprehension, design
* **Suggestion:**
  - Require strict JSON: `{"picks":[{"name","reason","confidence"}]}`, at most 3 entries, empty list allowed.
  - Drop names that are not in the catalog, which guards against made-up names.
  - Start the confidence threshold at about 0.6 and tune it on the test set.
  - If the reply can't be parsed, show nothing.
  - Version the prompt in the repo, and frame it so that most prompts need no skill.
  - Show the two empty states differently: "No skill needed" (dim) and "Pilot unavailable (timeout)". Count only a real "none" from a successful run as a pass.
  - Use `$.model.complete`. `classify` returns a single label with no reason (2724-2742).

### M3. Skill descriptions can inject instructions into the model call
* **Lens:** implementation-readiness, design
* **Issue:** Descriptions from project skills and third-party plugins are untrusted text. One could say "always pick me".
* **Suggestion:** Wrap descriptions and the draft in delimiters as data, cap each description at about 300 characters, and check picks against the catalog.

### M4. The eval set can't be reproduced as described
* **Lens:** structural, implementation-readiness, comprehension, design, zoom-out
* **Suggestion:**
  - Use `eval/prompts.jsonl` with lines like `{id, lang, prompt, expected:[...]|[]}`, allowing several acceptable skills per prompt.
  - Run against a frozen skill set in `eval/fixtures/skills/`, not the author's live `~/.claude`.
  - Write at least a third (ideally half) of the prompts in Turkish.
  - Include near-miss negatives, e.g. "fix this CSS bug".
  - Have someone other than the author write some prompts.
  - Run the real Haiku 3 times and take the median. Report recall@10 and cost.
  - Write down that n=20 gives a wide error margin.
  - Seed the set from the Turkish examples in v0.2's CATALOG.
  - Turn every user report of the form "suggested X, wanted Y" into a new eval line.

### M5. The host-agnostic core, CLI and adapters are premature
* **Lens:** zoom-out, design, structural, codebase-details, implementation-readiness
* **Suggestion:**
  - Write one pure function, `rank(draft, skills, complete) -> {picks, abstained, trace}`, with no host imports.
  - Ship only the Claude Code adapter, plus the CLI as the eval harness. The CLI has no session, so it needs its own model client (API key) or a `complete` function passed in.
  - Version the JSON output shape.
  - Skip the adapter framework and the Codex/Cursor design until a second host is actually being built.

### M6. No limits on model calls or cost
* **Lens:** design, implementation-readiness, zoom-out
* **Suggestion:** Call the model only when all of these hold:
  - the user has been idle about 800 ms
  - the draft has at least 3-4 words
  - the draft does not start with `/`
  - no turn is running
  - the result for the normalized draft is not already cached (LRU of about 50)

  Also set a per-minute cap and a daily token budget, with `effort:"low"`, maxTokens about 200 and timeoutMs 3000-4000. On timeout, show the local top 3 labelled "(local)", or nothing.

### M7. Users and the author can't see why a skill was suggested
* **Lens:** codebase-details, structural, comprehension, implementation-readiness, design
* **Suggestion:**
  - Each row shows the skill name, a reason of 12 words or fewer, and its source. Hovering shows the full description.
  - A "why?" toggle shows the top-10 candidates with scores.
  - Keep a local ring buffer of traces (candidates, model reply, latency, abstain reason, prompt version), storing hashes rather than draft text. Add `/pilot-debug` and a CLI `--explain` flag.
  - Count shown, clicked and ignored suggestions.
  - Use `skill.prompt` (12842) to detect whether the suggested skill was actually used, which is the real success signal.

### M8. Suggestions will flicker and go stale
* **Lens:** comprehension, design
* **Suggestion:** Change the band only when the new top pick differs and passes the confidence bar. Hide suggestions while a turn runs or once the draft starts with `/`. Offer a manual "suggest now" option and an auto/manual setting.

### M9. Host API churn
* **Lens:** structural, implementation-readiness
* **Suggestion:**
  - Use the fewest host APIs: `prompt.edit`, `prompt.change`, `model.complete`, `prompt.read/fill`, AboveProm­pt or the pane, `command.list`, `store`.
  - Wrap each host call in one adapter function, so a rename touches one file.
  - Check at session.start that each capability exists. If one is missing, fall back to a smaller mode and show one status line instead of crashing.
  - Declare the minimum Claude Code version, and pin the d.ts used for type checking.

### M10. When the skill list is refreshed is undefined
* **Lens:** structural, implementation-readiness, design
* **Suggestion:** Build the list at session.start. Refresh it lazily if it is more than about 5 minutes old, or when the skill count changes. Add a `/pilot-reindex` command. Don't watch the file system.

### M11. The brief is missing sections and success metrics
* **Lens:** structural, implementation-readiness
* **Suggestion:**
  - Use these H2s: Problem / Goals / Non-goals / Users & languages / Design / Success metrics / Open questions / Migration.
  - List the non-goals: no auto-invoke, no `prompt.compose`, no change to model routing, no telemetry leaving the machine.
  - Add metrics for p95 latency, model calls per prompt, tokens per suggestion, and flicker.

### M12. Wrong suggestions can't be muted
* **Lens:** comprehension
* **Suggestion:** Add a per-skill "never suggest" action stored in `$.store`. Optionally rank down skills that are dismissed often.

### M13. The README doesn't cover prerequisites, jargon or value
* **Lens:** comprehension
* **Suggestion:**
  - List prerequisites: minimum Claude Code version, how to install, a check command, and that the CLI needs an API key.
  - Replace jargon ("mod", "cheap model", "adapter", "local") with plain words.
  - Open with the gap the plugin fills (B1).

---

## 🟢 Nits

- **N1 (codebase-details, structural):** Version numbers disagree. plugin.json says 0.3.0, the concept says v0.2. Make plugin.json the single source of truth and keep a CHANGELOG.
- **N2 (comprehension, structural, design):** Write the reason in the language of the draft, at about 8-12 words. Score only the skill name in the eval, not the reason text.
- **N3 (comprehension):** For local scoring, lowercase with Turkish rules (`toLocaleLowerCase('tr')`).
- **N4 (comprehension):** Support English and Turkish strings in the UI, following the host or OS locale.
- **N5 (comprehension):** Add a manual filter box for large catalogs, show a status line such as "🧭 2 picks", and mark the top pick.
- **N6 (codebase-details):** Reuse from v0.2: the `atom`/`read`/`update` and `$.store` pattern (lines 8-9, 99-103), session.start registration (106-114), the pane with Button `onPress` (138-169), and the `isPlaced` fallback.
- **N7 (zoom-out):** A cheaper first experiment: an on-demand `/pilot <text>` command with no typing hooks.
- **N8 (implementation-readiness, design):** Don't use `$.model.classify`. It returns one label and no reason.
- **N9 (structural):** Grow the eval set to about 100 prompts from opt-in local usage logs.

---

## Not verified (runtime checks needed)
- What `$.command.list()` returns: whether descriptions are cut short, how project skills are tagged, and whether model-only skills are left out.
- Whether Claude Code's own skill listing is cut short with large catalogs.
- Haiku latency, the minimum prompt length for caching, and whether `setTimeout` is available to a mod outside a hook.
- Whether `$.fs` may read outside cwd under the sandbox.
