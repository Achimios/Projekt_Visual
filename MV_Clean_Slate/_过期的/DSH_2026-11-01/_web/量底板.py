#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""量底板 —— 从像素化的场景图里量出光板（最亮的那块）的位置和台面高度。

为什么要量：相机 `cu/cv/z` 和她站的位置 `feet` 如果靠眼睛估，全分辨率一渲就露馅——
她一个人悬在纯黑里，光板根本不在画面里（ws_v2 第一版就是这样，缩略图看不出来）。
这里直接把「光板有多亮、占哪一块、前沿在哪一行」测出来，相机和站位都从数据里推。

用法：
    python _web/量底板.py              # 量 px3 里所有板子
    python _web/量底板.py px3/d1.png   # 量指定文件
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PX = HERE / "px3"


def measure(path: Path, thr: int = 150):
    im = np.array(Image.open(path).convert("RGB")).astype(np.float32)
    L = 0.3 * im[..., 0] + 0.59 * im[..., 1] + 0.11 * im[..., 2]
    m = L > thr
    if m.sum() < 20:
        return None
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    # 台面：取最亮那一行附近，从亮块的底边往上找（底边 = 离观众最近的那条边）
    cx = int((x0 + x1) / 2)
    col = np.nonzero(m[:, cx])[0]
    # 每一列亮区的底边（>0 才算有）
    bottom = np.full(im.shape[1], -1, dtype=int)
    for x in range(im.shape[1]):
        yy = np.nonzero(m[:, x])[0]
        if len(yy):
            bottom[x] = yy.max()
    valid = bottom[bottom >= 0]
    return {
        "bbox": (x0, y0, x1, y1),
        "center": (cx, int((y0 + y1) / 2)),
        "front": int(np.percentile(valid, 92)) if len(valid) else y1,  # 前沿（近端）行
        "back": y0,
        "col_at_center": (int(col.min()), int(col.max())) if len(col) else None,
        "width": x1 - x0, "height": y1 - y0,
        "pixels": int(m.sum()),
    }


def main() -> int:
    args = sys.argv[1:]
    files = [Path(a) for a in args] if args else sorted(PX.glob("d*.png"))
    for f in files:
        if not f.is_absolute():
            f = (Path.cwd() / f) if (Path.cwd() / f).exists() else (PX / f.name)
        r = measure(f)
        if not r:
            print(f"{f.name}: 没有亮块")
            continue
        x0, y0, x1, y1 = r["bbox"]
        print(f"{f.name}  {Image.open(f).size[0]}×{Image.open(f).size[1]}")
        print(f"  光板 bbox  x {x0}–{x1}   y {y0}–{y1}   (宽 {r['width']} 高 {r['height']})")
        print(f"  亮面积 {r['pixels']} px")
        print(f"  前沿 v={r['front']}   后沿 v={r['back']}   中心 u={r['center'][0]}")
        if r["col_at_center"]:
            a, b = r["col_at_center"]
            print(f"  u=中心那一列：v {a}–{b}")
        # 建议：把她放在前沿往上 1 格，脚踩在 x 中心
        print(f"  → 建议站位 feet = [{r['center'][0]}, {r['front'] - 1}]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
