import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SCALE = 2
W, H = 720 * SCALE, 310 * SCALE
FINAL_W, FINAL_H = 720, 310

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
        "tab": ImageFont.truetype(mono_bold, 11 * SCALE),
        "cta": ImageFont.truetype(mono_bold, 11 * SCALE),
        "header": ImageFont.truetype(mono_bold, 12 * SCALE),
        "header_sub": ImageFont.truetype(mono_reg, 11 * SCALE),
        "prompt": ImageFont.truetype(mono_reg, 16 * SCALE),
        "prompt_bold": ImageFont.truetype(mono_bold, 16 * SCALE),
        "ghost": ImageFont.truetype(mono_reg, 14 * SCALE),
        "sub": ImageFont.truetype(mono_reg, 12 * SCALE),
        "pill": ImageFont.truetype(mono_reg, 10 * SCALE),
    }


FONTS = load_fonts()


def text_w(draw, text, font):
    if not text:
        return 0
    b = draw.textbbox((0, 0), text, font=font)
    return b[2] - b[0]


def draw_terminal_icon(draw, x, y, color=INK_BLACK):
    s = SCALE
    draw.line([(x, y + 2*s), (x + 5*s, y + 6*s), (x, y + 10*s)], fill=color, width=2*s)
    draw.line([(x + 7*s, y + 10*s), (x + 13*s, y + 10*s)], fill=color, width=2*s)


def draw_spark_icon(draw, x, y, color=INK_GRAY):
    s = SCALE
    cx, cy = x + 6*s, y + 6*s
    r = 6*s
    pts = [(cx, cy - r), (cx + 2*s, cy - 2*s), (cx + r, cy), (cx + 2*s, cy + 2*s),
           (cx, cy + r), (cx - 2*s, cy + 2*s), (cx - r, cy), (cx - 2*s, cy - 2*s)]
    draw.polygon(pts, outline=color, width=2*s)


def draw_code_icon(draw, x, y, color=INK_GRAY):
    s = SCALE
    draw.line([(x + 4*s, y + 2*s), (x, y + 6*s), (x + 4*s, y + 10*s)], fill=color, width=2*s)
    draw.line([(x + 9*s, y + 2*s), (x + 13*s, y + 6*s), (x + 9*s, y + 10*s)], fill=color, width=2*s)


def draw_chat_bubble_icon(draw, x, y):
    s = SCALE
    draw.rectangle([x, y + 1*s, x + 14*s, y + 11*s], outline=INK_BLACK, width=2*s)
    draw.line([(x + 3*s, y + 11*s), (x + 2*s, y + 15*s), (x + 7*s, y + 11*s)], fill=INK_BLACK, width=2*s)


def build_playground_card(out_paths):
    s = SCALE
    frames = []
    durations = []

    for phase in range(4):
        img = Image.new("RGB", (W, H), BG_WHITE)
        d = ImageDraw.Draw(img)

        # Outer thin frame so it reads clearly as an interactive widget card
        d.rectangle([16*s, 10*s, (720 - 16)*s, (310 - 10)*s], outline=INK_BLACK, width=2*s)

        # Top Tabs Bar
        tab_y = 26 * s
        # Tab 1: Active CLAUDE CODE
        d.rectangle([34*s, tab_y, 160*s, tab_y + 26*s], outline=INK_BLACK, width=2*s)
        draw_terminal_icon(d, 44*s, tab_y + 7*s, INK_BLACK)
        d.text((64*s, tab_y + 7*s), "CLAUDE CODE", font=FONTS["tab"], fill=INK_BLACK)

        # Tab 2: Inactive ANTIGRAVITY / GEMINI
        d.rectangle([168*s, tab_y, 350*s, tab_y + 26*s], outline=INK_FAINT, width=1*s)
        draw_spark_icon(d, 178*s, tab_y + 7*s, INK_GRAY)
        d.text((198*s, tab_y + 7*s), "ANTIGRAVITY / GEMINI", font=FONTS["tab"], fill=INK_GRAY)

        # Tab 3: Inactive CODEX / COPILOT
        d.rectangle([358*s, tab_y, 504*s, tab_y + 26*s], outline=INK_FAINT, width=1*s)
        draw_code_icon(d, 368*s, tab_y + 7*s, INK_GRAY)
        d.text((388*s, tab_y + 7*s), "CODEX / COPILOT", font=FONTS["tab"], fill=INK_GRAY)

        # Right CTA button: "[ ↗ CLICK TO LAUNCH LIVE TEST ]"
        cta_inverted = (phase % 2 == 1)
        cta_rect = [524*s, tab_y, 686*s, tab_y + 26*s]
        if cta_inverted:
            d.rectangle(cta_rect, fill=INK_BLACK, outline=INK_BLACK, width=2*s)
            d.text((536*s, tab_y + 7*s), "-> CLICK TO TEST LIVE", font=FONTS["cta"], fill=BG_WHITE)
        else:
            d.rectangle(cta_rect, fill=BG_WHITE, outline=INK_BLACK, width=2*s)
            d.text((536*s, tab_y + 7*s), "-> CLICK TO TEST LIVE", font=FONTS["cta"], fill=INK_BLACK)

        # Divider below tabs
        d.line([(34*s, 64*s), (686*s, 64*s)], fill=INK_FAINT, width=1*s)

        # Stage Header
        draw_terminal_icon(d, 34*s, 82*s, INK_BLACK)
        d.text((56*s, 81*s), "INTERACTIVE PLAYGROUND", font=FONTS["header"], fill=INK_BLACK)
        d.text((230*s, 82*s), "— type any prompt or click a preset below (347 skills)", font=FONTS["header_sub"], fill=INK_GRAY)

        # Input Line in middle
        line_x1, line_x2 = 34*s, 686*s
        line_y = 166*s
        prompt_y = 134*s
        d.line([(line_x1, line_y), (line_x2, line_y)], fill=INK_BLACK, width=2*s)
        d.text((line_x1, prompt_y), ">", font=FONTS["prompt_bold"], fill=INK_BLACK)

        sample = "plot monthly revenue"
        tx = line_x1 + 22*s
        d.text((tx, prompt_y), sample, font=FONTS["prompt"], fill=INK_BLACK)
        tw = text_w(d, sample, FONTS["prompt"])
        cx = tx + tw + 4*s
        if phase in (0, 2):
            d.line([(cx, prompt_y + 2*s), (cx, prompt_y + 19*s)], fill=INK_BLACK, width=2*s)

        d.text((cx + 14*s, prompt_y + 2*s), "-> Tab: /dataviz", font=FONTS["ghost"], fill=INK_LIGHT)

        # Status line below input line
        draw_chat_bubble_icon(d, line_x1, line_y + 16*s)
        d.text((line_x1 + 22*s, line_y + 15*s), "/dataviz · Build data visualizations · end with ;;", font=FONTS["sub"], fill=INK_BLACK)

        # Bottom Presets Bar
        d.line([(34*s, 236*s), (686*s, 236*s)], fill=INK_FAINT, width=1*s)
        d.text((34*s, 254*s), "Try prompt:", font=FONTS["pill"], fill=INK_GRAY)

        pills = [
            "plot monthly revenue",
            "test and mock this REST API",
            "deploy kubernetes canary rollback",
        ]
        px = 110 * s
        for idx, p_text in enumerate(pills):
            pw = text_w(d, p_text, FONTS["pill"]) + 16*s
            outline = INK_BLACK if idx == 0 else INK_FAINT
            d.rectangle([px, 249*s, px + pw, 271*s], outline=outline, width=1*s)
            d.text((px + 8*s, 254*s), p_text, font=FONTS["pill"], fill=INK_BLACK if idx == 0 else INK_DARK)
            px += pw + 8*s

        frames.append(img.resize((FINAL_W, FINAL_H), Image.Resampling.LANCZOS))
        durations.append(650)

    for out_p in out_paths:
        frames[0].save(out_p, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=False)


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent
    out_paths = [
        str(repo_root / "assets" / "playground-card.gif"),
        str(repo_root / "universal-registry" / "assets" / "playground-card.gif"),
    ]
    build_playground_card(out_paths)
    print("Generated playground-card.gif:", out_paths)
