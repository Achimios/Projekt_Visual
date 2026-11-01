# -*- coding: utf-8 -*-
"""Clean Slate 控制台（TUI）：起服务 / 开浏览器 / 停服务 / 看状态，窗口一直留着。

  python -X utf8 _web/panel.py          （由 play.bat 调用）
  python -X utf8 _web/panel.py --port 5440

设计：这个窗口是「遥控器」，不是服务本身。服务如果是它起的，它是子进程；
如果是别人起的（比如你已经开过一次），它就进入「接管」模式，只读状态 + 能停。
关掉这个窗口 = 关掉它起的服务。
"""
import argparse
import os
import socket
import subprocess
import sys
import time
import unicodedata
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = "/_web/player.html"


def dw(s):
    """显示宽度：中文/全角算 2 列，不然框线对不齐。"""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def pad(s, n):
    while dw(s) > n:
        s = s[:-1]
    return s + " " * (n - dw(s))


def port_busy(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def pid_on_port(port):
    """只用 netstat，避免 Windows 上 psutil 不一定装。"""
    try:
        out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=8).stdout
    except Exception:
        return None
    for line in out.splitlines():
        f = line.split()
        if len(f) >= 5 and f[0] == "TCP" and f[1].endswith(f":{port}") and f[3] == "LISTENING":
            try:
                return int(f[4])
            except ValueError:
                pass
    return None


def kill(pid):
    if not pid:
        return False
    subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True)
    return True


class Panel:
    def __init__(self, port, auto_open=True):
        self.port = port
        self.child = None
        self.auto_open = auto_open

    # ── 状态 ──
    def alive(self):
        if self.child is not None and self.child.poll() is not None:
            self.child = None
        return port_busy(self.port)

    def owner(self):
        if self.child is not None and self.child.poll() is None:
            return "本窗口启动的"
        return "别处启动的（接管模式）"

    def start(self):
        if self.alive():
            return False
        self.child = subprocess.Popen(
            [sys.executable, "-X", "utf8", str(ROOT / "_web" / "serve.py"), "--port", str(self.port)],
            cwd=str(ROOT / "_web"),
        )
        for _ in range(40):
            if self.alive():
                return True
            time.sleep(0.15)
        return False

    def stop(self):
        if self.child is not None and self.child.poll() is None:
            self.child.terminate()
            try:
                self.child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.child.kill()
            self.child = None
            return True
        pid = pid_on_port(self.port)
        return kill(pid)

    def open(self):
        webbrowser.open(f"http://localhost:{self.port}{PAGE}")

    # ── 画面 ──
    def draw(self, msg=""):
        os.system("cls")
        up = self.alive()
        rule = "─" * 56
        print()
        print("  " + rule)
        print("  CLEAN SLATE · 播放器控制台")
        print("  " + rule)
        state = "● 运行中" if up else "○ 已停止"
        print(f"  服务   {state}    端口 {self.port}")
        print(f"  归属   {self.owner()}")
        print(f"  地址   localhost:{self.port}{PAGE}")
        if not up:
            print("         服务没在跑 —— 按 s 启动")
        print("  " + rule)
        print("  o   打开播放器（浏览器）")
        print("  s   启动 / 停止服务")
        print("  r   重启服务")
        print("  q   退出（会关掉本窗口起的服务）")
        print("  " + rule)
        if msg:
            print("  " + msg)
        print()

    def run(self):
        self.draw("第一次启动中…")
        if not self.alive():
            self.start()
        self.draw("已就绪。按 o 打开播放器，回车刷新状态。")
        if self.auto_open:
            self.open()
        while True:
            try:
                c = input("  命令 (o/s/r/q) > ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if c in ("q", "quit", "exit"):
                break
            if c == "o":
                self.open()
                self.draw("已打开浏览器。")
            elif c in ("s", "start", "stop"):
                if self.alive():
                    ok = self.stop()
                    self.draw("服务已停止。" if ok else "停不掉：没找到监听进程。")
                else:
                    ok = self.start()
                    self.draw("服务已启动。" if ok else "启动失败，看下面有没有报错。")
            elif c in ("r", "restart"):
                self.stop()
                time.sleep(0.4)
                ok = self.start()
                self.draw("已重启。" if ok else "重启失败。")
            else:
                self.draw()
        # 退出
        if self.child is not None and self.child.poll() is None:
            self.stop()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5440)
    ap.add_argument("--no-open", action="store_true", help="调试用：不自动开浏览器")
    a = ap.parse_args()
    Panel(a.port, auto_open=not a.no_open).run()


if __name__ == "__main__":
    main()
