# -*- coding: utf-8 -*-
"""Seedream 分图层 → 像素素材（共用一套调色板、同一个像素格）+ 清单 px/manifest.json。
用 Eidolon 的 .venv 跑：python -X utf8 prep_px.py
- 每层按 PSD 里的位置框放回原图坐标，再按 UNIT（原图每 UNIT 像素 = 1 格）缩小、量化。
- 她（girl）自动找眼睛：品红色像素聚成左右两团 → manifest 里记 eyes。
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材" / "图片_分图层_1"
OUT = HERE / "px"
UNIT = 10
# PSD 图层顺序（自下而上）与位置框（PIL 读 PSD 得到；导出的 PNG 被缩放过，按框拉回去）
LAYERS = [
    ("bg", "图片_EPa-0202.png", (0, 0, 1760, 2224)),
    ("frame", "图片_EPa-0202-2.png", (73, 459, 1681, 1319)),
    ("screen", "图片_EPa-0202-3.png", (149, 515, 1605, 1248)),
    ("rail", "图片_EPa-0202-4.png", (0, 1391, 1758, 1855)),
    ("mini", "图片_EPa-0202-5.png", (260, 303, 387, 367)),
    ("strip1", "图片_EPa-0202-6.png", (327, 1217, 587, 1303)),
    ("strip2", "图片_EPa-0202-7.png", (623, 1945, 932, 2003)),
    ("strip3", "图片_EPa-0202-8.png", (686, 1807, 876, 1857)),
    ("strip4", "图片_EPa-0202-9.png", (972, 1481, 1411, 1560)),
    ("strip5", "图片_EPa-0202-10.png", (1288, 1764, 1466, 1837)),
    ("girl", "图片_EPa-0202-11.png", (225, 139, 1483, 2224)),
]
ACCENT = [(255, 70, 230), (214, 90, 255), (255, 140, 210), (120, 225, 255), (255, 255, 255), (255, 190, 230)]


def load(name, box):
    im = Image.open(SRC / name).convert("RGBA")
    w, h = box[2] - box[0], box[3] - box[1]
    return im.resize((w, h), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    # 1) 合成整张 → 定调色板（中位切分 22 色 + 6 个强制保留的强调色）
    W, H = 1760, 2224
    comp = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    for _, f, box in LAYERS:
        comp.alpha_composite(load(f, box), (box[0], box[1]))
    comp = ImageEnhance.Contrast(comp.convert("RGB")).enhance(1.1)
    small = comp.resize((W // UNIT, H // UNIT), Image.Resampling.BOX)
    base = small.quantize(colors=22, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).getpalette()[:66]
    pal = base + [v for c in ACCENT for v in c]
    pimg = Image.new("P", (1, 1)); pimg.putpalette(pal + [0] * (768 - len(pal)))
    small.quantize(palette=pimg, dither=Image.Dither.NONE).convert("RGB").save(OUT / "composite.png")
    palette = [pal[i:i + 3] for i in range(0, len(pal), 3)]

    man = {"unit": UNIT, "size": [W // UNIT, H // UNIT], "palette": palette, "layers": []}
    for key, f, box in LAYERS:
        im = load(f, box)
        x0, y0 = box[0] // UNIT, box[1] // UNIT
        w, h = max(1, round((box[2] - box[0]) / UNIT)), max(1, round((box[3] - box[1]) / UNIT))
        sm = im.resize((w, h), Image.Resampling.BOX)
        rgb = ImageEnhance.Contrast(sm.convert("RGB")).enhance(1.1).quantize(palette=pimg, dither=Image.Dither.NONE).convert("RGBA")
        a = np.array(sm)[..., 3]
        arr = np.array(rgb); arr[..., 3] = np.where(a > 140, 255, 0)          # 硬边：像素图不要半透明
        Image.fromarray(arr).save(OUT / f"{key}.png")
        entry = {"key": key, "x": x0, "y": y0, "w": w, "h": h}
        if key == "girl":                                                    # 找眼睛：品红像素的左右两团
            mag = (arr[..., 0] > 200) & (arr[..., 1] < 140) & (arr[..., 2] > 190) & (arr[..., 3] > 0)
            ys, xs = np.nonzero(mag[: h // 3])                                # 只在上 1/3（脸）里找
            if len(xs):
                mid = np.median(xs)
                eyes = []
                for sel in (xs < mid, xs >= mid):
                    if sel.any():
                        eyes.append([int(xs[sel].min()), int(ys[sel].min()), int(xs[sel].max()), int(ys[sel].max())])
                entry["eyes"] = eyes
        man["layers"].append(entry)
        print(key, entry)
    (OUT / "manifest.json").write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding="utf-8")
    print("palette", len(palette), "colors ->", OUT)


if __name__ == "__main__":
    main()
