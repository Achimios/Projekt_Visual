#!/usr/bin/env bash
# 渲染看门狗：启动 headless Chrome 渲染某个页面；如果输出文件 3 分钟没长大，就杀掉重来（最多 3 次）。
# 用法：bash render_watch.sh <页面相对 _web 的路径> <输出 mp4 的绝对路径>
PAGE="$1"; OUT="$2"
SP="C:/Users/Administrator/AppData/Local/Temp/claude/C--Users-Administrator-Desktop-SimuWeb/6bc0ee7d-2842-444c-bfd1-d608988080e1/scratchpad/chrome_render"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
FP=/e/2_Little_Wares/ffmpeg-master-latest-win64-gpl-shared/bin/ffprobe.exe
kill_render() {
  powershell -NoProfile -Command "foreach (\$p in Get-CimInstance Win32_Process) { if (\$p.Name -eq 'chrome.exe' -and \$p.CommandLine -like '*chrome_render*') { try { Stop-Process -Id \$p.ProcessId -Force -ErrorAction Stop } catch {} } }" >/dev/null 2>&1
}
for try in 1 2 3; do
  kill_render; sleep 2
  "$CHROME" --headless=new --user-data-dir="$SP" --window-size=1920,1080 --ignore-gpu-blocklist --no-first-run \
    --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows \
    "http://localhost:5430/_web/$PAGE?render=1" >/dev/null 2>&1 &
  last=-1; still=0
  while true; do
    sleep 30
    d=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$OUT" 2>/dev/null)
    if [ -n "$d" ] && awk "BEGIN{exit !($d > 185)}"; then echo "done try=$try dur=$d"; kill_render; exit 0; fi
    sz=$(stat -c %s "$OUT" 2>/dev/null || echo 0)
    if [ "$sz" = "$last" ]; then still=$((still + 1)); else still=0; fi
    last=$sz
    if [ $still -ge 6 ]; then echo "stalled at $sz bytes (try $try), restarting"; break; fi
  done
done
echo "gave up"; exit 1
