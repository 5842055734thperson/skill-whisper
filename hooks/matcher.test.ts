import { describe, expect, test } from 'claude-code/testing'

import { buildLibrary, isConfidentHint, matchSkillsForDraft } from './logic'
import type { DiskSkill } from './logic'

// A fixed library, so the cases below measure the matcher and not whatever is installed.
// Descriptions are short paraphrases that keep the words the real ones contain.
const DISK: [string, string, boolean?][] = [
  ['diagram-design', 'Create architecture diagrams, flowcharts, timelines, sequence and state diagrams.'],
  ['animation-performance', 'Keep web animations inside the frame budget; fix janky, choppy animations that drop frames.'],
  ['animation-vocabulary', 'Reverse lookup glossary that names a vague animation or motion effect.'],
  ['variant', 'Builds multiple variants of a component and helps you pick one.', true],
  ['seo', 'Comprehensive SEO analysis for any website or business type.'],
  ['seo-local', 'Local SEO analysis: Google Business Profile, citations, reviews and map pack.'],
  ['seo-plan', 'Strategic SEO planning with templates for new or existing sites.'],
  ['seo-schema', 'Detect, validate and generate Schema.org structured data markup.'],
  ['seo-audit', 'Full website SEO audit with parallel analysis.'],
  ['seo-images', 'Image SEO: alt text, file sizes, formats and lazy loading.'],
  ['seo-image-gen', 'Plan and generate images for SEO assets such as social previews.'],
  ['mobile-native', 'Make a web app feel native on a phone: tap highlight, 100vh bug, safe areas.'],
  ['import-memory', 'Import a memory export from another AI assistant into Claude memory.'],
  ['egm-review-loop', 'Runs an automated multi-agent review loop to audit design documents.', true],
  ['vercel-cli-with-tokens', 'Deploy and manage Vercel projects with token-based CLI authentication.'],
  ['deploy-to-vercel', 'Deploy applications and websites to Vercel and return the link.'],
  ['spaced-repetition', 'Spaced repetition scheduling for long-term memory with review intervals.'],
  ['interleaving', 'Interleaving: mix related topics in one practice session instead of blocks.'],
  ['deliberate-practice', 'Deliberate practice with specific goals, feedback and focused practice sessions.'],
  ['learn', 'Teach a topic step by step so the learner understands how and why it works.'],
  ['ponytail-review', 'Quality review of a change: logic, safety, tests and speed.'],
  ['write-swift', 'How to write modern Swift: concurrency, actors and Swift 6 data-race safety.'],
  ['better-accessibility', 'Reviews keyboard focus, ARIA, accessible names and screen readers against WCAG.'],
  ['xlsx', 'Work with spreadsheet files: formulas, cleaning data and charts in xlsx.'],
]
const PREFIX: Record<string, string> = {
  seo: 'claude-seo:', 'seo-local': 'claude-seo:', 'seo-plan': 'claude-seo:', 'seo-schema': 'claude-seo:',
  'seo-audit': 'claude-seo:', 'seo-images': 'claude-seo:', 'seo-image-gen': 'claude-seo:',
  'import-memory': 'anthropic-skills:', learn: 'anthropic-skills:', xlsx: 'anthropic-skills:',
  'egm-review-loop': 'egm:', 'spaced-repetition': 'learning-framework:', interleaving: 'learning-framework:',
  'deliberate-practice': 'learning-framework:', 'ponytail-review': 'ponytail:',
}
const disk = new Map<string, DiskSkill>(DISK.map(([n, d, m]) => [n, { name: n, description: d, manual: Boolean(m) }]))
// Built-in skills have no SKILL.md; the host's skill listing names them. The MCP prompt is a plain command.
const listing = new Map([
  ['dataviz', 'Use for any chart, graph, plot, dashboard or data visualization.'],
  ['code-review', 'Review a pull request or diff for correctness bugs.'],
])
const cmds = [
  ...DISK.map(([n]) => ({ name: (PREFIX[n] ?? '') + n })),
  { name: 'dataviz' },
  { name: 'code-review' },
  { name: 'mcp__claude_ai_Scite__verify-bibliography' },
]
const lib = buildLibrary(disk, cmds, listing)

const hintFor = (draft: string) => {
  const top = matchSkillsForDraft(draft, lib, disk, cmds, 1)[0]
  return top && isConfidentHint(draft, top) ? top.name : null
}
const topFor = (draft: string) => matchSkillsForDraft(draft, lib, disk, cmds, 1)[0]?.name ?? null

// The unasked hint (status line, ghost text): the right skill, or nothing.
const HINT_CASES: [string, string | null][] = [
  // Real requests that v0.8.3 matched but silenced, or missed
  ['aylık gelir grafiği çiz', 'dataviz'],
  ['kasa iş akışını döngü diyagramı yap', 'diagram-design'],
  ['my scroll animation is janky, make it 60fps', 'animation-performance'],
  ['teach me how TCP works from scratch', 'anthropic-skills:learn'],
  ['aralıklı tekrar ile çalışma planı yap', 'learning-framework:spaced-repetition'],
  ['do a code review of this git diff', 'code-review'],
  ['bu sitenin seo analizini yap', 'claude-seo:seo'],
  ['deploy this app to vercel', 'deploy-to-vercel'],
  ['migrate this class to swift 6 actors and concurrency', 'write-swift'],
  ['can you make a chart of monthly revenue', 'dataviz'],
  // Everyday drafts that showed an unrelated skill
  ['plot twist: the test passed on local machine but failed on CI', null],
  ['convert this callback based method to return a native Promise', null],
  ['clean up unused import statements in this typescript file', null],
  ['fare üzerine gelince butonun arka plan rengini mavi yap', null],
  ['refactor this loop to use array reduce instead of a mutable variable', null],
  ['design a relational database schema for user orders and invoices', null],
  ['build a simple CLI calculator in Go', null],
  ['add a unit test to verify that divide by zero throws an exception', null],
  ['deploy notes: we successfully tagged release 1.4.0 yesterday', null],
  // Questions and chat (v0.8.2 set)
  ['bu excel kelimesi ne demek', null],
  ['what does the aria-label attribute do', null],
  ['how many tokens is this prompt', null],
  ['pdf mi docx mi daha iyi', null],
  ['seo nedir kısaca', null],
  ['merhaba bugün nasılsın', null],
  ['the chart in my head says no', null],
  // Known limits, asserted so a change in behavior is noticed: a question, and a single common word
  ['kart açılınca hafif zıplayan efektin adı ne', null],
  ['generate several variants so I can choose one', null],
]

// The top pick that ;; and the pane use.
const TOP_CASES: [string, string | null][] = [
  ['audit image alt text and file sizes', 'claude-seo:seo-images'],
  ['plan an interleaved practice schedule', 'learning-framework:interleaving'],
  ['generate several variants so I can choose one', 'variant'],
  ['kart açılınca hafif zıplayan efektin adı ne', 'animation-vocabulary'],
  ['add a unit test to verify that divide by zero throws an exception', null],
]

describe('matcher regression set', () => {
  test('unasked hints', () => {
    const wrong = HINT_CASES.map(([d, want]) => [d, want, hintFor(d)]).filter(([, want, got]) => want !== got)
    expect(wrong).toEqual([])
  })

  test('top pick for ;; and the pane', () => {
    const wrong = TOP_CASES.map(([d, want]) => [d, want, topFor(d)]).filter(([, want, got]) => want !== got)
    expect(wrong).toEqual([])
  })

  test('plain commands and MCP prompts are never scored', () => {
    const names = lib.flatMap(g => g.skills.map(s => s.name))
    expect(names).toContain('code-review')
    expect(names).toContain('dataviz')
    expect(names).not.toContain('mcp__claude_ai_Scite__verify-bibliography')
  })
})
