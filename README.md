<h1 align="center">💬</h1>

<h1 align="center">skill-whisper</h1>

<p align="center">Suggests the right installed skill while you type, and makes Claude point you to skills it can't start itself.</p>

<p align="center">
  <a href="https://www.buymeacoffee.com/5842055734thperson"><img alt="Buy Me a Beer" src="https://img.shields.io/badge/Buy%20Me%20a%20Beer-ffdd00?logo=buymeacoffee&logoColor=black"></a>
</p>

Skill Whisper is a Claude Code mod for people with many skills installed. It reads the skills on your machine, suggests the one that fits your draft, and puts `/skill` at the start of your message when you type `;;`. It also tells Claude which skills are manual-only, so Claude says “run `/name`” instead of doing that work itself.

## Install the mod

Install it from this repository with one command. At the prompt of a Claude Code terminal session, run:

```text
/plugin install skill-whisper --marketplace 5842055734thperson/skill-whisper
```

From a shell, run:

```bash
claude plugin install skill-whisper --marketplace 5842055734thperson/skill-whisper
```

In the Claude desktop app, where `/plugin` doesn't run, use the plugin menu:

1. Click **+** next to the prompt box, then **Plugins**.
2. Click **Add marketplace** and enter `5842055734thperson/skill-whisper`.
3. Click **Add plugin** and pick **skill-whisper**.

The mod starts at the `full` level. Your status line shows `💬 whisper: full` once it's active.

## Commands

All commands start with `/whisper`. The level you pick is saved and kept in later sessions:

| Command | What it does |
|---|---|
| `/whisper` | Shows the current level. |
| `/whisper full` | Claude invokes a matching skill, names manual-only skills, and you get suggestions while you type. |
| `/whisper lite` | Claude only suggests a skill in one line and asks before using it. No suggestions while you type. |
| `/whisper off` | Turns the mod off. Nothing is added to Claude's context. |
| `/whisper-help` | Lists your installed skills, grouped by plugin, with a short description of each. |
| `/whisper-ui` | Opens the control center pane: level buttons, the current suggestion, and every skill as a button. |

Clicking a skill in the pane puts `/skill` in front of what you already typed. It doesn't erase your draft.

## Typing shortcut

End your draft with a space and `;;` to put the suggested skill at the start of your message. This works at the `full` level. With a chart skill such as `dataviz` installed:

```text
monthly revenue chart ;;
```

becomes:

```text
/dataviz monthly revenue chart
```

While you type, the status line shows the current suggestion, for example `💬 /dataviz · charts and dashboards · end with ;;`. The skill names you see depend on what you have installed. Manual-only skills are tagged `[manual]`. If no skill fits, `;;` leaves your text alone. A lone search like `/grafik ;;` becomes `/dataviz `.

Suggestions appear on their own only for task-like drafts: questions (“what does…”, “nedir”) get no hint, and a weak match needs an action word such as *make*, *draw* or *çiz*. `;;` skips that check, because you asked. It also never fires inside a fenced code block or on shell lines like `echo x;;`, since it needs a space before it.

The shortcut is typed text because the Claude desktop app doesn't pass key combinations to mods. In a terminal session you also get a dim inline hint and Tab completion.

## How the skill library is built

The mod builds its list from what's installed, so it works with your own skills and needs no setup. At session start it:

1. Reads every `SKILL.md` under `~/.claude/skills`, `~/.claude/plugins/cache` and `~/.claude/plugins/synced`.
2. Takes each skill's name, description, and `disable-model-invocation` flag (the manual-only flag).
3. Keeps only skills that appear in Claude Code's list of installed commands, and groups them by plugin.

Install or remove a skill, then run `/reload-plugins` to refresh the list in the current session.

The same list feeds two changes to what Claude sees:

- **Manual-only list**: added to Claude's context, with the rule “tell the user to run `/name`; don’t do its work yourself”
- **Restored descriptions**: when Claude Code shortens its skill list and drops descriptions, the mod puts short descriptions back, within a size cap

## Add your own match words

Suggestions while you type match your words against skill names and descriptions, so English works best. To add words for a skill, edit [`hooks/aliases.ts`](hooks/aliases.ts):

```typescript
export const ALIASES = {
  "dataviz": ["chart", "dashboard", "grafik"],
}
```

An entry is used only when that skill is installed. The file ships with English and Turkish words from the author.

## Privacy

Everything runs on your machine. The mod reads `SKILL.md` front matter in your Claude config folder. It calls no model, and it sends nothing over the network.

## Preliminary results

These numbers are an early check, not a benchmark. Each setup ran the same 20 prompts with `claude -p`, Opus 5.5, and at most 2 turns. Of those, 16 need a skill that Claude can start, and 4 need a manual-only skill. The no-mod and v0.3 runs also included 10 prompts that need no skill, and both stayed quiet on all 10; v0.8 was not run on those 10, so its false-alarm rate is unknown:

| Setup | Skill invoked (of 16) | Manual skill named (of 4) |
|---|---|---|
| No mod | 8 | 0 |
| v0.3, hand-written routing table | 15 | 0 |
| v0.8, library built from installed skills | 15 | 3 |

In v0.8, the one auto miss (a slide deck) went to the host's Artifact tool, and the one manual miss (a design doc) went to the `docs` skill instead of `/egm:egm-draft`.

Each setup ran once, on prompts the author wrote, so treat the results as preliminary. The [process documents](docs/process/README.md) list the caveats. To run the measurements on your own install, see [`eval/README.md`](eval/README.md).

## Known limits

These gaps are known and not fixed yet:

- Claude Code's built-in skills that have no `SKILL.md` file (for example `loop` and `schedule`) aren't suggested while you type. Claude still sees them in its own skill list.
- Matching while you type uses keywords, so it can miss a skill or suggest the wrong one. A v0.8.3 audit found three common cases, all fixes planned in [`docs/process/action_plan_v0.9.md`](docs/process/action_plan_v0.9.md):
  - **Missed hints on real requests**: a question word anywhere in the draft hides the hint, so “my animation is janky, make it 60fps” and Turkish drafts with *iş* get none
  - **False hints from one common word**: words that are also part of a skill name, such as *local*, *native*, *import* or *plan*, can show an unrelated skill
  - **Turkish drafts**: skills with no Turkish alias are found only from English words
- The false-alarm rate on prompts that need no skill wasn't re-measured for v0.8.
- Tested with Claude Code 2.1.316 on Windows.

## Develop and test

Clone the repository and run the checks from its root. The tests use a fake skill install, so they don't depend on your machine:

```bash
claude plugin validate .
claude plugin test .
```

To load your working copy into a session instead of the installed version, start Claude Code with `claude --plugin-dir .`.

## Project history

The design, measurements and reviews behind each version are in [`docs/process/`](docs/process/README.md). The mod was called skill-pilot until v0.6.

## Support the project

Skill Whisper is free and MIT-licensed. If it saves you time, you can [buy me a beer](https://www.buymeacoffee.com/5842055734thperson). Bug reports and pull requests help too.

## License

[MIT](LICENSE)
