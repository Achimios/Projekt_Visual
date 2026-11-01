# -*- coding: utf-8 -*-
"""验证：九宫格切开 → 抠黑 → 按剪影归一化 → 缩到她最终会有的像素高度（380/180 两种），
看「站→蹲→按」这个动作在像素化之后还读不读得出来。
输出：素材/生成_九宫格/_press_检验_<h>.png
"""
import sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "素材" / "生成_九宫格"


def key_black(im):
    """从四边往里洪泛，抠掉和边缘连通的暗色。"""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    stack = []
    for x in range(w):
        stack.append((x, 0)); stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y)); stack.append((w - 1, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        r, g, b, a = px[x, y]
        if max(r, g, b) >= 26:
            continue
        seen[y][x] = True
        px[x, y] = (r, g, b, 0)
        stack += [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
    return im


def bbox(im):
    a = im.split()[3]
    bb = a.getbbox()
    return bb


def build(name, girl_h, out_h=180, out_w=320):
    im = Image.open(SRC / name).convert("RGB")
    W, H = im.size
    cw, ch = W // 3, H // 3
    frames = []
    for k in range(9):
        cell = im.crop((k % 3 * cw + 6, k // 3 * ch + 6, (k % 3 + 1) * cw - 6, (k // 3 + 1) * ch - 6))
        cell = key_black(cell)
        bb = bbox(cell)
        if bb:
            cell = cell.crop(bb)
        # 归一化：按剪影高度缩到 girl_h（模拟 withBox 的对齐）
        sc = girl_h / cell.height
        cell = cell.resize((max(1, round(cell.width * sc)), girl_h), Image.LANCZOS)
        # 降采样到像素级（硬边）
        cell = cell.resize((max(1, cell.width // 3), max(1, cell.height // 3)), Image.LANCZOS)
        cell = cell.resize((cell.width * 3, cell.height * 3), Image.NEAREST)
        frames.append(cell)

    pad = 6
    tile_w = out_w
    sheet = Image.new("RGB", (tile_w * 9 + pad * 10, out_h + pad * 2), (6, 8, 12))
    for i, f in enumerate(frames):
        x = pad + i * (tile_w + pad)
        y = pad + (out_h - f.height) // 2
        sheet.paste(f, (x + (tile_w - f.width) // 2, y), f)
    path = SRC / f"_press_检验_{girl_h}.png"
    sheet.save(path)
    print("ok", path.name, sheet.size)


if __name__ == "__main__":
    for h in (80, 40):
        build("press_a.png", h)
