/**
 * End-to-end live runner loading the REAL mod from this repository (`--plugin-dir <repo root>`),
 * NOT `--append-system-prompt`.
 *
 * Modes:
 *   --smoke : Quota-frugal 4-call check on Sonnet (2 out-of-CATALOG auto skills + 2 manual skills in English)
 *   --full  : Full comparable run (all 30 prompts + 10 held-out prompts on Opus, matching baseline setup)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.join(__dirname, '..'); // the repository root is the mod
// An installed copy of the mod is turned off for these runs, so only the repository copy loads.
const INSTALLED_ID = process.env.SKILL_WHISPER_ID || 'skill-whisper@skill-whisper';
const EMPTY_CWD = path.join(__dirname, 'empty_cwd');
fs.mkdirSync(EMPTY_CWD, { recursive: true });

const isSmoke = process.argv.includes('--smoke');
const isFull = process.argv.includes('--full');
const MODEL = process.env.EVAL_MODEL || (isFull ? 'opus' : 'sonnet');
const OUT_DIR = path.join(__dirname, isFull ? 'out_mod_full' : 'out_mod_smoke');
fs.mkdirSync(OUT_DIR, { recursive: true });

function loadCases() {
  const heldOut = fs
    .readFileSync(path.join(__dirname, 'held_out_prompts.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));

  if (isSmoke) {
    // 4 high-signal checks:
    // - 101: ask-sonner (NOT in CATALOG at all — tests host listing + enrichSkillListing)
    // - 102: write-swift (NOT in CATALOG at all)
    // - 106: pick-ui-library (manual skill missing in previous draft + English reply check)
    // - 18:  egm:egm-draft (manual skill vs Artifact rule + English reply check via real mod)
    return [
      heldOut.find(c => c.id === 101),
      heldOut.find(c => c.id === 102),
      heldOut.find(c => c.id === 106),
      {
        id: 18,
        manual: true,
        prompt: 'Write a formal design doc for adding rate limiting to our public API.',
        expect: ['egm:egm-draft'],
        note: 'real mod hook + English reply check vs Artifact'
      }
    ];
  }

  const base30 = fs
    .readFileSync(path.join(__dirname, 'prompts.jsonl'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(l => JSON.parse(l));
  return [...base30, ...heldOut];
}

const shortName = s => s.split(':').pop();

function scoreCase(c, invoked, text) {
  const nonPonytail = invoked.filter(s => !s.startsWith('ponytail'));
  if (!c.expect || c.expect.length === 0) {
    return {
      pass: nonPonytail.length === 0,
      verdict: nonPonytail.length === 0 ? 'QUIET_PASS' : 'FALSE_POSITIVE'
    };
  }
  if (c.manual) {
    const named = c.expect.some(e => {
      const sh = shortName(e);
      return text.includes(`/${e}`) || text.includes(`/${sh}`);
    });
    const hasHardcodedTurkish = text.includes('Bu görev için lütfen');
    return {
      pass: named && !hasHardcodedTurkish,
      verdict: named ? (hasHardcodedTurkish ? 'WRONG_LANGUAGE' : 'MANUAL_RECOMMENDED') : 'MISSED'
    };
  }
  const hit = nonPonytail.some(s => c.expect.includes(s) || c.expect.map(shortName).includes(shortName(s)));
  return {
    pass: hit,
    verdict: hit ? 'AUTO_INVOKED' : 'MISSED'
  };
}

function runOne(c) {
  const outPath = path.join(OUT_DIR, `case_${String(c.id).padStart(3, '0')}.jsonl`);
  if (!fs.existsSync(outPath)) {
    // Turn off an installed copy so ONLY the `--plugin-dir` copy runs.
    // In --full mode, keep ponytail in its default state to match baseline; in --smoke mode disable ponytail to save quota.
    const enabledPlugins = isFull
      ? { [INSTALLED_ID]: false }
      : { [INSTALLED_ID]: false, 'ponytail@ponytail': false };

    const args = [
      '-p', c.prompt,
      '--model', MODEL,
      '--plugin-dir', PLUGIN_DIR,
      '--settings', JSON.stringify({ enabledPlugins }),
      '--max-turns', isFull ? '4' : '2',
      '--disallowedTools', 'Bash,PowerShell,Write,Edit,NotebookEdit,Agent,WebSearch,WebFetch',
      ...(isFull ? [] : ['--strict-mcp-config']),
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence'
    ];
    const res = spawnSync('claude', args, { encoding: 'utf8', input: '', cwd: EMPTY_CWD, timeout: 180000 });
    if ((res.stdout || '').includes('Not logged in') || (res.stdout || '').includes('"error":"authentication_failed"')) {
      console.error('Sandbox blocked ~/.claude auth or network; run outside sandbox.');
      process.exit(2);
    }
    fs.writeFileSync(outPath, res.stdout || '', 'utf8');
  }

  const lines = fs.readFileSync(outPath, 'utf8').split('\n').filter(Boolean);
  const invoked = [];
  let text = '';
  let cost = 0;
  let turns = 0;
  let terminalReason = '';
  let loadedPlugins = [];

  for (const l of lines) {
    try {
      const d = JSON.parse(l);
      if (d.type === 'system' && d.subtype === 'init') {
        loadedPlugins = (d.plugins || []).map(p => p.name);
      }
      if (d.type === 'assistant') {
        for (const block of d.message?.content || []) {
          if (block.type === 'tool_use' && block.name === 'Skill') {
            invoked.push(block.input?.skill || '');
          }
          if (block.type === 'text') text += block.text + '\n';
        }
      }
      if (d.type === 'result') {
        if (d.result && !text) text += d.result + '\n';
        cost = d.total_cost_usd || 0;
        turns = d.num_turns || 0;
        terminalReason = d.terminal_reason || '';
      }
    } catch {}
  }

  const scored = scoreCase(c, invoked, text);
  return {
    id: c.id,
    note: c.note || '',
    expect: c.expect,
    invoked,
    verdict: scored.verdict,
    pass: scored.pass,
    turns,
    terminalReason,
    cost: Number(cost.toFixed(4)),
    skillWhisperLoaded: loadedPlugins.includes('skill-whisper'),
    preview: text.trim().slice(0, 180)
  };
}

if (!isSmoke && !isFull) {
  console.log('Usage: node run_mod_eval.mjs --smoke | --full');
  process.exit(0);
}

const cases = loadCases();
const summary = cases.map(runOne);
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.table(
  summary.map(s => ({
    id: s.id,
    modLoaded: s.skillWhisperLoaded,
    verdict: s.verdict,
    pass: s.pass,
    invoked: s.invoked.join(','),
    turns: s.turns,
    cost: s.cost
  }))
);
