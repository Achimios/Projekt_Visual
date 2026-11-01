# -*- coding: utf-8 -*-
"""d1「蹲下、把手按进光板」的九宫格动作帧。
⚠️ 只出**她**（平黑底），场景 / 涟漪 / 擦除由 JS 画 —— 和现有结构一致（场景是背景，她是精灵层）。
python -X utf8 gen_grid_d1.py
"""
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\Administrator\Desktop\Vault_Automata\4_Eidolon\src")
import ark  # noqa: E402

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材"
OUT = SRC / "生成_九宫格"
REFS = [str(SRC / "她_原图_v1.webp"), str(SRC / "生成_工作空间" / "ws_d1.png")]

GRID = ("A 3x3 grid of 9 equal panels, an animation sequence of the SAME girl, read left-to-right, top-to-bottom, "
        "each panel is the next frame of one continuous action. "
        "Character: same as reference image 1 — blue short hair, dark oversized techwear jacket, black boots, cyber idol. "
        "Identical framing, identical scale, identical camera in every panel; her whole body visible in every panel; "
        "she is centred and always the same size. Flat pure BLACK background in every panel, "
        "thin black gutters between panels, no text, no numbers, no panel borders, no floor, no shadow. "
        "Anime illustration, cold palette (deep indigo, cyan rim light from the front), restrained. ")

SEQ = ("Sequence: panel 1 she stands upright, one hand slightly forward. panel 2 knees begin to bend, arms lowering. "
       "panel 3 she crouches halfway, back straight, right arm reaching down. panel 4 she is crouched low, both arms down. "
       "panel 5 her right hand reaches toward the floor in front of her. panel 6 hand near the floor, fingers spread open. "
       "panel 7 her palm is flat against the floor, right arm straight, head still up. "
       "panel 8 she presses down, shoulders drop, head bows. panel 9 she holds that pose, head down, palm still pressed. ")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for v in "ab":
        out = OUT / f"press_{v}.png"
        if out.exists():
            print("skip", out.name); continue
        try:
            ark.image(GRID + SEQ, str(out), mdl="seedream_flash", size="2048x2048", refs=REFS, output_format="png")
            print("ok", out.name)
        except Exception as e:
            print("fail", out.name, str(e)[:300])


if __name__ == "__main__":
    main()
