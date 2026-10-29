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
STYLE = ("画风：像素风动漫插画，有限调色板，冷蓝 / 品红 / 青为主。⭐这是「数据里的世界」，不是真实世界：场景只构建了一部分——"
         "有些楼只有白模或线框、有些区域是缺失的黑色方块、有些地方是没贴图的灰色几何体、有数据损坏的错位色块和像素拉丝、有漂浮的半成品碎片；"
         "结构简单、几何化，像游戏引擎里还没加载完的关卡。忧郁、安静。不要文字 / logo / 水印。16:9。")
SHOTS = {
    24: "【未加载完的城市】从高处看一座城市：近处几栋楼有完整的霓虹和窗灯，越往远处越不完整——变成灰白的白模、再变成发光的线框、最远处干脆是悬空的方块和网格；地平线上有大块缺失的黑色区域。她很小地站在近处楼顶边缘，看着这座还没建完的城市。",
    25: "【损坏的街道】一条街道走到一半就断了：前半段是湿漉漉的霓虹像素街，后半段的楼房和路面碎成漂浮的方块，露出下面无尽的网格和黑暗；空中有错位的色块和像素拉丝。她站在断口边缘。",
    26: "【白模房间】一个只有灰白几何体的房间（没贴图的墙、方块桌椅、一扇只有轮廓线的窗），只有窗外透进来一束品红光；她坐在方块椅子上，是房间里唯一有颜色的东西。",
    27: "【线框海】一片由发光线框网格组成的海面，起伏像波浪，网格有几块缺失变成黑洞；远处漂着几座只有线框的岛和塔；她站在网格上，脚下的格子被她点亮。",
    28: "【数据瀑布】一面巨大的墙从上到下被像素排序拉成彩色的竖条瀑布，墙上原本的城市图像只剩上半部分还能看清；她站在瀑布底下仰头看，衣角也被拉成了竖条。",
    29: "【半成品的门】一片黑暗的虚空中，悬着一扇只有一半实体、另一半是线框的门，门缝里漏出白光；周围漂着方块碎片和低多边形的残骸；她伸手去推门。",
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
