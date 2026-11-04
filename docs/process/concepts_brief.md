# Skill Pilot v1: Skill Suggestions While Typing

* **Author:** 5842055734thperson
* **Date:** 2026-11-04
* **Raw review report:** [goldfish_brainstorm_report.md](goldfish_brainstorm_report.md) (6 of 6 reviewers completed; 7 🔴, 13 🟡, 9 🟢)

> Historical document. The mod was called **skill-pilot** at this stage. It was later renamed **skill-whisper**, and its commands became `/whisper`, `/whisper-help` and `/whisper-ui`. Several plans below changed after measurement. See the later reports in this folder.

## Overview

People install tens or even thousands of skills. Remembering and picking the right one while writing a prompt takes effort. Nothing is broken, but there is friction.

Skill Pilot v1 is a mod for the Claude Code desktop app, to be published on GitHub for anyone. While the user types, it shows the draft to a cheap model (Haiku), which suggests at most 3 installed skills with a short reason. If the user clicks one, `/skill-name` is put at the start of the draft. If not, nothing happens. The mod never starts a skill by itself.

The existing v0.2 (in the author's local mods folder) adds a hand-written, Turkish catalog of about 40 skills to the system prompt every turn, as a table. v1 replaces it.

## Focus (decided 2026-11-04)

The user named three things that matter. v1 focuses on them:
1. **Claude acts on its own even when the right skill is installed**, especially with skills that only the user can start (`disable-model-invocation`). This is the main problem to solve.
2. **In large catalogs, Claude's own skill list gets shortened.**
3. **The user wants to see the choice before sending.**

Other decisions:
- Turkish support is out of scope. Everything (prompts, descriptions, test set) is in English.
- The first version is a **`/pilot <text>` command**, not suggestions while typing.

## Baseline (measured, 2026-11-04)

**Setup:** 30 English prompts ([prompts.jsonl](../../eval/prompts.jsonl)), run with `claude -p` and skill-pilot off.
- Opus 5.5, 143 skills installed.
- At most 2 turns, tools that change things disabled.
- One run (n = 1). Variance was not measured.

| Group | Result |
|---|---|
| 16 prompts that need a skill the model can start | **8/16** called the right skill (teardown, better-colors, remove-animations, seo-audit, deploy-to-vercel, docx, break-ui, mobile-native) |
| 4 prompts that need a manual-only skill (egm-brainstorm, egm-draft, egm-review, variant) | **0/4**. Claude never once said "there is `/egm-brainstorm` for this". It did the work itself. |
| 10 prompts that need no skill | **10/10** stayed quiet (no false alarms) |

The 8 misses break down as follows:
- **In 4, it did the work itself.** It wrote the flowchart as plain Mermaid (diagram-design), reviewed accessibility itself (better-accessibility), rewrote the text itself (humanizer) and explained Bloom filters itself (learn).
- **In 3, the environment's Artifact rule took priority over the skill** (chart, landing page, slides: Artifact `quickstart` was called). This is a clash between environment instructions and the skill, not Claude acting on a whim. For the user the result is the same: the skill they wanted did not run.
- **In 1, it searched for files** (modal animation; the folder was empty).

**Catalog shortening (measured):** according to `/context`, 53 of the 125 listed skills reach the model **by name only, with no description**.
- The skill listing has a budget of about 10k tokens, and it is full.
- Skills that lost their description include `humanizer`, `pdf`, `pptx`, `ui-ux-pro-max:*` (slides included), `learning-framework:*`, most of `claude-seo:*`, `frontend-design` and `deep-research`.
- Two of the "did it itself" misses (humanizer, learn) are in the no-description group. The sample is small, so this does not show a link.

**Conclusion:** the "18 out of 20" goal is clearly above the baseline (baseline: 8/20, 0/4 on manual-only skills). Staying quiet is already 10/10, and the pilot must not break it.

## Analysis

### The real question: doesn't Claude already do this?
Claude Code already gives the main model the descriptions of installed skills, and the model picks skills itself. The pilot is only worth something when:
- the model cannot start the skill by itself (skills with `disable-model-invocation: true`, for example the egm skills);
- the catalog is so large that Claude's own list is shortened;
- the user wants to see the choice **before sending**.

So the success measure should not be "18 out of 20" but "beats Claude without the plugin by X". The 30 prompts should first be run without the plugin to get a baseline. The cheapest first try: improve the skill descriptions.

### Where to show suggestions (verified)
- `$.prompt.suggest` (a dim suggestion accepted with Tab) is hidden by the core while the box holds text, so it cannot show suggestions while typing.
- When a `prompt.autocomplete` row is chosen, it replaces only the word at the cursor. That does not fit the goal.
- The pane only appears in a wide window (about 144+ columns).
- **Main surface: the `AbovePrompt` band above the prompt box.** The pane is an optional detail view, and `$.ui.status` is the fallback.

### Clicking erases the draft (existing bug)
In v0.2, `register.tsx:141` calls `fill({ text: '/name ', mode: 'replace' })`, which erases the draft already typed. There is no prepend mode.

Fix: read the draft with `$.prompt.read()`, remove a leading `/command` if there is one, and replace the text with `'/name ' + rest`. If `isFilled: false` comes back, show a toast. This should be an acceptance test.

### Matching across languages
A keyword search finds almost no overlap between a Turkish request and an English description, and the host has no embedding API. Decision:
- Up to about 150–200 skills: the whole catalog goes to Haiku as one cached block, with no prefilter.
- More than that: a keyword prefilter, optionally with multilingual keywords generated once per skill.
- No embeddings or local model in v1.

### Typing speed
`prompt.edit` runs on every burst of keys, so waiting for a model call there would freeze typing.
- The hook returns `next(e)` at once, and the model call runs outside the hook after a 600–900 ms pause.
- On a new key, the old call is cancelled with `signal`, and answers for an older draft are dropped.
- The mod's own `fill` operations are ignored.

### Cost and privacy
- Unsent drafts go to the model on the user's own quota. The README must say this plainly, and the model step must be opt-in or show a visible marker.
- **When to call:** after about 800 ms of no typing, with at least 3–4 words, when the draft does not start with `/`, no turn is running and there is no cache hit.
- **Limits:** per-minute and daily caps, `effort: low`, `maxTokens ≈ 200`, a 3–4 s timeout.
- Drafts that look like secret keys are not sent.
- If the `haiku` alias does not resolve on Bedrock, Vertex or a gateway, the model step turns off for that session and the user is told.

### Skill list
Use `$.command.list()` instead of scanning folders: it gives resolved `plugin:skill` names and enabled state. Folder scanning stays only in the CLI and test tool, using only the newest version of each plugin. The list is built at session start, refreshed when needed, and rebuilt by hand with `/pilot-reindex`.

### "Suggest nothing"
- The model returns strict JSON: at most 3 picks, each with a confidence score. An empty list is valid.
- Names are checked against the catalog. The starting threshold is about 0.6.
- If the JSON is broken, nothing is shown.
- "No skill needed" and "suggestion service not working" are shown differently.
- The suggestion list updates only when the top pick changes, so it does not flicker.

### Prompt injection
Third-party skill descriptions may try to steer the model. Descriptions are wrapped in delimiters, each is capped at about 300 characters, and picks are checked against the catalog.

### Seeing why a skill was suggested
- Each suggestion row shows the reason and the source, and a "why?" view lists the candidates.
- A local trace log keeps only hashes, never the draft text.
- `/pilot-debug`, and `--explain` in the CLI.
- The `skill.prompt` event counts whether a suggested skill was actually used.

### Maintenance
The host API may change. Use as few APIs as possible, check at startup that each one exists, and state the minimum Claude Code version. No adapter framework for "every desktop agent" for now.

## Goals and Non-Goals

* **Goals:**
  - v1: a `/pilot <text>` command with at most 3 skill suggestions (manual-only skills and skills with shortened descriptions included). Suggestions in the `AbovePrompt` band while typing come in v2.
  - Clicking puts `/skill-name` at the start without erasing the draft.
  - An automatic skill list (`$.command.list()`), with no hand-written catalog.
  - Suggest nothing where nothing is needed.
  - Clear cost and privacy notice, limits, and a way to turn it off.
  - One pure function `rank(draft, skills, complete)`, plus a CLI as the test tool.
  - A clean migration from v0.2.
* **Non-goals (v1):**
  - Starting skills automatically.
  - Adapters for Codex, Cursor and others.
  - Embeddings or a local model.
  - Adding a routing table to the system prompt.
  - Sending telemetry to a server.

## Alternatives Weighed

- **Analyze after sending and ask the user:** makes the main model wait (1–3 s per message) or costs an extra turn. Rejected in favor of suggestions while typing.
- **A table in the system prompt, as in v0.2:** costs tokens every turn, does not scale to thousands of skills, and clashes with Claude's own choice. Rejected. *(Later measurements reversed this: the table nearly doubled correct skill use. See [test_report.md](test_report.md).)*
- **Local keyword/BM25 search only:** cheap, but cannot match a Turkish request with an English description. Rejected on its own. It remains as a prefilter for large catalogs.
- **Embedding search:** the host has no embedding API, and it would add a dependency. Left out of v1.
- **Local model (Ollama):** good for privacy, but a beginner cannot set it up. Left out of v1.
- **`$.prompt.suggest`, `prompt.autocomplete`, or only the pane:** these either do not work while typing or do not show in a narrow window (see above). The `AbovePrompt` band was chosen.
- **`$.model.classify`:** `complete` with strict JSON fits better, because it allows a reason and a "none" answer.
- **A host-independent adapter framework from the start:** premature abstraction. One pure function is enough.
- **A cheaper first try (not decided yet):** suggestions only on request, through a `/pilot <text>` command, not while typing. Tests the idea with the least code.

## Decisions and Next Steps

1. **The baseline is measured** (above): 8/20, 0/4 on manual-only skills, 10/10 quiet. Still to do: the median of 3 runs, prompts written by other people, and near-miss negatives. No Turkish prompts are needed.
2. **Success measure** for `/pilot <text>`:
   - the right skill in the top 3 for at least 18/20 prompts (manual-only skills included);
   - "no skill needed" for at least 9/10 of the prompts that need none.

   Latency and cost are recorded too.
3. **v1 = the `/pilot <text>` command:**
   - all skills through `$.command.list()`, including those with shortened descriptions and manual-only ones;
   - at most 3 suggestions from Haiku;
   - a click puts `/skill` at the start of the draft.

   Suggestions while typing move to v2.
4. **v0.2 migration:**
   - `CATALOG`, `ROUTES`, `SECTION` and the `prompt.compose` hook are removed.
   - The new setting is kept under a new key (`enabled`), and `level` is kept for rollback.
   - Decide what happens to the `/pilot`, `/pilot-help` and `/pilot-ui` commands.
   - The local copy and the published plugin are never installed at the same time.
5. **To verify at runtime:**
   - what `command.list()` returns;
   - whether Claude's own skill list is shortened in large catalogs;
   - Haiku latency and the minimum cache size;
   - a timer outside a hook inside the mod (`$.clock`);
   - `$.fs` access under the sandbox.
6. **Open question:** when the Artifact rule and a skill clash (chart, page, slides), which should the pilot suggest? The environment instruction comes before the skill. The pilot cannot change that; it can only show the user both paths.
