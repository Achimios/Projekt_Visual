#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""审片 —— 把一个 mp4 变成「能看的证据」。

用法（在 MV_Clean_Slate 下；路径以 - 开头时用绝对路径）：
    python _web/审片.py 样片/段_工作空间_v1.mp4
        默认：探针信息 + 每 0.5 s 一帧的接触表 → _tmp/审/<名字>_接触表.jpg

    python _web/审片.py 样片/x.mp4 --at 45.0,47.6,53.5
        指定时刻的**全分辨率**静帧 → _tmp/审/<名字>/全帧_45.00.png（VLM 只认这个，缩图看不出边缘）

    python _web/审片.py 样片/x.mp4 --strip 47.0 --n 12 --fps 30
        从 47.0 s 起逐帧取 12 帧，横向拼成一条（看动作、看缓动、看几帧里发生了什么）

    python _web/审片.py 样片/x.mp4 --diff
        逐帧灰度差 + 直方图差 → 打印「大变」时刻（找切点 / 找闪光 / 找静止）

    --cols / --gap 只影响接触表和横条；--out 改输出目录（默认 _tmp/审）
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
FF = Path(r"E:\2_Little_Wares\ffmpeg-master-latest-win64-gpl-shared\bin")
FFMPEG = FF / "ffmpeg.exe"
FFPROBE = FF / "ffprobe.exe"


def probe(path: Path) -> dict:
    out = subprocess.run(
        [str(FFPROBE), "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate,nb_frames,duration",
         "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    s = j["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    fps = float(num) / float(den)
    dur = float(s.get("duration") or j["format"]["duration"])
    nb = s.get("nb_frames")
    return {"w": s["width"], "h": s["height"], "fps": fps,
            "dur": dur, "frames": int(nb) if nb else round(dur * fps)}


def grab(path: Path, t: float) -> Image.Image:
    """取 t 秒那一帧，原分辨率。"""
    r = subprocess.run(
        [str(FFMPEG), "-v", "error", "-ss", f"{t:.4f}", "-i", str(path),
         "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
        capture_output=True, check=True)
    import io
    return Image.open(io.BytesIO(r.stdout)).convert("RGB")


def contact_sheet(path: Path, info: dict, out: Path, step: float, cols: int) -> Path:
    tw, th = 384, 216
    ts = []
    t = 0.0
    while t < info["dur"] - 1e-6:
        ts.append(t)
        t += step
    rows = (len(ts) + cols - 1) // cols
    pad = 18
    sheet = Image.new("RGB", (cols * tw, rows * (th + pad)), (16, 16, 18))
    d = ImageDraw.Draw(sheet)
    for i, t in enumerate(ts):
        im = grab(path, t).resize((tw, th), Image.LANCZOS)
        x, y = (i % cols) * tw, (i // cols) * (th + pad)
        sheet.paste(im, (x, y))
        d.text((x + 5, y + th + 3), f"{t:.2f}s", fill=(255, 220, 60))
    sheet.save(out, quality=92)
    return out


def diff_report(path: Path, info: dict) -> None:
    """逐帧灰度差 + 直方图差，找切点 / 闪光 / 静止。"""
    import numpy as np
    w, h = 192, 108
    r = subprocess.run(
        [str(FFMPEG), "-v", "error", "-i", str(path), "-vf", f"scale={w}:{h}",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
    buf = np.frombuffer(r.stdout, dtype=np.uint8)
    n = buf.size // (w * h * 3)
    f = buf[: n * w * h * 3].reshape(n, h, w, 3).astype(np.float32)
    g = f[..., :3].mean(-1)
    dmean = np.abs(np.diff(g, axis=0)).mean((1, 2))
    hh = np.stack([np.stack([np.histogram(f[i, ..., c], 32, (0, 256))[0] for c in range(3)]).ravel()
                   for i in range(n)]).astype(np.float32)
    hh /= hh.sum(1, keepdims=True)
    dhist = np.abs(np.diff(hh, axis=0)).sum(1)
    med = float(np.median(dmean)) or 1e-6
    print(f"\n逐帧差（{n} 帧，{info['fps']:.2f} fps）  中位 dmean = {med:.2f}")
    print(f"{'秒':>8} {'dmean':>7} {'dhist':>6}")
    idx = np.argsort(-dmean)[:40]
    for i in sorted(idx):
        print(f"{(i + 1) / info['fps']:8.2f} {dmean[i]:7.1f} {dhist[i]:6.3f}")
    quiet = dmean < max(1.0, med * 0.25)
    runs, s = [], None
    for i, q in enumerate(quiet):
        if q and s is None:
            s = i
        if not q and s is not None:
            if i - s >= int(info["fps"] * 0.6):
                runs.append((s / info["fps"], i / info["fps"]))
            s = None
    if s is not None:
        runs.append((s / info["fps"], len(quiet) / info["fps"]))
    if runs:
        print("\n静止段（>0.6 s，dmean < 1/4 中位）：")
        for a, b in runs:
            print(f"  {a:7.2f} – {b:7.2f}  ({b - a:.2f} s)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--at", default="", help="逗号分隔的秒数 → 全分辨率静帧")
    ap.add_argument("--strip", type=float, default=None, help="横条起点（秒）")
    ap.add_argument("--n", type=int, default=12, help="横条帧数")
    ap.add_argument("--fps", type=float, default=None, help="横条按这个 fps 取（默认用片子的）")
    ap.add_argument("--step", type=float, default=0.5, help="接触表间隔（秒）")
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--diff", action="store_true")
    ap.add_argument("--out", default=str(ROOT / "_tmp" / "审"))
    a = ap.parse_args()

    path = Path(a.video)
    if not path.is_absolute():
        path = (ROOT / path).resolve()
    if not path.exists():
        print(f"没有这个文件：{path}")
        return 1
    info = probe(path)
    stem = path.stem
    outdir = Path(a.out)
    if not outdir.is_absolute():
        outdir = (ROOT / outdir).resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"{path.name}  {info['w']}×{info['h']}  {info['fps']:.3f} fps  "
          f"{info['dur']:.3f} s  {info['frames']} 帧")

    made: list[Path] = []
    if a.at.strip():
        sub = outdir / stem
        sub.mkdir(parents=True, exist_ok=True)
        for s in a.at.split(","):
            t = float(s)
            im = grab(path, t)
            p = sub / f"全帧_{t:06.2f}.png"
            im.save(p)
            made.append(p)
    if a.strip is not None:
        fps = a.fps or info["fps"]
        ims = [grab(path, a.strip + i / fps) for i in range(a.n)]
        th = 360
        tw = round(ims[0].width * th / ims[0].height)
        sheet = Image.new("RGB", (tw * len(ims), th + 18), (16, 16, 18))
        d = ImageDraw.Draw(sheet)
        for i, im in enumerate(ims):
            sheet.paste(im.resize((tw, th), Image.LANCZOS), (i * tw, 0))
            d.text((i * tw + 4, th + 3), f"{(a.strip + i / fps):.2f}", fill=(255, 220, 60))
        p = outdir / f"{stem}_横条_{a.strip:06.2f}.jpg"
        sheet.save(p, quality=92)
        made.append(p)
    if not a.at.strip() and a.strip is None:
        p = contact_sheet(path, info, outdir / f"{stem}_接触表.jpg", a.step, a.cols)
        made.append(p)
    if a.diff:
        diff_report(path, info)

    for p in made:
        print(f"  → {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
