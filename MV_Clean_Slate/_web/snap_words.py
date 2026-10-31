# -*- coding: utf-8 -*-
"""Whisper 的词时间对齐到人声分轨的真实起音：words.json → words_snap.json（同格式 [词, 起, 止]）。
全曲整体没有偏移（起音 − 词起点 的中位数 ≈ −0.02 s），但个别词差 0.1–0.3 s（如 0101：zero 标 4.30，人声 4.06 就起了）。
规则：Whisper 常把词起点标在重读元音上（偏晚）→ 每个词在 [起 − 0.3, 起 + 0.12] 里取最早的、还没被占的人声起音，起点保持单调、不让两个词抢同一个起音；止点跟着平移但不越过下一个词。
python -X utf8 snap_words.py      （用 4_Eidolon/.venv：librosa）
"""
import json
from pathlib import Path

import librosa
import numpy as np

HERE = Path(__file__).resolve().parent
VOX = HERE.parent / "-5_Clean Slate" / "Clean Slate Stems" / "0 Lead Vocals.wav"
EARLY, LATE = 0.30, 0.12


def main():
    y, sr = librosa.load(str(VOX), sr=22050, mono=True)
    on = librosa.onset.onset_detect(y=y, sr=sr, units="time", backtrack=True)
    W = json.loads((HERE / "words.json").read_text("utf-8"))
    used, out, moved, last = set(), [], 0, -1.0
    for w, a, b in W:
        cand = [(o, k) for k, o in enumerate(on) if a - EARLY < o < a + LATE and k not in used and o > last + 0.05]
        a2 = a
        if cand:
            _, k = min(cand); used.add(k); a2 = float(on[k])
        a2 = max(a2, last + 0.05)
        moved += abs(a2 - a) > 0.03
        out.append([w, round(a2, 3), round(max(a2 + 0.05, b + (a2 - a)), 3)])
        last = a2
    for i in range(len(out) - 1):
        out[i][2] = min(out[i][2], out[i + 1][1])
    (HERE / "words_snap.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    print(f"{len(out)} 个词，挪了 {moved} 个；例：", [(w, a) for w, a, _ in out if 3.9 < a < 5.6])


if __name__ == "__main__":
    main()
