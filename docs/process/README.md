# Process documents

How Skill Whisper was designed, measured and reviewed, in order:

1. [concepts_brief.md](concepts_brief.md): the brainstorm brief and the measured baseline.
2. [goldfish_brainstorm_report.md](goldfish_brainstorm_report.md): six independent reviewers on the first idea.
3. [test_report.md](test_report.md): the old v0.3 mod against a Haiku-ranker prototype.
4. [goldfish_review_report.md](goldfish_review_report.md): a review of that report, with how each finding was resolved.
5. [antigravity_review.md](antigravity_review.md): reviews of the v0.3.x and v0.4 reworks.
6. [evaluation_and_plan.md](evaluation_and_plan.md): the v0.4 fixes and the measurements, each in its own row.
7. [action_plan_v0.9.md](action_plan_v0.9.md): matcher fixes planned after an audit of all 143 skills on the author's install.

Reading notes:
- Until v0.6 the mod was called **skill-pilot**, with the commands `/pilot`, `/pilot-help` and `/pilot-ui`. It is now **skill-whisper**, with `/whisper`, `/whisper-help` and `/whisper-ui`.
- Line references such as `register.tsx:141` point to old versions that are not in this repository.
- Paths such as `out/run1/` refer to raw run logs. They are not published, because they contain the author's full session setup. The scored summaries are in [`../../eval/results/`](../../eval/results/).
- `hooks/catalog.ts`, the hand-written skill catalog these reports discuss, was removed in v0.8. The mod now builds its skill library from the installed `SKILL.md` files; only optional match words remain, in `hooks/aliases.ts`.
