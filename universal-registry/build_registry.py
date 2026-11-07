import argparse
import json
import os
import re
import sys
from pathlib import Path

# Curated descriptions for Claude catalog skills that had empty descriptions in catalog.json
FALLBACK_DESCRIPTIONS = {
    "artifact-capabilities": "Create interactive HTML/React artifacts, visual widgets, dashboards, and rich formatted previews.",
    "artifact-diagramming": "Render structured Mermaid flowcharts, sequence diagrams, architecture topologies, and ER diagrams.",
    "batch": "Execute batch operations, bulk file transformations, and parallelized multi-item processing.",
    "claude-api": "Build applications with the Anthropic Claude API, Messages endpoint, tool use, prompt caching, and SDKs.",
    "code-review": "Run comprehensive code reviews on pull requests, local git diffs, security flaws, and quality regressions.",
    "dataviz": "Build data visualizations, statistical charts, time-series plots, bar/line graphs, and visual analytics.",
    "debug": "Diagnose runtime exceptions, stack traces, crash logs, and failing test cases to isolate root causes.",
    "design-sync": "Synchronize design tokens, Figma variables, color palettes, typography scales, and component styles with code.",
    "doctor": "Diagnose environment health, configuration issues, broken dependencies, and CLI setup problems.",
    "fewer-permission-prompts": "Configure safe tool allowlists and permission boundaries to reduce repetitive confirmation prompts.",
    "loop": "Run recurring autonomous loops, polling tasks, and iterative improvement cycles until completion criteria pass.",
    "plugin-authoring": "Scaffold, structure, and package custom agent plugins with manifests, skills, hooks, and MCP configurations.",
    "run": "Execute project scripts, build tasks, custom runners, and automated command workflows.",
    "run-skill-generator": "Generate new agent skills, SKILL.md runbooks, frontmatter definitions, and trigger examples.",
    "schedule": "Schedule recurring cron tasks, delayed execution jobs, and automated periodic agent workflows.",
    "send-to-project": "Export, transfer, and sync generated artifacts, templates, or code modules into a target project directory.",
    "simplify": "Refactor complex code for clarity, reduce cognitive load, remove dead abstractions, and simplify logic.",
    "ui-ux-pro-max:ui-ux-pro-max": "End-to-end UI/UX design system orchestration, layout architecture, visual hierarchy, and interactive polish.",
    "update-config": "Modify and validate workspace configuration files, JSON settings, environment options, and preferences.",
    "verify": "Run end-to-end verification checks, build validations, test suites, and pre-commit assertions.",
    "workflow-authoring": "Author multi-step automated workflows, CI/CD pipelines, and orchestrated agent task sequences.",
}

# Curated bilingual (Turkish + English) multi-word aliases for skills lacking aliases or needing disambiguation
CURATED_ALIASES = {
    "animate-expo": ["animate expo", "expo animasyon", "reanimated animasyon", "mobil expo hareket"],
    "animation-performance": ["animasyon performansi", "frame budget", "60fps animation", "jank analizi"],
    "anthropic-skills:built-in-browser": ["yerlesik tarayici", "built-in browser", "dahili browser"],
    "anthropic-skills:chrome-browser": ["chrome eklentisi", "chrome browser", "claude in chrome"],
    "anthropic-skills:computer-use": ["bilgisayar kullanimi", "computer use", "masaustu otomasyon"],
    "anthropic-skills:deep-research": ["kapsamli kaynak arastirmasi", "multi-source deep research", "literatur taramasi"],
    "anthropic-skills:docs": ["paylasimli dokuman", "editable docs", "ortak belge yaz"],
    "anthropic-skills:google-workspace": ["google workspace baglantisi", "drive docs sheets entegrasyonu"],
    "anthropic-skills:import-memory": ["hafiza ice aktar", "import memory", "gecmis sohbet hafizasi"],
    "anthropic-skills:morning": ["sabah bulteni", "morning brief", "gunluk ozet raporu"],
    "anthropic-skills:remove-ai-marks": ["ai izlerini temizle", "remove ai marks", "filigran kaldir"],
    "anthropic-skills:skill-creator": ["yeni beceri tasarla", "skill creator", "beceri olusturucu"],
    "artifact-capabilities": ["interaktif artifact", "artifact capabilities", "canli bilesen"],
    "artifact-diagramming": ["artifact diyagram", "artifact diagramming", "gorsel sema"],
    "ask-sonner": ["sonner toast", "bildirim balonu", "react sonner"],
    "batch": ["toplu islem", "batch processing", "coklu dosya isle"],
    "claude-api": ["anthropic sdk", "claude api entegrasyonu", "messages api"],
    "claude-seo:seo-dataforseo": ["dataforseo", "serp verisi", "anahtar kelime hacmi"],
    "claude-seo:seo-flow": ["seo flow", "find leverage optimize win", "kanit odakli seo"],
    "claude-seo:seo-google": ["google search console", "pagespeed insights", "crUX metrikleri"],
    "deep-research": ["derin arastirma yap", "deep research report", "konu arastirmasi"],
    "design": ["kapsamli tasarim", "comprehensive design tokens", "urun tasarimi"],
    "design-sync": ["tasarim senkronizasyonu", "design sync", "token esitle"],
    "doctor": ["ortam tanilama", "sistem doktoru", "kurulum kontrolu"],
    "fewer-permission-prompts": ["izin onaylarini azalt", "fewer permission prompts", "otomatik izin"],
    "find-animation-opportunities": ["animasyon firsatlari", "find animation opportunities", "hareket onerileri"],
    "learning-framework:learn": ["kavramsal ogrenme", "intellectual understanding", "derinlemesine ogren"],
    "loop": ["dongusel gorev", "recurring loop", "otonom dongu"],
    "plugin-authoring": ["eklenti gelistirme", "plugin authoring", "yeni plugin paketi"],
    "ponytail:ponytail": ["ponytail modu", "lazy senior dev", "en kucuk degisiklik"],
    "ponytail:ponytail-gain": ["ponytail tasarrufu", "ponytail gain", "maliyet kazanci"],
    "ponytail:ponytail-help": ["ponytail yardim", "ponytail help", "ponytail komutlari"],
    "remember:remember": ["oturum durumunu kaydet", "save session state", "hafizaya kaydet"],
    "reverse-engineer-anything": ["ikili dosya tersine muhendislik", "reverse engineer binary", "firmware analizi"],
    "run": ["komut betigi calistir", "run project script", "gorev yurutucu"],
    "run-skill-generator": ["beceri uretici calistir", "run skill generator", "otomatik skill uret"],
    "schedule": ["zamanlanmis gorev", "scheduled cron task", "periyodik calistir"],
    "send-to-project": ["projeye aktar", "send to project", "hedef projeye kopyala"],
    "slides": ["stratejik sunum", "html slides chartjs", "interaktif sunum"],
    "update-config": ["yapilandirma guncelle", "update config file", "ayar dosyasi duzenle"],
    "vercel-cli-with-tokens": ["vercel token cli", "tokenli vercel dagitimi", "vercel cli auth"],
    "vercel-optimize": ["vercel maliyet optimizasyonu", "vercel optimize", "serverless performans"],
    "vercel-react-native-skills": ["vercel react native", "expo mobil performans", "react native mobile skills"],
    "vercel-react-view-transitions": ["view transitions api", "react sayfa gecisi", "viewtransition animasyon"],
    "verify": ["dogrulama kontrolu", "run verification suite", "sonuc dogrula"],
    "web-design-guidelines": ["web arayuz kurallari", "web design guidelines", "ui uyumluluk denetimi"],
    "workflow-authoring": ["is akisi yazimi", "workflow authoring", "otomasyon akisi tasarla"],
    "write-swift": ["modern swift kodu", "write swift", "swift 6 concurrency"],
    "whisper-me-a-skill": ["whisper me a skill", "online skill ara", "webden skill bul", "yeni skill indir", "skills sh ara"],
}

# Aliases for skills of other agents (Antigravity, Gemini, Copilot) depend on what one machine has
# installed, so they live in a local, git-ignored file next to this script.
_LOCAL_ALIASES = Path(__file__).resolve().parent / "local_aliases.json"
if _LOCAL_ALIASES.exists():
    CURATED_ALIASES.update(json.loads(_LOCAL_ALIASES.read_text(encoding="utf-8")))


def dedup_preserve_order(items):
    return list(dict.fromkeys(x for x in items if x))


def parse_skill_frontmatter(raw_text):
    """Deterministic YAML frontmatter parser matching logic.ts + handling block scalars & quotes."""
    m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---", raw_text)
    if not m:
        return {"name": None, "description": "", "manual": False}

    block = m.group(1)
    out = {}
    current_key = None

    for line in block.splitlines():
        kv = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if kv:
            current_key = kv.group(1)
            val = kv.group(2).strip()
            if val in (">", "|", ">-", "|-"):
                out[current_key] = ""
            else:
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                out[current_key] = val.strip()
        elif current_key is not None and (line.startswith(" ") or line.startswith("\t") or line.strip() == ""):
            stripped = line.strip()
            if not stripped:
                continue
            # Strip stray leading pipe if malformed block scalar
            if not out[current_key] and stripped.startswith("|"):
                stripped = re.sub(r"^\|-?\s*", "", stripped)
            out[current_key] = f"{out[current_key]} {stripped}".strip() if out[current_key] else stripped
        else:
            current_key = None

    desc = re.sub(r"\s+", " ", out.get("description", "")).strip()
    desc = desc.strip("'\" ").replace("''", "'")
    desc = re.sub(r"^\|-?\s*", "", desc).strip()

    manual = out.get("disable-model-invocation", "").strip().lower() == "true"
    return {
        "name": out.get("name", "").strip() or None,
        "description": desc,
        "manual": manual,
    }


def clean_catalog_description(desc, skill_id):
    if not desc or not desc.strip():
        return FALLBACK_DESCRIPTIONS.get(skill_id, f"Specialized workflow and runbook for {skill_id}.")
    cleaned = desc.replace("\\n", " ").replace('\\"', '"')
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def resolve_default_paths():
    home = Path.home()
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent  # skill-pilot-eval or parent workspace

    claude_config = Path(os.environ.get("CLAUDE_CONFIG_DIR", home / ".claude"))
    gemini_config = Path(os.environ.get("GEMINI_CONFIG_DIR", home / ".gemini"))

    aliases_candidates = [
        repo_root.parent / "skill-whisper-publish" / "hooks" / "aliases.ts",
        repo_root / "skill-whisper-publish" / "hooks" / "aliases.ts",
        script_dir.parent / "hooks" / "aliases.ts",
    ]
    aliases_path = next((p for p in aliases_candidates if p.exists()), aliases_candidates[0])

    catalog_candidates = [
        repo_root / "catalog.json",
        script_dir / "catalog.json",
    ]
    catalog_path = next((p for p in catalog_candidates if p.exists()), catalog_candidates[0])

    return {
        "home": home,
        "claude_config": claude_config,
        "gemini_config": gemini_config,
        "aliases_path": aliases_path,
        "catalog_path": catalog_path,
    }


def extract_claude_aliases(aliases_path=None):
    if aliases_path is None:
        aliases_path = resolve_default_paths()["aliases_path"]
    if not aliases_path.exists():
        return {}
    content = aliases_path.read_text(encoding="utf-8")

    pattern = re.compile(r'"([^"]+)"\s*:\s*\[([^\]]*)\]', re.MULTILINE | re.DOTALL)
    aliases_dict = {}
    for match in pattern.finditer(content):
        key = match.group(1)
        items = re.findall(r'"([^"]+)"', match.group(2))
        # Case-insensitive deduplication while preserving order
        seen_lower = set()
        deduped = []
        for item in items:
            low = item.lower()
            if low not in seen_lower:
                seen_lower.add(low)
                deduped.append(item)
        aliases_dict[key] = deduped
    return aliases_dict


def build_multiword_fallback_aliases(skill_id, plugin_name):
    """Generates safe, multi-word aliases for skills not in CURATED_ALIASES. Never emits 1-word aliases."""
    if skill_id in CURATED_ALIASES:
        return dedup_preserve_order(CURATED_ALIASES[skill_id])

    spaced = re.sub(r"[-_.:]+", " ", skill_id).strip()
    words = spaced.split()
    if len(words) >= 2:
        # Multi-word skill ID: use the spaced phrase (e.g. "figma generate design")
        return dedup_preserve_order([spaced])
    else:
        # Single-word skill ID: qualify with plugin name so it is never a 1-word poison alias
        clean_plugin = re.sub(r"[-_]+", " ", plugin_name.replace("-plugin", "")).strip()
        return dedup_preserve_order([f"{clean_plugin} {spaced}"])


def extract_antigravity_skills(plugins_dir=None):
    if plugins_dir is None:
        plugins_dir = resolve_default_paths()["gemini_config"] / "config" / "plugins"
    if not plugins_dir.exists():
        return []

    ag_skills = []
    skill_files = sorted(
        plugins_dir.glob("*/skills/*/SKILL.md"),
        key=lambda p: (p.parent.parent.parent.name, p.parent.name),
    )

    for skill_file in skill_files:
        plugin_name = skill_file.parent.parent.parent.name
        folder_name = skill_file.parent.name

        try:
            text = skill_file.read_text(encoding="utf-8", errors="ignore")
            fm = parse_skill_frontmatter(text)
            skill_id = fm["name"] or folder_name
            desc = fm["description"] or FALLBACK_DESCRIPTIONS.get(
                skill_id, f"Specialized {plugin_name} skill for {skill_id}."
            )
            manual = fm["manual"]

            aliases = build_multiword_fallback_aliases(skill_id, plugin_name)

            ag_skills.append({
                "id": skill_id,
                "plugin": plugin_name,
                "description": desc,
                "manual": manual,
                "aliases": aliases,
                "targets": ["antigravity", "gemini", "copilot"],
            })
        except Exception as err:
            print(f"[WARN] Skipping malformed skill file {skill_file}: {err}", file=sys.stderr)
            continue

    local_skills_dir = Path(__file__).resolve().parent / "skills"
    if local_skills_dir.exists():
        for skill_file in sorted(local_skills_dir.glob("*/SKILL.md")):
            folder_name = skill_file.parent.name
            plugin_name = "skill-whisper"
            try:
                text = skill_file.read_text(encoding="utf-8", errors="ignore")
                fm = parse_skill_frontmatter(text)
                skill_id = fm["name"] or folder_name
                desc = fm["description"] or f"Specialized {plugin_name} skill for {skill_id}."
                manual = fm["manual"]
                aliases = build_multiword_fallback_aliases(skill_id, plugin_name)
                ag_skills.append({
                    "id": skill_id,
                    "plugin": plugin_name,
                    "description": desc,
                    "manual": manual,
                    "aliases": aliases,
                    "targets": ["claude", "antigravity", "gemini", "copilot"],
                })
            except Exception as err:
                print(f"[WARN] Skipping local skill file {skill_file}: {err}", file=sys.stderr)
                continue

    return ag_skills


def main():
    defaults = resolve_default_paths()
    parser = argparse.ArgumentParser(description="Builds canonical skills_registry.json across installed agent skills")
    parser.add_argument("--catalog", default=str(defaults["catalog_path"]), help="Path to Claude catalog.json")
    parser.add_argument("--aliases", default=str(defaults["aliases_path"]), help="Path to hooks/aliases.ts")
    parser.add_argument(
        "--plugins-dir",
        default=str(defaults["gemini_config"] / "config" / "plugins"),
        help="Path to Antigravity/Gemini plugins directory",
    )
    parser.add_argument("-o", "--output", default="universal-registry/skills_registry.json", help="Output registry path")
    args = parser.parse_args()

    catalog_path = Path(args.catalog)
    catalog = []
    if catalog_path.exists():
        with open(catalog_path, encoding="utf-8") as f:
            catalog = json.load(f)

    claude_aliases = extract_claude_aliases(Path(args.aliases))
    ag_skills = extract_antigravity_skills(Path(args.plugins_dir))

    print(
        f"Loaded {len(catalog)} Claude catalog skills, "
        f"{len(claude_aliases)} Claude alias sets, and "
        f"{len(ag_skills)} Antigravity skills."
    )

    registry = {
        "$schema": "./registry.schema.json",
        "version": "1.1.0",
        "generated_by": "universal-whisper-compiler",
        "skills": [],
    }

    by_id = {}

    # 1. Add Claude catalog skills
    for item in catalog:
        name = item["name"]
        desc = clean_catalog_description(item.get("description", ""), name)
        manual = bool(item.get("manual", False))
        aliases = claude_aliases.get(name) or CURATED_ALIASES.get(name, [])
        aliases = dedup_preserve_order(aliases)
        plugin = name.split(":")[0] if ":" in name else "claude-core"

        entry = {
            "id": name,
            "plugin": plugin,
            "description": desc,
            "manual": manual,
            "aliases": aliases,
            "targets": ["claude"],
        }
        registry["skills"].append(entry)
        by_id[name] = entry

    # 2. Add any extra Claude aliases not in catalog
    for name, aliases in sorted(claude_aliases.items()):
        if name not in by_id:
            plugin = name.split(":")[0] if ":" in name else "claude-builtins"
            desc = FALLBACK_DESCRIPTIONS.get(name, f"Built-in Claude skill for {name}.")
            entry = {
                "id": name,
                "plugin": plugin,
                "description": desc,
                "manual": False,
                "aliases": dedup_preserve_order(aliases),
                "targets": ["claude"],
            }
            registry["skills"].append(entry)
            by_id[name] = entry

    # 3. Add or merge Antigravity skills deterministically
    for ag_s in ag_skills:
        skill_id = ag_s["id"]
        prefixed_id = f"{ag_s['plugin']}:{skill_id}"

        if skill_id in by_id or prefixed_id in by_id:
            existing = by_id.get(skill_id) or by_id[prefixed_id]
            existing["targets"] = dedup_preserve_order(existing["targets"] + ag_s["targets"])
            existing["aliases"] = dedup_preserve_order(existing["aliases"] + ag_s["aliases"])
            if not existing["description"] or existing["description"].startswith("Built-in") or existing["description"].startswith("Run comprehensive"):
                if ag_s["description"]:
                    existing["description"] = ag_s["description"]
        else:
            registry["skills"].append(ag_s)
            by_id[skill_id] = ag_s

    out_file = Path(args.output)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Successfully generated {out_file} with {len(registry['skills'])} total universal skills!")


if __name__ == "__main__":
    main()
