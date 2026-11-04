"""Build the skill catalog /pilot would see: every skill and slash-command skill the
session lists (from a stream-json init event), with its full SKILL.md description.

shortcut: scans SKILL.md files on disk and matches by name; the real mod will use
$.command.list() instead, which already knows names and enabled state.

Usage: python build_catalog.py <stream-json file with an init event>  -> catalog.json
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.path.expanduser("~/.claude")


def init_names(path):
    for line in open(path, encoding="utf8"):
        d = json.loads(line)
        if d.get("subtype") == "init":
            return d.get("skills") or [], d.get("slash_commands") or []
    sys.exit("no init event")


def frontmatter(path):
    text = open(path, encoding="utf8", errors="replace").read()
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    if not m:
        return {}
    fm, out, key = m.group(1), {}, None
    for line in fm.splitlines():
        kv = re.match(r"^([A-Za-z_-]+):\s*(.*)$", line)
        if kv:
            key, val = kv.group(1), kv.group(2).strip()
            out[key] = val.strip("'\"") if val not in (">", "|", ">-", "|-") else ""
        elif key and line.startswith((" ", "\t")):
            out[key] = (out[key] + " " + line.strip()).strip()
    return out


def all_skill_files():
    # plugin layouts vary (skills/, .claude/skills/, cli/assets/...), so search recursively
    files = []
    for p in ["skills/**/SKILL.md", "plugins/cache/**/SKILL.md", "plugins/synced/**/SKILL.md"]:
        files += glob.glob(os.path.join(HOME, p), recursive=True)
    files += glob.glob(os.path.expanduser("~/AppData/Local/Temp/claude/bundled-skills/*/*/*/SKILL.md"))
    return files


skills, slash = init_names(sys.argv[1])
index = {}  # short name -> list of (path, frontmatter)
for f in all_skill_files():
    fm = frontmatter(f)
    short = fm.get("name") or os.path.basename(os.path.dirname(f))
    index.setdefault(short, []).append((f.replace("\\", "/"), fm))

catalog = []
for name in sorted(set(skills) | set(slash)):
    plugin, _, short = name.rpartition(":")
    cands = index.get(short, [])
    if plugin:
        cands = [c for c in cands if f"/{plugin}/" in c[0] or "synced" in c[0]] or cands
    if not cands:
        if name in skills:  # built-in skill with no file on disk
            catalog.append({"name": name, "description": "", "manual": False})
        continue  # a plain slash command, not a skill
    cands.sort(key=lambda c: os.path.getmtime(c[0]), reverse=True)  # newest plugin version
    fm = cands[0][1]
    catalog.append({"name": name,
                    "description": fm.get("description", "")[:600],
                    "manual": fm.get("disable-model-invocation", "").lower() == "true" or name not in skills})

json.dump(catalog, open(os.path.join(HERE, "catalog.json"), "w", encoding="utf8"), indent=1)
print(len(catalog), "skills;", sum(c["manual"] for c in catalog), "manual-only;",
      sum(not c["description"] for c in catalog), "without description")
