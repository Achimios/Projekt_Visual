#!/usr/bin/env bash
# 分段渲染：headless Chrome 连续 POST 约 1000 帧原始 RGBA 后会卡住（内存），所以每 20 s（600 帧）开一个新浏览器，
# 最后把各段视频拼起来，再整首铺上原声。页面要支持 ?render=1&t0=&t1=&out=（wake_v3 起的页面都支持）。
# 用法：bash render_segments.sh <页面相对 _web 的路径> <端口> <最终 mp4 绝对路径> [总时长=189.48] [段长=20]
PAGE="$1"; PORT="$2"; OUT="$3"; DUR="${4:-189.48}"; SEG="${5:-20}"
# 根目录 = 本脚本的上一级（pwd -W 给 Windows 风格 C:/...，后面 ${seg#$ROOT/} 要用）
# 换目录 / 换工作副本不用改；实在取不到再手动改兜底那行。
ROOT="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null)"
[ -n "$ROOT" ] || ROOT="C:/Users/Administrator/Desktop/Projekt_Visual/MV_Clean_Slate"
TMP="$ROOT/_tmp/_段_$(basename "$OUT" .mp4)"; mkdir -p "$TMP"   # 中间分段放 _tmp，不污染样片目录
SP="C:/Users/Administrator/AppData/Local/Temp/cs_chrome_seg_$PORT"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BIN=/e/2_Little_Wares/ffmpeg-master-latest-win64-gpl-shared/bin
kill_mine() {
  powershell -NoProfile -Command "foreach (\$p in Get-CimInstance Win32_Process) { if (\$p.Name -eq 'chrome.exe' -and \$p.CommandLine -like '*chrome_seg_$PORT*') { try { Stop-Process -Id \$p.ProcessId -Force -ErrorAction Stop } catch {} } }" >/dev/null 2>&1
}
n=$(awk "BEGIN{print int(($DUR + $SEG - 0.001) / $SEG)}")
: > "$TMP/list.txt"
for ((k = 0; k < n; k++)); do
  t0=$(awk "BEGIN{print $k * $SEG}"); t1=$(awk "BEGIN{v = ($k + 1) * $SEG; print (v > $DUR ? $DUR : v)}")
  seg="$TMP/seg$(printf %02d $k).mp4"; rel="${seg#$ROOT/}"
  echo "file '$seg'" >> "$TMP/list.txt"
  want=$(awk "BEGIN{print ($t1 - $t0) - 0.5}")
  ok=0
  for try in 1 2 3; do
    if [ -f "$seg" ] && [ -z "$(find "$ROOT/_web" -maxdepth 2 -name '*.js' -newer "$seg" -print -quit)" ] && d=$("$BIN/ffprobe.exe" -v error -show_entries format=duration -of csv=p=0 "$seg" 2>/dev/null) && [ -n "$d" ] && awk "BEGIN{exit !($d >= $want)}"; then ok=1; break; fi
    kill_mine; sleep 1
    url="http://localhost:$PORT/_web/$PAGE?render=1&t0=$t0&t1=$t1&out=$(python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$rel")"
    "$CHROME" --headless=new --user-data-dir="$SP" --window-size=1920,1080 --ignore-gpu-blocklist --no-first-run \
      --disable-background-timer-throttling --disable-renderer-backgrounding "$url" >/dev/null 2>&1 &
    last=-1; still=0
    while true; do
      sleep 10
      d=$("$BIN/ffprobe.exe" -v error -show_entries format=duration -of csv=p=0 "$seg" 2>/dev/null)
      if [ -n "$d" ] && awk "BEGIN{exit !($d >= $want)}"; then ok=1; break; fi
      sz=$(stat -c %s "$seg" 2>/dev/null || echo 0)
      if [ "$sz" = "$last" ]; then still=$((still + 1)); else still=0; fi; last=$sz
      if [ $still -ge 12 ]; then echo "seg $k stalled (try $try)"; break; fi
    done
    [ $ok = 1 ] && break
  done
  kill_mine
  [ $ok = 1 ] || { echo "seg $k FAILED"; exit 1; }
  echo "seg $k ok ($t0–$t1)"
done
# 拼接：只取视频流，整首原声重新铺（避免段间音频接缝）
"$BIN/ffmpeg.exe" -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -i "$ROOT/-5_Clean Slate/Clean Slate.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -af "afade=t=out:st=$(awk "BEGIN{print $DUR - 1.2}"):d=1.2" -shortest "$OUT" \
  && echo "done $OUT"
