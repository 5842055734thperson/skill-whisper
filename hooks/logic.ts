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
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
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

  // Mode 1: Semantic slash search (`/grafik`, `/sunum`, `/spec`) on the first token
  const slashOnly = trimmed.match(/^\/([^\s/]+)$/)
  if (slashOnly) {
    const rawQ = slashOnly[1].toLowerCase()
    const q = foldTr(slashOnly[1]) // fold first: 'İ'.toLowerCase() leaves a combining dot
    if (q.length < 2) return []

    // Yield to Claude Code's native slash menu if an installed command already starts with rawQ
    for (const name of knownCommands) {
      if (name.toLowerCase().startsWith(rawQ)) return []
    }

    const scored = new Map<string, SkillMatch>()
    for (const g of visibleGroups) {
      for (const s of g.skills) {
        let score = 0
        const pool = [s.label, ...(s.triggers ?? [])]
        for (const item of pool) {
          for (const w of tokenizeWords(foldTr(item))) {
            if (w === q) score = Math.max(score, 12)
            else if (q.length >= 3 && w.startsWith(q)) score = Math.max(score, 9)
          }
        }
        if (score > 0) {
          scored.set(s.name, { name: s.name, reason: s.label, manual: Boolean(g.manual), score })
        }
      }
    }

    // Also search installed skills by name and description
    for (const cmd of installedCommands) {
      if (BUILTIN_SKIP.has(cmd.name) || scored.has(cmd.name)) continue
      const disk = diskSkills.get(cmd.name) ?? diskSkills.get(shortName(cmd.name))
      const desc = disk?.description || cmd.description || ''
      let score = 0
      for (const part of tokenizeWords(foldTr(shortName(cmd.name)))) {
        if (part === q) score = Math.max(score, 12)
        else if (q.length >= 3 && part.startsWith(q)) score = Math.max(score, 10)
      }
      if (score === 0 && desc && q.length >= 3) {
        for (const w of tokenizeWords(foldTr(desc))) {
          if (GENERIC_SKILL_WORDS.has(w)) continue
          if (w === q || w.startsWith(q)) {
            score = Math.max(score, 7)
            break
          }
        }
      }
      if (score > 0) {
        scored.set(cmd.name, {
          name: cmd.name,
          reason: trimDesc(desc || cmd.name, 52),
          manual: Boolean(disk?.manual),
          score,
        })
      }
    }

    return [...scored.values()]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, maxResults)
  }

  // Ignore other leading `/` paths (`/etc/hosts ...`) or very short fragments
  if (trimmed.startsWith('/') || trimmed.length < 6) return []

  // Mode 2: Natural prose matching while typing
  const foldedDraft = foldTr(trimmed)
  const draftWords = tokenizeWords(foldedDraft)
  if (draftWords.length === 0) return []

  const results = new Map<string, SkillMatch>()

  for (const g of visibleGroups) {
    for (const s of g.skills) {
      let score = 0

      // Exact mention of distinctive skill shortName (e.g. "dataviz", "hallmark", "teardown", "humanizer")
      const sn = foldTr(shortName(s.name))
      if (sn.length >= 4 && !GENERIC_SKILL_WORDS.has(sn) && draftWords.some(w => w === sn)) {
        score += 10
      }

      for (const rawTrig of s.triggers ?? []) {
        const ft = foldTr(rawTrig)
        const tWords = tokenizeWords(ft)
        if (tWords.length === 0) continue

        if (tWords.length >= 2) {
          const allHit = tWords.every(tw => draftWords.some(dw => wordMatchesStem(dw, tw)))
          if (allHit) {
            score += foldedDraft.includes(ft) ? 12 : 9
          }
        } else {
          const stem = tWords[0]
          if (draftWords.some(dw => wordMatchesStem(dw, stem))) {
            score += 7
          }
        }
      }

      if (score >= 7) {
        results.set(s.name, {
          name: s.name,
          reason: s.label,
          manual: Boolean(g.manual),
          score,
        })
      }
    }
  }

  // Dynamic out-of-catalog installed skills (e.g. `ask-sonner`, `write-swift`)
  const dynamicCandidates =
    installedCommands.length > 0
      ? installedCommands
      : [...diskSkills.values()].map(d => ({ name: d.name, description: d.description }))

  for (const cmd of dynamicCandidates) {
    if (BUILTIN_SKIP.has(cmd.name)) continue
    // Skills already matched by their aliases also get name and description points added below.

    const disk = diskSkills.get(cmd.name) ?? diskSkills.get(shortName(cmd.name))
    const desc = disk?.description || cmd.description || ''
    let score = 0

    const nameParts = foldTr(shortName(cmd.name))
      .split(/[-_.:]+/)
      .filter(p => (p.length >= 4 || SHORT_EXACT_STEMS.has(p)) && !GENERIC_SKILL_WORDS.has(p)) // 3-letter acronyms like seo, pdf count

    // Name parts match whole words only ("extra" must not match "extract", "brain" not "brainstorm").
    for (const part of nameParts) {
      if (draftWords.some(dw => dw === part || dw === `${part}s` || dw === `${part}es`)) {
        score += 9
      }
    }

    if (desc) {
      const descKeywords = new Set(
        tokenizeWords(foldTr(desc)).filter(w => w.length >= 5 && !GENERIC_SKILL_WORDS.has(w)),
      )
      let descHits = 0
      for (const dw of draftWords) {
        if (dw.length >= 5 && descKeywords.has(dw)) descHits++
      }
      score += Math.min(descHits * 4, 8)
    }

    const prev = results.get(cmd.name) ?? results.get(shortName(cmd.name))
    if (prev) {
      results.set(prev.name, { ...prev, score: prev.score + score })
    } else if (score >= 8) {
      results.set(cmd.name, {
        name: cmd.name,
        reason: trimDesc(desc || cmd.name, 52),
        manual: Boolean(disk?.manual),
        score,
      })
    }
  }

  return [...results.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, maxResults)
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
  if ((text.match(/```/g) ?? []).length % 2 === 1) return null
  // Shell `case` arms: `case $x in a) echo foo ;;`, or a last line such as `1) ;;` or `  a) cmd ;;`.
  const lastLine = text.trimEnd().split(/\r?\n/).pop() ?? ''
  if (/\bcase\b[^\n]*\bin\b/.test(text) || /^\s*[^\s)]*\)/.test(lastLine)) return null
  return text.trimEnd().slice(0, -TRIGGER.length).trimEnd()
}

/** `/grafik` alone is a search for a skill, so the pick replaces it instead of being prepended to it. */
export function fillForPick(base: string, skill: string, known: ReadonlySet<string>): string {
  return /^\/[^\s/]+$/.test(base.trim()) ? `/${skill} ` : buildFilledDraft(base, skill, known)
}

const QUESTION_WORDS = new Set([
  'what', 'why', 'how', 'when', 'where', 'which', 'who', 'does', 'is', 'are', 'can', 'should',
  'ne', 'nedir', 'neden', 'nasil', 'hangi', 'kim', 'mi', 'mu', 'misin', 'midir', 'demek',
])
const INTENT_STEMS = [
  'make', 'draw', 'create', 'build', 'generate', 'design', 'add', 'write', 'review', 'check', 'audit',
  'fix', 'deploy', 'migrate', 'convert', 'rewrite', 'analyze', 'analyse', 'improve', 'optimize',
  'refactor', 'brainstorm', 'draft', 'render', 'export', 'turn', 'clean', 'extract', 'teach',
  'ciz', 'yap', 'olustur', 'hazirla', 'tasarla', 'ekle', 'yaz', 'incele', 'denetle', 'duzelt',
  'kontrol', 'analiz', 'donustur', 'cevir', 'iyilestir', 'gelistir', 'cikar', 'ogret', 'temizle',
]

/**
 * Whether a match is strong enough to show unasked (status line, ghost text, typeahead).
 * Questions get no hint, and a weak match needs an action word: "what does excel mean" or
 * "plot twist: ..." should not suggest a skill. `;;` skips this check, because the user asked.
 */
export function isConfidentHint(draft: string, score: number): boolean {
  const words = tokenizeWords(foldTr(draft))
  if (draft.trimEnd().endsWith('?') || words.some(w => QUESTION_WORDS.has(w))) return false
  if (score >= 12) return true
  return score >= 7 && words.some(w => INTENT_STEMS.some(v => w === v || (v.length >= 3 && w.startsWith(v))))
}

/**
 * The skill library, built from what is installed: every installed command that has a SKILL.md,
 * grouped by plugin, with manual-only skills in their own groups. Nothing here is hand-written;
 * ALIASES only adds optional match words.
 */
export function buildLibrary(
  diskSkills: ReadonlyMap<string, DiskSkill>,
  installedCommands: readonly { name: string; description?: string }[],
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
    // No SKILL.md: a plain slash command, unless ALIASES names it (built-in skills such as dataviz have no file).
    if (!found && !aliases) continue
    const disk = found ?? {
      name,
      description: installedCommands.find(c => c.name === name)?.description ?? '',
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
