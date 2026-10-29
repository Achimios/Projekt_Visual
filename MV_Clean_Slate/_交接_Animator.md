# 交接：Clean Slate「她睁眼」15 秒 · 学一个仓库的手法做一版（2026-10-30）

> 给 Animator1 / 2 / 3。三个会话做**同一段**，各学**一个**仓库，交一个 mp4。值钱的是三版之间的**分歧点**。

## 做什么
- 歌：`Projekt_Visual/MV_Clean_Slate/-5_Clean Slate/Clean Slate.wav`，只做 **28.3–43.8 s**（「Layer by layer … every little star says wake up」）。
- 逐词时间：`MV_Clean_Slate/_web/words.json`（Whisper 听写；`GAME`=GATE、`Go`=UP）；拍点 / 鼓 / 贝斯包络：`_web/audio.json`（实测 125 BPM）。
- 故事：一个 AI 人格从 LLM 的数据海里醒来（出道曲）。分镜 `-5_Clean Slate/分镜_v2.md`，歌词 `歌词_v4.md`。
- 她：用 `_web/cybergirl.js` 的 `drawCyberGirl()` + `blitGirl()`（像素动漫、赛博）。⚠️**别改这个文件**，形象还在迭代，主会话改；要新表情就在你自己的文件里包一层。
- 已有的一版（对照用，别照抄）：`_web/wake_v3.html/js`（one-prompt 手法）。

## 你学哪个仓库（只学手法和技术，不搬图形 / 文字 / 歌）
- **Animator1 → `Vault_Automata/_外部仓库/pdoom-video`**（MIT；音频 / 歌词不是 MIT）。重点读 `docs/ENGINE.md`、`docs/TREATMENT.md`、场景写法：卡拉 OK 式逐词排版、运动模糊采样、每帧 = 歌曲时间的纯函数、场景之间怎么交接。
- Animator2 → `_外部仓库/mg-styles-15`（15 种 MG 风格，每种有 prompt + 源码；先看第 13 种像素风，再挑 1–2 种适合「赛博女孩醒来」的）。
- Animator3 → `_外部仓库/openfilm-examples/one-prompt`（三维排版、bloom / halation / 颗粒、甩镜 / 冲击帧；主会话的 v3 已经借过一轮，你往更深处挖：type3d、glsl 板块）。

## 规矩
- 画面用 **JS / HTML**（Canvas 或 three.js，本地已有 three 在 `_web/vendor/`）；Python 只算数据。
- 你的文件放 `MV_Clean_Slate/_web/animatorN/`（N = 你的编号），别动别人的文件。
- 出片：本地服务 `_web/serve.py`（SimuWeb `.claude/launch.json` 的 `clean-slate`，端口 5430，已在跑就复用）；页面 `?render=1` 逐帧 POST 给 `/start` `/frame?i=` `/done`，用法照 `wake_v3.js` 末尾。headless Chrome 渲染时用**你自己的** `--user-data-dir`。
- 交付：`-5_Clean Slate/样片/风格小样_她睁眼_animatorN.mp4` + 一页 `animatorN/说明.md`（学到了什么、和 v3 哪里不一样、没做到 / 没验证的）。
- 画风：开心、可爱但**酷**的赛博女孩；配色靛紫底 + 品红 / 青 / 酸性黄绿 / 一点橙；参考 `Projekt_Visual/_参考库/分析_Modular`、`分析_FITC2015_Titles`、`AshThorp_GitS_接触表`、`_参考_Short/_说明.md`。
- 节奏规矩：**做完排队，不要主动推给 Leo**；告诉主会话（Leo 的 Clean Slate 会话）路径即可。
- 删除一律进回收站（`Vault_Automata/4_Eidolon/tools/trash.py`），只删自己这轮的中间文件。提交只 `git add -- 你自己的路径`，提交人 `Leo Akimos <seeuaurora@gmail.com>`，末尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。不装包、不下载，先问。
- 我（主会话）只看接触表和静帧、听不见声音：节奏手感归 Leo 判断，说明里要写清楚哪些没验证。
