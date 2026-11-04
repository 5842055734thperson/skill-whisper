"""Baseline: does Claude Code pick the right skill with skill-pilot turned off?

Runs each prompt in prompts.jsonl through `claude -p` (headless, tools that change
anything disallowed, 2 turns max), records which skills the Skill tool was called
with and whether the final text names an expected skill, then scores.

Usage: python run_baseline.py [run_label]
"""
import json, os, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
LABEL = sys.argv[1] if len(sys.argv) > 1 else "run1"
PILOT_ON = len(sys.argv) > 2 and sys.argv[2] == "pilot"  # keep the current skill-pilot mod enabled
OUT = os.path.join(HERE, "out", LABEL)
os.makedirs(OUT, exist_ok=True)
WORK = tempfile.mkdtemp(prefix="pilot-eval-")  # empty cwd, no project files

CMD = ["claude", "-p", None,
       "--settings", json.dumps({"enabledPlugins": {"skill-pilot@5842055734thperson-mods": PILOT_ON}}),
       "--max-turns", "2",
       "--disallowedTools", "Bash,PowerShell,Write,Edit,NotebookEdit,Agent,WebSearch,WebFetch",
       "--output-format", "stream-json", "--verbose", "--no-session-persistence"]


def run(case):
    path = os.path.join(OUT, f"{case['id']:02d}.jsonl")
    if not os.path.exists(path):
        cmd = list(CMD); cmd[2] = case["prompt"]
        with open(path, "w", encoding="utf8") as f:
            subprocess.run(cmd, stdout=f, stderr=subprocess.DEVNULL, cwd=WORK, timeout=600)
    invoked, text = [], ""
    for line in open(path, encoding="utf8"):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("type") == "assistant":
            for c in d["message"].get("content", []):
                if c.get("type") == "tool_use" and c.get("name") == "Skill":
                    invoked.append(c["input"].get("skill", ""))
                if c.get("type") == "text":
                    text += c["text"] + "\n"
        if d.get("type") == "result":
            text += d.get("result") or ""
    return case, invoked, text


def short(name):
    return name.split(":")[-1]


def score(case, invoked, text):
    exp = case["expect"]
    if not exp:
        # ponytail is injected by a session hook for every task, so a ponytail call is not a routing pick
        picks = [s for s in invoked if not s.startswith("ponytail")]
        return ("PASS" if not picks else "FALSE_POSITIVE"), picks
    hit = [s for s in invoked if s in exp or short(s) in map(short, exp)]
    if hit:
        return "INVOKED", hit
    # a bare word like "learn" is not a mention; require /name or `name`
    named = [e for e in exp if any(m in text for m in (f"/{short(e)}", f"`{short(e)}`", f"`{e}`"))]
    if named:
        return "NAMED_ONLY", named
    return ("WRONG_SKILL" if invoked else "NO_SKILL"), invoked


cases = [json.loads(l) for l in open(os.path.join(HERE, "prompts.jsonl"), encoding="utf8") if l.strip()]
with ThreadPoolExecutor(5) as pool:
    results = list(pool.map(lambda c: run(c), cases))

rows, tally = [], {}
for case, invoked, text in results:
    verdict, detail = score(case, invoked, text)
    tally[verdict] = tally.get(verdict, 0) + 1
    rows.append({"id": case["id"], "manual": case.get("manual", False), "expect": case["expect"],
                 "verdict": verdict, "detail": detail, "all_skill_calls": invoked})
with open(os.path.join(OUT, "scores.json"), "w", encoding="utf8") as f:
    json.dump({"tally": tally, "rows": rows}, f, indent=1)

pos = [r for r in rows if r["expect"]]
auto = [r for r in pos if not r["manual"]]
print(f"auto-invocable skills ({len(auto)}): invoked {sum(r['verdict']=='INVOKED' for r in auto)}, "
      f"named only {sum(r['verdict']=='NAMED_ONLY' for r in auto)}")
print(f"manual-only skills ({len(pos)-len(auto)}): named {sum(r['verdict']=='NAMED_ONLY' for r in pos if r['manual'])}")
print(f"no-skill prompts (10): stayed quiet {sum(r['verdict']=='PASS' for r in rows if not r['expect'])}")
for r in rows:
    print(r["id"], r["verdict"], r["detail"], "| calls:", r["all_skill_calls"])
