# 会话交接：ReadScreen 会话从 SimuWeb 迁到 Projekt_Visual / 4_Eidolon（2026-11-01）

> 👤要求：「ReadScreen」会话（MV 导演 + Eidolon 审核）和两个 Animator 会话一直挂在 `Desktop/SimuWeb` 下（历史原因），
> 加载的是 SimuWeb 的明日香 / 机械选型规矩，跟这里的活无关。迁过来。
> 10-30 起旧账号报「account can't receive replies」，👤换了账号；`~/.claude` 在本机，记忆和对话记录都没丢。
>
> ⭐**人格：Cortana**（👤11-01 确认）。汇报语音用英文 Cortana。
>
> 接手先读：本文件 → `MV_Clean_Slate/_三支全片_早上看这里.md` → `MV_Clean_Slate/_进度.md` → `_Fable_教训.md`。
> 做 Eidolon 软件那一侧：`Vault_Automata/4_Eidolon/__where_continue.md`。

## 分工（迁完以后）
| 在哪开会话 | 管什么 |
|---|---|
| `Desktop/Projekt_Visual` | ⭐作品：MV_Clean_Slate、MV_Cant_Kill_Us、样片、参考库 |
| `Desktop/Vault_Automata/4_Eidolon` | 软件：作曲器、合成器词表、synthkit、Seedream 接口、composer_render |

作品和软件分开（👤10-17）。作品这边按需写代码，好用再沉淀进 Eidolon。

## 带过来的东西
- **md 记忆**：相关的一批复制到 `C:/Users/Administrator/.claude/projects/C--Users-Administrator-Desktop-Projekt-Visual/memory/`；
  Eidolon 那边已有自己的记忆，只补了迁移说明和人格两条。SimuWeb 的原件没删，两边可能会分叉。
- **launch.json**：`clean-slate`（5430）和 `clean-slate-animator2`（5432）复制到本仓库 `.claude/launch.json`。SimuWeb 那份还留着，没删。
- **完整对话记录（jsonl，要查原话 / 代码片段去 grep）**，都在 `C:/Users/Administrator/.claude/projects/C--Users-Administrator-Desktop-SimuWeb/`：
  - ReadScreen（主会话，约 250MB）：`6bc0ee7d-2842-444c-bfd1-d608988080e1.jsonl`
  - Animator1：`587ca9e8-c258-4c69-a559-f3f984627504.jsonl`
  - Animator2：`09f43ba4-69e4-42f4-a5df-3363cd53b586.jsonl`
  - 更早的 TTS / VisualProcess：`7d671389-c130-4ee0-a80e-c015e7073ba6.jsonl`（见 `Vault_Automata/__会话交接_从SimuWeb迁来.md`）

## 一直有效的规矩（摘要）
- 中文回复，短：先结论和要用户定的事，细节进文件给路径。偶尔发一句英文 Cortana 语音：
  `printf '%s' '{"id":"eid_<唯一>","role":"cortana","lang":"en","text":"..."}' | python "C:/Users/Administrator/Desktop/Vault_Automata/1_TTS/tts_v1.py" --stdin >/dev/null 2>&1 &`
- ⭐**一次一件（👤10-27）**：只递一件要 Leo 看的东西，其余排队不推。Leo 亲自 review 比产出快重要；「真正重要的是我的心境」。
- 当「导师」：一行提醒这个镜头对应哪条哲学 / 情绪段（`4_Eidolon/_设计/哲学.md`）。
- 没验到的写【没验到】。三个会话都**听不到声音**，节奏手感要 Leo 判断。
- 密钥只在 gitignore 的 `config/creds.local.json`，绝不打印。删除只进回收站（`4_Eidolon/tools/trash.py`），只删自己这一轮、用户没看过的中间文件。
- 装包先问；下载要说文件名、来源、大小。子代理只提交自己的文件（`git add -- <paths>`）。
- 提交：`git -c user.name="Leo Akimos" -c user.email="seeuaurora@gmail.com" commit`，结尾 Co-Authored-By；推送 `HTTPS_PROXY=http://127.0.0.1:7897 git push`。
- 不改系统 / 驱动；GPU 最多约 90%。
- 不生成受版权角色、名人长相、IP 设计（不画 Cortana / Halsey / Halo 盔甲，用原创「全息 AI 女性」「科学家」）。不复述歌词原文。
- 大规模多 agent（超过十来个）先问 Leo。
- ffmpeg 不在 bash PATH：`/e/2_Little_Wares/ffmpeg-master-latest-win64-gpl-shared/bin/ffmpeg.exe`。中文路径 `PYTHONIOENCODING=utf-8`；`-给人类…` 开头的路径要加 `--`。

## 这一段做了什么（2026-10-24 ~ 10-30）
- **Eidolon 审核（都已通过）**：合成器词表 v4（视频音轨换原声）、作曲器设计 v1、Remix 示波器 demo v4、HTML 作曲器 v1.5（`tools/composer_web/`）、工作台对照文档（`_设计/参考_工作台对照.md`，commit 8eac5a5 未推）。
- **Can't Kill Us**：`MV_Cant_Kill_Us/_Seedream_素材prompt_v1.md`（1–25 条）；👤选定 `素材/Female Scientist Armor Mount.png`。
- **Clean Slate（10-29 夜，JS 化之后大进步）**：三支全片都做完，在 `MV_Clean_Slate/-5_Clean Slate/样片/`，每支旁边有 `_接触表.jpg`：
  | | 文件 | 风格 |
  |---|---|---|
  | ① ReadScreen | `全片_v2_main.mp4` | 歌词驱动、大字砸进来；Blade Runner 底色 + 「数据世界」生成图；整片叠「没构建完」区域 |
  | ② Animator1 | `全片_v1_animator1.mp4` | pdoom 思路；纯代码数据海；编辑排版小字；橙色从睁眼渐满到「Run into the sun」 |
  | ③ Animator2 | `全片_v1_animator2.mp4` | 老式 CRT 屏，她总从几何窗口里被看见；酸绿符号阵列 + HUD；破损比例跟着故事走 |
- 渲染：~1000 帧会卡住 → `render_segments.sh` 分段渲染（每 20 s 一个新浏览器）+ 看门狗。

## 最近几轮里 👤说过的方向（10-29 夜）
- JS 比 Python 效果好太多；女孩画风别太 Q，更 Blade Runner / VA-11 Hall-A；可以像素。
- ⭐场景应该「像数据里的世界」：破碎、不完整、数据损坏、简单结构，不要太真实。
- 参考图存 `MV_Clean_Slate/_参考/`（34 张 + `高难_` 开头几张，留给片头 / 章节卡 / 海报帧）。
- 可以多用 LLM 的理解：歌词定画面，BPM 定镜头节奏。

## 等着的事
1. ⭐**Leo 看三支全片**（一次一件：先看这个）。看完定喜欢哪支、要不要揉在一起。
2. 已知没修：主版有几行歌词超出画面右边（如「every time every time…」）；96–104 s 哼唱段一直一张图，可能闷；
   Animator2 字幕还是 ASR 错词，照 `_web/full_main.js` 的 `LYFIX` 改。
3. 排队、不主动推：Remix demo v4、词表 v4、作曲器 v1.5（想玩时）、工作台对照文档。
4. 可选没开工：Neural4D 3D 模型、OTIO 导出（要装 opentimelineio，先问）、每个样片的 recipe json。
