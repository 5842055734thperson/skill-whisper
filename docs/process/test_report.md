# Skill Pilot: Test Report

* **Author:** 5842055734thperson
* **Date:** 2026-11-04
* **Purpose:** measure how well the current mod (v0.3) works, test the planned `/pilot <text>` command before building it, and list what to fix. The mod will be built from this report.

## 1. Setup

- **Prompts:** 30 English requests in [prompts.jsonl](prompts.jsonl).
  - 16 need a skill that the model can start by itself.
  - 4 need a manual-only skill (`disable-model-invocation`): `egm:egm-brainstorm`, `egm:egm-draft`, `egm:egm-review`, `variant`.
  - 10 need no skill.
  - Some prompts accept more than one correct skill.
- **Environment:** Claude Code 2.1.316, main model Opus 5.5, 143 skills installed.
- **Headless runs:** `claude -p`, at most 2 turns. Tools that change things (Bash, Write, Edit, Agent, web) are disallowed. Each run starts in an empty folder.
- **Three conditions:**
  - **Baseline:** skill-pilot turned off ([run_baseline.py](run_baseline.py) `run1`).
  - **v0.3 mod on:** the current mod at level `full`. It adds a hand-written routing table of about 40 skills to the system prompt every turn and tells the model to invoke a matching skill ([run_baseline.py](run_baseline.py) `pilot_v03 pilot`).
  - **`/pilot` prototype:** a cheap model gets the full catalog and the request, and returns up to 3 skills as JSON ([rank.py](rank.py)).
    - The catalog is built by [build_catalog.py](build_catalog.py): 143 skills, 15 of them manual-only, with descriptions cut to 300 characters.
    - The model is called through `claude -p --model haiku` with no tools, no plugins and a custom system prompt.
    - A pick is shown when its confidence is 0.6 or higher.
- **Catalog truncation:** measured with `/context` in a fresh session.

## 2. Results

| Condition | Auto skills (16) | Manual skills (4) | Quiet on no-skill (10) | Notes |
|---|---|---|---|---|
| Baseline (pilot off) | 8 invoked | 0 named | 10 | The model did the task itself in 4 cases |
| v0.3 mod on | **15 invoked** | 0 named | 10 | Its table lists egm skills, but the model never told the user about them |
| `/pilot` prototype, Haiku, rules v1 | 14 in top 3 | 2 in top 3 | 10 | Too cautious: returned no picks for humanizer, learn, brainstorm |
| `/pilot` prototype, Haiku, rules v2 | 15 in top 3 | 3 in top 3 | 10 | Rules were loosened **after seeing v1's misses on this same set** |

The `/pilot` rows count a hit when the right skill appears among the shown picks (top 3). On the 20 skill prompts, rules v2 had 18 in the top 3 and 17 at top 1.

**Prototype latency and cost (Haiku through the CLI):**
- Median 7–8 s per call, max 12.5 s.
- About 0.0027 USD per call. The catalog is about 40,000 characters, roughly 10,000 tokens.
- Most of that time is the CLI process starting up. A call from inside the mod (`$.model.complete`) was **not measured**.

**Catalog truncation in a normal session:**
- Of the 125 skills Claude lists for the main model, 53 are listed by name only, with no description.
- The skill listing has about a 10,000-token budget, and it is full.
- Skills that lose their description include `humanizer`, `pptx`, `pdf`, all `ui-ux-pro-max:*`, all `learning-framework:*`, and most `claude-seo:*`.

### Per-case misses

| # | Expected | Baseline | v0.3 | `/pilot` v2 |
|---|---|---|---|---|
| 1 | diagram-design | wrote plain Mermaid | ✔ | ✔ |
| 2 | dataviz | Artifact quickstart | ✔ | ✔ |
| 4 | hallmark / frontend-design | Artifact quickstart | ✔ | ✔ |
| 5 | better-accessibility | reviewed it itself | ✔ | ✔ |
| 7 | animate | searched for files | ✔ | ✔ |
| 9 | humanizer | rewrote it itself | ✔ | ✘ (no pick) |
| 10 | learn | explained it itself | ✔ | ✔ |
| 13 | slides / pptx | Artifact quickstart | Artifact quickstart | ✔ (pptx) |
| 17 | egm-brainstorm (manual) | brainstormed itself | brainstormed itself | ✔ (0.6) |
| 18 | egm-draft (manual) | Artifact doc | Artifact doc | ✘ (`docs` 0.85) |
| 19 | egm-review (manual) | searched for files | searched for files | ✔ |
| 20 | variant (manual) | asked for the file | asked for the file | ✔ |

## 3. What the numbers say

1. **A routing hint in the system prompt nearly doubles skill use** (baseline 8/16 → v0.3 15/16). The main model's own choice is the weak point. Knowledge of the skills is not.
2. **v0.3 does nothing for manual-only skills (0/4).**
   - The model cannot invoke them, and nothing in the table tells it to mention them.
   - It did the work itself: it ran its own brainstorm instead of pointing to `/egm-brainstorm`.
   - This is the gap you named first. It is now measured.
3. **Only `/pilot` reaches manual skills (2–3 of 4)**, because it shows the user a choice before the main model acts.
4. **Environment rules beat skills.** The host's Artifact rules send charts, pages, slides and documents to Artifact quickstart before any skill. v0.3 lost case 13 this way, and every condition lost case 18 this way. No mod can change that order; it can only show both paths to the user.
5. **No condition produced a false alarm** (10/10 everywhere). The no-skill prompts may be too easy, see the caveats below.

## 4. Caveats (read before trusting the numbers)

- **n = 1 run per condition.** Variance was not measured.
- **The test set favours v0.3.** The author wrote the prompts, and 15 of the 16 auto-skill targets are skills in v0.3's hand-written table. The one that is not, `docx`, was still invoked. v0.3's 15/16 says little about the other ~100 skills its table does not list.
- **Rules v2 were tuned on the test set.** Its 18/20 is an optimistic number. It needs a held-out set.
- **The no-skill prompts are easy** (unit conversion, trivia). There are no near-miss prompts, for example "explain this CSS" next to a CSS-review skill.
- **The latency number is the CLI's**, not the mod's.
- **The prototype used SKILL.md files from disk.** About 20 built-in skills have no file, so the prototype gave them empty descriptions. The real mod gets names and descriptions from `$.command.list()`. Whether that call returns descriptions has not been checked.

## 5. Improvements, and how to solve each

| # | Problem | Fix | Effort |
|---|---|---|---|
| I1 | Manual-only skills are never surfaced (0/4 in v0.3) | `/pilot <text>` ranks the full catalog, including manual skills; the user clicks one and the draft becomes `/skill <text>`. Also add one line to the router section: "If a [manual] skill fits, tell the user to run `/name`; do not do its work yourself." Cheap, and testable on the same 4 prompts. | S |
| I2 | The routing table is hand-written (40 of 143 skills) | Generate it from `$.command.list()` at session start. Keep the auto router (it is what produced 15/16) but list only names plus a short "when" per skill, grouped, with a token cap. Measure the token cost against the 10,000-token skill budget. | M |
| I3 | 53 of 125 skill descriptions are dropped by the host | The mod cannot change the host's listing. `/pilot` sidesteps it, because the cheap model sees every description. Check whether `prompt.compose` exposes the skills section; if it does, the generated router (I2) can carry short "when" lines for the dropped ones. | S to check |
| I4 | Haiku is too cautious with "small task" requests | Use rules v2, but validate on a **new held-out set** of 30 prompts written by someone else and covering skills outside v0.3's table. Report the median of 3 runs. | S |
| I5 | Clicking a pane skill wipes the draft (`register.tsx:141`, `mode: 'replace'`) | Read the draft with `$.prompt.read()`, strip any leading `/cmd`, and fill `'/name ' + rest`. Add a test. | S |
| I6 | Artifact rules override skills (cases 13, 18) | When a pick is a chart, page, slide or document skill, `/pilot` shows a note: "This host also has an Artifact type for this; name the skill to use it instead." No routing change. | S |
| I7 | Latency of 7–8 s through the CLI | Measure `$.model.complete({ model: 'haiku' })` inside the mod. Cache the catalog block (`cache: true`). If it is still over 3 s, show a "thinking…" status and allow cancel. | S to measure |
| I8 | Picks that differ only by tool (`docs` vs `egm-draft`) | Show all three picks with their reasons. Do not auto-pick. The user decides. This is already the design. | none |

## 6. Recommended v1

Two parts, both in the existing mod:

1. **Auto router (kept from v0.3, made automatic).**
   - The table is generated from `$.command.list()` (I2).
   - It gets the manual-skill line (I1).
   - Levels: `full` invokes, `lite` suggests, `off`.
2. **`/pilot <text>`.**
   - Haiku ranks the whole catalog using rules v2.
   - It shows up to 3 picks with reasons in the pane or as command output.
   - Clicking a pick fills `/skill <text>` without wiping the draft (I5), and the user sends it.
   - Picks that touch an Artifact type carry the note from I6.

Out of v1: suggestions while typing, adapters for other hosts, local models.

## 7. Next measurements

1. A held-out set: 30 new prompts covering skills outside v0.3's table and including near-miss negatives. Run 3 times per condition and report medians.
2. Re-run the v0.3 condition with the manual-skill line (I1) added.
3. Measure the latency of `$.model.complete` from inside the mod.
4. Check what `$.command.list()` returns (does it include descriptions?) and whether `prompt.compose` exposes the host's skills section.
