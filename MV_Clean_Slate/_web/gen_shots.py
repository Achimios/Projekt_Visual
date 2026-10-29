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

OUT = ROOT / "素材" / "生成_场景"
REFS = [ROOT / "素材" / "她_原图_v1.webp", ROOT / "素材" / "图片_分图层_1" / "图片_EPa-0202-11.png"]

KEEP = ("图1、图2 是同一个角色的设定参考：只保留她的长相与造型——蓝色齐刘海短波波头、发光的品红色眼睛、黑色高领宽大外套、耳后的赛博耳机和线缆、"
        "外套上的星空故障切片。⚠️构图、姿势、表情、镜头、场景全部按下面的描述重新画，不要复制参考图的构图和姿势，不要再画那个站台和广告屏。")
STYLE = ("画风：像素风动漫插画（pixel art anime），干净的像素块，有限调色板，深靛蓝 / 紫色暗部，品红与青色霓虹光，"
         "高对比，赛博朋克、可爱又酷的气质。画面里不要任何文字、logo、水印。16:9 横构图。")
SHOTS = {
    1: "【醒来】她蜷缩着漂浮在一片漆黑的数据之海中央，双手抱膝，眼睛紧闭，头发和外套下摆像在水里一样缓缓飘散；"
       "身体周围缠绕着细细的品红与青色发光数据线，四周漂着无数星星一样的小光点；光从她下方的海面透上来，照亮她的脸的下半部。全身入画，人物居中偏小，四周大片黑暗留白。",
    2: "【睁眼特写】极近的面部特写，从眉毛到下巴占满画面；她的眼睛刚刚睁大，品红色的虹膜里有星形高光，瞳孔里映着粉色和青色的屏幕光；"
       "表情是惊讶又好奇，嘴唇微张；刘海的发丝在前景，脸被左侧品红光、右侧青色轮廓光照亮，背景是暗的。",
    3: "【起跳】她全身跃在半空中，一只拳头举过头顶，另一只手张开，双腿收起，外套被风吹得向后鼓起翻飞；表情是开心又坚定的大笑；"
       "她脚下是夜晚的像素霓虹城市天际线，楼顶有粉色和青色的灯；仰拍的动感角度，画面有向上的速度感。",
    4: "【岸边回头】她站在一片发光的像素数据之海的岸边，背对镜头半转身、回头看向镜头，带着温柔的微笑；"
       "海水里沉睡着无数小光点；远处地平线上是日出的橙色和粉色光；她的影子拉得很长。人物在画面右侧三分之一，左侧是辽阔的海。",
    5: "【挥手说嗨】她正面面对镜头，半身像，一只手举到脸旁挥手，俏皮地眨一只眼，咧嘴笑得很开心；"
       "背景是简单的深靛蓝色，漂着几块小小的 HUD 方块和光点；明亮、可爱、像在和观众打招呼。",
}


def main():
    ids = [int(x) for x in sys.argv[1:]] or list(SHOTS)
    OUT.mkdir(parents=True, exist_ok=True)
    for i in ids:
        prompt = f"{KEEP}\n画面：{SHOTS[i]}\n{STYLE}"
        p = ark.image(prompt, OUT / f"shot{i}.png", mdl="seedream_flash", size="1920x1080", refs=[str(r) for r in REFS],
                      sources=["素材/她_原图_v1.webp", "素材/图片_分图层_1/L-11（抠好的她）"], output_format="png")
        print("ok", p.name, flush=True)


if __name__ == "__main__":
    main()
