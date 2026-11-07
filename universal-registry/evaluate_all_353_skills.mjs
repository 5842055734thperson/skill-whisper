import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Load skills_registry.json
const registryPath = path.resolve(__dirname, 'skills_registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

function loadAliases(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '..', filePath);
  let code = fs.readFileSync(absPath, 'utf-8');
  // Attempt zero-eval JSON extraction first
  const start = code.indexOf('{');
  const end = code.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    const jsonStr = code.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Fallback to function evaluation if trailing comments/syntax exist
    }
  }
  code = code
    .replace(/export const ALIASES\s*:\s*Readonly<Record<string,\s*readonly string\[\]>>\s*=/, 'const ALIASES =')
    .replace(/export const ALIASES\s*=/, 'const ALIASES =');
  return new Function(`${code}; return ALIASES;`)();
}

const CLAUDE_ALIASES = loadAliases('universal-registry/generated/claude/aliases.ts');
const UNIVERSAL_ALIASES = loadAliases('universal-registry/generated/universal/aliases.ts');

// 2. Exact replica of hooks/logic.ts matching engine
const shortName = (name) => {
  const idx = name.lastIndexOf(':');
  return idx === -1 ? name : name.slice(idx + 1);
};

function foldTr(s) {
  return s
    .normalize('NFC')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[’'`]/g, '');
}

const SHORT_EXACT_STEMS = new Set(['seo', 'pdf', 'csv', 'svg', 'sql', 'jsx', 'tsx', 'cli', 'api', 'ux']);

function wordMatchesStem(word, stem) {
  if (word === stem) return true;
  if (stem.length >= 4) {
    if (word.startsWith(stem)) return true;
    if (stem.endsWith('k') && word.startsWith(`${stem.slice(0, -1)}g`)) return true;
    if (stem.endsWith('t') && word.startsWith(`${stem.slice(0, -1)}d`)) return true;
    if (stem.endsWith('p') && word.startsWith(`${stem.slice(0, -1)}b`)) return true;
  } else if (SHORT_EXACT_STEMS.has(stem) && stem.length === 3) {
    if (word.startsWith(stem) && word.length <= stem.length + 5) return true;
  }
  return false;
}

const GENERIC_SKILL_WORDS = new Set([
  'ask', 'write', 'make', 'create', 'build', 'get', 'run', 'use', 'with', 'for', 'the', 'and', 'from', 'into',
  'claude', 'skill', 'skills', 'plugin', 'plugins', 'auto', 'better', 'good', 'new', 'pro', 'max', 'code',
  'app', 'dev', 'tool', 'tools', 'helper', 'agent', 'agents', 'user', 'users', 'when', 'this', 'that',
  'help', 'helps', 'using', 'used', 'work', 'workflow', 'workflows', 'mode', 'file', 'files', 'text',
  'data', 'project', 'system', 'review', 'design', 'interface', 'improve', 'remove', 'pick', 'explain',
  'whisper', 'whisper-help', 'whisper-ui', 'reload-plugins', 'reload-skills', 'clear', 'compact', 'login', 'logout',
  'config', 'status', 'cost', 'doctor', 'init', 'memory', 'model', 'permissions', 'resume', 'vim', 'bug',
]);

const BUILTIN_SKIP = new Set([
  'whisper', 'whisper-help', 'whisper-ui', 'reload-plugins', 'reload-skills', 'clear', 'compact', 'help',
  'login', 'logout', 'config', 'status', 'cost', 'doctor', 'init', 'memory', 'model', 'permissions',
  'pr-comments', 'release-notes', 'resume', 'terminal-setup', 'vim', 'bug',
]);

function tokenizeWords(folded) {
  return folded
    .split(/[^a-z0-9.+-]+/)
    .map(w => w.replace(/^[.+-]+|[.+-]+$/g, ''))
    .filter(w => w.length >= 2);
}

const trimDesc = (s, max = 160) => {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
};

const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const byScore = (a, b) => b.score - a.score || b.coverage - a.coverage || a.name.localeCompare(b.name);

const EN_QUESTION_START = new Set([
  'what', 'why', 'how', 'when', 'where', 'which', 'who', 'whom', 'whose', 'does', 'do', 'did',
  'is', 'are', 'was', 'were', 'can', 'could', 'should', 'would', 'will', 'shall',
]);
const EN_POLITE = new Set(['can', 'could', 'would', 'will']);
const TR_QUESTION_ANY = new Set([
  'mi', 'mı', 'mu', 'mü', 'misin', 'mısın', 'musun', 'müsün', 'midir', 'mıdır', 'mudur', 'müdür',
  'nasıl', 'neden', 'niye', 'nedir',
]);
const TR_QUESTION_EDGE = new Set(['ne', 'hangi', 'hangisi', 'kim', 'demek']);

function isQuestion(draft) {
  if (draft.trimEnd().endsWith('?')) return true;
  const words = draft.replace(/İ/g, 'i').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return false;
  const [first, second] = words;
  const last = words[words.length - 1];
  if (EN_QUESTION_START.has(first) && !(EN_POLITE.has(first) && second === 'you')) return true;
  if (words.some(w => TR_QUESTION_ANY.has(w))) return true;
  return TR_QUESTION_EDGE.has(first) || TR_QUESTION_EDGE.has(last);
}

const INTENT_STEMS = [
  'make', 'draw', 'create', 'build', 'generate', 'design', 'add', 'write', 'review', 'check', 'audit',
  'fix', 'deploy', 'migrate', 'convert', 'rewrite', 'analyze', 'analyse', 'improve', 'optimize',
  'refactor', 'brainstorm', 'draft', 'render', 'export', 'turn', 'clean', 'extract', 'teach',
  'ciz', 'yap', 'olustur', 'hazirla', 'tasarla', 'ekle', 'yaz', 'incele', 'denetle', 'duzelt',
  'kontrol', 'analiz', 'donustur', 'cevir', 'iyilestir', 'gelistir', 'cikar', 'ogret', 'temizle',
];

function isConfidentHint(draft, match) {
  if (!match.strong || isQuestion(draft)) return false;
  if (match.score >= 12) return true;
  return tokenizeWords(foldTr(draft)).some(
    w => !match.words.includes(w) && INTENT_STEMS.some(v => w === v || (v.length >= 3 && w.startsWith(v))),
  );
}

function buildLibrary(diskSkills, activeAliases) {
  const groups = new Map();
  for (const [name, disk] of diskSkills.entries()) {
    // Only use exact key lookup if present so prefixed vs unprefixed skills don't cross-contaminate
    const aliases = activeAliases[name] ?? activeAliases[shortName(name)];
    const plugin = name.includes(':') ? name.slice(0, name.lastIndexOf(':')) : '';
    const title = `${plugin || 'Personal and built-in skills'}${disk.manual ? ' (manual-only)' : ''}`;
    const g = groups.get(title) ?? { title, skills: [], ...(disk.manual ? { manual: true } : {}) };
    if (g.skills.some(x => x.name === name)) continue;
    g.skills.push({ name, label: trimDesc(disk.description || name, 70), ...(aliases ? { triggers: aliases } : {}) });
    groups.set(title, g);
  }
  return [...groups.values()];
}

function matchSkillsForDraft(draftText, groups, diskSkills, maxResults = 5) {
  const trimmed = draftText.replace(/^\s+/, '');
  if (trimmed === '' || trimmed.startsWith('!') || trimmed.startsWith('/') || trimmed.length < 6) return [];

  const skills = groups.flatMap(g => g.skills.map(s => ({ s, manual: Boolean(g.manual) })));
  const descOf = (name, label) => (diskSkills.get(name) ?? diskSkills.get(shortName(name)))?.description || label;

  const foldedDraft = foldTr(trimmed);
  const draftWords = tokenizeWords(foldedDraft);
  if (draftWords.length === 0) return [];

  const results = [];
  for (const { s, manual } of skills) {
    const hitWords = new Set();
    let score = 0;
    let aliasHit = false;

    for (const rawTrig of s.triggers ?? []) {
      const ft = foldTr(rawTrig);
      const tWords = tokenizeWords(ft);
      if (tWords.length === 0) continue;
      const hits = tWords.map(tw => draftWords.find(dw => wordMatchesStem(dw, tw)));
      if (hits.every(Boolean)) {
        score += tWords.length >= 2 ? (foldedDraft.includes(ft) ? 12 : 9) : 7;
        aliasHit = true;
        for (const h of hits) hitWords.add(h);
      }
    }

    const short = foldTr(shortName(s.name));
    const parts = short.split(/[-_.:]+/).filter(x => x.length >= 3 && !GENERIC_SKILL_WORDS.has(x));
    let matchedParts = 0;
    for (const part of parts) {
      if (part.length < 4 && !SHORT_EXACT_STEMS.has(part)) continue;
      const w = draftWords.find(dw => dw === part || dw === `${part}s` || dw === `${part}es`);
      if (w) {
        score += 9;
        matchedParts++;
        hitWords.add(w);
      }
    }

    const phrase = short.replace(/[-_.]+/g, ' ');
    const phraseHit = phrase.includes(' ') && new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}($|[^a-z0-9])`).test(foldedDraft);
    if (phraseHit) {
      score += 10;
      for (const w of phrase.split(' ')) hitWords.add(w);
    }

    const descKeywords = new Set(
      tokenizeWords(foldTr(descOf(s.name, s.label))).filter(w => w.length >= 5 && !GENERIC_SKILL_WORDS.has(w)),
    );
    let descHits = 0;
    for (const dw of draftWords) {
      if (dw.length >= 5 && descKeywords.has(dw) && !hitWords.has(dw)) {
        descHits++;
        hitWords.add(dw);
      }
    }
    score += Math.min(descHits * 4, 8);

    if (score < (aliasHit ? 7 : 8)) continue;
    const coverage = parts.length ? matchedParts / parts.length : 0;
    const strong = aliasHit || phraseHit || (parts.length >= 2 && coverage === 1) || hitWords.size >= 2;
    results.push({ name: s.name, reason: s.label, manual, score, strong, coverage, words: [...hitWords] });
  }

  return results.sort(byScore).slice(0, maxResults);
}

// 3. Negative Control Prompts (50 realistic everyday coding & general prompts)
const NEGATIVE_PROMPTS = [
  "fare üzerine gelince butonun arka plan rengini css ile mavi yap",
  "menü açılınca hafifçe zıplayan yay efektinin adı ne?",
  "what is the difference between let and const in javascript?",
  "how do I reverse a linked list in python?",
  "git status çıktısında untracked files görünüyor ne yapmalıyım",
  "for döngüsü içinde dizi elemanlarını toplamak istiyorum",
  "bu fonksiyon neden undefined döndürüyor?",
  "react state güncellendiğinde bileşen neden tekrar render olmuyor",
  "python list comprehension ile çift sayıları filtrele",
  "sql sorgusunda inner join ile left join farkı nedir",
  "docker container çalışıyor mu nasıl bakarım",
  "npm install yaparken peer dependency hatası alıyorum",
  "bu değişkenin adını camelCase olarak değiştir",
  "terminalde çalışan portu nasıl kapatırım",
  "typescript interface ile type arasındaki fark nedir",
  "merhaba bugün nasılsın",
  "teşekkür ederim eline sağlık",
  "bu dosyadaki satır sayısını bul",
  "string içindeki boşlukları temizle",
  "tarih formatını YYYY-MM-DD olarak yazdır",
  "how does garbage collection work in Go?",
  "why is my promise not resolving?",
  "write a function to calculate fibonacci numbers",
  "check if a number is prime in rust",
  "convert this json string to a dictionary",
  "sort an array of objects by date descending",
  "read a text file line by line in nodejs",
  "remove duplicate items from an array",
  "center a div horizontally and vertically using flexbox",
  "add a border radius to the card element",
  "change font size to 16px on mobile screens",
  "hide the scrollbar in css",
  "make the navbar sticky at the top of the page",
  "parse command line arguments in python",
  "handle division by zero exception",
  "create a virtual environment in python",
  "upgrade pip to the latest version",
  "show current working directory in bash",
  "find all files modified in the last 24 hours",
  "count number of words in a string",
  "bu iş bugün biter mi?",
  "akşam iş çıkışı ne yapacaksın?",
  "projedeki search input alanının genişliğini 300px yap",
  "kullanıcı auth token süresini 1 saate çıkar",
  "bu değişkenleri (variables) dosyadan oku",
  "veri akışını (flows) kontrol eden if bloğunu düzelt",
  "kuyruktaki (queues) mesaj sayısını ekrana yazdır",
  "alan adlarını (domains) alfabetik sırala",
  "doğrulama (verification) kodunu 6 haneli yap",
  "kimlik bilgilerini (credentials) env dosyasından al"
];

function generatePromptsForSkill(skill) {
  const short = shortName(skill.id).replace(/[-_.]+/g, ' ');
  const aliases = skill.aliases || [];
  const descWords = tokenizeWords(foldTr(skill.description || ''))
    .filter(w => w.length >= 5 && !GENERIC_SKILL_WORDS.has(w))
    .slice(0, 4)
    .join(' ');

  const bestAlias = aliases.length > 0
    ? [...aliases].sort((a, b) => b.split(' ').length - a.split(' ').length)[0]
    : short;

  const p1 = `projede ${bestAlias} işlemini uygulayalım ve hazırlayalım`;
  const p2 = `please create and run ${bestAlias} for ${descWords || short}`;

  return [
    { lang: 'tr/alias', text: p1 },
    { lang: 'en/name-desc', text: p2 }
  ];
}

function evaluateSubset(modeName, skillsSubset, activeAliases) {
  const diskSkills = new Map();
  for (const s of skillsSubset) {
    diskSkills.set(s.id, {
      name: s.id,
      description: s.description || '',
      manual: Boolean(s.manual)
    });
  }

  const groups = buildLibrary(diskSkills, activeAliases);

  let top1Hits = 0;
  let top3Hits = 0;
  let confidentHits = 0;
  let totalPrompts = 0;
  const skillResults = [];
  const failedSkills = [];

  for (const skill of skillsSubset) {
    const prompts = generatePromptsForSkill(skill);
    const outcomes = [];

    for (const p of prompts) {
      totalPrompts++;
      const matches = matchSkillsForDraft(p.text, groups, diskSkills, 5);
      const top1 = matches[0];
      const inTop1 = top1?.name === skill.id;
      const inTop3 = matches.slice(0, 3).some(m => m.name === skill.id);
      const isConf = top1 ? isConfidentHint(p.text, top1) : false;

      if (inTop1) top1Hits++;
      if (inTop3) top3Hits++;
      if (inTop1 && isConf) confidentHits++;

      outcomes.push({
        lang: p.lang,
        prompt: p.text,
        inTop1,
        inTop3,
        isConfident: inTop1 && isConf,
        topMatch: top1 ? { name: top1.name, score: top1.score, strong: top1.strong } : null,
        targetRank: matches.findIndex(m => m.name === skill.id) + 1
      });
    }

    const passedTop1 = outcomes.some(o => o.inTop1);
    const passedTop3 = outcomes.some(o => o.inTop3);
    if (!passedTop1) {
      failedSkills.push({
        id: skill.id,
        plugin: skill.plugin,
        aliases: skill.aliases,
        outcomes
      });
    }

    skillResults.push({
      id: skill.id,
      plugin: skill.plugin,
      targets: skill.targets,
      aliasCount: (skill.aliases || []).length,
      passedTop1,
      passedTop3,
      outcomes
    });
  }

  const falsePositives = [];
  for (const neg of NEGATIVE_PROMPTS) {
    const matches = matchSkillsForDraft(neg, groups, diskSkills, 3);
    const top = matches[0];
    if (top && isConfidentHint(neg, top)) {
      falsePositives.push({
        prompt: neg,
        matchedSkill: top.name,
        score: top.score,
        strong: top.strong,
        words: top.words
      });
    }
  }

  return {
    mode: modeName,
    evaluatedSkills: skillResults.length,
    totalPositivePrompts: totalPrompts,
    promptLevelTop1Recall: `${top1Hits}/${totalPrompts} (${((top1Hits / totalPrompts) * 100).toFixed(2)}%)`,
    promptLevelTop3Recall: `${top3Hits}/${totalPrompts} (${((top3Hits / totalPrompts) * 100).toFixed(2)}%)`,
    promptLevelConfidentRecall: `${confidentHits}/${totalPrompts} (${((confidentHits / totalPrompts) * 100).toFixed(2)}%)`,
    skillLevelTop1Pass: `${skillResults.filter(s => s.passedTop1).length}/${skillResults.length} (${((skillResults.filter(s => s.passedTop1).length / skillResults.length) * 100).toFixed(2)}%)`,
    skillLevelTop3Pass: `${skillResults.filter(s => s.passedTop3).length}/${skillResults.length} (${((skillResults.filter(s => s.passedTop3).length / skillResults.length) * 100).toFixed(2)}%)`,
    negativeControlsTotal: NEGATIVE_PROMPTS.length,
    falsePositivesCount: falsePositives.length,
    falsePositiveRate: `${falsePositives.length}/${NEGATIVE_PROMPTS.length} (${((falsePositives.length / NEGATIVE_PROMPTS.length) * 100).toFixed(2)}%)`,
    falsePositives,
    failedSkillsCount: failedSkills.length,
    failedSkills,
    skillResults
  };
}

const claudeSkills = registry.skills.filter(s => s.targets.includes('claude'));
const antigravitySkills = registry.skills.filter(s => s.targets.includes('antigravity'));
const allSkills = registry.skills;

const claudeEval = evaluateSubset(`Claude Target (${claudeSkills.length} Skills)`, claudeSkills, CLAUDE_ALIASES);
const antigravityEval = evaluateSubset(`Antigravity Target (${antigravitySkills.length} Skills)`, antigravitySkills, UNIVERSAL_ALIASES);
const universalEval = evaluateSubset(`Universal Combined (${allSkills.length} Skills)`, allSkills, UNIVERSAL_ALIASES);

const report = {
  claudeMode: { ...claudeEval, skillResults: undefined },
  antigravityMode: { ...antigravityEval, skillResults: undefined },
  universalMode: { ...universalEval, skillResults: undefined },
};

fs.writeFileSync(path.resolve(__dirname, 'eval_353_report.json'), JSON.stringify({
  summary: report,
  allSkillResults: universalEval.skillResults
}, null, 2), 'utf-8');

console.log(JSON.stringify(report, null, 2));
