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
    18: "【数字世界·黄昏天际线】没有人物也可以：像素风的城市剪影，前景是带天线和脚手架的高楼，天空是大片发光的像素云，蓝色调，几道水平的扫描线划过天空；她可以很小地站在左下角楼顶边缘远眺。安静、辽阔。",
    19: "【数字世界·雨夜霓虹街】像素风的雨夜街道纵深，两侧霓虹招牌和路灯，湿漉漉的路面倒映出彩色光条，远处高楼窗灯如数据；她撑着外套领子独自走在街中央，背影，很小。",
    20: "【数字世界·霓虹巨城】紫色调的像素巨型城市，一道青白色光柱从城市中心直冲天空，楼体上有发光的几何标志和全息广告；她站在近处一座楼的消防梯上俯看，剪影。",
    21: "【数字世界·高塔边缘】她坐在一座极高的信号塔平台边缘，双腿悬空，戴着耳机，低头，下方是无边无际的夜城灯海，几根缆绳斜着伸向远方；深蓝色，安静、孤独，很高的视角。",
    22: "【数字世界·青色数据大厅】巨大的青色数据大厅，墙壁由无数发光的数据面板组成，地面像积水的镜面；她穿着半透明发光的外衣站在中央低着头，衣服里有暖橙色的光点，四周是模糊的人群剪影，她的倒影清晰。",
    23: "【数字世界·漂浮之塔】一座漂浮在云海上方的巨大石塔，塔身连着彩色管线和圆形舱门，远处有小飞船；她坐在塔身的一个小平台上晃着腿；平涂动漫风格转像素，天空青绿色，明亮一点（全片少有的白天）。",
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
