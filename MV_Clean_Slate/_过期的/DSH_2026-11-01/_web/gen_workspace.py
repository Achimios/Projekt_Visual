# -*- coding: utf-8 -*-
"""44–58 s「Clean Slate 工作空间」：她的工程室 / 用户的桌面。
👤 2026-11-01：「Clean Slate 的时候可以展示女孩在工作空间里，想象的工程室或用户的桌面都行？」
每个方向出一张，人挑（先挑后做）。Seedream flash 就够（简单构图 + 风格参考）。
python -X utf8 gen_workspace.py
"""
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\Administrator\Desktop\Vault_Automata\4_Eidolon\src")
import ark  # noqa: E402

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材"
OUT = SRC / "生成_工作空间"
REFS = [str(SRC / "她_原图_v1.webp"), str(SRC / "生成_场景" / "shot1.png")]

GIRL = ("Same girl as reference image 1: blue short hair, dark oversized techwear jacket, cyber idol. "
        "Anime illustration, same line quality and shading as the references. "
        "Palette: deep indigo darkness, cold cyan light, a trace of magenta, no warm colors. "
        "Cinematic wide shot, 16:9, Blade Runner mood, restrained, empty space is allowed, no text, no watermark.")

VARS = {
    # a 悬浮工作台：一圈窗口围着她
    "a": ("She floats at the center of an endless holographic workspace. Thirty translucent UI windows, "
          "code panes and terminal cards orbit her in a loose ring, thin cyan connector lines between them; "
          "three of the windows are dissolving into blank white. She is small in the frame, seen from far away, "
          "centered, everything made of light and glass over a black void. "),
    # b 想象的工程室：没有墙，机架化成线框
    "b": ("An imagined engineering room with no walls. Server racks on both sides dissolve into cyan wireframe, "
          "cables spill out into the void, one long desk made of pale light runs into the distance, "
          "she stands at the near end of the desk looking down its length. Dust in the air. "),
    # c 用户的桌面 = 地貌：图标像建筑
    "c": ("The user's desktop imagined as a landscape: giant app icons stand like dark buildings on a flat plain, "
          "a huge cursor arrow rests on the ground like a monument, she walks small between the icons. "
          "Strong scale contrast, everything is a UI element, nothing is a real object. "),
    # d 极简：一块还没被写的白板地面
    "d": ("Almost empty. A clean white slate lies on the floor of an infinite dark room like a pool of light; "
          "only a few thin construction lines and one small glowing window showing a progress bar exist. "
          "She stands at the edge of the white slate, tiny, seen from behind, facing into the whiteness. "
          "Extreme restraint, 90 percent darkness. "),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for k, v in VARS.items():
        out = OUT / f"ws_{k}.png"
        if out.exists():
            print("skip", out.name); continue
        try:
            ark.image(v + GIRL, str(out), mdl="seedream_flash", size="2560x1440", refs=REFS, output_format="png")
            print("ok", out.name)
        except Exception as e:
            print("fail", k, str(e)[:300])


if __name__ == "__main__":
    main()
