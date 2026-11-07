import json
from pathlib import Path

with open('universal-registry/skills_registry.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

skills = []
for s in data['skills']:
    desc = s.get('description', '').strip()
    first_sentence = desc.split('. ')[0]
    if len(first_sentence) > 68:
        first_sentence = first_sentence[:65] + '...'
    skills.append({
        'id': s['id'],
        'p': s.get('plugin', 'core'),
        'd': first_sentence,
        'm': s.get('manual', False),
        'a': s.get('aliases', []),
        't': s.get('targets', ['claude', 'antigravity', 'copilot'])
    })

skills_json = json.dumps(skills, separators=(',', ':'), ensure_ascii=False)

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>skill-whisper — Interactive Line-Art Playground</title>
  <style>
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    body {{
      background: #FFFFFF;
      color: #111111;
      font-family: Consolas, 'SFMono-Regular', Menlo, Monaco, 'Liberation Mono', monospace;
      -webkit-font-smoothing: antialiased;
      padding: 16px 20px;
      user-select: none;
    }}
    .wrap {{
      max-width: 720px;
      margin: 0 auto;
      background: #FFFFFF;
    }}

    /* Minimal Monochrome Agent Switcher Tabs */
    .tabs {{
      display: flex;
      gap: 8px;
      margin-bottom: 18px;
      border-bottom: 1px solid #E1E1E1;
      padding-bottom: 12px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }}
    .tab-group {{
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }}
    .tab-btn {{
      background: #FFFFFF;
      color: #737373;
      border: 1px solid #E1E1E1;
      padding: 6px 12px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: border-color 0.12s, color 0.12s;
    }}
    .tab-btn:hover {{
      color: #111111;
      border-color: #737373;
    }}
    .tab-btn.active {{
      color: #111111;
      border: 2px solid #111111;
      padding: 5px 11px;
    }}
    .tab-btn svg {{
      width: 14px;
      height: 14px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: square;
      stroke-linejoin: miter;
    }}
    .replay-btn {{
      background: #FFFFFF;
      color: #111111;
      border: 1px solid #111111;
      padding: 5px 10px;
      font-family: inherit;
      font-size: 11px;
      cursor: pointer;
    }}
    .replay-btn:hover {{
      background: #111111;
      color: #FFFFFF;
    }}

    /* Exact 720x250 GIF Stage Canvas */
    .stage {{
      position: relative;
      width: 100%;
      height: 240px;
      background: #FFFFFF;
      overflow: hidden;
    }}

    /* Header inside stage matching GIFs */
    .stage-header {{
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 6px;
      margin-bottom: 12px;
    }}
    .stage-header svg {{
      width: 16px;
      height: 16px;
      stroke: #111111;
      fill: none;
      stroke-width: 2;
      flex-shrink: 0;
    }}
    .stage-title {{
      font-size: 12px;
      font-weight: 700;
      color: #111111;
      letter-spacing: 0.02em;
    }}
    .stage-sub {{
      font-size: 11px;
      color: #737373;
    }}

    /* ==========================================
       VIEW 1: CLAUDE CODE (Middle Line Hook)
       ========================================== */
    #view-claude {{
      padding-top: 38px;
    }}
    .claude-line-row {{
      position: relative;
      display: flex;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 2px solid #111111;
      min-height: 34px;
      cursor: text;
    }}
    .claude-gt {{
      font-size: 16px;
      font-weight: 700;
      color: #111111;
      margin-right: 10px;
      flex-shrink: 0;
    }}
    .claude-skill-box {{
      display: none;
      border: 2px solid #111111;
      padding: 1px 7px;
      font-size: 15px;
      font-weight: 700;
      color: #111111;
      margin-right: 8px;
      flex-shrink: 0;
    }}
    .claude-semi-box {{
      display: none;
      border: 2px solid #111111;
      padding: 1px 5px;
      font-size: 15px;
      font-weight: 700;
      color: #111111;
      margin-left: 4px;
      flex-shrink: 0;
    }}
    .claude-input-wrap {{
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      overflow: hidden;
    }}
    .claude-mirror {{
      font-size: 16px;
      color: #111111;
      white-space: pre;
    }}
    .claude-cursor {{
      display: inline-block;
      width: 2px;
      height: 18px;
      background: #111111;
      margin-left: 2px;
      animation: blink 1s step-end infinite;
      flex-shrink: 0;
    }}
    .claude-ghost {{
      font-size: 14px;
      color: #AFAFAF;
      margin-left: 14px;
      white-space: nowrap;
      pointer-events: auto;
      cursor: pointer;
    }}
    .claude-ghost:hover {{
      color: #111111;
    }}
    .hidden-input {{
      position: absolute;
      inset: 0;
      opacity: 0;
      width: 100%;
      height: 100%;
      font-family: inherit;
      font-size: 16px;
      cursor: text;
      border: none;
      outline: none;
    }}
    .claude-status {{
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #737373;
      min-height: 20px;
    }}
    .claude-status svg {{
      width: 15px;
      height: 15px;
      stroke: #111111;
      fill: none;
      stroke-width: 2;
      flex-shrink: 0;
    }}
    .semi-btn {{
      margin-left: auto;
      background: #FFFFFF;
      color: #111111;
      border: 1px solid #111111;
      padding: 2px 8px;
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }}
    .semi-btn:hover {{
      background: #111111;
      color: #FFFFFF;
    }}

    /* ==========================================
       VIEW 2 & 3: GEMINI & COPILOT (Chat + Bottom Line)
       ========================================== */
    #view-chat {{
      display: none;
      flex-direction: column;
      justify-content: space-between;
      height: 196px;
    }}
    .chat-history {{
      flex: 1;
      padding-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}
    .chat-row {{
      display: flex;
      align-items: flex-start;
      font-size: 13px;
      line-height: 1.45;
    }}
    .chat-role {{
      width: 56px;
      font-weight: 700;
      color: #737373;
      flex-shrink: 0;
    }}
    .chat-role.agent {{
      color: #111111;
    }}
    .chat-user-text {{
      color: #111111;
      font-size: 14px;
    }}
    .chat-divider {{
      height: 1px;
      background: #E1E1E1;
      width: 100%;
    }}
    .agent-lines {{
      display: flex;
      flex-direction: column;
      gap: 7px;
      flex: 1;
    }}
    .agent-line {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }}
    .agent-line svg {{
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      fill: none;
      stroke-width: 2;
    }}
    .agent-line.bold {{
      font-size: 13px;
      font-weight: 700;
      color: #111111;
    }}
    .agent-line.muted {{
      color: #737373;
    }}
    .agent-line.body {{
      color: #2D2D2D;
    }}

    /* Bottom Single-Line Input with Circular (↑) Button */
    .bottom-input-line {{
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 6px;
      border-bottom: 2px solid #111111;
      min-height: 34px;
    }}
    .chat-input-field {{
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-family: inherit;
      font-size: 15px;
      color: #111111;
    }}
    .chat-input-field::placeholder {{
      color: #AFAFAF;
      font-size: 13px;
    }}
    .send-circle {{
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid #111111;
      background: #FFFFFF;
      color: #111111;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      margin-left: 10px;
      transition: background 0.1s, color 0.1s;
    }}
    .send-circle:hover, .send-circle.active {{
      background: #111111;
      color: #FFFFFF;
    }}
    .send-circle svg {{
      width: 12px;
      height: 12px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
    }}

    /* Minimal Monochrome Presets Bar at Bottom */
    .presets-bar {{
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #E1E1E1;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }}
    .presets-label {{
      font-size: 11px;
      color: #737373;
      margin-right: 4px;
    }}
    .preset-pill {{
      background: #FFFFFF;
      color: #2D2D2D;
      border: 1px solid #E1E1E1;
      padding: 3px 8px;
      font-family: inherit;
      font-size: 11px;
      cursor: pointer;
    }}
    .preset-pill:hover {{
      border-color: #111111;
      color: #111111;
    }}

    @keyframes blink {{
      50% {{ opacity: 0; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <!-- Top Monochrome Tabs -->
    <div class="tabs">
      <div class="tab-group">
        <button id="tab-claude" class="tab-btn active" onclick="switchMode('claude')">
          <svg viewBox="0 0 16 16"><polyline points="1,3 7,8 1,13"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
          CLAUDE CODE
        </button>
        <button id="tab-gemini" class="tab-btn" onclick="switchMode('gemini')">
          <svg viewBox="0 0 16 16"><polygon points="8,1 10,6 15,8 10,10 8,15 6,10 1,8 6,6"/></svg>
          ANTIGRAVITY / GEMINI
        </button>
        <button id="tab-copilot" class="tab-btn" onclick="switchMode('copilot')">
          <svg viewBox="0 0 16 16"><polyline points="5,3 1,8 5,13"/><polyline points="11,3 15,8 11,13"/></svg>
          CODEX / COPILOT
        </button>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="replay-btn" onclick="clearStage()" title="Clear input to type your own prompt">Clear</button>
        <button class="replay-btn" onclick="playDemoAnimation()" title="Play automated typing flow">▶ Auto-Play</button>
      </div>
    </div>

    <!-- Main Line-Art Stage (Identical to the GIFs) -->
    <div class="stage">
      <!-- Stage Header -->
      <div class="stage-header">
        <span id="header-icon"></span>
        <span id="header-title" class="stage-title">CLAUDE CODE</span>
        <span id="header-sub" class="stage-sub">— while-typing hook (hooks/register.tsx)</span>
      </div>

      <!-- 1. CLAUDE CODE VIEW -->
      <div id="view-claude">
        <div class="claude-line-row" onclick="focusClaudeInput()">
          <span class="claude-gt">&gt;</span>
          <span id="claude-skill-tag" class="claude-skill-box">/dataviz</span>
          <div class="claude-input-wrap">
            <span id="claude-mirror" class="claude-mirror"></span>
            <span id="claude-semi-box" class="claude-semi-box"> ;;</span>
            <span class="claude-cursor"></span>
            <span id="claude-ghost" class="claude-ghost" onclick="triggerClaudeRewrite(event)"></span>
            <input id="claude-input" class="hidden-input" type="text" autocomplete="off" spellcheck="false"
                   oninput="onClaudeInput()" onkeydown="onClaudeKeyDown(event)">
          </div>
        </div>
        <div class="claude-status">
          <span id="claude-status-icon" style="display:none;">
            <svg viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="10"/><polyline points="4,12 3,15 8,12"/></svg>
          </span>
          <span id="claude-status-text">whisper: full</span>
          <button id="claude-semi-btn" class="semi-btn" style="display:none;" onclick="triggerClaudeRewrite(event)">Type ;;</button>
        </div>
      </div>

      <!-- 2 & 3. ANTIGRAVITY / GEMINI & CODEX / COPILOT VIEW -->
      <div id="view-chat">
        <div id="chat-history" class="chat-history"></div>
        <div class="bottom-input-line">
          <input id="chat-input" class="chat-input-field" type="text" autocomplete="off" spellcheck="false"
                 placeholder="Write a message..." onkeydown="onChatKeyDown(event)">
          <button id="send-btn" class="send-circle" onclick="submitChatPrompt()" title="Send message">
            <svg viewBox="0 0 16 16"><line x1="8" y1="13" x2="8" y2="3"/><polyline points="4,7 8,3 12,7"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Minimal Monochrome Presets Bar -->
    <div class="presets-bar">
      <span class="presets-label">Try prompt:</span>
      <button class="preset-pill" onclick="runPreset('plot monthly revenue')">plot monthly revenue</button>
      <button class="preset-pill" onclick="runPreset('test and mock this REST API')">test and mock this REST API</button>
      <button class="preset-pill" onclick="runPreset('deploy kubernetes canary rollback')">deploy kubernetes canary rollback</button>
      <button class="preset-pill" onclick="runPreset('menüye açılış animasyonu ekle')">menüye açılış animasyonu ekle</button>
      <button class="preset-pill" onclick="runPreset('predict protein structure with AlphaFold')">predict protein structure with AlphaFold</button>
      <button class="preset-pill" onclick="runPreset('what is the capital of France?')">what is the capital of France? (no skill)</button>
    </div>
  </div>

  <script>
    const ALL_SKILLS = {skills_json};

    // Add canonical demo skills so the 3 flagship GIF examples always match with exact descriptions
    const DEMO_OVERRIDES = [
      {{
        id: 'dataviz',
        p: 'claude-core',
        d: 'Build data visualizations',
        m: false,
        keywords: ['plot monthly revenue', 'monthly revenue', 'revenue chart', 'bar chart', 'dataviz', 'grafik ciz', 'chart']
      }},
      {{
        id: 'api-engineer',
        p: 'postman',
        d: 'REST API contract testing & mocking',
        m: false,
        keywords: ['test and mock this rest api', 'mock this rest api', 'rest api', 'api contract', 'postman mock', 'sozlesme testi']
      }},
      {{
        id: 'k8s-canary-rollback',
        p: 'devops',
        d: 'Kubernetes canary deployment & traffic rollback',
        m: false,
        keywords: ['deploy kubernetes canary rollback', 'kubernetes canary', 'canary rollback', 'k8s canary']
      }}
    ];

    const ICONS = {{
      claude: '<svg viewBox="0 0 16 16"><polyline points="1,3 7,8 1,13"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
      gemini: '<svg viewBox="0 0 16 16"><polygon points="8,1 10,6 15,8 10,10 8,15 6,10 1,8 6,6"/></svg>',
      copilot: '<svg viewBox="0 0 16 16"><polyline points="5,3 1,8 5,13"/><polyline points="11,3 15,8 11,13"/></svg>',
      bubble: '<svg viewBox="0 0 16 16" stroke="#111111"><rect x="1" y="2" width="14" height="10"/><polyline points="4,12 3,15 8,12"/></svg>',
      file: '<svg viewBox="0 0 16 16" stroke="#737373"><rect x="2" y="1" width="11" height="14"/><line x1="5" y1="5" x2="10" y2="5"/><line x1="5" y1="9" x2="10" y2="9"/></svg>'
    }};

    let currentMode = 'claude';
    let appliedSkill = null;
    let isAutoDemoResult = false;
    let animTimers = [];

    function clearTimers() {{
      while (animTimers.length) clearTimeout(animTimers.pop());
    }}

    function softHit(q, na) {{
      if (q.includes(na)) return true;
      const soft = {{k: 'g', t: 'd', p: 'b'}}[na.slice(-1)];
      return Boolean(soft) && na.length >= 4 && q.includes(na.slice(0, -1) + soft);
    }}

    function normTr(s) {{
      return s.normalize('NFC').toLowerCase()
        .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
        .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/İ/g, 'i');
    }}

    function findSkillMatch(rawText) {{
      const q = normTr(rawText.trim());
      if (!q || q.length < 4) return null;

      // Negative control questions
      const negStarters = ['what is the capital', 'how do i tie', 'why is the sky', 'weather today', 'what does ', 'nedir'];
      for (const neg of negStarters) {{
        if (q.includes(neg)) return null;
      }}

      // 1. Check flagship GIF overrides first
      for (const o of DEMO_OVERRIDES) {{
        for (const kw of o.keywords) {{
          if (q.includes(kw) || (q.length >= 14 && kw.startsWith(q))) {{
            return {{ id: o.id, p: o.p, d: o.d, m: o.m, matched: kw }};
          }}
        }}
      }}

      // 2. Check full 347-skill registry (aliases & id)
      let best = null;
      let bestLen = 0;
      for (const s of ALL_SKILLS) {{
        const sid = normTr(s.id);
        if (q.includes(sid) && sid.length > bestLen) {{
          best = {{ id: s.id, p: s.p, d: s.d, m: s.m, matched: s.id }};
          bestLen = sid.length;
        }}
        for (const a of s.a) {{
          const na = normTr(a);
          if (na.length >= 4 && (softHit(q, na) || (q.length >= 12 && na.includes(q)))) {{
            if (na.length > bestLen) {{
              best = {{ id: s.id, p: s.p, d: s.d, m: s.m, matched: a }};
              bestLen = na.length;
            }}
          }}
        }}
      }}
      return best;
    }}

    function switchMode(mode) {{
      clearTimers();
      currentMode = mode;
      appliedSkill = null;

      document.getElementById('tab-claude').classList.toggle('active', mode === 'claude');
      document.getElementById('tab-gemini').classList.toggle('active', mode === 'gemini');
      document.getElementById('tab-copilot').classList.toggle('active', mode === 'copilot');

      const hIcon = document.getElementById('header-icon');
      const hTitle = document.getElementById('header-title');
      const hSub = document.getElementById('header-sub');
      const vClaude = document.getElementById('view-claude');
      const vChat = document.getElementById('view-chat');
      const chatInput = document.getElementById('chat-input');

      if (mode === 'claude') {{
        hIcon.innerHTML = ICONS.claude;
        hTitle.textContent = 'CLAUDE CODE';
        hSub.textContent = '— while-typing hook (hooks/register.tsx)';
        vClaude.style.display = 'block';
        vChat.style.display = 'none';
      }} else if (mode === 'gemini') {{
        hIcon.innerHTML = ICONS.gemini;
        hTitle.textContent = 'ANTIGRAVITY / GEMINI';
        hSub.textContent = '— autonomous rule mandate (rules/AGENTS.md)';
        vClaude.style.display = 'none';
        vChat.style.display = 'flex';
        chatInput.placeholder = 'Write a message...';
      }} else {{
        hIcon.innerHTML = ICONS.copilot;
        hTitle.textContent = 'CODEX / COPILOT';
        hSub.textContent = '— matrix routing (.github/copilot-instructions.md)';
        vClaude.style.display = 'none';
        vChat.style.display = 'flex';
        chatInput.placeholder = 'Ask Copilot or Codex...';
      }}

      playDemoAnimation();
    }}

    function focusClaudeInput() {{
      clearTimers();
      const input = document.getElementById('claude-input');
      if (isAutoDemoResult) {{
        isAutoDemoResult = false;
        appliedSkill = null;
        input.value = '';
        renderClaudeState();
      }}
      input.focus();
    }}

    function clearStage() {{
      clearTimers();
      isAutoDemoResult = false;
      appliedSkill = null;
      if (currentMode === 'claude') {{
        const input = document.getElementById('claude-input');
        input.value = '';
        renderClaudeState();
        input.focus();
      }} else {{
        document.getElementById('chat-history').innerHTML = '';
        const input = document.getElementById('chat-input');
        input.value = '';
        input.focus();
      }}
    }}

    function onClaudeInput() {{
      clearTimers();
      isAutoDemoResult = false;
      const input = document.getElementById('claude-input');
      let val = input.value;

      if (appliedSkill && !val.endsWith(';;')) {{
        appliedSkill = null;
      }}

      // Detect ";;" trigger at the end of the draft
      if (val.endsWith(';;')) {{
        const stripped = val.slice(0, -2).trimEnd();
        const match = findSkillMatch(stripped);
        if (match) {{
          input.value = stripped;
          animateClaudeTrigger(match, false);
          return;
        }}
      }}

      renderClaudeState();
    }}

    function onClaudeKeyDown(e) {{
      if (e.key === 'Tab') {{
        const val = document.getElementById('claude-input').value;
        const match = findSkillMatch(val);
        if (match && !appliedSkill) {{
          e.preventDefault();
          animateClaudeTrigger(match);
        }}
      }} else if (e.key === 'Backspace' && document.getElementById('claude-input').value === '' && appliedSkill) {{
        appliedSkill = null;
        renderClaudeState();
      }}
    }}

    function triggerClaudeRewrite(e) {{
      if (e) e.stopPropagation();
      const val = document.getElementById('claude-input').value;
      const match = findSkillMatch(val);
      if (match) {{
        animateClaudeTrigger(match);
      }}
    }}

    function animateClaudeTrigger(match, fromAuto = false) {{
      clearTimers();
      const semiBox = document.getElementById('claude-semi-box');
      const ghost = document.getElementById('claude-ghost');
      ghost.textContent = '';
      semiBox.style.display = 'inline-block';

      animTimers.push(setTimeout(() => {{
        semiBox.style.display = 'none';
        appliedSkill = match;
        isAutoDemoResult = fromAuto;
        renderClaudeState();
      }}, 360));
    }}

    function renderClaudeState() {{
      const val = document.getElementById('claude-input').value;
      const mirror = document.getElementById('claude-mirror');
      const skillBox = document.getElementById('claude-skill-tag');
      const ghost = document.getElementById('claude-ghost');
      const statusIcon = document.getElementById('claude-status-icon');
      const statusText = document.getElementById('claude-status-text');
      const semiBtn = document.getElementById('claude-semi-btn');

      mirror.textContent = val;

      if (appliedSkill) {{
        skillBox.textContent = '/' + appliedSkill.id;
        skillBox.style.display = 'inline-block';
        ghost.textContent = '';
        statusIcon.style.display = 'none';
        statusText.style.color = '#737373';
        statusText.textContent = `whisper: full  (;; stripped -> /${{appliedSkill.id}} placed at start of prompt)`;
        semiBtn.style.display = 'none';
        return;
      }}

      skillBox.style.display = 'none';
      const match = findSkillMatch(val);

      if (match) {{
        ghost.textContent = `-> Tab: /${{match.id}}`;
        statusIcon.style.display = 'inline-flex';
        statusText.style.color = '#111111';
        statusText.textContent = `/${{match.id}} · ${{match.d}} · end with ;;`;
        semiBtn.style.display = 'inline-block';
      }} else {{
        ghost.textContent = '';
        statusIcon.style.display = 'none';
        statusText.style.color = '#AFAFAF';
        statusText.textContent = 'whisper: full';
        semiBtn.style.display = 'none';
      }}
    }}

    function onChatKeyDown(e) {{
      if (e.key === 'Enter') {{
        submitChatPrompt();
      }}
    }}

    function submitChatPrompt() {{
      clearTimers();
      const input = document.getElementById('chat-input');
      const promptText = input.value.trim();
      if (!promptText) return;

      const sendBtn = document.getElementById('send-btn');
      sendBtn.classList.add('active');

      const match = findSkillMatch(promptText);
      const history = document.getElementById('chat-history');

      animTimers.push(setTimeout(() => {{
        sendBtn.classList.remove('active');
        input.value = '';

        // Stage 1: User message appears in chat
        history.innerHTML = `
          <div class="chat-row">
            <span class="chat-role">You:</span>
            <span class="chat-user-text">${{escapeHtml(promptText)}}</span>
          </div>
          <div class="chat-divider"></div>
          <div class="chat-row" id="agent-reply-row" style="display:none;">
            <span class="chat-role agent">Agent:</span>
            <div class="agent-lines" id="agent-lines"></div>
          </div>
        `;

        // Stage 2: Agent replies step-by-step matching GIFs
        animTimers.push(setTimeout(() => {{
          const replyRow = document.getElementById('agent-reply-row');
          const linesEl = document.getElementById('agent-lines');
          if (!replyRow || !linesEl) return;
          replyRow.style.display = 'flex';

          if (!match) {{
            linesEl.innerHTML = `
              <div class="agent-line body">Direct response (no specialized skill triggered for this prompt).</div>
            `;
            return;
          }}

          if (currentMode === 'gemini') {{
            linesEl.innerHTML = `
              <div class="agent-line bold">${{ICONS.bubble}} <span>Skill: ${{match.id}} — ${{escapeHtml(match.d)}}</span></div>
            `;
            animTimers.push(setTimeout(() => {{
              linesEl.innerHTML += `
                <div class="agent-line muted">${{ICONS.file}} <span>read_file("~/.gemini/config/plugins/${{match.p}}/skills/${{match.id}}/SKILL.md")</span></div>
              `;
            }}, 400));
            animTimers.push(setTimeout(() => {{
              linesEl.innerHTML += `
                <div class="agent-line body"><span>Following the ${{match.id}} workflow: loaded instructions and executing steps.</span></div>
              `;
            }}, 800));
          }} else {{
            linesEl.innerHTML = `
              <div class="agent-line bold">${{ICONS.file}} <span>Matched in copilot-instructions.md: | ${{match.p}} | ${{match.id}} |</span></div>
              <div class="agent-line muted" id="copilot-step2"><span>Reading ${{match.id}}/SKILL.md runbook...</span></div>
            `;
            animTimers.push(setTimeout(() => {{
              const step2 = document.getElementById('copilot-step2');
              if (step2) {{
                step2.className = 'agent-line bold';
                step2.innerHTML = `${{ICONS.bubble}} <span>Using ${{match.id}} runbook:</span>`;
              }}
              linesEl.innerHTML += `
                <div class="agent-line body"><span>await executeVerifiedRunbook('${{match.id}}');</span></div>
              `;
            }}, 550));
          }}
        }}, 280));
      }}, 220));
    }}

    function runPreset(text) {{
      clearTimers();
      appliedSkill = null;

      if (currentMode === 'claude') {{
        const input = document.getElementById('claude-input');
        input.value = '';
        renderClaudeState();
        let i = 0;
        function typeChar() {{
          if (i <= text.length) {{
            input.value = text.slice(0, i);
            renderClaudeState();
            i++;
            animTimers.push(setTimeout(typeChar, 32));
          }} else {{
            const m = findSkillMatch(text);
            if (m) {{
              animTimers.push(setTimeout(() => animateClaudeTrigger(m, true), 550));
            }}
          }}
        }}
        typeChar();
      }} else {{
        const input = document.getElementById('chat-input');
        document.getElementById('chat-history').innerHTML = '';
        input.value = '';
        let i = 0;
        function typeChatChar() {{
          if (i <= text.length) {{
            input.value = text.slice(0, i);
            i++;
            animTimers.push(setTimeout(typeChatChar, 30));
          }} else {{
            animTimers.push(setTimeout(() => submitChatPrompt(), 350));
          }}
        }}
        typeChatChar();
      }}
    }}

    function playDemoAnimation() {{
      if (currentMode === 'claude') {{
        runPreset('plot monthly revenue');
      }} else if (currentMode === 'gemini') {{
        runPreset('test and mock this REST API');
      }} else {{
        runPreset('deploy kubernetes canary rollback');
      }}
    }}

    function escapeHtml(s) {{
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }}

    // Start initial animation matching the GIF
    switchMode('claude');
  </script>
</body>
</html>
"""

for p in [
    Path('playground.html'),
    Path('universal-registry/test_playground.html'),
]:
    p.write_text(html_content, encoding='utf-8')
    print('Updated:', p, f'({len(html_content)} bytes)')
