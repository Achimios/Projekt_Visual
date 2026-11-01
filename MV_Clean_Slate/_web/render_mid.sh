#!/usr/bin/env bash
# 中间段渲染：把页面在 [START, END]（**绝对歌曲秒**）之间渲成 mp4。
# 和 render_segments.sh 的区别：那个从 0 秒起算、整首；这个只渲你给的一段，还能带原声切片。
#
# 用法：
#   bash _web/render_mid.sh <页面相对 _web 的路径> <端口> <输出 mp4> <START> <END> [段长=20] [audio|noaudio]
#   例：bash _web/render_mid.sh ws_v2.html 5430 "$PWD/样片/段_工作空间_v2.mp4" 44 58
#
# 注意：
#   - 页面必须支持 ?render=1&t0=&t1=&out=（wake_v3 之后的页面都支持；t0/t1 是绝对歌曲秒）
#   - 输出先写到 _tmp，渲完才 mv 到目标，避免目标位置出现半成品（👤看不到「出现又消失」）
#   - 音频只切不拉伸；带头尾 0.15 s 淡入淡出防爆音
set -u
PAGE="$1"; PORT="$2"; OUT="$3"; START="$4"; END="${5:-}"; SEG="${6:-20}"; AUD="${7:-audio}"
if [ -z "${END:-}" ]; then echo "用法: render_mid.sh <page> <port> <out.mp4> <start> <end> [seg] [audio|noaudio]"; exit 2; fi

ROOT="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null)"
[ -n "$ROOT" ] || { echo "取不到根目录"; exit 1; }
TMP="$ROOT/_tmp/_段_$(basename "$OUT" .mp4)"; mkdir -p "$TMP"
SP="C:/Users/Administrator/AppData/Local/Temp/cs_chrome_mid_$PORT"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BIN=/e/2_Little_Wares/ffmpeg-master-latest-win64-gpl-shared/bin
DUR=$(awk "BEGIN{print $END - $START}")
[ -x "$CHROME" ] || { echo "找不到 Chrome：$CHROME"; exit 1; }
[ -x "$BIN/ffmpeg.exe" ] || { echo "找不到 ffmpeg：$BIN"; exit 1; }

kill_mine() {
  powershell -NoProfile -Command "foreach (\$p in Get-CimInstance Win32_Process) { if (\$p.Name -eq 'chrome.exe' -and \$p.CommandLine -like '*chrome_mid_$PORT*') { try { Stop-Process -Id \$p.ProcessId -Force -ErrorAction Stop } catch {} } }" >/dev/null 2>&1
}
urlq() { python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"; }

n=$(awk "BEGIN{print int(($DUR + $SEG - 0.001) / $SEG)}")
: > "$TMP/list.txt"
echo "渲染 $PAGE  $START → $END  (${DUR}s, $n 段)"
for ((k = 0; k < n; k++)); do
  a=$(awk "BEGIN{print $START + $k * $SEG}")
  b=$(awk "BEGIN{v = $START + ($k + 1) * $SEG; print (v > $END ? $END : v)}")
  seg="$TMP/seg$(printf %02d $k).mp4"; rel="${seg#$ROOT/}"
  echo "file '$seg'" >> "$TMP/list.txt"
  want=$(awk "BEGIN{print ($b - $a) - 0.5}")
  ok=0
  for try in 1 2 3; do
    if [ -f "$seg" ] && [ -z "$(find "$ROOT/_web" -maxdepth 2 -name '*.js' -newer "$seg" -print -quit)" ] && d=$("$BIN/ffprobe.exe" -v error -show_entries format=duration -of csv=p=0 "$seg" 2>/dev/null) && [ -n "$d" ] && awk "BEGIN{exit !($d >= $want)}"; then ok=1; break; fi
    kill_mine; sleep 1
    url="http://localhost:$PORT/_web/$PAGE?render=1&t0=$a&t1=$b&out=$(urlq "$rel")"
    "$CHROME" --headless=new --user-data-dir="$SP" --window-size=1920,1080 --ignore-gpu-blocklist --no-first-run \
      --disable-background-timer-throttling --disable-renderer-backgrounding "$url" >/dev/null 2>&1 &
    last=-1; still=0
    while true; do
      sleep 10
      d=$("$BIN/ffprobe.exe" -v error -show_entries format=duration -of csv=p=0 "$seg" 2>/dev/null)
      if [ -n "$d" ] && awk "BEGIN{exit !($d >= $want)}"; then ok=1; break; fi
      sz=$(stat -c %s "$seg" 2>/dev/null || echo 0)
      if [ "$sz" = "$last" ]; then still=$((still + 1)); else still=0; fi; last=$sz
      if [ $still -ge 12 ]; then echo "  seg $k 卡住（第 $try 次）"; break; fi
    done
    [ $ok = 1 ] && break
  done
  kill_mine
  [ $ok = 1 ] || { echo "seg $k 失败（$a–$b）"; exit 1; }
  echo "  seg $k ok  $a–$b"
done

TMPOUT="$TMP/out.mp4"
if [ "$AUD" = "audio" ]; then
  WAV="$ROOT/-5_Clean Slate/Clean Slate.wav"
  if [ -f "$WAV" ]; then
    "$BIN/ffmpeg.exe" -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" \
      -ss "$START" -t "$DUR" -i "$WAV" \
      -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k \
      -af "afade=t=in:d=0.15,afade=t=out:st=$(awk "BEGIN{print $DUR - 0.15}"):d=0.15" \
      -shortest "$TMPOUT"
  else
    echo "  没有原声 $WAV，只出画面"; AUD=noaudio
  fi
fi
if [ "$AUD" != "audio" ] || [ ! -f "$TMPOUT" ]; then
  "$BIN/ffmpeg.exe" -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMPOUT"
fi

mkdir -p "$(dirname "$OUT")"
mv -f "$TMPOUT" "$OUT" && echo "done $OUT"
"$BIN/ffprobe.exe" -v error -show_entries format=duration -of csv=p=0 "$OUT"
