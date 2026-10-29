# -*- coding: utf-8 -*-
"""animator2 v2：素材/生成_场景/shot1–5 → 像素图（320×180 一格一像素），调色板直接读 _web/px/manifest.json（全片统一）。
  python -X utf8 prep_a2.py
输出到 animator2/px/：shotN.png（已量化成调色板颜色的 RGB）+ shot2_eye.png（眼睛特写，从原图裁一块重新像素化）。
做法照 _web/prep_px.py：BOX 缩小 → 对比度 ×1.1 → 量化到同一调色板；这里多加一层 4×4 Bayer 有序抖动（暗部过渡不断档）。
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[1] / "素材" / "生成_场景"
OUT = HERE / "px"
PAL = np.array(json.loads((HERE.parent / "px" / "manifest.json").read_text(encoding="utf-8"))["palette"], dtype=np.float32)
W, H = 320, 180
BAY = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) + 0.5) / 16 - 0.5
WT = np.array([0.3, 0.59, 0.11], dtype=np.float32)


def quant(im, dither=22.0):
    a = np.asarray(ImageEnhance.Contrast(im.convert("RGB")).enhance(1.1), dtype=np.float32)
    h, w = a.shape[:2]
    a = a + np.tile(BAY, (h // 4 + 1, w // 4 + 1))[:h, :w, None] * dither
    d = (((a[:, :, None, :] - PAL[None, None]) ** 2) * WT).sum(-1)
    return PAL[d.argmin(-1)].astype(np.uint8)


def small(im, box=None):
    if box: im = im.crop(box)
    return im.resize((W, H), Image.Resampling.BOX)


def main():
    OUT.mkdir(exist_ok=True)
    for n in range(1, 6):
        im = Image.open(SRC / f"shot{n}.png")
        Image.fromarray(quant(small(im))).save(OUT / f"shot{n}.png")
        print("shot", n)
    # 眼睛特写：shot2 右眼（画面右侧那只）附近 16:9 一块
    im = Image.open(SRC / "shot2.png")
    cx, cy, bw = 1300, 360, 760
    Image.fromarray(quant(small(im, (cx - bw // 2, cy - bw * 9 // 32, cx + bw // 2, cy + bw * 9 // 32)))).save(OUT / "shot2_eye.png")
    print("eye ->", OUT)


if __name__ == "__main__":
    main()
