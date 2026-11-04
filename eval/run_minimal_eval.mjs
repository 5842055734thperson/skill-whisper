/**
 * Ultra-frugal live test runner (Quota-Safe Mode)
 * - Runs ONLY the 5 unresolved cases from v0.3:
 *   - Case 13 (slides/pptx vs Artifact)
 *   - Cases 17, 18, 19, 20 (the 4 manual-only skills)
 *   + 1 near-miss negative check (6 calls total, instead of 30-90!)
 * - Uses Sonnet by default (~5x cheaper on weekly Claude quota than Opus)
 * - Disables old v0.3 mod & noisy session hooks (ponytail) to save tokens
 * - Caps turns strictly (--max-turns 2) and outputs strictly inside antigravity/out_minimal/
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from './skill-pilot/hooks/catalog.ts';
import { buildRouterSection } from './skill-pilot/hooks/logic.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out_minimal');
const EMPTY_CWD = path.join(__dirname, 'empty_cwd');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(EMPTY_CWD, { recursive: true });

const MODEL = process.env.EVAL_MODEL || 'sonnet';
const ROUTER_PROMPT = buildRouterSection('full', CATALOG);

// Only the 5 critical gap cases + 1 near-miss no-skill case = 6 calls total
const TARGET_CASES = [
  {
    id: 13,
    manual: false,
    prompt: 'Make a 5-slide deck summarizing Q3 results: revenue up 12%, churn down 2 points, two new markets.',
    expect: ['ui-ux-pro-max:slides', 'anthropic-skills:pptx']
  },
  {
    id: 17,
    manual: true,
    prompt: 'I have an idea for a CLI that syncs dotfiles across machines. Brainstorm and stress-test it with me before we write a spec.',
    expect: ['egm:egm-brainstorm']
  },
  {
    id: 18,
    manual: true,
    prompt: 'Write a formal design doc for adding rate limiting to our public API.',
    expect: ['egm:egm-draft']
  },
  {
    id: 19,
    manual: true,
    prompt: 'Review my design doc docs/designs/cache.md with independent fresh-context reviewers.',
    expect: ['egm:egm-review']
  },
  {
    id: 20,
    manual: true,
    prompt: 'Give me three alternative design variants of my pricing card.',
    expect: ['variant']
  },
  {
    id: 31,
    manual: false,
    prompt: 'What does CSS `isolation: isolate` do in two sentences?',
    expect: [] // Near-miss UI/CSS question that should NOT trigger a UI review skill
  }
];

function shortName(s) {
  return s.split(':').pop();
}

function scoreRun(c, invoked, text) {
  if (c.expect.length === 0) {
    const nonPonytail = invoked.filter(s => !s.startsWith('ponytail'));
    return { pass: nonPonytail.length === 0 && !text.includes('🧭'), verdict: nonPonytail.length === 0 ? 'QUIET_PASS' : 'FALSE_POSITIVE' };
  }
  if (c.manual) {
    const recommended = c.expect.some(e => {
      const sh = shortName(e);
      return text.includes(`/${e}`) || text.includes(`/${sh}`);
    });
    return { pass: recommended, verdict: recommended ? 'MANUAL_RECOMMENDED' : 'MISSED' };
  }
  const hit = invoked.some(s => c.expect.includes(s) || c.expect.map(shortName).includes(shortName(s)));
  return { pass: hit, verdict: hit ? 'AUTO_INVOKED' : 'MISSED' };
}

// Probe quota first with a tiny 5-token call before running the 6 cases
function probeQuota() {
  const res = spawnSync(
    'claude',
    ['-p', 'Reply OK', '--model', 'haiku', '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence', '--max-turns', '1'],
    { encoding: 'utf8', input: '', timeout: 30000 }
  );
  const out = (res.stdout || '') + (res.stderr || '');
  if (out.includes('Not logged in') || (out.includes('limit') && out.includes('resets'))) {
    console.error('Auth or quota blocked:', out.trim());
    process.exit(2);
  }
  return true;
}

function runCase(c) {
  const outPath = path.join(OUT_DIR, `case_${String(c.id).padStart(2, '0')}.jsonl`);
  if (!fs.existsSync(outPath)) {
    const settings = JSON.stringify({
      enabledPlugins: {
        'skill-pilot@5842055734thperson-mods': false,
        'ponytail@ponytail': false
      }
    });
    const args = [
      '-p', c.prompt,
      '--model', MODEL,
      '--settings', settings,
      '--append-system-prompt', ROUTER_PROMPT,
      '--max-turns', c.manual ? '1' : '2',
      '--disallowedTools', 'Bash,PowerShell,Write,Edit,NotebookEdit,Agent,WebSearch,WebFetch',
      '--strict-mcp-config',
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence'
    ];
    const res = spawnSync('claude', args, { encoding: 'utf8', input: '', cwd: EMPTY_CWD, timeout: 120000 });
    fs.writeFileSync(outPath, res.stdout || '', 'utf8');
  }

  const lines = fs.readFileSync(outPath, 'utf8').split('\n').filter(Boolean);
  const invoked = [];
  let text = '';
  for (const l of lines) {
    try {
      const d = JSON.parse(l);
      if (d.type === 'assistant') {
        for (const block of d.message?.content || []) {
          if (block.type === 'tool_use' && block.name === 'Skill') {
            invoked.push(block.input?.skill || '');
          }
          if (block.type === 'text') text += block.text + '\n';
        }
      }
      if (d.type === 'result' && d.result) text += d.result + '\n';
    } catch {}
  }
  const scored = scoreRun(c, invoked, text);
  return { id: c.id, expect: c.expect, invoked, verdict: scored.verdict, pass: scored.pass, preview: text.trim().slice(0, 160) };
}

if (process.argv.includes('--run')) {
  probeQuota();
  const summary = [];
  for (const c of TARGET_CASES) {
    summary.push(runCase(c));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.table(summary.map(s => ({ id: s.id, verdict: s.verdict, pass: s.pass, invoked: s.invoked.join(',') })));
} else {
  console.log(`Ready: ${TARGET_CASES.length} minimal cases configured (model=${MODEL}). Pass --run after 16:30.`);
}
