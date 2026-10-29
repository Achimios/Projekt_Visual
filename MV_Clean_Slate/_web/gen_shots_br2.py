# -*- coding: utf-8 -*-
"""Clean Slate：用 Seedream（flash）按场景生成她的新图（参考图 = 原图 + 抠好的她）。
用 Eidolon 的 .venv：python -X utf8 gen_shots.py [编号…]
输出 素材/生成_场景/shotN.png（旁边 .json 记 prompt / 模型 / 参数，ark.image 自带）。key 只在 ark.py 里读，不打印。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path("C:/Users/Administrator/Desktop/Vault_Automata/4_Eidolon/src")))
import ark  # noqa: E402

OUT = ROOT / "素材" / "生成_场景_2"
REFS = [ROOT / "素材" / "她_原图_v1.webp", ROOT / "素材" / "图片_分图层_1" / "图片_EPa-0202-11.png", ROOT / "_参考" / "赛博少女_逆光大屏_面罩线缆.webp"]

KEEP = ("图3 只是氛围参考（逆光、冷峻、忧郁），不要画图3里的人。图1、图2 是同一个角色的设定参考：只保留她的长相与造型——蓝色齐刘海短波波头、发光的品红色眼睛、黑色高领宽大外套、耳后的赛博耳机和线缆、"
        "外套上的星空故障切片。⚠️构图、姿势、表情、镜头、场景全部按下面的描述重新画，不要复制参考图的构图和姿势，不要再画那个站台和广告屏。")
STYLE = ("画风：像素风动漫插画（pixel art anime），干净的像素块，有限调色板。Blade Runner 式的夜：雨、霓虹雾、湿漉漉的反光地面、强逆光剪影、体积光；"
         "冷蓝和品红为主，一点钠灯橙；忧郁、安静、电影感构图，大量暗部留白。画面里不要任何文字、logo、水印。16:9 横构图。")
SHOTS = {
    14: "【岸边奔跑】她沿着一片发光的数据海的岸边奔跑，侧面全身，头发和外套向后飞，脚下踩起发光的水花；远处地平线上一轮低低的暖橙色太阳，天空从深蓝渐变到粉橙。速度感，人物在画面左侧三分之一。",
    15: "【空白的板】四周全暗，她一个人小小地站在画面正中一块空白、平滑、像镜面一样的白色平台上，平台倒映着她；极简，大量黑色留白，安静。",
    16: "【看自己的手】她低头看着自己摊开的双手，手掌里发出柔和的品红和青色的光，光照亮她的下半张脸；雨夜、暗背景，近景，惊讶又温柔。",
    17: "【画光的宫殿】她抬起一只手，用指尖在空中画出一道发光的线；她身后是一座由一排排亮着暖灯的窗格子组成的巨大宫殿，像一栋发光的数据大楼；夜，雾，她是逆光剪影，中景。",
}


SUF = ""

def main():
    global SUF
    import os; SUF = os.environ.get("SUF", "")
    ids = [int(x) for x in sys.argv[1:]] or list(SHOTS)
    OUT.mkdir(parents=True, exist_ok=True)
    for i in ids:
        prompt = f"{KEEP}\n画面：{SHOTS[i]}\n{STYLE}"
        p = ark.image(prompt, OUT / f"shot{i}{SUF}.png", mdl="seedream_flash", size="1920x1080", refs=[str(r) for r in REFS],
                      sources=["素材/她_原图_v1.webp", "素材/图片_分图层_1/L-11（抠好的她）", "_参考/赛博少女_逆光大屏_面罩线缆.webp"], output_format="png")
        print("ok", p.name, flush=True)


if __name__ == "__main__":
    main()
