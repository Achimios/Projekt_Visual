# Clean Slate · 复现指南（外人拿起来就能跑）

> 目标不是逐帧一模一样，是**能复现这套审美和品质**。
> 读顺序：本文件（怎么跑）→ `审美判据.md`（什么算好）→ `决策史.md`（为什么这么做）。
> 上游哲学在 `Vault_Automata/4_Eidolon/_设计/哲学.md`；镜头/转场手法在 `_设计/方法_剪辑与情绪.md` §四⅞¾。

---

## 1. 这是什么

数字偶像的出道曲 MV。她是从 LLM 的数据海里醒来的 AI 人格——Suno 生成的歌（125 BPM 实测），
画面的主体是代码实时画的（Canvas 2D + 少量 three.js）。生成模型的顺序是：先让 LLM 明确意图锚点 → 代码动画 + Seedream 低帧 → **最后**才把局部或全画面交给 Seedance（👤2026-11-02）。
三支完整版本由三个会话各做一支，值钱的地方是**三支的分歧点**，不是选出一支最好的。

- 时长 189.48 s，1920×1080，30 fps，带原声。
- 纯像素 + MG 几何 + 3D 几何。参考：Blade Runner 底色（冷、暗、忧郁、克制），可爱只在表情里闪一下。

## 2. 目录里有什么

| 路径 | 是什么 |
|---|---|
| `_web/` | **全部代码**。每个 `.html` = 一个可跟歌播放的页面，配同名的 `.js` |
| `-5_Clean Slate/Clean Slate.wav` | 歌（**时间轴的真源**，189.48 s） |
| `-5_Clean Slate/_分析/` | 节拍 / 能量 / 逐词（Python 预算） |
| `-5_Clean Slate/分镜_v2.md` | 分镜，末尾有对照情绪大图的修正 |
| `-5_Clean Slate/样片/` | 所有成片 mp4（**不进 git**，体积大） |
| `素材/` | Seedream 出的图、像素化中间产物（**不进 git**） |
| `3D/` | Tripo / Neural4D 的 glb（**不进 git**） |
| `_参考/`、`_参考库/` (在上一级) | Leo 给的参考图 + MG 拆解 |
| `_反馈/` | Leo 的反馈原文 + 分工计划 |
| `_复现/` | 本文件所在 |


## 3. 跑起来

```bash
cd MV_Clean_Slate/_web
python -X utf8 serve.py --port 5430
# 打开 http://localhost:5430/_web/open_v2.html
```

`serve.py` 的根目录 = 它的上一级（`MV_Clean_Slate/`），只绑 `127.0.0.1`。
它同时是**静态服务器**和**出片收帧端**：页面加参数后逐帧 POST RGBA 给它，它喂给 ffmpeg。

**页面参数约定**（新页面请照这个来，别自创）：

| 参数 | 作用 |
|---|---|
| `?t=36.5` | 只画这一秒的静帧（调画面用） |
| `?t0=80` | 从这一秒开始跟歌播放。⚠️**是歌里的绝对秒，不是段内偏移** —— 5 秒的片段写 81.3，不是 0 |
| `?sheet=28.3,43.8,16` | 接触表：起、止、张数（一眼看 16 帧） |
| `?render=1&t0=&t1=&out=` | 逐帧交给 serve.py 出 mp4 |

**播放器**：双击 `open_preview.bat`，打开 `_web/player.html`。歌是唯一的时钟：实时页面用 `?t=` 打开后由播放器每帧调 `window.DRAW(t)`，样片用静音 `<video>` 跟时钟，所以不用先渲染。新页面支持 `?t=`、挂 `window.DRAW`，再往 `_web/pieces.json` 加一行；`cut` 是全片模式的当前剪辑。打点存到 `_反馈/打点.json`。
⚠️ 实时预览不含渲染那一遍的色散和颗粒（`LOOK.pixels`），定稿仍要渲。

⚠️ **实际支持情况不齐**（2026-10-31 逐个 grep 过，别假设都一样）：

| 页面 | t | t0 | sheet |
|---|---|---|---|
| `open_v2.html` | ✅ | ✅ | ✅ |
| `full_main.html` | ✅ | ✅ | ✅ |
| `animator1/full.html` | ✅ | ✅ | ✅ |
| `animator1/now_i_can_run.html` | ✅ | ✅ | ✅ |
| `wake_v3 / v4 / v5 .html` | ✅ | ✅ | ❌ |
| `animator2/full.html` | ✅ | ✅ | ❌ |
| `animator2/win_close.html` | ✅ | ✅ | ❌ |
| `animator2/index_v2.html` | ❌ | ❌ | ❌（参数名自定，用前先读代码） |


**端口分配**（历史约定，避免几个会话串帧——`serve.py` 是全局单状态）：

| 端口 | 谁 |
|---|---|
| 5430 | 主会话 / 现在共用 |
| 5431 | Animator1 |
| 5432 | Animator2 |

## 4. 出片

```bash
cd MV_Clean_Slate/_web
bash render_segments.sh open_v2.html 5430 "…/样片/开场_v4.mp4" 28.4 15
#      bash render_segments.sh <页面> <端口> <最终mp4绝对路径> [总时长=189.48] [段长=20]
```

**为什么要分段**：headless Chrome 连续 POST 约 1000 帧后会卡住（内存），所以每 20 s 开一个新浏览器，
每段渲完用 ffprobe 验时长、卡住就重试 3 次，最后 concat 再把**整首原声重新铺一遍**（避免段间音频接缝）。

⚠️ 三个已知坑：
- ⚠️ **它只能「从 0 秒渲到 DUR」**。渲中间某一段用 `_web/render_mid.sh <页面> <端口> <输出> <START> <END>`。
- 两个脚本的断点续渲会比较 `_web` 里 js 的修改时间：改过代码自动重渲。中间分段在 `_tmp/`。
- `ROOT` 现在从脚本位置推导（`cd $(dirname $0)/.. && pwd -W`），所以**换目录不用改**；只有在非 Git Bash 环境下 `pwd -W` 取不到时才用兜底那行硬编码路径。
- `render_segments.sh` 支持 `?quit=1` 才关服务；不带你就能连续渲多段。

⚠️ 本机 `bash` 不在 PATH 里，要用 `C:\Program Files\Git\bin\bash.exe`。

更完整的踩坑记录在 `Projekt_Visual/_LEARNINGS.md`。

需要 `ffmpeg`：当前写死在 `E:/2_Little_Wares/ffmpeg-master-latest-win64-gpl-shared/bin/`（`serve.py` 第 14 行、`render_segments.sh` 第 10 行）。换机器改这两处。

## 5. 素材从哪来

| 环节 | 工具 | 规矩 |
|---|---|---|
| 出图 | Seedream（`_web/gen_shots*.py`） | ⭐**必须带风格参考图**当锚点，每镜 3–4 张挑；纯文字 prompt = AI 默认审美 |
| 抠图 | `4_Eidolon/tools/matte.py`（**BiRefNet**） | 吃图也吃视频，输出透明 PNG 序列。不会把发光点误当成人 |
| 像素化 | `_web/prep_px.py`、`prep_a2.py` | 320×180 / 调色板读 `_web/px/manifest.json` |
| 九宫格帧 | `_web/gen_grid.py` | 低帧动画，一张图 = 若干帧（**帧数按画面精度定，不必 9**） |
| 动作 | Seedream 低帧动画优先；Seedance 放最后 | 连续动作放在**同一张图**里出；九宫格接不上的长动作、或意图锚点都定了之后，局部或全画面交 Seedance |

## 6. 时间轴的真源

| 文件 | 内容 | 注意 |
|---|---|---|
| `Clean Slate.wav` | 歌，189.48 s | 125 BPM 是**实测**（Suno 标 126、Style 写 122 都不准） |
| `_web/words_snap.json` | 440 个词的时间 | ⭐**对齐到人声起音**（`snap_words.py`）。Whisper 原稿 `words.json` 个别词差 0.1–0.3 s |
| `_web/audio.json` | 鼓 / 贝斯包络 + 拍点 | Python 预算 |

新页面请直接用 `words_snap.json`，别再读 `words.json`。

## 7. 三支全片（2026-10-30 夜）

| | 页面 | 成片 | 一句话 |
|---|---|---|---|
| 主会话 | `full_main.html` | `全片_v2_main.mp4` | 歌词驱动，每句一镜，大字砸进来；整片叠「没构建完」区域 |
| Animator1 | `animator1/full.html` | `全片_v1_animator1.mp4` | 纯代码数据海开场；编辑排版式小字歌词；橙从睁眼开始越来越多 |
| Animator2 | `animator2/full.html` | `全片_v1_animator2.mp4` | 整片是一块 CRT 屏，她总从几何窗口里被看见；酸绿符号阵列底 |

各自的说明在 `_web/animator1/说明_全片.md`、`_web/animator2/说明_全片.md`（含"没做到 / 没验证的"）。

## 8. 三个会话共同的盲区（写下来，别继承这个 bug）

**三个会话都听不到声音**，只看了接触表和抽帧。所以：
- "节奏合不合拍、动得舒不舒服"**必须由人判断**，说明里要写清楚哪些没验证。
- 我看不到连续运动，只看到离散静帧 → 判断"运动是否流畅"不可靠，要么让人看视频，要么抽更密的帧。

这一条是本项目最贵的教训：**不要替人判断节奏**。
