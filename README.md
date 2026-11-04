# Skill Whisper

A Claude Code mod for people with many skills installed. It does two jobs:

- It helps Claude pick the skill that fits a task, including skills Claude cannot start by itself.
- While you type, it suggests the skill that fits your draft and puts `/skill` at the start of your message when you ask.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install skill-whisper --marketplace 5842055734thperson/skill-whisper
```

From a shell:

```
claude plugin install skill-whisper --marketplace 5842055734thperson/skill-whisper
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `5842055734thperson/skill-whisper`, then **Add plugin**.

## What it does

- **Routing for manual-only skills.** Skills marked `disable-model-invocation: true` (for example the `egm` design skills, `/variant`, `/prototype`) cannot be started by Claude. Without help, Claude does that work itself instead of telling you the skill exists. Skill Whisper lists these skills separately and tells Claude to answer "run `/<name>`" rather than imitate them.
- **Restores dropped skill descriptions.** When many skills are installed, Claude Code lists some of them by name only. Skill Whisper fills short descriptions back into that list (`prompt.attachment` on `skill_listing`), within a size cap.
- **Suggestion while you type.** The skill that fits your draft shows in the status line, for example `💬 /dataviz — grafik ve gösterge paneli · sona ;; yaz` ("end with ;;"). It also shows as a button at the top of the `/whisper-ui` pane.
- **`;;` shortcut.** End your draft with `;;` and the suggested `/skill` is put at the start: `monthly revenue chart ;;` becomes `/dataviz monthly revenue chart`. If no skill fits, the text is left alone. The shortcut is typed text because the desktop app does not pass key combinations to mods.
- **Draft-safe pane (`/whisper-ui`).** Clicking a skill puts `/skill` in front of what you already typed. It does not erase it.
- **Levels.** `/whisper full` lets Claude invoke matching skills and shows suggestions. `/whisper lite` only suggests. `/whisper off` turns the mod off. `/whisper-help` lists the skills it knows.

In a terminal session there is also an inline dim hint and Tab completion. The desktop app does not draw these: we measured that it fires `prompt.edit` but paints no decorations and never fires `prompt.autocomplete`.

## Privacy

Everything runs locally. The mod reads `SKILL.md` front matter under your Claude config folder (`~/.claude/skills`, `~/.claude/plugins/cache`, `~/.claude/plugins/synced`) to learn skill names, descriptions and the manual-only flag. It calls no model and sends nothing anywhere.

## Limits

- The curated routing table (`hooks/catalog.ts`) was written for the author's set of skills. Skills you do not have are filtered out. Skills it does not list still get the manual-only routing and description restore, but no curated "when to use" line.
- Help and pane text are partly in Turkish.
- Matching while typing is keyword based, so it can miss or suggest the wrong skill.

## How it was built

The design, measurements and reviews are in [`docs/process/`](docs/process/), in this order:

1. `concepts_brief.md`: brainstorm brief, in Turkish, with the measured baseline.
2. `goldfish_brainstorm_report.md`: six independent reviewers on the first idea.
3. `test_report.md`: measurements of the old version against a Haiku-ranker prototype.
4. `goldfish_review_report.md`: review of that report, with how each finding was resolved.
5. `evaluation_and_plan.md` (Turkish) and `antigravity_review.md`: the next rounds.

Headline numbers, 30 prompts, `claude -p`, one run each:

| Setup | Model-invocable skills (16) | Manual-only skills (4) | Quiet on no-skill prompts (10) |
|---|---|---|---|
| No mod | 8 | 0 | 10 |
| Old routing table | 15 | 0 | 10 |
| Table with a manual-only section (6 of the 30 cases re-run, Sonnet) | — | 4 | — |

These are small samples (n = 1, prompts written by the author). Read the caveats in the reports before relying on them.

[`eval/`](eval/) holds the prompts, the scripts and the scored results. Raw run logs are not included: they contain the author's full session setup. `eval/rank.py` needs a `catalog.json`, which `eval/build_catalog.py` builds from your own install.

## Development

```
claude plugin validate .
claude plugin test .
```

## License

MIT
