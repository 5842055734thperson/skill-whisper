import { describe, expect, mock, test } from 'claude-code/testing'

// A fake install: SKILL.md files under /mockhome/.claude/skills/<name>/. The mod builds its library from these.
const FIXTURE: { name: string; description: string; manual?: true }[] = [
  { name: 'dataviz', description: 'Create charts, graphs, dashboards and data visualizations.' },
  { name: 'hallmark', description: 'Design websites and new pages that look designed.' },
  { name: 'ask-sonner', description: 'Guide to Sonner, the React toast library: toasts behind a modal, dark mode.' },
  { name: 'seo', description: 'Comprehensive SEO analysis for any website or business type.' },
  { name: 'egm-draft', description: 'Drafts a formal design document or spec section by section.', manual: true },
  { name: 'egm-brainstorm', description: 'Interactive ideation and brainstorming for software ideas.', manual: true },
  { name: 'review-animations', description: 'Reviews animation and motion code against a high craft bar.', manual: true },
]

function mockSkills(on: any, skills = FIXTURE) {
  mock.env(on, { HOME: '/mockhome' })
  const norm = (e: unknown) =>
    (typeof e === 'string' ? e : String((e as Record<string, unknown>).path ?? '')).replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  on('fs.list', (_$: unknown, e: unknown) => {
    const p = norm(e)
    if (p === '/mockhome/.claude/skills') return { value: skills.map(x => ({ name: x.name, kind: 'dir' })) }
    const hit = skills.find(x => p === `/mockhome/.claude/skills/${x.name}`)
    return { value: hit ? [{ name: 'SKILL.md', kind: 'file' }] : [] }
  })
  on('fs.read', (_$: unknown, e: unknown) => {
    const p = norm(e)
    const hit = skills.find(x => p === `/mockhome/.claude/skills/${x.name}/SKILL.md`)
    if (!hit) return { value: '' }
    const fm = ['---', `name: ${hit.name}`, `description: ${hit.description}`]
    if (hit.manual) fm.push('disable-model-invocation: true')
    return { value: [...fm, '---', '# Body'].join('\n') }
  })
}

describe('skill-whisper mod', () => {
  test('pane click reads PromptBox { text, cursor } and preserves user draft', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('command.list', () => ({
      value: [
        { name: 'dataviz', description: 'Charts', source: 'builtin' },
        { name: 'hallmark', description: 'Pages', source: 'plugin' },
      ],
    }))

    let currentBox = { text: 'Make a monthly revenue chart', cursor: 28 }
    on('prompt.read', () => ({ value: currentBox }))

    const fills: { text: string; mode?: string }[] = []
    let fillAllowed = true
    on('prompt.fill', (_$, e) => {
      const ev = e as { text: string; mode?: string }
      fills.push({ text: ev.text, mode: ev.mode })
      return fillAllowed ? { isFilled: true } : { isFilled: false, reason: 'no_composer' }
    })

    const statuses: (string | undefined)[] = []
    on('ui.status', (_$, e) => {
      statuses.push((e as { text?: string }).text)
      return { value: undefined }
    })

    const pane = await $.ui.mount({
      plugin: 'skill-whisper',
      surface: 'terminal',
      component: 'Pane',
      props: {},
      requestId: 'skill-whisper',
      viewport: { columns: 90, rows: 30 },
    })

    // 1. Plain non-empty draft -> prefixes /dataviz without wiping text
    await pane.press({ key: 'skill-dataviz' })
    expect(fills[0]).toEqual({ text: '/dataviz Make a monthly revenue chart', mode: 'replace' })

    // 2. Existing known command -> replaces /hallmark with /dataviz
    currentBox = { text: '/hallmark Make a monthly revenue chart', cursor: 38 }
    await pane.press({ key: 'skill-dataviz' })
    expect(fills[1]).toEqual({ text: '/dataviz Make a monthly revenue chart', mode: 'replace' })

    // 3. Leading file path (/etc/hosts) -> NOT a known command, must NOT be stripped
    currentBox = { text: '/etc/hosts changed, explain why', cursor: 31 }
    await pane.press({ key: 'skill-dataviz' })
    expect(fills[2]).toEqual({ text: '/dataviz /etc/hosts changed, explain why', mode: 'replace' })

    // 4. Empty/whitespace draft -> '/dataviz '
    currentBox = { text: '   ', cursor: 3 }
    await pane.press({ key: 'skill-dataviz' })
    expect(fills[3]).toEqual({ text: '/dataviz ', mode: 'replace' })

    // 5. Refusal when composer is unavailable -> reports ui.status notice
    fillAllowed = false
    await pane.press({ key: 'skill-dataviz' })
    expect(statuses.some(s => typeof s === 'string' && s.includes('/dataviz'))).toBe(true)
  })

  test('session.start registers only working commands (no dead /whisper-find) and /whisper switches levels', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    const registered: string[] = []
    on('command.register', (_$, e) => {
      registered.push((e as { name: string }).name)
      return { value: undefined }
    })
    on('command.list', () => ({ value: [] }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.status', () => ({ value: undefined }))
    on('session.start', (_$, e) => e)

    await $.session.start({ reason: 'startup', cwd: '/work' } as any)
    expect(registered).toEqual(['whisper', 'whisper-help', 'whisper-ui'])
    expect(registered.includes('pilot-find')).toBe(false)

    const switched = await $.command.run({ command: 'whisper', args: 'lite' })
    expect((switched as { text: string }).text).toContain('lite')

    const bad = await $.command.run({ command: 'whisper', args: 'unknown-arg' })
    expect((bad as { text: string }).text).toContain('Unknown level')

    const help = await $.command.run({ command: 'whisper-help', args: '' })
    expect((help as { text: string }).text).not.toContain('/whisper-find')
  })

  test('prompt.compose separates auto vs manual skills, uses user language in full & lite, and filters uninstalled skills', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('ui.status', () => ({ value: undefined }))
    on('command.list', () => ({ value: [] }))
    on('prompt.compose', () => ({ sections: [] }))

    const composeEvent = { traits: [] as string[], promptModel: 'claude-sonnet-5-5', outputStyle: null, tools: [] as string[], surfaces: [] as string[] }
    const fullOut = await $.prompt.compose(composeEvent as any)
    const fullText = fullOut.sections.find((s: any) => s.id === 'skill-whisper:router')?.text ?? ''
    const [autoPart, manualPart] = fullText.split('### Manual-Only Skills')

    // Bug 3 check: review-animations & egm skills are strictly in Manual, never in Automatic
    expect(autoPart).not.toContain('review-animations')
    expect(autoPart).not.toContain('egm:egm-brainstorm')
    expect(autoPart).not.toContain('egm:egm-draft')
    expect(autoPart).not.toContain('egm:egm-review')
    expect(manualPart).toContain('/review-animations')
    expect(manualPart).toContain('/egm-draft')
    expect(manualPart).toContain('/egm-brainstorm')
    expect(manualPart).not.toContain('dataviz')
    expect(fullText).toContain("in the user's language")
    expect(fullText).not.toContain('Bu görev için')

    // Lite mode check: Bug 4 — language-neutral, no hardcoded Turkish output sentence
    await $.command.run({ command: 'whisper', args: 'lite' })
    const liteOut = await $.prompt.compose(composeEvent as any)
    const liteText = liteOut.sections.find((s: any) => s.id === 'skill-whisper:router')?.text ?? ''
    expect(liteText).toContain("in the user's language")
    expect(liteText).not.toContain('Bu görev için')

    // Bare trait & off mode add zero sections
    const bareOut = await $.prompt.compose({ ...composeEvent, traits: ['bare'] } as any)
    expect(bareOut.sections.length).toBe(0)

    await $.command.run({ command: 'whisper', args: 'off' })
    const offOut = await $.prompt.compose(composeEvent as any)
    expect(offOut.sections.length).toBe(0)
  })

  test('prompt.compose lists only manual skills that are installed here, read from SKILL.md', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('command.list', () => ({
      value: [
        { name: 'dataviz', source: 'builtin' },
        { name: 'egm-draft', source: 'plugin' },
      ],
    }))
    on('prompt.compose', () => ({ sections: [] }))

    const out = await $.prompt.compose({ traits: [], promptModel: 'claude-sonnet-5-5', outputStyle: null, tools: [], surfaces: [] } as any)
    const text = out.sections[0]?.text ?? ''
    expect(text).toContain('/egm-draft: Drafts a formal design document')
    expect(text).not.toContain('/egm-brainstorm') // on disk, but not installed (not in command.list)
    expect(text).not.toContain('hallmark')
  })

  test('prompt.attachment dynamically restores dropped descriptions and appends manual skills from SKILL.md', async ($, on) => {
    mock.store(on, { level: 'full' })
    mock.env(on, { HOME: '/mockhome' })

    const pathOf = (e: unknown): string => {
      const raw = typeof e === 'string' ? e : String((e as Record<string, unknown>).path ?? '')
      return raw.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
    }

    on('fs.list', (_$, e) => {
      const p = pathOf(e)
      if (p === '/mockhome/.claude/skills') {
        return { value: [{ name: 'custom-manual-tool', kind: 'dir' }] }
      }
      if (p === '/mockhome/.claude/skills/custom-manual-tool') {
        return { value: [{ name: 'SKILL.md', kind: 'file' }] }
      }
      if (p === '/mockhome/.claude/plugins/cache') {
        return { value: [{ name: 'mkt', kind: 'dir' }] }
      }
      if (p === '/mockhome/.claude/plugins/cache/mkt') {
        return { value: [{ name: 'anthropic-skills', kind: 'dir' }] }
      }
      if (p === '/mockhome/.claude/plugins/cache/mkt/anthropic-skills') {
        return { value: [{ name: '1.0.0', kind: 'dir' }] }
      }
      if (p === '/mockhome/.claude/plugins/cache/mkt/anthropic-skills/1.0.0') {
        return { value: [{ name: 'humanizer', kind: 'dir' }] }
      }
      if (p === '/mockhome/.claude/plugins/cache/mkt/anthropic-skills/1.0.0/humanizer') {
        return { value: [{ name: 'SKILL.md', kind: 'file' }] }
      }
      return { value: [] }
    })

    on('fs.read', (_$, e) => {
      const p = pathOf(e)
      if (p.endsWith('custom-manual-tool/SKILL.md')) {
        return {
          value: [
            '---',
            'name: custom-manual-tool',
            'description: Audits custom database migrations interactively.',
            'disable-model-invocation: true',
            '---',
            '# Body',
          ].join('\n'),
        }
      }
      if (p.endsWith('humanizer/SKILL.md')) {
        return {
          value: [
            '---',
            'name: humanizer',
            'description: Rewrite AI-sounding text so it reads naturally.',
            '---',
            '# Body',
          ].join('\n'),
        }
      }
      return { value: '' }
    })

    on('command.list', () => ({
      value: [
        { name: 'anthropic-skills:humanizer', source: 'plugin' },
        { name: 'dataviz', description: 'Create charts', source: 'builtin' },
        { name: 'custom-manual-tool', source: 'plugin' },
        { name: 'clear', source: 'builtin' },
      ],
    }))

    on('prompt.attachment', (_$, e) => ({ text: (e as { text: string }).text }))

    const hostListing = ['- dataviz: Create charts', '- anthropic-skills:humanizer'].join('\n')
    const res = await $.prompt.attachment({ type: 'skill_listing', text: hostListing } as any)
    const enriched = (res as { text: string }).text

    // 1. Restored truncated description on anthropic-skills:humanizer
    expect(enriched).toContain('- anthropic-skills:humanizer: Rewrite AI-sounding text so it reads naturally.')
    // 2. Dynamically discovered out-of-table manual skill from SKILL.md
    expect(enriched).toContain('/custom-manual-tool [manual')
    expect(enriched).toContain('Audits custom database migrations interactively.')
    // 3. Built-in /clear command is NOT treated as a manual skill
    expect(enriched).not.toContain('/clear')
  })

  test('full mode shows inline ghost hint while typing and Tab prefixes /skill cleanly at index 0', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('command.register', () => ({ value: undefined }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.status', () => ({ value: undefined }))
    on('session.start', (_$, e) => e)
    on('command.list', () => ({
      value: [
        { name: 'dataviz', description: 'Create charts and dashboards', source: 'plugin' },
        { name: 'egm:egm-draft', description: 'Draft a formal software spec', source: 'plugin' },
      ],
    }))
    on('prompt.edit', (_$, e) => ({
      text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
      cursor: e.start + e.inputText.length,
    }))
    on('prompt.autocomplete', () => ({ suggestions: [] }))
    on('prompt.change', (_$, e) => ({ text: e.text }))

    const fills: { text: string; mode?: string }[] = []
    on('prompt.fill', (_$, e) => {
      fills.push({ text: e.text, mode: e.mode })
      return { isFilled: true }
    })

    await $.session.start({ reason: 'startup', cwd: '/work' } as any)
    await $.command.run({ command: 'whisper-help', args: '' }) // let the first skill scan finish, as it does a moment after start

    // 1. Typing "aylık gelir grafiği çiz" shows inline VS Code-style ghost text `⇥ Tab: /dataviz`
    const editOut = await $.prompt.edit({
      origin: { kind: 'composer' },
      text: 'aylık gelir grafiği ',
      cursor: 20,
      start: 20,
      end: 20,
      inputText: 'çiz',
    } as any)
    expect(editOut.text).toBe('aylık gelir grafiği çiz')
    expect(editOut.decorations).toEqual([
      {
        start: 23,
        end: 23,
        virtualText: '  ⇥ Tab: /dataviz',
        dimColor: true,
      },
    ])

    // 2. Trailing space suppresses `Tab` ghost hint (since no token sits at the caret)
    const spaceOut = await $.prompt.edit({
      origin: { kind: 'composer' },
      text: 'aylık gelir grafiği çiz',
      cursor: 23,
      start: 23,
      end: 23,
      inputText: ' ',
    } as any)
    expect(spaceOut.decorations).toBeUndefined()

    // 3. Autocomplete + Tab acceptance moves `/dataviz` to index 0 via `prompt.change` -> `$.prompt.fill`
    const ac = await $.prompt.autocomplete({
      text: 'aylık gelir grafiği çiz',
      cursor: 23,
      token: 'çiz',
      start: 20,
    } as any)
    expect(ac.suggestions.length).toBeGreaterThan(0)
    expect(ac.suggestions[0]?.label).toBe('/dataviz')
    expect(ac.suggestions[0]?.text).toBe('çiz /dataviz')

    // Simulate the composer replacing token "çiz" with `ac.suggestions[0].text` when user presses Tab
    await $.prompt.change({
      origin: { kind: 'engine' },
      text: 'aylık gelir grafiği çiz /dataviz',
      cursor: 32,
    } as any)
    expect(fills[0]).toEqual({
      text: '/dataviz aylık gelir grafiği çiz',
      mode: 'replace',
    })

    // 4. Manual-only skill (`egm:egm-draft`) shows `[manual]` tag and Tab-prefixes `/egm:egm-draft`
    const manualEdit = await $.prompt.edit({
      origin: { kind: 'composer' },
      text: 'ödeme servisi için formal spec ',
      cursor: 31,
      start: 31,
      end: 31,
      inputText: 'yazalım',
    } as any)
    expect(manualEdit.decorations?.[0]?.virtualText).toBe('  ⇥ Tab: /egm:egm-draft [manual]')

    const manualAc = await $.prompt.autocomplete({
      text: 'ödeme servisi için formal spec yazalım',
      cursor: 38,
      token: 'yazalım',
      start: 31,
    } as any)
    expect(manualAc.suggestions[0]?.label).toBe('/egm:egm-draft')

    await $.prompt.change({
      origin: { kind: 'engine' },
      text: 'ödeme servisi için formal spec yazalım /egm:egm-draft',
      cursor: 53,
    } as any)
    expect(fills[1]).toEqual({
      text: '/egm:egm-draft ödeme servisi için formal spec yazalım',
      mode: 'replace',
    })
  })

  test('semantic /kelime autocomplete and dynamic out-of-catalog skills work cleanly', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('command.list', () => ({
      value: [
        { name: 'dataviz', description: 'Charts and dashboards', source: 'plugin' },
        { name: 'ask-sonner', description: 'Integrate Sonner toast notifications in React apps', source: 'plugin' },
      ],
    }))
    on('prompt.autocomplete', () => ({ suggestions: [] }))

    // 1. Semantic Turkish `/grafik` -> directly replaces `/grafik` at index 0 with `/dataviz `
    const slashSemantic = await $.prompt.autocomplete({
      text: '/grafik',
      cursor: 7,
      token: '/grafik',
      start: 0,
    } as any)
    expect(slashSemantic.suggestions[0]?.label).toBe('/dataviz')
    expect(slashSemantic.suggestions[0]?.text).toBe('/dataviz ')

    // 2. Native prefix `/dat` -> yields to Claude Code's built-in slash menu (0 duplicate rows)
    const slashNative = await $.prompt.autocomplete({
      text: '/dat',
      cursor: 4,
      token: '/dat',
      start: 0,
    } as any)
    expect(slashNative.suggestions).toEqual([])

    // 3. Out-of-catalog dynamically installed skill (`ask-sonner`) is suggested while typing prose
    const dynamicAc = await $.prompt.autocomplete({
      text: 'react uygulamama sonner toast ekle',
      cursor: 34,
      token: 'ekle',
      start: 30,
    } as any)
    expect(dynamicAc.suggestions[0]?.label).toBe('/ask-sonner')
  })

  test('lite and off modes disable while-typing ghost hints and generic chat triggers zero false positives', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('ui.status', () => ({ value: undefined }))
    on('command.list', () => ({
      value: [{ name: 'dataviz', description: 'Charts', source: 'plugin' }],
    }))
    on('prompt.edit', (_$, e) => ({
      text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
      cursor: e.start + e.inputText.length,
    }))
    on('prompt.autocomplete', () => ({ suggestions: [] }))

    // 1. Generic chat in `full` mode -> no ghost decoration, no autocomplete
    const chatEdit = await $.prompt.edit({
      origin: { kind: 'composer' },
      text: 'merhaba bugün hava çok ',
      cursor: 23,
      start: 23,
      end: 23,
      inputText: 'güzel',
    } as any)
    expect(chatEdit.decorations).toBeUndefined()

    const chatAc = await $.prompt.autocomplete({
      text: 'merhaba bugün hava çok güzel',
      cursor: 28,
      token: 'güzel',
      start: 23,
    } as any)
    expect(chatAc.suggestions).toEqual([])

    // 2. Already-prefixed prompt (`/dataviz ...`) -> no ghost decoration, no autocomplete
    const prefixedAc = await $.prompt.autocomplete({
      text: '/dataviz aylık gelir grafiği çiz',
      cursor: 32,
      token: 'çiz',
      start: 29,
    } as any)
    expect(prefixedAc.suggestions).toEqual([])

    // 3. Switching to `lite` disables while-typing suggestions completely
    await $.command.run({ command: 'whisper', args: 'lite' })

    const liteEdit = await $.prompt.edit({
      origin: { kind: 'composer' },
      text: 'aylık gelir grafiği ',
      cursor: 20,
      start: 20,
      end: 20,
      inputText: 'çiz',
    } as any)
    expect(liteEdit.decorations).toBeUndefined()

    const liteAc = await $.prompt.autocomplete({
      text: 'aylık gelir grafiği çiz',
      cursor: 23,
      token: 'çiz',
      start: 20,
    } as any)
    expect(liteAc.suggestions).toEqual([])
  })

  test('desktop fallback: typing puts the suggestion in the status line and a pane button that prefixes it', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('command.register', () => ({ value: undefined }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    const statuses: (string | undefined)[] = []
    on('ui.status', (_$, e) => {
      statuses.push((e as { text?: string }).text)
      return { value: undefined }
    })
    on('session.start', (_$, e) => e)
    on('command.list', () => ({ value: [{ name: 'dataviz', description: 'Charts', source: 'plugin' }] }))
    on('prompt.edit', (_$, e) => ({
      text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
      cursor: e.start + e.inputText.length,
    }))
    on('prompt.read', () => ({ value: { text: 'aylık gelir grafiği çiz', cursor: 23 } }))
    const fills: string[] = []
    on('prompt.fill', (_$, e) => {
      fills.push((e as { text: string }).text)
      return { isFilled: true }
    })

    await $.session.start({ reason: 'startup', cwd: '/work' } as any)
    await $.command.run({ command: 'whisper-help', args: '' }) // let the first skill scan finish, as it does a moment after start
    await $.prompt.edit({ origin: { kind: 'composer' }, text: 'aylık gelir grafiği ', cursor: 20, start: 20, end: 20, inputText: 'çiz' } as any)
    expect(statuses.some(s => typeof s === 'string' && s.includes('/dataviz'))).toBe(true)

    const pane = await $.ui.mount({
      plugin: 'skill-whisper', surface: 'desktop', component: 'Pane', props: {}, requestId: 'skill-whisper',
      viewport: { columns: 90, rows: 30 },
    })
    await pane.press({ key: 'suggest' })
    expect(fills.at(-1)).toBe('/dataviz aylık gelir grafiği çiz')
  })

  test('typed shortcut: ending the draft with ;; prefixes the suggested skill', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('command.register', () => ({ value: undefined }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('ui.status', () => ({ value: undefined }))
    on('session.start', (_$, e) => e)
    on('command.list', () => ({ value: [{ name: 'dataviz', description: 'Charts', source: 'plugin' }] }))
    on('prompt.edit', (_$, e) => ({
      text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
      cursor: e.start + e.inputText.length,
    }))
    await $.session.start({ reason: 'startup', cwd: '/work' } as any)
    const out = await $.prompt.edit({ origin: { kind: 'composer' }, text: 'aylık gelir grafiği çiz ', cursor: 24, start: 24, end: 24, inputText: ';;' } as any)
    expect(out.text).toBe('/dataviz aylık gelir grafiği çiz')
    const plain = await $.prompt.edit({ origin: { kind: 'composer' }, text: 'merhaba ', cursor: 8, start: 8, end: 8, inputText: ';;' } as any)
    expect(plain.text).toBe('merhaba ;;')
  })

  test('a 3-letter skill name like seo matches a Turkish draft', async ($, on) => {
    mock.store(on, { level: 'full' })
    mockSkills(on)
    on('command.register', () => ({ value: undefined }))
    on('ui.open', () => ({ value: { isPlaced: true } }))
    const statuses: (string | undefined)[] = []
    on('ui.status', (_$, e) => {
      statuses.push((e as { text?: string }).text)
      return { value: undefined }
    })
    on('session.start', (_$, e) => e)
    on('command.list', () => ({ value: [{ name: 'claude-seo:seo', description: 'SEO', source: 'plugin' }] }))
    on('prompt.edit', (_$, e) => ({
      text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
      cursor: e.start + e.inputText.length,
    }))
    await $.session.start({ reason: 'startup', cwd: '/work' } as any)
    await $.command.run({ command: 'whisper-help', args: '' })
    await $.prompt.edit({ origin: { kind: 'composer' }, text: 'bu sitenin seo analizini ', cursor: 25, start: 25, end: 25, inputText: 'yap' } as any)
    expect(statuses.some(x => typeof x === 'string' && x.includes('/claude-seo:seo'))).toBe(true)
  })
})
