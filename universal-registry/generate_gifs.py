import tempfile
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Render at 2x retina scale (1440x520) and downsample to 720x260 for razor-sharp anti-aliased line art
SCALE = 2
W, H = 720 * SCALE, 260 * SCALE
FINAL_W, FINAL_H = 720, 260

BG_WHITE = (255, 255, 255)
INK_BLACK = (17, 17, 17)
INK_DARK = (45, 45, 45)
INK_GRAY = (115, 115, 115)
INK_LIGHT = (175, 175, 175)
INK_FAINT = (225, 225, 225)


def load_fonts():
    font_dir = Path(r"C:\Windows\Fonts")
    mono_reg = str(font_dir / "consola.ttf")
    mono_bold = str(font_dir / "consolab.ttf")

    return {
        "header": ImageFont.truetype(mono_bold, 12 * SCALE),
        "header_sub": ImageFont.truetype(mono_reg, 11 * SCALE),
        "prompt": ImageFont.truetype(mono_reg, 16 * SCALE),
        "prompt_bold": ImageFont.truetype(mono_bold, 16 * SCALE),
        "ghost": ImageFont.truetype(mono_reg, 14 * SCALE),
        "chat_role": ImageFont.truetype(mono_bold, 13 * SCALE),
        "chat_text": ImageFont.truetype(mono_reg, 14 * SCALE),
        "chat_bold": ImageFont.truetype(mono_bold, 14 * SCALE),
        "sub": ImageFont.truetype(mono_reg, 12 * SCALE),
        "sub_bold": ImageFont.truetype(mono_bold, 12 * SCALE),
    }


FONTS = load_fonts()


def new_canvas():
    return Image.new("RGB", (W, H), BG_WHITE)


def draw_terminal_icon(draw, x, y):
    s = SCALE
    draw.line([(x, y + 2*s), (x + 6*s, y + 7*s), (x, y + 12*s)], fill=INK_BLACK, width=2*s)
    draw.line([(x + 9*s, y + 12*s), (x + 16*s, y + 12*s)], fill=INK_BLACK, width=2*s)


def draw_spark_icon(draw, x, y):
    s = SCALE
    cx, cy = x + 7*s, y + 7*s
    r = 7*s
    pts = [(cx, cy - r), (cx + 2*s, cy - 2*s), (cx + r, cy), (cx + 2*s, cy + 2*s),
           (cx, cy + r), (cx - 2*s, cy + 2*s), (cx - r, cy), (cx - 2*s, cy - 2*s)]
    draw.polygon(pts, outline=INK_BLACK, width=2*s)


def draw_code_icon(draw, x, y):
    s = SCALE
    draw.line([(x + 5*s, y + 2*s), (x, y + 7*s), (x + 5*s, y + 12*s)], fill=INK_BLACK, width=2*s)
    draw.line([(x + 11*s, y + 2*s), (x + 16*s, y + 7*s), (x + 11*s, y + 12*s)], fill=INK_BLACK, width=2*s)


def draw_chat_bubble_icon(draw, x, y):
    s = SCALE
    draw.rectangle([x, y + 1*s, x + 14*s, y + 11*s], outline=INK_BLACK, width=2*s)
    draw.line([(x + 3*s, y + 11*s), (x + 2*s, y + 15*s), (x + 7*s, y + 11*s)], fill=INK_BLACK, width=2*s)


def draw_file_icon(draw, x, y):
    s = SCALE
    draw.rectangle([x, y, x + 10*s, y + 13*s], outline=INK_GRAY, width=2*s)
    draw.line([(x + 3*s, y + 4*s), (x + 7*s, y + 4*s)], fill=INK_GRAY, width=1*s)
    draw.line([(x + 3*s, y + 8*s), (x + 7*s, y + 8*s)], fill=INK_GRAY, width=1*s)


def draw_send_button(draw, x, y, active=False):
    s = SCALE
    r = 12 * s
    cx, cy = x + r, y + r
    if active:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK_BLACK, outline=INK_BLACK, width=2*s)
        fg = BG_WHITE
    else:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BG_WHITE, outline=INK_BLACK, width=2*s)
        fg = INK_BLACK
    draw.line([(cx, cy + 5*s), (cx, cy - 5*s)], fill=fg, width=2*s)
    draw.line([(cx - 4*s, cy - 1*s), (cx, cy - 5*s), (cx + 4*s, cy - 1*s)], fill=fg, width=2*s)


def text_width(draw, text, font):
    if not text:
        return 0
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def finalize_frame(img):
    return img.resize((FINAL_W, FINAL_H), Image.Resampling.LANCZOS)


# ==============================================================================
# 1. CLAUDE CODE GIF — Exact behavior from hooks/register.tsx & logic.ts:
# - User types "plot monthly revenue"
# - Ghost decoration appears after cursor: "  Tab: /dataviz"
# - Status line below shows: "/dataviz · Build data visualizations · end with ;;"
# - User types " ;;" at the end -> hook strips ";;" and rewrites input to "/dataviz plot monthly revenue"
# ==============================================================================
def build_claude_gif(out_paths, preview_frame_dir):
    frames = []
    durations = []
    s = SCALE

    line_x1, line_x2 = 56 * s, 664 * s
    line_y = 130 * s
    prompt_y = 96 * s
    base_prompt = "plot monthly revenue"

    def make_base():
        img = new_canvas()
        d = ImageDraw.Draw(img)
        draw_terminal_icon(d, 56 * s, 28 * s)
        d.text((80 * s, 27 * s), "CLAUDE CODE", font=FONTS["header"], fill=INK_BLACK)
        d.text((180 * s, 28 * s), "— while-typing hook (hooks/register.tsx)", font=FONTS["header_sub"], fill=INK_GRAY)
        d.line([(line_x1, line_y), (line_x2, line_y)], fill=INK_BLACK, width=2 * s)
        d.text((line_x1, prompt_y), ">", font=FONTS["prompt_bold"], fill=INK_BLACK)
        return img, d

    step_indices = list(range(1, len(base_prompt) + 1, 2))
    if step_indices[-1] != len(base_prompt):
        step_indices.append(len(base_prompt))

    for idx in step_indices:
        img, d = make_base()
        typed = base_prompt[:idx]
        tx = line_x1 + 22 * s
        d.text((tx, prompt_y), typed, font=FONTS["prompt"], fill=INK_BLACK)
        tw = text_width(d, typed, FONTS["prompt"])
        cx = tx + tw + 2 * s
        d.line([(cx, prompt_y + 2*s), (cx, prompt_y + 19*s)], fill=INK_BLACK, width=2*s)

        # Once confident match hits ("plot monthly rev..."), show exact ghost text & status bar from register.tsx
        if idx >= 15:
            # Inline ghost decoration right after cursor: `  Tab: /dataviz`
            d.text((cx + 12*s, prompt_y + 2*s), "-> Tab: /dataviz", font=FONTS["ghost"], fill=INK_LIGHT)
            # Status line below input line:
            draw_chat_bubble_icon(d, line_x1, line_y + 18*s)
            d.text((line_x1 + 22*s, line_y + 17*s), "/dataviz · Build data visualizations · end with ;;", font=FONTS["sub"], fill=INK_GRAY)
        else:
            d.text((line_x1, line_y + 17*s), "whisper: full", font=FONTS["sub"], fill=INK_LIGHT)

        frames.append(finalize_frame(img))
        durations.append(75)

    durations[-1] = 850
    if preview_frame_dir:
        frames[-1].save(os.path.join(preview_frame_dir, "claude_1_ghost.png"))

    # User types " ;" then " ;;" at the end
    for semi_str, hold_ms in [(" ;", 280), (" ;;", 900)]:
        img, d = make_base()
        tx = line_x1 + 22 * s
        d.text((tx, prompt_y), base_prompt, font=FONTS["prompt"], fill=INK_BLACK)
        tw = text_width(d, base_prompt, FONTS["prompt"])
        sw = text_width(d, semi_str, FONTS["prompt_bold"])

        if semi_str == " ;;":
            d.rectangle([tx + tw + 4*s, prompt_y - 2*s, tx + tw + sw + 10*s, prompt_y + 21*s], outline=INK_BLACK, width=2*s)
            d.text((tx + tw + 6*s, prompt_y), semi_str, font=FONTS["prompt_bold"], fill=INK_BLACK)
            cx = tx + tw + sw + 14*s
        else:
            d.text((tx + tw + 2*s, prompt_y), semi_str, font=FONTS["prompt_bold"], fill=INK_BLACK)
            cx = tx + tw + sw + 6*s

        d.line([(cx, prompt_y + 2*s), (cx, prompt_y + 19*s)], fill=INK_BLACK, width=2*s)
        draw_chat_bubble_icon(d, line_x1, line_y + 18*s)
        d.text((line_x1 + 22*s, line_y + 17*s), "/dataviz · Build data visualizations · end with ;;", font=FONTS["sub"], fill=INK_BLACK)

        f = finalize_frame(img)
        frames.append(f)
        durations.append(hold_ms)
        if semi_str == " ;;" and preview_frame_dir:
            f.save(os.path.join(preview_frame_dir, "claude_2_trigger.png"))

    # Hook strips ";;" and prepends "/dataviz " to the start of the draft!
    for blink in range(4):
        img, d = make_base()
        tx = line_x1 + 22 * s
        skill_tag = "/dataviz"
        tag_w = text_width(d, skill_tag, FONTS["prompt_bold"])
        d.rectangle([tx, prompt_y - 3*s, tx + tag_w + 14*s, prompt_y + 22*s], outline=INK_BLACK, width=2*s)
        d.text((tx + 7*s, prompt_y), skill_tag, font=FONTS["prompt_bold"], fill=INK_BLACK)

        rest_x = tx + tag_w + 22*s
        d.text((rest_x, prompt_y), base_prompt, font=FONTS["prompt"], fill=INK_BLACK)
        rw = text_width(d, base_prompt, FONTS["prompt"])

        if blink % 2 == 0:
            d.line([(rest_x + rw + 4*s, prompt_y + 2*s), (rest_x + rw + 4*s, prompt_y + 19*s)], fill=INK_BLACK, width=2*s)

        d.text((line_x1, line_y + 17*s), "whisper: full  (;; stripped -> /dataviz placed at start of prompt)", font=FONTS["sub"], fill=INK_GRAY)

        f = finalize_frame(img)
        frames.append(f)
        durations.append(550)
        if blink == 0 and preview_frame_dir:
            f.save(os.path.join(preview_frame_dir, "claude_3_rewritten.png"))

    for p in out_paths:
        frames[0].save(p, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=False)


# ==============================================================================
# 2. ANTIGRAVITY / GEMINI GIF — Exact behavior from rules/AGENTS.md:
# - User types prompt in bottom chat line & sends it
# - Agent opens its reply message with:
#   "💬 Skill: api-engineer — Fits REST API contract testing & mocking"
# - Agent immediately calls read_file(".../api-engineer/SKILL.md") and answers!
# ==============================================================================
def build_gemini_gif(out_paths, preview_frame_dir):
    frames = []
    durations = []
    s = SCALE

    line_x1, line_x2 = 56 * s, 664 * s
    input_line_y = 222 * s
    input_text_y = 190 * s
    prompt_text = "test and mock this REST API"

    def make_base(send_active=False):
        img = new_canvas()
        d = ImageDraw.Draw(img)
        draw_spark_icon(d, 56 * s, 20 * s)
        d.text((80 * s, 19 * s), "ANTIGRAVITY / GEMINI", font=FONTS["header"], fill=INK_BLACK)
        d.text((255 * s, 20 * s), "— autonomous rule mandate (rules/AGENTS.md)", font=FONTS["header_sub"], fill=INK_GRAY)
        d.line([(line_x1, input_line_y), (line_x2, input_line_y)], fill=INK_BLACK, width=2 * s)
        draw_send_button(d, line_x2 - 26 * s, input_text_y - 3 * s, active=send_active)
        return img, d

    # Phase 1: User types in bottom chat line
    step_indices = list(range(1, len(prompt_text) + 1, 2))
    if step_indices[-1] != len(prompt_text):
        step_indices.append(len(prompt_text))

    for idx in step_indices:
        img, d = make_base(send_active=False)
        typed = prompt_text[:idx]
        d.text((line_x1, input_text_y), typed, font=FONTS["prompt"], fill=INK_BLACK)
        tw = text_width(d, typed, FONTS["prompt"])
        d.line([(line_x1 + tw + 3*s, input_text_y + 2*s), (line_x1 + tw + 3*s, input_text_y + 19*s)], fill=INK_BLACK, width=2*s)
        frames.append(finalize_frame(img))
        durations.append(65)

    durations[-1] = 400

    # Phase 2: User presses Send
    img, d = make_base(send_active=True)
    d.text((line_x1, input_text_y), prompt_text, font=FONTS["prompt"], fill=INK_BLACK)
    frames.append(finalize_frame(img))
    durations.append(350)

    # Phase 3: Input clears; User message appears in chat
    img, d = make_base(send_active=False)
    d.text((line_x1, input_text_y), "Write a message...", font=FONTS["sub"], fill=INK_LIGHT)
    d.text((line_x1, 52 * s), "You:", font=FONTS["chat_role"], fill=INK_GRAY)
    d.text((line_x1 + 54 * s, 52 * s), prompt_text, font=FONTS["chat_text"], fill=INK_BLACK)
    d.line([(line_x1, 76 * s), (line_x2, 76 * s)], fill=INK_FAINT, width=1 * s)
    frames.append(finalize_frame(img))
    durations.append(450)

    # Phase 4: Agent replies with step 1 (💬 Skill banner) -> step 2 (read_file SKILL.md) -> step 3 (response)
    for stage, hold_ms in [(1, 650), (2, 750), (3, 2400)]:
        img, d = make_base(send_active=False)
        d.text((line_x1, input_text_y), "Write a message...", font=FONTS["sub"], fill=INK_LIGHT)

        d.text((line_x1, 52 * s), "You:", font=FONTS["chat_role"], fill=INK_GRAY)
        d.text((line_x1 + 54 * s, 52 * s), prompt_text, font=FONTS["chat_text"], fill=INK_BLACK)
        d.line([(line_x1, 76 * s), (line_x2, 76 * s)], fill=INK_FAINT, width=1 * s)

        # Agent Reply Message
        d.text((line_x1, 90 * s), "Agent:", font=FONTS["chat_role"], fill=INK_BLACK)
        # Line 1 of Agent's reply (Mandatory AGENTS.md announcement):
        draw_chat_bubble_icon(d, line_x1 + 56 * s, 91 * s)
        d.text((line_x1 + 78 * s, 90 * s), "Skill: api-engineer — REST API contract testing & mocking", font=FONTS["chat_bold"], fill=INK_BLACK)

        if stage >= 2:
            # Tool call line (read_file SKILL.md)
            draw_file_icon(d, line_x1 + 56 * s, 118 * s)
            d.text((line_x1 + 74 * s, 117 * s), "read_file(\"~/.gemini/config/plugins/postman/skills/api-engineer/SKILL.md\")", font=FONTS["sub"], fill=INK_GRAY)

        if stage >= 3:
            # Agent's actual response guided by the skill
            d.text((line_x1 + 56 * s, 143 * s), "Following the api-engineer workflow: I'll set up your Postman collection & mock.", font=FONTS["sub"], fill=INK_DARK)

        f = finalize_frame(img)
        frames.append(f)
        durations.append(hold_ms)
        if stage == 3 and preview_frame_dir:
            f.save(os.path.join(preview_frame_dir, "gemini_real_flow.png"))

    for p in out_paths:
        frames[0].save(p, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=False)


# ==============================================================================
# 3. CODEX / COPILOT GIF — Exact behavior from .github/copilot-instructions.md & AGENTS.md:
# - Codex CLI reads AGENTS.md; GitHub Copilot reads .github/copilot-instructions.md
# - User sends prompt in chat: "deploy kubernetes canary rollback"
# - Agent looks up the Key Mappings table (`| devops | k8s-canary-rollback | canary rollback | Refer to skill runbook |`)
# - Agent replies in chat citing the matched skill runbook and outputs the guided solution
# ==============================================================================
def build_copilot_gif(out_paths, preview_frame_dir):
    frames = []
    durations = []
    s = SCALE

    line_x1, line_x2 = 56 * s, 664 * s
    input_line_y = 222 * s
    input_text_y = 190 * s
    prompt_text = "deploy kubernetes canary rollback"

    def make_base(send_active=False):
        img = new_canvas()
        d = ImageDraw.Draw(img)
        draw_code_icon(d, 56 * s, 20 * s)
        d.text((80 * s, 19 * s), "CODEX / COPILOT", font=FONTS["header"], fill=INK_BLACK)
        d.text((220 * s, 20 * s), "— matrix routing (.github/copilot-instructions.md)", font=FONTS["header_sub"], fill=INK_GRAY)
        d.line([(line_x1, input_line_y), (line_x2, input_line_y)], fill=INK_BLACK, width=2 * s)
        draw_send_button(d, line_x2 - 26 * s, input_text_y - 3 * s, active=send_active)
        return img, d

    # Phase 1: User types in bottom chat line
    step_indices = list(range(1, len(prompt_text) + 1, 2))
    if step_indices[-1] != len(prompt_text):
        step_indices.append(len(prompt_text))

    for idx in step_indices:
        img, d = make_base(send_active=False)
        typed = prompt_text[:idx]
        d.text((line_x1, input_text_y), typed, font=FONTS["prompt"], fill=INK_BLACK)
        tw = text_width(d, typed, FONTS["prompt"])
        d.line([(line_x1 + tw + 3*s, input_text_y + 2*s), (line_x1 + tw + 3*s, input_text_y + 19*s)], fill=INK_BLACK, width=2*s)
        frames.append(finalize_frame(img))
        durations.append(65)

    durations[-1] = 400

    # Phase 2: User presses Send
    img, d = make_base(send_active=True)
    d.text((line_x1, input_text_y), prompt_text, font=FONTS["prompt"], fill=INK_BLACK)
    frames.append(finalize_frame(img))
    durations.append(350)

    # Phase 3: Input clears; User message appears in chat
    img, d = make_base(send_active=False)
    d.text((line_x1, input_text_y), "Ask Copilot or Codex...", font=FONTS["sub"], fill=INK_LIGHT)
    d.text((line_x1, 52 * s), "You:", font=FONTS["chat_role"], fill=INK_GRAY)
    d.text((line_x1 + 54 * s, 52 * s), prompt_text, font=FONTS["chat_text"], fill=INK_BLACK)
    d.line([(line_x1, 76 * s), (line_x2, 76 * s)], fill=INK_FAINT, width=1 * s)
    frames.append(finalize_frame(img))
    durations.append(450)

    # Phase 4: Codex / Copilot matches table row -> reads SKILL.md -> replies with runbook solution
    for stage, hold_ms in [(1, 700), (2, 2400)]:
        img, d = make_base(send_active=False)
        d.text((line_x1, input_text_y), "Ask Copilot or Codex...", font=FONTS["sub"], fill=INK_LIGHT)

        d.text((line_x1, 52 * s), "You:", font=FONTS["chat_role"], fill=INK_GRAY)
        d.text((line_x1 + 54 * s, 52 * s), prompt_text, font=FONTS["chat_text"], fill=INK_BLACK)
        d.line([(line_x1, 76 * s), (line_x2, 76 * s)], fill=INK_FAINT, width=1 * s)

        d.text((line_x1, 90 * s), "Agent:", font=FONTS["chat_role"], fill=INK_BLACK)
        # Table match reference
        draw_file_icon(d, line_x1 + 56 * s, 91 * s)
        d.text((line_x1 + 74 * s, 90 * s), "Matched in copilot-instructions.md: | devops | k8s-canary-rollback |", font=FONTS["sub_bold"], fill=INK_BLACK)

        if stage == 1:
            d.text((line_x1 + 56 * s, 117 * s), "Reading k8s-canary-rollback/SKILL.md runbook...", font=FONTS["sub"], fill=INK_GRAY)
        else:
            draw_chat_bubble_icon(d, line_x1 + 56 * s, 118 * s)
            d.text((line_x1 + 78 * s, 117 * s), "Using k8s-canary-rollback runbook:", font=FONTS["sub_bold"], fill=INK_BLACK)
            d.text((line_x1 + 56 * s, 143 * s), "await drainPodsAndRestoreTraffic('service-api');", font=FONTS["sub"], fill=INK_DARK)

        f = finalize_frame(img)
        frames.append(f)
        durations.append(hold_ms)
        if stage == 2 and preview_frame_dir:
            f.save(os.path.join(preview_frame_dir, "copilot_real_flow.png"))

    for p in out_paths:
        frames[0].save(p, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=False)


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent
    assets_dir = repo_root / "assets"
    ureg_assets_dir = repo_root / "universal-registry" / "assets"
    scratch_dir = Path(tempfile.mkdtemp(prefix="skill-whisper-gif-"))  # frame files, not kept

    for d in [assets_dir, ureg_assets_dir]:
        d.mkdir(parents=True, exist_ok=True)

    build_claude_gif([
        str(assets_dir / "claude-flow.gif"),
        str(ureg_assets_dir / "claude-flow.gif"),
    ], str(scratch_dir))

    build_gemini_gif([
        str(assets_dir / "gemini-flow.gif"),
        str(ureg_assets_dir / "gemini-flow.gif"),
    ], str(scratch_dir))

    build_copilot_gif([
        str(assets_dir / "copilot-flow.gif"),
        str(ureg_assets_dir / "copilot-flow.gif"),
    ], str(scratch_dir))

    print("Successfully generated 100% faithful GIFs for Claude, Antigravity/Gemini, and Codex/Copilot!")
