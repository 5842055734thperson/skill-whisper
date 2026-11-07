---
name: whisper-me-a-skill
description: Explicit, user-triggered online search and installer for agent skills from skills.sh and GitHub. Only run when explicitly requested by the user via slash command or deliberate prompt; never invoke autonomously.
disable-model-invocation: true
metadata:
  version: "1.0.0"
  author: "Skill Whisper"
---

# 🌐 Whisper-Me-a-Skill (Online Skill Search & Installer)

> [!IMPORTANT]
> **Manual / Opt-in Only**: This skill is strictly user-invoked via `/whisper-me-a-skill <query>` or explicit user requests. It MUST NEVER be invoked autonomously by AI agents for regular programming tasks.

## Purpose & Capabilities

When a user's task requires a capability or domain workflow not available among currently installed local skills, `whisper-me-a-skill` searches the global skill ecosystem ([skills.sh](https://skills.sh) / GitHub repositories) and assists the user in installing verified skills.

## Core Procedures

### 1. Execute Search (Windows-Safe Execution)

Due to a known Windows Git Bash TTY stdout buffering bug, running `npx skills find` directly under MSYS2/Git Bash returns an empty output. This skill implements the verified cross-platform wrapper pattern:

* **On Windows (PowerShell wrapper):**
  ```powershell
  powershell -Command "npx skills find '<query>'"
  ```
* **On Linux / macOS:**
  ```bash
  npx skills find '<query>'
  ```

### 2. Present Candidate Skills to User

Always present the search results to the user with:
- **Package / Repo ID** (e.g. `vercel-labs/agent-skills@vercel-react-best-practices`)
- **Author & Source**
- **Description & Capabilities**

### 3. Human-in-the-Loop Installation Confirmation

**NEVER install a skill without explicit user confirmation.** Once the user approves:

* **On Windows:**
  ```powershell
  powershell -Command "npx skills add <package_name> -g -y"
  ```
* **On Linux / macOS:**
  ```bash
  npx skills add <package_name> -g -y
  ```

### 4. Sync with Local Registry

After a new skill is installed locally on the machine:
1. Re-scan and compile the local registry:
   ```bash
   python universal-registry/build_registry.py
   skill-whisper-compiler
   ```
2. The newly installed skill is immediately available for zero-latency local routing!
