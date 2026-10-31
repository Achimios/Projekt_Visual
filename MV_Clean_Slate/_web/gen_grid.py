# -*- coding: utf-8 -*-
"""九宫格低帧动画：一张图里 3×3 = 9 帧同一个动作序列（同一张图里角色最一致），切开后当序列帧用（一拍两帧 / 三帧）。
python -X utf8 gen_grid.py [名字 ...]
"""
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\Administrator\Desktop\Vault_Automata\4_Eidolon\src")
import ark  # noqa: E402

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材"
OUT = SRC / "生成_九宫格"
REFS = [str(SRC / "生成_场景_3" / "float_a.png"), str(SRC / "她_原图_v1.webp")]

GRID = ("A 3x3 grid of 9 equal panels, an animation sequence of the SAME girl (same character as reference image 1: blue short hair, "
        "dark oversized techwear hoodie, black boots), read left-to-right, top-to-bottom, each panel is the next frame. "
        "Identical framing, identical scale and identical camera in every panel, flat pure black background in every panel, "
        "thin black gutters between panels, no text, no numbers, no panel borders. Anime illustration, Blade Runner cold palette "
        "(deep indigo, cyan rim light from below, a little magenta). ")
SEQ = {
    "wake": "Sequence: she floats curled up asleep, knees to chest, eyes closed (panels 1-3, only her hair drifts); "
            "panel 4 she stirs; panels 5-7 she slowly lifts her head, chin rising; panel 8 her eyes half open; "
            "panel 9 eyes open looking up, lips slightly parted, soft wonder.",
    "breathe": "Sequence: a seamless loop of her floating curled up asleep, eyes closed; her hair and hoodie strings drift "
               "slowly in zero gravity, her shoulders rise and fall with breathing; panel 9 matches panel 1 for looping.",
}


def main(names):
    OUT.mkdir(parents=True, exist_ok=True)
    for name in names or SEQ:
        for v in "ab":
            out = OUT / f"{name}_{v}.png"
            if out.exists():
                print("skip", out.name); continue
            try:
                ark.image(GRID + SEQ[name], str(out), mdl="seedream_flash", size="2048x2048", refs=REFS, output_format="png")
                print("ok", out.name)
            except Exception as e:
                print("fail", out.name, str(e)[:200])


if __name__ == "__main__":
    main(sys.argv[1:])
