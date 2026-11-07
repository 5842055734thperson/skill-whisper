import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

exe_ext = ".exe" if sys.platform == "win32" else ""
BINARY_PATH = Path(f"universal-registry/compiler-rust/target/release/skill-whisper-compiler{exe_ext}")
PYTHON_COMPILER = Path("universal-registry/compiler.py")
BUILD_REGISTRY = Path("universal-registry/build_registry.py")
REGISTRY_PATH = Path("universal-registry/skills_registry.json")
GENERATED_DIR = Path("universal-registry/generated")
EVAL_SCRIPT = Path("universal-registry/evaluate_all_353_skills.mjs")

GENERATED_REL_PATHS = [
    Path("claude/aliases.ts"),
    Path("universal/aliases.ts"),
    Path("antigravity/AGENTS.md"),
    Path("antigravity/GEMINI.md"),
    Path("copilot/copilot-instructions.md"),
]

POISON_SINGLE_WORDS = {
    "search", "auth", "variables", "flows", "queues", "domains",
    "verification", "credentials", "plugin", "browse", "datasets", "eve",
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_test(name, func):
    print(f"\n[TEST] {name}...", end=" ", flush=True)
    try:
        func()
        print("PASS")
        return True
    except AssertionError as e:
        print(f"FAIL: {e}")
        return False
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        return False


def test_binary_exists():
    assert BINARY_PATH.exists(), f"Rust binary not found at {BINARY_PATH}"
    size = BINARY_PATH.stat().st_size
    assert size > 500_000, f"Binary suspiciously small: {size} bytes"


def test_cli_help():
    res = subprocess.run([str(BINARY_PATH), "--help"], capture_output=True, text=True)
    assert res.returncode == 0, f"Help failed with returncode {res.returncode}"
    assert "Usage: skill-whisper-compiler" in res.stdout, "Missing usage text"
    assert "--input" in res.stdout, "Missing --input in help"


def test_missing_input_error_handling():
    res = subprocess.run([str(BINARY_PATH), "--input", "non_existent_file.json"], capture_output=True, text=True)
    assert res.returncode != 0, "Compiler should return non-zero exit code on missing input file"


def test_malformed_json_error_handling():
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_file = Path(tmpdir) / "bad.json"
        temp_file.write_text("{ this is not valid json }", encoding="utf-8")
        res = subprocess.run([str(BINARY_PATH), "--input", str(temp_file)], capture_output=True, text=True)
        assert res.returncode != 0, "Compiler should return non-zero exit code on malformed JSON"


def test_cli_argument_validation():
    res = subprocess.run([str(BINARY_PATH), "--unknown-flag"], capture_output=True, text=True)
    assert res.returncode != 0, "Compiler should exit non-zero on unknown option"
    res_dangle = subprocess.run([str(BINARY_PATH), "--input"], capture_output=True, text=True)
    assert res_dangle.returncode != 0, "Compiler should exit non-zero on dangling flag"


def _registry_counts():
    """Skill counts of the registry built on this machine; they differ from machine to machine."""
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))["skills"]
    claude = sum(1 for x in data if "claude" in x.get("targets", []))
    return len(data), claude, len(data) - claude


def test_registry_determinism_and_hygiene():
    r1 = subprocess.run([sys.executable, str(BUILD_REGISTRY)], capture_output=True, text=True)
    assert r1.returncode == 0, f"First build_registry run failed: {r1.stderr}"
    h1 = sha256_file(REGISTRY_PATH)

    r2 = subprocess.run([sys.executable, str(BUILD_REGISTRY)], capture_output=True, text=True)
    assert r2.returncode == 0, f"Second build_registry run failed: {r2.stderr}"
    h2 = sha256_file(REGISTRY_PATH)

    assert h1 == h2, f"Non-deterministic registry output! {h1} != {h2}"

    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    skills = data.get("skills", [])
    assert len(skills) > 0, "Registry has no skills"

    seen_ids = set()
    for s in skills:
        sid = s["id"]
        assert sid not in seen_ids, f"Duplicate skill ID: {sid}"
        seen_ids.add(sid)

        desc = s.get("description", "")
        assert desc.strip(), f"Empty description on skill {sid}"
        assert not desc.startswith(("|", ">", "'", '"')), f"Leaked YAML syntax in description of {sid}: {desc[:20]}"

        aliases = s.get("aliases", [])
        assert len(aliases) >= 1, f"Skill {sid} has 0 aliases"
        for a in aliases:
            assert a.lower().strip() not in POISON_SINGLE_WORDS, f"Poison single-word alias '{a}' found in {sid}"

    print(f"({len(skills)} skills, deterministic SHA-256={h1[:12]}...)", end=" ")


def test_python_rust_byte_for_byte_parity():
    with tempfile.TemporaryDirectory() as tmpdir:
        py_out = Path(tmpdir) / "py_out"
        rs_out = Path(tmpdir) / "rs_out"

        r_py = subprocess.run(
            [sys.executable, str(PYTHON_COMPILER), "--input", str(REGISTRY_PATH), "--output-dir", str(py_out)],
            capture_output=True,
            text=True,
        )
        assert r_py.returncode == 0, f"Python compiler failed: {r_py.stderr}"

        r_rs = subprocess.run(
            [str(BINARY_PATH), "--input", str(REGISTRY_PATH), "--output-dir", str(rs_out)],
            capture_output=True,
            text=True,
        )
        assert r_rs.returncode == 0, f"Rust compiler failed: {r_rs.stderr}"

        for rel in GENERATED_REL_PATHS:
            f_py = py_out / rel
            f_rs = rs_out / rel
            assert f_py.exists(), f"Missing Python output: {rel}"
            assert f_rs.exists(), f"Missing Rust output: {rel}"
            h_py = sha256_file(f_py)
            h_rs = sha256_file(f_rs)
            assert h_py == h_rs, f"Parity mismatch on {rel}: Python={h_py} vs Rust={h_rs}"

    print(f"({len(GENERATED_REL_PATHS)}/5 files byte-identical)", end=" ")


def test_successful_compilation_and_latency():
    latencies = []
    for _ in range(10):
        t0 = time.perf_counter()
        res = subprocess.run(
            [str(BINARY_PATH), "--input", str(REGISTRY_PATH), "--output-dir", str(GENERATED_DIR)],
            capture_output=True,
            text=True,
        )
        t1 = time.perf_counter()
        assert res.returncode == 0, f"Compilation failed: {res.stderr}"
        latencies.append((t1 - t0) * 1000)

    avg_latency = sum(latencies) / len(latencies)
    print(f"(Avg speed: {avg_latency:.2f} ms)", end=" ")
    assert avg_latency < 50, f"Latency too high: {avg_latency:.2f} ms"


def test_claude_vs_universal_target_isolation():
    claude_ts = GENERATED_DIR / "claude" / "aliases.ts"
    univ_ts = GENERATED_DIR / "universal" / "aliases.ts"
    assert claude_ts.exists(), "claude/aliases.ts does not exist"
    assert univ_ts.exists(), "universal/aliases.ts does not exist"

    node_script = f"""
    const fs = require('fs');
    function loadTs(p) {{
      let code = fs.readFileSync(p, 'utf-8');
      code = code.replace('export const ALIASES: Readonly<Record<string, readonly string[]>> =', 'const ALIASES =');
      return new Function(code + '; return ALIASES;')();
    }}
    const claude = loadTs('{claude_ts.as_posix()}');
    const univ = loadTs('{univ_ts.as_posix()}');
    const cKeys = Object.keys(claude);
    const uKeys = Object.keys(univ);
    console.log(JSON.stringify({{
      claudeCount: cKeys.length,
      univCount: uKeys.length,
      hasAntigravityOnlyInClaude: Boolean(claude['alphafold-database-fetch-and-analyze'] || claude['deployments-cicd']),
      hasAntigravityInUniversal: Boolean(univ['alphafold-database-fetch-and-analyze'] && univ['deployments-cicd']),
    }}));
    """
    res = subprocess.run(["node", "-e", node_script], capture_output=True, text=True)
    assert res.returncode == 0, f"Node parsing failed: {res.stderr}"
    data = json.loads(res.stdout.strip())
    total, claude, _ = _registry_counts()
    assert data["claudeCount"] == claude, f"Expected {claude} skills in claude/aliases.ts, got {data['claudeCount']}"
    assert data["univCount"] == total, f"Expected {total} skills in universal/aliases.ts, got {data['univCount']}"
    assert not data["hasAntigravityOnlyInClaude"], "Antigravity-only skills leaked into claude/aliases.ts"
    assert data["hasAntigravityInUniversal"], "Antigravity skills missing from universal/aliases.ts"
    print(f"(Claude={claude}, Universal={total}, 0 target leaks)", end=" ")


def test_markdown_rules_integrity():
    ag_file = GENERATED_DIR / "antigravity" / "AGENTS.md"
    gemini_file = GENERATED_DIR / "antigravity" / "GEMINI.md"
    assert ag_file.exists(), "AGENTS.md missing"
    assert gemini_file.exists(), "GEMINI.md missing"

    ag_text = ag_file.read_text(encoding="utf-8")
    gemini_text = gemini_file.read_text(encoding="utf-8")
    assert ag_text == gemini_text, "AGENTS.md and GEMINI.md must be identical"
    assert "## Core Mandate: Skills Over Improvisation" in ag_text
    assert "💬 Skill:" in ag_text

    reg = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    ag_skills = [s["id"] for s in reg["skills"] if "antigravity" in s["targets"]]
    claude_only = [s["id"] for s in reg["skills"] if "antigravity" not in s["targets"]]

    for sid in ag_skills:
        assert f"`{sid}`" in ag_text, f"Antigravity skill {sid} missing from AGENTS.md"
    for sid in claude_only:
        assert f"`{sid}`" not in ag_text, f"Claude-only skill {sid} leaked into AGENTS.md"

    print(f"({len(ag_skills)} Antigravity skills present, 0 Claude-only leaks)", end=" ")


def test_copilot_instructions_integrity():
    copilot_file = GENERATED_DIR / "copilot" / "copilot-instructions.md"
    assert copilot_file.exists(), "copilot-instructions.md missing"
    content = copilot_file.read_text(encoding="utf-8")
    assert "## Expert Skill Routing Rules" in content
    assert "| Skill | Triggers / Keywords | Action |" in content

    reg = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    cop_skills = [s["id"] for s in reg["skills"] if "copilot" in s["targets"]]
    for sid in cop_skills:
        assert f"| `{sid}` |" in content, f"Copilot skill {sid} missing from copilot-instructions.md"

    print(f"({len(cop_skills)} Copilot table rows verified)", end=" ")


def test_full_346_skill_evaluation_suite():
    res = subprocess.run(["node", str(EVAL_SCRIPT)], capture_output=True, text=True)
    assert res.returncode == 0, f"Evaluation script failed: {res.stderr}"
    summary = json.loads(res.stdout.strip())

    c_mode = summary["claudeMode"]
    a_mode = summary["antigravityMode"]
    u_mode = summary["universalMode"]

    assert c_mode["failedSkillsCount"] == 0, f"Claude mode failed skills: {c_mode['failedSkillsCount']}"
    assert a_mode["failedSkillsCount"] == 0, f"Antigravity mode failed skills: {a_mode['failedSkillsCount']}"
    assert u_mode["failedSkillsCount"] == 0, f"Universal mode failed skills: {u_mode['failedSkillsCount']}"

    assert c_mode["falsePositivesCount"] <= 2, f"Claude FP too high: {c_mode['falsePositivesCount']}"
    assert a_mode["falsePositivesCount"] <= 3, f"Antigravity FP too high: {a_mode['falsePositivesCount']}"
    assert u_mode["falsePositivesCount"] <= 4, f"Universal FP too high: {u_mode['falsePositivesCount']}"

    print(
        f"(Claude={c_mode['skillLevelTop1Pass']}, AG={a_mode['skillLevelTop1Pass']}, Univ={u_mode['skillLevelTop1Pass']})",
        end=" ",
    )


def test_foreign_computer_custom_skill_set():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        foreign_plugins = tmp / "foreign_plugins"

        custom_skills = [
            (
                "acme-devops",
                "k8s-canary-rollback",
                """---
name: k8s-canary-rollback
description: Automatically rollback failing Kubernetes canary deployments, drain faulty pods, and restore ingress traffic weights.
---
# K8s Canary Rollback
""",
            ),
            (
                "fintech-tr",
                "efatura-vergi-dogrulama",
                """---
name: efatura-vergi-dogrulama
description: E-fatura XML belgelerinde KDV tevkifat oranlarini, GIB sema kurallarini ve vergi kimlik numaralarini denetler.
---
# E-Fatura Vergi Dogrulama
""",
            ),
            (
                "quantum-sim",
                "qiskit-circuit-transpiler",
                """---
name: qiskit-circuit-transpiler
description: Optimize and transpile quantum circuits for superconducting qubit topologies and reduce CNOT gate depth.
---
# Qiskit Transpiler
""",
            ),
        ]

        for plugin_name, skill_name, content in custom_skills:
            sdir = foreign_plugins / plugin_name / "skills" / skill_name
            sdir.mkdir(parents=True, exist_ok=True)
            (sdir / "SKILL.md").write_text(content, encoding="utf-8")

        py_out = tmp / "py_foreign"
        rs_out = tmp / "rs_foreign"

        r_py = subprocess.run(
            [
                sys.executable,
                str(PYTHON_COMPILER),
                "--input",
                str(REGISTRY_PATH),
                "--output-dir",
                str(py_out),
                "--scan-dir",
                str(foreign_plugins),
            ],
            capture_output=True,
            text=True,
        )
        assert r_py.returncode == 0, f"Python --scan-dir failed: {r_py.stderr}"

        r_rs = subprocess.run(
            [
                str(BINARY_PATH),
                "--input",
                str(REGISTRY_PATH),
                "--output-dir",
                str(rs_out),
                "--scan-dir",
                str(foreign_plugins),
            ],
            capture_output=True,
            text=True,
        )
        assert r_rs.returncode == 0, f"Rust --scan-dir failed: {r_rs.stderr}"

        for rel in GENERATED_REL_PATHS:
            assert sha256_file(py_out / rel) == sha256_file(rs_out / rel), f"--scan-dir parity mismatch on {rel}"

        ag_md = (rs_out / "antigravity" / "AGENTS.md").read_text(encoding="utf-8")
        for _, skill_name, _ in custom_skills:
            assert f"`{skill_name}`" in ag_md, f"Foreign skill {skill_name} missing from compiled AGENTS.md"

    print("(3 foreign custom skills discovered & compiled with 100% parity)", end=" ")


def main():
    print("=" * 68)
    print("UNIVERSAL SKILL WHISPER COMPILER, REGISTRY & 346-SKILL TEST SUITE")
    print("=" * 68)

    tests = [
        ("Binary Existence & Size", test_binary_exists),
        ("CLI Help Output", test_cli_help),
        ("CLI Option Validation & Robustness", test_cli_argument_validation),
        ("Missing File Error Handling", test_missing_input_error_handling),
        ("Malformed JSON Error Handling", test_malformed_json_error_handling),
        ("Registry Determinism & Schema Hygiene", test_registry_determinism_and_hygiene),
        ("Python vs Rust 100% Byte-for-Byte SHA-256 Parity", test_python_rust_byte_for_byte_parity),
        ("Compilation & Latency Benchmark (<50ms)", test_successful_compilation_and_latency),
        ("Claude vs Universal Target Isolation", test_claude_vs_universal_target_isolation),
        ("Antigravity & Gemini Markdown Completeness", test_markdown_rules_integrity),
        ("GitHub Copilot Instructions Completeness", test_copilot_instructions_integrity),
        ("Full Registry & 50-Negative-Control Evaluation Suite", test_full_346_skill_evaluation_suite),
        ("Foreign Computer & Custom Skill Set Discovery (--scan-dir)", test_foreign_computer_custom_skill_set),
    ]

    results = [run_test(name, func) for name, func in tests]

    print("\n" + "=" * 68)
    passed = sum(results)
    total = len(results)
    print(f"TEST RESULTS: {passed}/{total} Passed ({'100% SUCCESS' if passed == total else 'FAILURES DETECTED'})")
    print("=" * 68)
    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    main()
