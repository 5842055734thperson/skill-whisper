import type { Level } from '../types'
import { ALIASES } from './aliases'

export type SkillEntry = {
  name: string
  label: string
  triggers?: readonly string[]
}
export type Group = { title: string; skills: SkillEntry[]; manual?: true }

export type DiskSkill = {
  name: string
  description: string
  manual: boolean
}

export type SkillMatch = {
  name: string
  reason: string
  manual: boolean
  score: number
  /** True when more than one common word supports the match: an alias, the whole name, or two different words. */
  strong: boolean
  /** Share of the skill's name parts found in the draft; breaks ties between similar skills. */
  coverage: number
  /** Folded draft words that produced the match, so an action word can be told apart from them. */
  words: string[]
}

export type PendingTab = {
  prefix: string
  token: string
  tail: string
  skills: readonly string[]
}

export const shortName = (name: string): string => {
  const idx = name.lastIndexOf(':')
  return idx === -1 ? name : name.slice(idx + 1)
}

export function foldTr(s: string): string {
  return s
    .normalize('NFC') // macOS pastes decomposed letters (u + U+0308), which would split words
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[’'`]/g, '')
}

export function parseFrontmatter(raw: string): { name?: string; description: string; manual: boolean } {
  const m = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return { description: '', manual: false }
  const out: Record<string, string> = {}
  let key: string | null = null
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (kv) {
      key = kv[1]
      const val = kv[2].trim()
      out[key] = val === '>' || val === '|' || val === '>-' || val === '|-' ? '' : val.replace(/^['"]|['"]$/g, '')
    } else if (key !== null && (line.startsWith(' ') || line.startsWith('\t'))) {
      out[key] = (out[key] ? `${out[key]} ${line.trim()}` : line.trim()).trim()
    } else {
      key = null
    }
  }
  return {
    name: out.name || undefined,
    description: (out.description ?? '').replace(/\s+/g, ' ').trim(),
    manual: (out['disable-model-invocation'] ?? '').toLowerCase() === 'true',
  }
}

export function buildKnownCommands(installedNames: Iterable<string>): Set<string> {
  const known = new Set<string>(['whisper', 'whisper-help', 'whisper-ui'])
  for (const n of installedNames) {
    known.add(n)
    known.add(shortName(n))
  }
  return known
}

export function hasLeadingKnownCommand(draftText: string, knownCommands: ReadonlySet<string>): boolean {
  const trimmed = draftText.replace(/^\s+/, '')
  const lead = trimmed.match(/^\/(\S+)/)
  return Boolean(lead && knownCommands.has(lead[1]))
}

/**
 * Replaces or prefixes a slash skill command without wiping the user's draft.
 * Only strips a leading `/token` when `token` is a known command/skill name,
 * preserving leading file paths such as `/etc/hosts changed, explain`.
 */
export function buildFilledDraft(draftText: string, skillName: string, knownCommands: ReadonlySet<string>): string {
  const trimmedStart = draftText.replace(/^\s+/, '')
  if (trimmedStart === '') return `/${skillName} `

  const lead = trimmedStart.match(/^\/(\S+)(?:\s+([\s\S]*))?$/)
  if (lead && knownCommands.has(lead[1])) {
    const rest = (lead[2] ?? '').trim()
    return rest === '' ? `/${skillName} ` : `/${skillName} ${rest}`
  }

  return `/${skillName} ${trimmedStart.trimEnd()}`
}

export function filterGroups(groups: readonly Group[], installedNames: ReadonlySet<string> | null): Group[] {
  if (installedNames === null || installedNames.size === 0) {
    return groups.map(g => ({ ...g, skills: [...g.skills] }))
  }
  const has = (name: string) => installedNames.has(name) || installedNames.has(shortName(name))
  return groups
    .map(g => ({ ...g, skills: g.skills.filter(s => has(s.name)) }))
    .filter(g => g.skills.length > 0)
}

const SHORT_EXACT_STEMS = new Set(['seo', 'pdf', 'csv', 'svg', 'sql', 'jsx', 'tsx', 'cli', 'api', 'ux'])

function wordMatchesStem(word: string, stem: string): boolean {
  if (word === stem) return true
  if (stem.length >= 4) {
    if (word.startsWith(stem)) return true
    // Turkish final-consonant softening: grafik -> grafigi, baslik -> basligi, slayt -> slaydi
    if (stem.endsWith('k') && word.startsWith(`${stem.slice(0, -1)}g`)) return true
    if (stem.endsWith('t') && word.startsWith(`${stem.slice(0, -1)}d`)) return true
    if (stem.endsWith('p') && word.startsWith(`${stem.slice(0, -1)}b`)) return true
  } else if (SHORT_EXACT_STEMS.has(stem) && stem.length === 3) {
    // Allow Turkish suffixes attached to 3-letter tech acronyms: seosunu, pdfi, csvden
    if (word.startsWith(stem) && word.length <= stem.length + 5) return true
  }
  return false
}

const GENERIC_SKILL_WORDS = new Set([
  'ask', 'write', 'make', 'create', 'build', 'get', 'run', 'use', 'with', 'for', 'the', 'and', 'from', 'into',
  'claude', 'skill', 'skills', 'plugin', 'plugins', 'auto', 'better', 'good', 'new', 'pro', 'max', 'code',
  'app', 'dev', 'tool', 'tools', 'helper', 'agent', 'agents', 'user', 'users', 'when', 'this', 'that',
  'help', 'helps', 'using', 'used', 'work', 'workflow', 'workflows', 'mode', 'file', 'files', 'text',
  'data', 'project', 'system', 'review', 'design', 'interface', 'improve', 'remove', 'pick', 'explain',
  'whisper', 'whisper-help', 'whisper-ui', 'reload-plugins', 'reload-skills', 'clear', 'compact', 'login', 'logout',
  'config', 'status', 'cost', 'doctor', 'init', 'memory', 'model', 'permissions', 'resume', 'vim', 'bug',
])

const BUILTIN_SKIP = new Set([
  'whisper', 'whisper-help', 'whisper-ui', 'reload-plugins', 'reload-skills', 'clear', 'compact', 'help',
  'login', 'logout', 'config', 'status', 'cost', 'doctor', 'init', 'memory', 'model', 'permissions',
  'pr-comments', 'release-notes', 'resume', 'terminal-setup', 'vim', 'bug',
])

function tokenizeWords(folded: string): string[] {
  return folded
    .split(/[^a-z0-9.+-]+/)
    .map(w => w.replace(/^[.+-]+|[.+-]+$/g, ''))
    .filter(w => w.length >= 2)
}

const trimDesc = (s: string, max = 160): string => {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

/**
 * Fast, zero-token local matcher for while-typing skill suggestions in `full` mode.
 * Supports:
 * 1. Semantic slash queries (`/grafik`, `/sunum`, `/spec`, `/sonner`) when no native command shares that prefix.
 * 2. Natural Turkish & English prose (`"aylık gelir grafiği çiz"`, `"ödeme servisi için formal spec yazalım"`),
 *    using optional ALIASES words and the descriptions of installed skills (`SKILL.md` / `command.list()`).
 */
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const byScore = (a: SkillMatch, b: SkillMatch) => b.score - a.score || b.coverage - a.coverage || a.name.localeCompare(b.name)

/**
 * Fast, zero-token local matcher for while-typing skill suggestions in `full` mode. Scores only the
 * skills in `groups` (the library), never plain slash commands or MCP prompts.
 * 1. Slash queries (`/grafik`, `/sunum`) when no installed command shares that prefix.
 * 2. Prose in English or Turkish, from ALIASES words, the skill's name and its description.
 */
export function matchSkillsForDraft(
  draftText: string,
  groups: readonly Group[],
  diskSkills: ReadonlyMap<string, DiskSkill>,
  installedCommands: readonly { name: string; description?: string }[],
  maxResults = 3,
): SkillMatch[] {
  const trimmed = draftText.replace(/^\s+/, '')
  if (trimmed === '' || trimmed.startsWith('!')) return []

  const installedNames = installedCommands.map(c => c.name)
  const knownCommands = buildKnownCommands(installedNames)
  if (hasLeadingKnownCommand(trimmed, knownCommands)) return []

  const visibleGroups = filterGroups(groups, installedNames.length > 0 ? new Set(installedNames) : null)
  const skills = visibleGroups.flatMap(g => g.skills.map(s => ({ s, manual: Boolean(g.manual) })))
  const descOf = (name: string, label: string) =>
    (diskSkills.get(name) ?? diskSkills.get(shortName(name)))?.description || label

  // Mode 1: slash search on the first token
  const slashOnly = trimmed.match(/^\/([^\s/]+)$/)
  if (slashOnly) {
    const rawQ = slashOnly[1].toLowerCase()
    const q = foldTr(slashOnly[1]) // fold first: 'İ'.toLowerCase() leaves a combining dot
    if (q.length < 2) return []
    for (const name of knownCommands) {
      if (name.toLowerCase().startsWith(rawQ)) return [] // Claude Code's own slash menu handles it
    }
    const scored: SkillMatch[] = []
    for (const { s, manual } of skills) {
      let score = 0
      for (const item of [s.label, ...(s.triggers ?? [])]) {
        for (const w of tokenizeWords(foldTr(item))) {
          if (w === q) score = Math.max(score, 12)
          else if (q.length >= 3 && w.startsWith(q)) score = Math.max(score, 9)
        }
      }
      for (const part of tokenizeWords(foldTr(shortName(s.name)))) {
        if (part === q) score = Math.max(score, 12)
        else if (q.length >= 3 && part.startsWith(q)) score = Math.max(score, 10)
      }
      if (score === 0 && q.length >= 3) {
        const hit = tokenizeWords(foldTr(descOf(s.name, s.label))).some(w => !GENERIC_SKILL_WORDS.has(w) && w.startsWith(q))
        if (hit) score = 7
      }
      // The user searched on purpose, so every hit counts as strong.
      if (score > 0) scored.push({ name: s.name, reason: s.label, manual, score, strong: true, coverage: 1, words: [q] })
    }
    return scored.sort(byScore).slice(0, maxResults)
  }

  // Ignore other leading `/` paths (`/etc/hosts ...`) or very short fragments
  if (trimmed.startsWith('/') || trimmed.length < 6) return []

  // Mode 2: prose
  // A pasted log can be 50 KB; intent sits at its start and end.
  const sampleText = trimmed.length > 2400 ? `${trimmed.slice(0, 600)} ${trimmed.slice(-1800)}` : trimmed
  const foldedDraft = foldTr(sampleText)
  const draftWords = [...new Set(tokenizeWords(foldedDraft))]
  if (draftWords.length === 0) return []

  const results: SkillMatch[] = []
  for (const { s, manual } of skills) {
    if (BUILTIN_SKIP.has(s.name)) continue
    const hitWords = new Set<string>()
    let score = 0
    let aliasHit = false

    // 1. Alias words, curated per skill (English and Turkish)
    for (const rawTrig of s.triggers ?? []) {
      const ft = foldTr(rawTrig)
      const tWords = tokenizeWords(ft)
      if (tWords.length === 0) continue
      const hits = tWords.map(tw => draftWords.find(dw => wordMatchesStem(dw, tw)))
      if (hits.every(Boolean)) {
        const extraSpecificity = Math.min(Math.max(tWords.length - 2, 0), 3) // 'teknik seo denetimi' beats 'teknik seo'
        score += tWords.length >= 2 ? (foldedDraft.includes(ft) ? 12 + extraSpecificity : 9) : 7
        aliasHit = true
        for (const h of hits) hitWords.add(h as string)
      }
    }

    // 2. The skill's own name. Parts match whole words only ("extra" is not "extract").
    const short = foldTr(shortName(s.name))
    const parts = short.split(/[-_.:]+/).filter(x => x.length >= 3 && !GENERIC_SKILL_WORDS.has(x))
    let matchedParts = 0
    for (const part of parts) {
      if (part.length < 4 && !SHORT_EXACT_STEMS.has(part)) continue // too short to tell apart, but still counts in coverage
      const w = draftWords.find(dw => dw === part || dw === `${part}s` || dw === `${part}es`)
      if (w) {
        score += 9
        matchedParts++
        hitWords.add(w)
      }
    }
    // The whole name as a phrase ("code review" for code-review), even when each part is generic.
    const phrase = short.replace(/[-_.]+/g, ' ')
    const phraseHit = phrase.includes(' ') && new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}($|[^a-z0-9])`).test(foldedDraft)
    if (phraseHit) {
      score += 10
      for (const w of phrase.split(' ')) hitWords.add(w)
    }

    // 3. Description words not already counted above
    const descKeywords = new Set(
      tokenizeWords(foldTr(descOf(s.name, s.label))).filter(w => w.length >= 5 && !GENERIC_SKILL_WORDS.has(w)),
    )
    let descHits = 0
    for (const dw of draftWords) {
      if (dw.length >= 5 && descKeywords.has(dw) && !hitWords.has(dw)) {
        descHits++
        hitWords.add(dw)
      }
    }
    score += Math.min(descHits * 4, 8)

    if (score < (aliasHit ? 7 : 8)) continue
    const coverage = parts.length ? matchedParts / parts.length : 0
    const strong = aliasHit || phraseHit || (parts.length >= 2 && coverage === 1) || hitWords.size >= 2
    results.push({ name: s.name, reason: s.label, manual, score, strong, coverage, words: [...hitWords] })
  }

  return results.sort(byScore).slice(0, maxResults)
}

export function buildAutocompleteSuggestions(
  event: { text: string; cursor: number; token: string; start: number },
  matches: readonly SkillMatch[],
): {
  suggestions: { text: string; label: string; description: string }[]
  pending: PendingTab | null
} {
  if (matches.length === 0) return { suggestions: [], pending: null }

  const tail = event.text.slice(event.cursor)

  // Case 1: First token at index 0 — token replacement writes `/skill ` directly at index 0!
  if (event.start === 0) {
    const isSlashQuery = event.token.startsWith('/')
    const sep = tail.startsWith(' ') ? '' : ' '
    return {
      suggestions: matches.map(m => ({
        text: isSlashQuery ? `/${m.name}${sep}` : `/${m.name} ${event.token}`,
        label: `/${m.name}`,
        description: `💬 ${m.reason}${m.manual ? ' [manual]' : ''} · Tab to put it first`,
      })),
      pending: null,
    }
  }

  // Case 2: Multi-word prose (`start > 0`) — writes `${token} /${skill}` and `prompt.change` moves `/skill` to index 0
  return {
    suggestions: matches.map(m => ({
      text: `${event.token} /${m.name}`,
      label: `/${m.name}`,
      description: `💬 ${m.reason}${m.manual ? ' [manual]' : ''} · Tab to put it first`,
    })),
    pending: {
      prefix: event.text.slice(0, event.start),
      token: event.token,
      tail,
      skills: matches.map(m => m.name),
    },
  }
}

export function resolveTabRewrite(
  changedText: string,
  pending: PendingTab | null,
  knownCommands: ReadonlySet<string>,
): string | null {
  if (!pending) return null
  for (const skill of pending.skills) {
    const expected = `${pending.prefix}${pending.token} /${skill}${pending.tail}`
    if (changedText === expected) {
      const cleanDraft = `${pending.prefix}${pending.token}${pending.tail}`
      return buildFilledDraft(cleanDraft, skill, knownCommands)
    }
  }
  return null
}

export function buildGhostDecoration(
  text: string,
  cursor: number,
  topMatch: SkillMatch | undefined,
): { start: number; end: number; virtualText: string; dimColor: true } | null {
  if (!topMatch || text.length === 0) return null
  // Only advertise `Tab` when the caret sits right at the end of a non-whitespace token
  // (matching the exact condition under which Claude Code's composer enables Tab autocomplete).
  if (cursor <= 0 || cursor > text.length || /\s/.test(text.charAt(cursor - 1))) {
    return null
  }
  const tag = topMatch.manual ? ' [manual]' : ''
  return {
    start: text.length,
    end: text.length,
    virtualText: `  ⇥ Tab: /${topMatch.name}${tag}`,
    dimColor: true,
  }
}

export function buildRouterSection(level: Exclude<Level, 'off'>, groups: readonly Group[]): string {
  const manual = groups.filter(g => g.manual).flatMap(g => g.skills)
  // Automatic skills are already in the host's skill listing (with restored descriptions), so they are not repeated here.
  const tables =
    manual.length === 0
      ? ''
      : [
          '### Manual-Only Skills (Cannot be invoked by model; tell user to run /name)',
          ...manual.map(s => `- /${s.name}: ${s.label}`),
        ].join('\n')

  if (level === 'lite') {
    return `# Skill Whisper (lite)
The user has installed skills and wants help noticing when one fits. At the start of each new task, check the skill listing and the manual-only list below.
- [Automatic Skills] (the skill listing): If a skill there fits, mention in one line in the user's language which skill fits and why, and ask whether to invoke it; do not invoke it unasked.
- [Manual-Only Skills]: If a manual skill fits, tell the user in one line in the user's language to run \`/<name>\` and why; do not invoke it and do not execute its workflow yourself.
- If no skill fits, say nothing about skills. When the user's message starts with \`/<skill>\`, that skill was chosen by hand: just follow it.

${tables}`
  }

  return `# Skill Whisper (full)
The user has installed skills and wants them used. At the start of each new task, check the skill listing and the manual-only list below.
- [Automatic Skills] (the skill listing): If a skill there fits, open your reply with one line "💬 Skill: <name> — <why, a few words>" in the user's language, then invoke it with the Skill tool and follow it. If two fit, pick the more specific one and name the other as an option.
- [Manual-Only Skills]: If a manual skill fits, YOU CANNOT INVOKE IT WITH THE SKILL TOOL. Open your reply in the user's language telling them to run \`/<name>\` (for example "💬 Skill: \`/<name>\` — <why>"), and do NOT simulate or execute its workflow yourself unasked.
- If no skill fits, say nothing about skills. When the user's message starts with \`/<skill>\`, that skill was chosen by hand: just follow it without repeating the 💬 banner. A skill's own "ask first" steps still apply.

${tables}`
}

export function buildHelpText(groups: readonly Group[]): string {
  return [
    '💬 Skill Whisper: installed skills',
    '',
    ...groups.flatMap(g => [
      g.manual ? `${g.title} [manual: run /command]` : g.title,
      ...g.skills.map(s => `  ${s.name.padEnd(32)} ${s.label}`),
      '',
    ]),
    'Tip (full level): the suggested skill shows in the status line while you type; end your draft with ;; to put /skill first.',
    'Control center: /whisper-ui · Level: /whisper full | lite | off',
  ].join('\n')
}

/**
 * Rewrites the host `skill_listing` attachment:
 * 1. Restores concise descriptions for auto skills whose descriptions were dropped by the host's token cap.
 * 2. Appends installed manual-only skills (`disable-model-invocation: true`) discovered from SKILL.md + `command.list()`.
 */
export function enrichSkillListing(
  listingText: string,
  diskSkills: ReadonlyMap<string, DiskSkill>,
  installedCommands: readonly { name: string; description?: string }[],
  maxExtraChars = 2800,
): string {
  let spent = 0
  const listedNames = new Set<string>()
  const cmdDesc = new Map<string, string>()
  for (const c of installedCommands) {
    if (c.description) cmdDesc.set(c.name, c.description)
  }

  const lookupDisk = (name: string): DiskSkill | undefined =>
    diskSkills.get(name) ?? diskSkills.get(shortName(name))

  const lines = listingText.split(/\r?\n/).map(line => {
    const m = line.match(/^(\s*-\s+)([A-Za-z0-9_.:-]+)(\s*:\s*(.*))?$/)
    if (!m) return line
    const [, prefix, name, colonPart, existingDesc] = m
    listedNames.add(name)
    listedNames.add(shortName(name))
    if (existingDesc && existingDesc.trim() !== '') return line

    const fallback = lookupDisk(name)?.description || cmdDesc.get(name) || ''
    if (!fallback) return line
    const short = trimDesc(fallback, 160)
    const addition = colonPart ? ` ${short}` : `: ${short}`
    if (spent + addition.length > maxExtraChars) return line
    spent += addition.length
    return `${prefix}${name}: ${short}`
  })

  // Collect enabled manual skills from installedCommands + diskSkills
  const manualEntries: { name: string; desc: string }[] = []
  const seenManual = new Set<string>()

  const candidates = installedCommands.length > 0
    ? installedCommands.map(c => c.name)
    : [...diskSkills.keys()]

  for (const name of candidates) {
    if (name === 'whisper' || name === 'whisper-help' || name === 'whisper-ui') continue
    if (listedNames.has(name) || listedNames.has(shortName(name))) continue
    const disk = lookupDisk(name)
    if (!disk || !disk.manual) continue
    if (seenManual.has(name)) continue
    seenManual.add(name)
    manualEntries.push({
      name,
      desc: trimDesc(disk.description || cmdDesc.get(name) || 'Manual workflow skill', 160),
    })
  }

  let out = lines.join('\n')
  if (manualEntries.length > 0) {
    const manualLines: string[] = []
    for (const item of manualEntries) {
      const row = `- /${item.name} [manual — cannot be invoked with Skill tool; tell user in their language to run /${item.name}, do not run workflow yourself]: ${item.desc}`
      if (spent + row.length > maxExtraChars + 1600) break
      spent += row.length
      manualLines.push(row)
    }
    if (manualLines.length > 0) {
      out = `${out.trimEnd()}\n\nManual-only skills (user-invoked via slash command only):\n${manualLines.join('\n')}`
    }
  }

  return out
}

// Typed shortcut: the desktop app passes no key chords to mods, only text, so the shortcut is text.
export const TRIGGER = ';;'

/** `draft ;;` -> the draft without the trigger, or null when the draft does not end with it. */
export function stripTrigger(text: string): string | null {
  // Needs text, a space, then ;; at the very end. That rules out `echo x;;`, a line of `;;` and `for(;;)`.
  if (!/[^\s;][ \t]+;;[ \t]*$/.test(text)) return null
  // Inside an unclosed ``` block, ;; is code. A closed block earlier in the draft is fine.
  if ((text.match(/```/g) ?? []).length % 2 === 1 || (text.match(/~~~/g) ?? []).length % 2 === 1) return null
  // Shell `case` arms: `case $x in a) echo foo ;;`, or a last line such as `1) ;;` or `  a) cmd ;;`.
  const lastLine = text.trimEnd().split(/\r?\n/).pop() ?? ''
  if (/\bcase\s+\S+\s+in\b[\s\S]*\)/.test(text) || /^\s*[^\s)]*\)/.test(lastLine)) return null
  return text.trimEnd().slice(0, -TRIGGER.length).trimEnd()
}

/** `/grafik` alone is a search for a skill, so the pick replaces it instead of being prepended to it. */
export function fillForPick(base: string, skill: string, known: ReadonlySet<string>): string {
  return /^\/[^\s/]+$/.test(base.trim()) ? `/${skill} ` : buildFilledDraft(base, skill, known)
}

// English question words count only as the first word; "teach me how" and "my animation is janky" are requests.
const EN_QUESTION_START = new Set([
  'what', 'why', 'how', 'when', 'where', 'which', 'who', 'whom', 'whose', 'does', 'do', 'did',
  'is', 'are', 'was', 'were', 'can', 'could', 'should', 'would', 'will', 'shall',
])
const EN_POLITE = new Set(['can', 'could', 'would', 'will']) // "can you/we make…" is a request
const EN_POLITE_SUBJECT = new Set(['you', 'we'])
// "do a code review" is an order; "do you…" is a question
const EN_DO_IMPERATIVE_NEXT = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'my', 'our', 'your'])
const TR_QUESTION_END = new Set(['mi', 'mı', 'mu', 'mü', 'nedir'])
// Turkish question markers anywhere in the draft, and words that ask only at the start or end.
const TR_QUESTION_ANY = new Set([
  'mi', 'mı', 'mu', 'mü', 'misin', 'mısın', 'musun', 'müsün', 'midir', 'mıdır', 'mudur', 'müdür',
  'nasıl', 'neden', 'niye', 'nedir',
])
const TR_QUESTION_EDGE = new Set(['ne', 'hangi', 'hangisi', 'kim', 'demek'])

/**
 * Whether the draft is a question. Words are read before Turkish folding, so "iş" stays "iş"
 * instead of becoming the English "is".
 */
export function isQuestion(draft: string): boolean {
  const words = draft.normalize('NFC').replace(/İ/g, 'i').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.length === 0) return draft.trimEnd().endsWith('?')
  const [first, second] = words
  const last = words[words.length - 1]
  if (EN_POLITE.has(first) && EN_POLITE_SUBJECT.has(second)) return false // a request, even with "?"
  if (first === 'do' && EN_DO_IMPERATIVE_NEXT.has(second)) return false
  if (draft.trimEnd().endsWith('?')) return true
  if (EN_QUESTION_START.has(first)) return true
  // A Turkish draft that ends in an action verb is an order, even with "nasıl"/"neden" in a clause before it.
  const lastFolded = foldTr(last)
  const endsInVerb = INTENT_STEMS.some(v => lastFolded === v || (v.length >= 3 && lastFolded.startsWith(v)))
  if (endsInVerb && !TR_QUESTION_END.has(last)) return false
  if (words.some(w => TR_QUESTION_ANY.has(w))) return true
  return TR_QUESTION_EDGE.has(first) || TR_QUESTION_EDGE.has(last)
}

const INTENT_STEMS = [
  'make', 'draw', 'create', 'build', 'generate', 'design', 'add', 'write', 'review', 'check', 'audit',
  'fix', 'deploy', 'migrate', 'convert', 'rewrite', 'analyze', 'analyse', 'improve', 'optimize',
  'refactor', 'brainstorm', 'draft', 'render', 'export', 'turn', 'clean', 'extract', 'teach',
  'ciz', 'yap', 'olustur', 'hazirla', 'tasarla', 'ekle', 'yaz', 'incele', 'denetle', 'duzelt',
  'kontrol', 'analiz', 'donustur', 'cevir', 'iyilestir', 'gelistir', 'cikar', 'ogret', 'temizle', 'kaldir',
]

/**
 * Whether a match is good enough to show unasked (status line, ghost text, typeahead).
 * Only strong matches qualify, never on a question, and a low score also needs an action word
 * other than the words that made the match. `;;` and the pane skip this check, because the user asked.
 */
export function isConfidentHint(draft: string, match: Pick<SkillMatch, 'score' | 'strong' | 'words'>): boolean {
  if (!match.strong || isQuestion(draft)) return false
  if (match.score >= 12) return true
  return tokenizeWords(foldTr(draft)).some(
    w => !match.words.includes(w) && INTENT_STEMS.some(v => w === v || (v.length >= 3 && w.startsWith(v))),
  )
}

/** Skill names and descriptions from the host's `skill_listing` text (`- name: description` lines). */
export function parseSkillListing(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s+([A-Za-z0-9_.:-]+)(?:\s*:\s*(.*))?$/)
    if (m) out.set(m[1], (m[2] ?? '').trim())
  }
  return out
}

/**
 * The skill library, built from what is installed: every installed command that has a SKILL.md,
 * grouped by plugin, with manual-only skills in their own groups. Nothing here is hand-written;
 * ALIASES only adds optional match words.
 */
export function buildLibrary(
  diskSkills: ReadonlyMap<string, DiskSkill>,
  installedCommands: readonly { name: string; description?: string }[],
  listing?: ReadonlyMap<string, string>,
): Group[] {
  const names =
    installedCommands.length > 0
      ? installedCommands.map(c => c.name)
      : [...new Set([...diskSkills.values()].map(d => d.name))]
  const groups = new Map<string, Group>()
  for (const name of names) {
    if (BUILTIN_SKIP.has(name)) continue
    const aliases = ALIASES[name] ?? ALIASES[shortName(name)]
    const found = diskSkills.get(name) ?? diskSkills.get(shortName(name))
    // No SKILL.md: a plain slash command, unless the host lists it as a skill or ALIASES names it
    // (built-in skills such as dataviz, code-review or loop have no file).
    const listed = listing?.get(name)
    if (!found && !aliases && listed === undefined) continue
    const disk = found ?? {
      name,
      description: listed || installedCommands.find(c => c.name === name)?.description || '',
      manual: false,
    }
    const plugin = name.includes(':') ? name.slice(0, name.lastIndexOf(':')) : ''
    const title = `${plugin || 'Personal and built-in skills'}${disk.manual ? ' (manual-only)' : ''}`
    const g = groups.get(title) ?? { title, skills: [], ...(disk.manual ? { manual: true as const } : {}) }
    if (g.skills.some(x => x.name === name)) continue
    g.skills.push({ name, label: trimDesc(disk.description || name, 70), ...(aliases ? { triggers: aliases } : {}) })
    groups.set(title, g)
  }
  return [...groups.values()]
    .map(g => ({ ...g, skills: g.skills.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => Number(Boolean(a.manual)) - Number(Boolean(b.manual)) || a.title.localeCompare(b.title))
}
