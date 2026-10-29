# -*- coding: utf-8 -*-
"""Seedream 生成的场景图（素材/生成_场景/shotN.png + 分图层）→ 像素素材 _web/px2/ + manifest。
每张图一套调色板（中位切分 26 色 + 强制保留的强调色），图层沿用所属整张图的调色板。统一 192×108 格（16:9）。
python -X utf8 prep_shots.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材" / "生成_场景"
OUT = HERE / "px2"
GW, GH = 192, 108
ACCENT = [(255, 70, 230), (214, 90, 255), (255, 140, 210), (120, 225, 255), (255, 255, 255), (255, 170, 80)]


def palette_of(img):
    small = ImageEnhance.Contrast(img.convert("RGB")).enhance(1.08).resize((GW, GH), Image.Resampling.BOX)
    base = small.quantize(colors=26, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).getpalette()[:78]
    pal = base + [v for c in ACCENT for v in c]
    p = Image.new("P", (1, 1)); p.putpalette(pal + [0] * (768 - len(pal)))
    return p


def pix(img, w, h, pimg, alpha=False):
    sm = img.convert("RGBA").resize((w, h), Image.Resampling.BOX)
    rgb = ImageEnhance.Contrast(sm.convert("RGB")).enhance(1.08).quantize(palette=pimg, dither=Image.Dither.NONE).convert("RGBA")
    arr = np.array(rgb)
    arr[..., 3] = np.where(np.array(sm)[..., 3] > 140, 255, 0) if alpha else 255
    return Image.fromarray(arr)


def main():
    OUT.mkdir(exist_ok=True)
    man = {"grid": [GW, GH], "shots": {}}
    for i in range(1, 6):
        full = Image.open(SRC / f"shot{i}.png")
        pimg = palette_of(full)
        pix(full, GW, GH, pimg).save(OUT / f"shot{i}.png")
        entry = {"full": f"shot{i}.png", "layers": []}
        side = SRC / f"shot{i}_layers.png.json"
        if side.exists():
            d = json.loads(side.read_text("utf-8"))
            for k, L in enumerate(d.get("layers", [])):
                x0, y0, x1, y1 = L["bounding_box"]["normalized"]           # 0–1000
                gx0, gy0 = round(x0 / 1000 * GW), round(y0 / 1000 * GH)
                gw, gh = max(1, round((x1 - x0) / 1000 * GW)), max(1, round((y1 - y0) / 1000 * GH))
                im = Image.open(SRC / L["file"])
                name = f"shot{i}_L{k + 1}.png"
                pix(im, gw, gh, pimg, alpha=True).save(OUT / name)
                entry["layers"].append({"file": name, "name": L.get("name"), "x": gx0, "y": gy0, "w": gw, "h": gh})
        man["shots"][f"shot{i}"] = entry
        print(i, len(entry["layers"]), "layers")
    (OUT / "manifest.json").write_text(json.dumps(man, ensure_ascii=False, indent=1), "utf-8")


if __name__ == "__main__":
    main()
