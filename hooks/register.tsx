import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Level, Suggestion } from '../types'
import {
  buildAutocompleteSuggestions,
  buildFilledDraft,
  buildGhostDecoration,
  buildHelpText,
  buildKnownCommands,
  buildLibrary,
  buildRouterSection,
  enrichSkillListing,
  matchSkillsForDraft,
  fillForPick,
  isConfidentHint,
  parseFrontmatter,
  resolveTabRewrite,
  stripTrigger,
} from './logic'
import type { DiskSkill, PendingTab, SkillMatch } from './logic'

const LEVELS: readonly Level[] = ['full', 'lite', 'off']
const isLevel = (v: unknown): v is Level => LEVELS.includes(v as Level)
const PANE = 'skill-whisper'
const level = atom({ plugin: 'skill-whisper', key: 'level' } as const, 'full')
const suggestion = atom({ plugin: 'skill-whisper', key: 'suggestion' } as const, null as Suggestion)

type CmdEntry = { name: string; description?: string; source?: string; plugin?: string }

async function listCommands($: EngineInterface): Promise<CmdEntry[]> {
  const raw: unknown = await $.command.list().catch(() => [])
  if (Array.isArray(raw)) return raw as CmdEntry[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { commands?: unknown }).commands)) {
    return (raw as { commands: CmdEntry[] }).commands
  }
  return []
}

async function resolveClaudeDir($: EngineInterface): Promise<string | null> {
  const custom = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  if (custom) return custom.replace(/\\/g, '/')
  const home =
    (await $.env.get('HOME').catch(() => undefined)) ??
    (await $.env.get('USERPROFILE').catch(() => undefined))
  return home ? `${home.replace(/\\/g, '/')}/.claude` : null
}

async function walkSkillFiles($: EngineInterface, dir: string, depth: number, acc: string[]): Promise<void> {
  if (depth < 0) return
  const entries = await $.fs.list(dir).catch(() => [])
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`
    if (entry.kind === 'file' && entry.name === 'SKILL.md') {
      acc.push(full)
    } else if (entry.kind === 'dir' && entry.name !== 'node_modules' && !entry.name.startsWith('.git')) {
      await walkSkillFiles($, full, depth - 1, acc)
    }
  }
}

async function scanDiskSkills($: EngineInterface): Promise<Map<string, DiskSkill>> {
  const map = new Map<string, DiskSkill>()
  const base = await resolveClaudeDir($)
  if (!base) return map

  const files: string[] = []
  await walkSkillFiles($, `${base}/skills`, 3, files)
  // plugins keep skills at different depths, e.g. <mkt>/<plugin>/<version>/.claude/skills/<skill>/SKILL.md
  await walkSkillFiles($, `${base}/plugins/cache`, 7, files)
  await walkSkillFiles($, `${base}/plugins/synced`, 7, files)

  for (const file of files) {
    const raw = await $.fs.read(file).catch(() => '')
    if (!raw) continue
    const fm = parseFrontmatter(raw)
    const parts = file.replace(/\\/g, '/').split('/')
    const parent = parts[parts.length - 2] ?? ''
    const short = fm.name || parent
    if (!short) continue

    const entry: DiskSkill = { name: short, description: fm.description, manual: fm.manual }
    map.set(short, entry)

    // Also index under `<plugin>:<short>` when located inside plugins/cache/<mkt>/<plugin>/...
    const cacheIdx = parts.indexOf('cache')
    if (cacheIdx !== -1 && parts.length > cacheIdx + 2) {
      const pluginName = parts[cacheIdx + 2]
      if (pluginName) map.set(`${pluginName}:${short}`, { ...entry, name: `${pluginName}:${short}` })
    }
    const syncedIdx = parts.indexOf('synced')
    if (syncedIdx !== -1 && parts.length > syncedIdx + 2) {
      const pluginName = parts[syncedIdx + 2]
      if (pluginName) map.set(`${pluginName}:${short}`, { ...entry, name: `${pluginName}:${short}` })
    }
  }
  return map
}

let shown: string | null = null

// The desktop app fires prompt.edit but paints no decorations and fires no prompt.autocomplete,
// so the suggestion also goes to the status line and the pane, which every surface draws.
async function showSuggestion($: EngineInterface, m: SkillMatch | undefined) {
  const key = m ? m.name : null
  if (key === shown) return
  shown = key
  await update($, suggestion, () => (m ? { name: m.name, reason: m.reason, manual: m.manual } : null))
  $.ui.status(m ? `💬 /${m.name}${m.manual ? ' [manual]' : ''} · ${m.reason} · end with ;;` : '💬 whisper: full')
}

async function setLevel($: EngineInterface, lv: Level) {
  await $.store.set('level', lv)
  await update($, level, () => lv)
  $.ui.status(lv === 'off' ? undefined : `💬 whisper: ${lv}`)
}

export const register: Register = on => {
  let diskCache: Map<string, DiskSkill> | null = null
  let cmdCache: CmdEntry[] | null = null
  let ready: Promise<unknown> | null = null // the first skill scan; ;; waits for it
  let pendingTab: PendingTab | null = null

  on('session.start', async ($, e, next) => {
    diskCache = null
    cmdCache = null
    pendingTab = null
    shown = null
    await $.command.register({ name: 'whisper', description: 'Skill Whisper level: full, lite or off' })
    await $.command.register({ name: 'whisper-help', description: 'List installed skills by plugin' })
    await $.command.register({ name: 'whisper-ui', description: 'Open the Skill Whisper control center' })
    const saved = await $.store.get('level')
    await setLevel($, isLevel(saved) ? saved : 'full')
    ready = Promise.all([
      listCommands($).then(c => { cmdCache = c }),
      scanDiskSkills($).then(m => { diskCache = m }).catch(() => {}),
    ])
    void $.ui.open({ id: PANE, title: 'Skill Whisper' })
    return next(e)
  }).catch((_$, e, next) => next(e))

  on('command.run', { command: ['reload-plugins', 'reload-skills'] }, async (_$, e, next) => {
    diskCache = null
    cmdCache = null
    pendingTab = null
    return next(e)
  }).catch((_$, e, next) => next(e))

  on('command.run', { command: 'whisper' }, async ($, e) => {
    const want = e.args.trim().toLowerCase()
    if (!want) return { text: `Skill Whisper level: ${await read($, level)}. Change it with: /whisper full | lite | off` }
    if (!isLevel(want)) return { text: `Unknown level "${want}". Options: full, lite, off` }
    pendingTab = null
    await setLevel($, want)
    return { text: `Skill Whisper: ${want}. Applies from your next message.` }
  })

  on('command.run', { command: 'whisper-help' }, async $ => {
    const cmds = await listCommands($)
    cmdCache = cmds
    if (diskCache === null && ready) await ready
    diskCache ??= await scanDiskSkills($).catch(() => new Map())
    return { text: buildHelpText(buildLibrary(diskCache, cmds)) }
  })

  on('command.run', { command: 'whisper-ui' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: 'Skill Whisper' })
    return { text: isPlaced ? 'Skill Whisper control center opened.' : 'This screen cannot show the pane; /whisper-help gives the list as text.' }
  })

  // Inline VS Code-style ghost hint at the end of the draft while typing in `full` mode (<1ms, pure in-memory)
  on('prompt.edit', async ($, e, next) => {
    const out = await next(e)
    const lv = await read($, level)
    if (lv !== 'full') return out
    const base = stripTrigger(out.text)
    if (base !== null) {
      if (ready) await ready
      const hit = matchSkillsForDraft(base, buildLibrary(diskCache ?? new Map(), cmdCache ?? []), diskCache ?? new Map(), cmdCache ?? [], 1)[0]
      if (hit) {
        const text = fillForPick(base, hit.name, buildKnownCommands((cmdCache ?? []).map(c => c.name)))
        void showSuggestion($, undefined)
        return { ...out, text, cursor: text.length }
      }
    }
    const top = matchSkillsForDraft(out.text, buildLibrary(diskCache ?? new Map(), cmdCache ?? []), diskCache ?? new Map(), cmdCache ?? [], 1)[0]
    const hint = top && isConfidentHint(out.text, top.score) ? top : undefined
    void showSuggestion($, hint)
    const ghost = buildGhostDecoration(out.text, out.cursor, hint)
    if (!ghost) return out
    return {
      ...out,
      decorations: [...(out.decorations ?? []), ghost],
    }
  }).catch((_$, e, next) => next(e))

  // Tab-completion rows while typing in `full` mode (both `/grafik` semantic search and natural prose)
  on('prompt.autocomplete', async ($, e, next) => {
    const out = await next(e)
    const lv = await read($, level)
    if (lv !== 'full') {
      pendingTab = null
      return out
    }
    if (cmdCache === null) {
      cmdCache = await listCommands($)
    }
    if (diskCache === null && ready) await ready
    if (diskCache === null) {
      diskCache = await scanDiskSkills($).catch(() => new Map())
    }
    const matches = matchSkillsForDraft(e.text, buildLibrary(diskCache, cmdCache), diskCache, cmdCache, 3).filter(m =>
      e.text.trim().startsWith('/') || isConfidentHint(e.text, m.score),
    )
    const built = buildAutocompleteSuggestions(e, matches)
    pendingTab = built.pending
    if (built.suggestions.length === 0) return out
    return {
      suggestions: [...out.suggestions, ...built.suggestions],
    }
  }).catch((_$, e, next) => next(e))

  // Moves `/skill` to the start of the prompt when Tab accepts a mid-sentence suggestion
  on('prompt.change', async ($, e, next) => {
    if (pendingTab !== null) {
      const lv = await read($, level)
      const known = buildKnownCommands((cmdCache ?? []).map(c => c.name))
      const rewritten = lv === 'full' ? resolveTabRewrite(e.text, pendingTab, known) : null
      if (rewritten !== null) {
        pendingTab = null
        await $.prompt.fill({ text: rewritten, mode: 'replace' }).catch(() => {})
      }
    }
    return next(e)
  }).catch((_$, e, next) => next(e))

  // Safety fallback if the user submits before microtask rewrite settles
  on('prompt.submit', async ($, e, next) => {
    if (shown !== null) void showSuggestion($, undefined)
    // Same shortcut at send time, in case the box did not take the edit-time rewrite.
    const base = (await read($, level)) === 'full' ? stripTrigger(e.text) : null
    if (base !== null) {
      if (ready) await ready
      const hit = matchSkillsForDraft(base, buildLibrary(diskCache ?? new Map(), cmdCache ?? []), diskCache ?? new Map(), cmdCache ?? [], 1)[0]
      if (hit) return next({ ...e, text: fillForPick(base, hit.name, buildKnownCommands((cmdCache ?? []).map(c => c.name))) })
    }
    if (pendingTab !== null) {
      const known = buildKnownCommands((cmdCache ?? []).map(c => c.name))
      const rewritten = resolveTabRewrite(e.text, pendingTab, known)
      pendingTab = null
      if (rewritten !== null) {
        return next({ ...e, text: rewritten })
      }
    }
    return next(e)
  }).catch((_$, e, next) => next(e))

  on('prompt.attachment', async ($, e, next) => {
    const lv = await read($, level)
    const ev = e as { type?: string; text?: string }
    if (lv === 'off' || ev.type !== 'skill_listing' || typeof ev.text !== 'string') {
      return next(e)
    }
    if (diskCache === null && ready) await ready
    if (diskCache === null) {
      diskCache = await scanDiskSkills($).catch(() => new Map())
    }
    const cmds = await listCommands($)
    cmdCache = cmds
    const enriched = enrichSkillListing(ev.text, diskCache, cmds)
    if (enriched === ev.text) return next(e)
    return next({ ...e, text: enriched } as typeof e)
  }).catch((_$, e, next) => next(e))

  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const lv = await read($, level)
    if (lv === 'off' || e.traits.includes('bare')) return out
    const cmds = await listCommands($)
    cmdCache = cmds
    if (diskCache === null && ready) await ready
    diskCache ??= await scanDiskSkills($).catch(() => new Map())
    const groups = buildLibrary(diskCache, cmds)
    return {
      sections: [
        ...out.sections,
        { id: 'skill-whisper:router', text: buildRouterSection(lv, groups), scope: 'session' },
      ],
    }
  }).catch((_$, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const lv = await read($, level)
    const sug = await read($, suggestion)
    const cmds = await listCommands($)
    cmdCache = cmds
    if (diskCache === null && ready) await ready
    diskCache ??= await scanDiskSkills($).catch(() => new Map())
    const visibleGroups = buildLibrary(diskCache, cmds)

    const pick = async (s: { name: string }) => {
      const { text } = await $.prompt.read()
      const latestCmds = await listCommands($)
      cmdCache = latestCmds
      const known = buildKnownCommands(latestCmds.map(c => c.name))
      const nextText = buildFilledDraft(text, s.name, known)
      const res = await $.prompt.fill({ text: nextText, mode: 'replace' })
      if (!res.isFilled) {
        $.ui.status(`💬 whisper: the prompt box is not available (/${s.name})`)
      }
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>Mod</Text>
          <Box gap={1}>
            {LEVELS.map(one => (
              <Button
                key={`level-${one}`}
                label={one}
                variant={one === lv ? 'primary' : undefined}
                dimColor={one !== lv}
                onPress={() => setLevel($, one)}
              />
            ))}
          </Box>
          <Text dimColor>full: invokes skills and suggests while you type · lite: only suggests · off: disabled</Text>
        </Box>
        {sug ? (
          <Box flexDirection="column">
            <Text bold>Suggestion (from your draft)</Text>
            <Box gap={1}>
              <Button key="suggest" label={`/${sug.name} ekle`} variant="primary" onPress={() => pick(sug)} />
              <Text dimColor>{sug.reason}{sug.manual ? ' [manual]' : ''}</Text>
            </Box>
          </Box>
        ) : null}
        <Text dimColor>Shortcut: end your draft with ;; to put the suggested /skill first. Or click a skill.</Text>
        {visibleGroups.map(g => (
          <Box key={g.title} flexDirection="column">
            <Text bold>{g.manual ? `${g.title} [manual]` : g.title}</Text>
            {g.skills.map(s => (
              <Box key={s.name} gap={1}>
                <Button key={`skill-${s.name}`} label={s.name} plain onPress={() => pick(s)} />
                <Text dimColor>{s.label}</Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
