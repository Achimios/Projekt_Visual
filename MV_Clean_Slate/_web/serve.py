# -*- coding: utf-8 -*-
"""Clean Slate 网页小样的本地服务器：静态文件 + 逐帧收图喂给 ffmpeg 出 mp4。
根目录 = MV_Clean_Slate/（页面在 _web/，歌在 -5_Clean Slate/）。只绑 127.0.0.1。
  python serve.py --port 5430
页面加 ?render=1 时：POST /start?w&h&fps&t0&t1&out → 每帧 POST /frame（原始 RGBA，自下而上）→ POST /done。
"""
import argparse, subprocess, sys, threading, time
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = "E:/2_Little_Wares/ffmpeg-master-latest-win64-gpl-shared/bin/ffmpeg.exe"
STATE = {"ff": None, "n": 0, "out": None, "quit": False}


class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass

    def _ok(self, msg=b"ok"):
        self.send_response(200); self.send_header("Content-Length", str(len(msg))); self.end_headers(); self.wfile.write(msg)

    def do_POST(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        n = int(self.headers.get("Content-Length", 0)); body = self.rfile.read(n) if n else b""
        if u.path == "/log":
            print("[page]", body.decode("utf-8", "replace"), flush=True); return self._ok()
        if u.path == "/start":
            w, h, fps, t0, t1 = int(q["w"]), int(q["h"]), int(q["fps"]), float(q["t0"]), float(q["t1"])
            out = (ROOT / q["out"]).resolve()
            out.parent.mkdir(parents=True, exist_ok=True)
            dur = t1 - t0
            cmd = [FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
                   "-ss", str(t0), "-t", str(dur), "-i", str(ROOT / "-5_Clean Slate" / "Clean Slate.wav"),
                   "-vf", "vflip" if q.get("vflip", "1") == "1" else "null", "-af", f"afade=t=in:d=0.3,afade=t=out:st={dur - 0.6:.3f}:d=0.6",
                   "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "medium",
                   "-c:a", "aac", "-b:a", "256k", "-shortest", str(out)]
            STATE.update(ff=subprocess.Popen(cmd, stdin=subprocess.PIPE), n=0, out=out)
            print("start", out, flush=True); return self._ok()
        if u.path == "/frame":
            if int(q.get("i", STATE["n"])) != STATE["n"]:      # 页面重试时可能重发同一帧：按帧号去重
                return self._ok(b"dup")
            STATE["ff"].stdin.write(body); STATE["n"] += 1
            if STATE["n"] % 60 == 0:
                print("frames", STATE["n"], flush=True)
            return self._ok()
        if u.path == "/done":
            STATE["ff"].stdin.close(); STATE["ff"].wait()
            print("done", STATE["n"], "frames ->", STATE["out"], flush=True)
            if q.get("quit"):
                STATE["quit"] = True
            return self._ok()
        self.send_error(404)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=5430); a = ap.parse_args()
    # 多线程：浏览器会预开空连接，单线程 handle_request 会卡在上面
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), partial(H, directory=str(ROOT)))
    print(f"http://127.0.0.1:{a.port}/_web/wake.html", flush=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    while not STATE["quit"]:
        time.sleep(0.5)
    srv.shutdown()


if __name__ == "__main__":
    main()
