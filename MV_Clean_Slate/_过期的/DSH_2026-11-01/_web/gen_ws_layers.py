# -*- coding: utf-8 -*-
"""d1 拆图层：同一个房间 / 同一块光板，但**去掉她** → 得到可以叠自己动画角色的背景层。
Seedream 的 layer_decomposition：返回底图 + 最多 16 个透明层（带 z_index）。
output：素材/生成_工作空间/ws_d1_nogirl.png（+ _layerN.png）
python -X utf8 gen_ws_layers.py
"""
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\Administrator\Desktop\Vault_Automata\4_Eidolon\src")
import ark  # noqa: E402

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材"
OUT = SRC / "生成_工作空间"

PROMPT = ("Same room, same camera, same composition and same lighting as reference image 1: an infinite dark room, "
          "one huge slab of pale light lying on the floor like a pool, volumetric haze, a single distant light source, "
          "90 percent darkness, cold teal and grey, Villeneuve mood. "
          "BUT: absolutely NO character, NO person, NO silhouette of a girl anywhere in the frame. The room is empty. "
          "Keep the soft ripple of erased darkness on the light slab. Cinematic wide shot, 16:9, no text, no watermark.")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / "ws_d1_nogirl.png"
    if out.exists():
        print("skip", out.name)
        return
    try:
        p = ark.image(PROMPT, str(out), mdl="seedream_flash", size="2K",   # layer_decomposition 只吃预设档位，比例写在 prompt 里
                      refs=[str(OUT / "ws_d1.png")], output_format="png",
                      layer_decomposition=True)
        print("ok", p.name)
        for f in sorted(OUT.glob("ws_d1_nogirl*")):
            print("  ", f.name, f"{f.stat().st_size/1024:.0f} KB")
    except Exception as e:
        print("fail", str(e)[:400])


if __name__ == "__main__":
    main()
