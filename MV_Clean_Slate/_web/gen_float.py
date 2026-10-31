# -*- coding: utf-8 -*-
"""开场「I was dust in a data sea」：她蜷缩漂浮的全身像（纯色底，方便抠 / 像素化）。Seedream flash 出多张，人挑。
python -X utf8 gen_float.py
"""
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\Administrator\Desktop\Vault_Automata\4_Eidolon\src")
import ark  # noqa: E402

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材"
OUT = SRC / "生成_场景_3"
REFS = [str(SRC / "她_原图_v1.webp"), str(SRC / "生成_场景" / "shot1.png")]

BASE = ("Same girl as reference image 1 (blue short hair, dark oversized techwear jacket, cyber idol). "
        "Full body, she is curled up floating weightlessly in empty space, knees to chest, arms around knees, eyes closed, "
        "hair drifting upward slightly, peaceful sleeping expression, faint cyan rim light from below, "
        "Blade Runner cold palette (deep indigo, cyan, a little magenta), anime illustration, clean silhouette, "
        "isolated on a flat pure black background, nothing else in the frame, no text, no floor, no particles.")
VARS = {
    "a": "side view, body slightly tilted, ",
    "b": "three-quarter view from slightly below, ",
    "c": "side view, head bowed, one hand loosely open, ",
    "d": "three-quarter view, body rotated as if slowly tumbling, ",
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for k, v in VARS.items():
        out = OUT / f"float_{k}.png"
        if out.exists():
            print("skip", out.name); continue
        try:
            ark.image(v + BASE, str(out), mdl="seedream_flash", size="1440x1920", refs=REFS, output_format="png")
            print("ok", out.name)
        except Exception as e:
            print("fail", k, str(e)[:200])


if __name__ == "__main__":
    main()
