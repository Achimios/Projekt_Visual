# -*- coding: utf-8 -*-
"""44–58 s「Clean Slate 工作空间」第二轮：以 d 为底（维伦纽瓦气质：巨尺度、极简几何、大量暗部、一个光源），
把 a 的「环绕」降级成很淡的远景结构，让她**有动作**（蹲下按住 / 抬手抹 / 走）。
👤2026-11-01：「d 其实更好，更有维伦纽瓦的气质，a 的环绕不错，就是中间的女孩没必要和参考图一模一样，可以有些动作变化」。
python -X utf8 gen_workspace2.py
"""
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\Administrator\Desktop\Vault_Automata\4_Eidolon\src")
import ark  # noqa: E402

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材"
OUT = SRC / "生成_工作空间"
# 参考：她（只取气质，不追求一模一样）+ d 的构图/光
REFS = [str(SRC / "她_原图_v1.webp"), str(OUT / "ws_d.png")]

BASE = ("Consistent with reference image 2's composition and lighting: an infinite dark room, one huge slab of pale light "
        "lying on the floor like a pool, 90 percent darkness, volumetric haze, a single distant light source, "
        "symmetrical, still, monumental. Villeneuve mood: vast scale, minimal geometry, silence, cold teal and grey. "
        "The girl from reference image 1 appears SMALL in the frame (she is a scale reference, not a portrait); "
        "her face is not detailed, only silhouette and rim light. Anime-adjacent but restrained. "
        "Cinematic wide shot, 16:9, no text, no watermark, no logos.")

VARS = {
    # 1 蹲下按住：白板被按出一圈涟漪，涟漪里变暗
    "d1": ("She is crouching at the near edge of the light slab, one hand pressed flat into the light; "
           "from her hand a wide ring of ripple spreads across the slab, and inside that ring the light is being erased "
           "into black. "),
    # 2 抬手一抹：抹出一道痕，痕里露出青色线框结构
    "d2": ("She is standing and sweeping one arm sideways across the air above the slab; a long smear of erased darkness "
           "follows her hand, and inside the smear a faint cyan wireframe structure of the room is revealed underneath. "),
    # 3 更远：头顶很远处有一圈极暗的窗，像星座
    "d3": ("Extreme wide shot: the room is so large its walls are invisible; far above her, a faint ring of dim window "
           "panels floats like a constellation of satellites, almost lost in the haze. She is a tiny silhouette on the slab. "),
    # 4 环绕在她身边：一圈窗口缓慢旋转，只有轮廓光
    "d4": ("A ring of eight dim window panels orbits slowly around her at shoulder height, seen edge-on, mostly dark "
           "with thin cyan edges; she stands still in the middle looking up at one of them. Very low key, only rim light. "),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for k, v in VARS.items():
        out = OUT / f"ws_{k}.png"
        if out.exists():
            print("skip", out.name); continue
        try:
            ark.image(v + BASE, str(out), mdl="seedream_flash", size="2560x1440", refs=REFS, output_format="png")
            print("ok", out.name)
        except Exception as e:
            print("fail", k, str(e)[:300])


if __name__ == "__main__":
    main()
