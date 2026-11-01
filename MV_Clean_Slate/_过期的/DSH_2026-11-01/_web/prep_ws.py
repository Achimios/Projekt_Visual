# -*- coding: utf-8 -*-
"""44–58 s「Clean Slate 工作空间」的像素素材：4 张场景 + 去她的背景 + 她那一层 → _web/px3/ + manifest。
沿用 prep_shots.py 的做法：每张图一套调色板（中位切分 26 色 + 强调色），统一 192×108（16:9）。
python -X utf8 prep_ws.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材" / "生成_工作空间"
OUT = HERE / "px3"
GW, GH = 192, 108
ACCENT = [(255, 70, 230), (214, 90, 255), (255, 140, 210), (120, 225, 255), (255, 255, 255), (255, 170, 80)]


def palette_of(img):
    small = ImageEnhance.Contrast(img.convert("RGB")).enhance(1.06).resize((GW, GH), Image.Resampling.BOX)
    base = small.quantize(colors=26, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).getpalette()[:78]
    pal = base + [v for c in ACCENT for v in c]
    p = Image.new("P", (1, 1)); p.putpalette(pal + [0] * (768 - len(pal)))
    return p


def pix(img, w, h, pimg, alpha=False):
    sm = img.convert("RGBA").resize((w, h), Image.Resampling.BOX)
    rgb = ImageEnhance.Contrast(sm.convert("RGB")).enhance(1.06).quantize(palette=pimg, dither=Image.Dither.NONE).convert("RGBA")
    arr = np.array(rgb)
    arr[..., 3] = np.where(np.array(sm)[..., 3] > 140, 255, 0) if alpha else 255
    return Image.fromarray(arr)


def main():
    OUT.mkdir(exist_ok=True)
    man = {"grid": [GW, GH], "shots": {}}
    jobs = [
        ("d3", "ws_d3.png"),
        ("d2", "ws_d2.png"),
        ("d4", "ws_d4.png"),
        ("d1", "ws_d1_nogirl.png"),      # 去她的背景（自带涟漪）
        ("d1orig", "ws_d1.png"),         # 原来那张，对照用
    ]
    for key, fn in jobs:
        p = SRC / fn
        if not p.exists():
            print("miss", fn); continue
        full = Image.open(p)
        pimg = palette_of(full)
        pix(full, GW, GH, pimg).save(OUT / f"{key}.png")
        man["shots"][key] = {"full": f"{key}.png", "layers": []}
        print("ok", key, full.size)

    # d1 她那层（透明，带 bbox）
    side = SRC / "ws_d1_nogirl.png.json"
    if side.exists():
        d = json.loads(side.read_text("utf-8"))
        for k, L in enumerate(d.get("layers", [])):
            x0, y0, x1, y1 = L["bounding_box"]["normalized"]      # 0–1000
            gx0, gy0 = round(x0 / 1000 * GW), round(y0 / 1000 * GH)
            gw, gh = max(1, round((x1 - x0) / 1000 * GW)), max(1, round((y1 - y0) / 1000 * GH))
            pimg = palette_of(Image.open(SRC / "ws_d1_nogirl.png"))
            im = Image.open(SRC / L["file"])
            name = f"d1_L{k + 1}.png"
            pix(im, gw, gh, pimg, alpha=True).save(OUT / name)
            man["shots"]["d1"]["layers"].append({"file": name, "name": L.get("name"), "x": gx0, "y": gy0, "w": gw, "h": gh})
            print("layer", name, gw, gh)

    (OUT / "manifest.json").write_text(json.dumps(man, ensure_ascii=False, indent=1), "utf-8")
    print("manifest ok")


if __name__ == "__main__":
    main()
