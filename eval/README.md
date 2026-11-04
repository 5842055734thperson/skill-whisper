# Evaluation

Scripts that measure whether Claude picks the right skill, with and without the mod. Each run calls `claude -p`, so it uses your own Claude quota.

## Files

- `prompts.jsonl`: 30 prompts. 16 need a skill the model can start, 4 need a manual-only skill, 10 need no skill. `expect` lists the accepted skills.
- `held_out_prompts.jsonl`: 10 more prompts aimed at skills outside the curated table, plus near-miss negatives.
- `results/`: scored summaries of the author's runs. The raw logs are not published.

Your results will differ from the author's if your installed skills differ.

Known bias: `hooks/aliases.ts` was written by the author who also wrote these prompts, and several held-out prompts (`pdf`, `xlsx`, `pick-ui-library`, `prototype`, `egm-drift-report`) use words that are in it. Prompts written by someone else would be a fairer test.

## Runs

Run these from the repository root.

1. Baseline with the mod turned off, then with it on. `SKILL_WHISPER_ID` is the id of your installed copy; the default is `skill-whisper@skill-whisper`.

   ```
   python eval/run_baseline.py run1
   python eval/run_baseline.py with_mod pilot
   ```

2. The mod loaded from this repository (`--plugin-dir`), with any installed copy turned off. `--smoke` runs 4 cases on Sonnet; `--full` runs all 40 on Opus.

   ```
   node eval/run_mod_eval.mjs --smoke
   ```

3. Optional: the Haiku ranker prototype, which was not shipped. First build a catalog of your installed skills from any run's log, then rank.

   ```
   python eval/build_catalog.py eval/out/run1/01.jsonl
   python eval/rank.py haiku run1
   ```

Outputs go to `eval/out/` and `eval/out_mod_*`, which git ignores.
