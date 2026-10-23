# TTS 调用方法（Projekt_Visual 各作品共用）

> 底本：`C:/Users/Administrator/Desktop/Vault_Automata/1_TTS/__TTS_调用方法(简洁).md`（2026-10-24 抄来，只留 MV 配音会用到的）。
> 规格手册 `__TTS_详细规则.md`，台词写法 `__TTS_写台词技巧.md`，角色表 `__TTS_角色表.md`（都在 1_TTS 根目录）。
> 入口：`C:/Users/Administrator/Desktop/Vault_Automata/1_TTS/tts_v1.py`。daemon（端口 5299）自动拉起，别手动开。
> 👤2026-10-24：对 Leo 说话默认用 **cortana 英文**（英文声线更有感情）。

## 规矩（四条）
1. **bash 管道**喂一行 JSON（PowerShell 5.1 会把中文变 `??`）。
2. `id` 每次唯一；重复 id 直接跳过（幂等），失败可原样重发。
3. 默认不等播完，入队即返回 `{"ok":true,"accepted":true}`；要结果加 `"wait":true`。
4. `ok:false` 才是失败；`accepted` 只是入了队。

## 例子
```bash
# 英文、等播完拿结果
printf '%s' '{"id":"mv-001","role":"cortana","lang":"en","mood":"confident","wait":true,"text":"Done. Three hundred and twenty tests, all green."}' | python "C:/Users/Administrator/Desktop/Vault_Automata/1_TTS/tts_v1.py" --stdin
```
```bash
# 中文、不等
printf '%s' '{"id":"mv-002","role":"cortana","lang":"zh","mood":"usual","text":"样片出来了，在样片文件夹。"}' | python "C:/Users/Administrator/Desktop/Vault_Automata/1_TTS/tts_v1.py" --stdin
```
```bash
# 插队并打断（只在「我发现自己错了」时用）
printf '%s' '{"id":"mv-003","role":"cortana","lang":"en","mood":"urgent","brk":true,"text":"Wait. I got that number wrong."}' | python "C:/Users/Administrator/Desktop/Vault_Automata/1_TTS/tts_v1.py" --stdin
```
HTTP 一样的 JSON（默认 wait=true）：
```bash
curl -X POST http://127.0.0.1:5299/speak -H "Content-Type: application/json" -d '{"id":"mv-004","role":"cortana","lang":"en","mood":"usual","text":"Ready when you are."}'
```

## 字段
| 字段 | 写什么 |
|---|---|
| `id` | 每次唯一的字符串 |
| `role` | `cortana`（最全：volc / edge / qwen 四后端，中英，六情绪）；认不出就用机器人声 |
| `text` | 要念的话。数字写成文字，一句别太长 |
| `lang` | `zh` / `en` / `ja` / `de`；不写按文本猜 |
| `mood` | `usual` 日常（默认）、`wistful` 伤感、`comfort` 安慰 / 平静、`urgent` 急促 / 战斗、`confident` 自信、`curious` 好奇 / 分析中。同义词可自由发挥，认不出回落默认音色 |
| `wait` | `true` 等播完拿完整结果 |
| `brk` | `true` 插队并打断当前 |

**不用写**：`pref`（默认火山，失败自动降级）、`style`（只有 Qwen 吃）、`speed_ratio` / `pitch`（角色表已配）。

## 可选：音效和定位（MV 配音用）
| 字段 | 写什么 |
|---|---|
| `fx` | 后处理：`对讲机` / `空房间` / `教堂` / `崩溃失控` / `瓦解` / `入侵` / `电磁干扰`；`+` 串联，如 `"对讲机+教堂"` |
| `pos` | 定位（耳机）：`[方位, 俯仰, 距离米]`，方位 0 前 +90 右 ±180 后，俯仰 +90 上。`[-90,-10,0.12]` = 左耳边耳语 |
| `hrtf` | 只有 `"kemar"`（实测头模）；不写 = 合成模型 |

```bash
printf '%s' '{"id":"mv-005","role":"cortana","lang":"zh","mood":"urgent","fx":"对讲机","pos":[135,0,2],"hrtf":"kemar","text":"护盾在掉，往左，现在。"}' | python "C:/Users/Administrator/Desktop/Vault_Automata/1_TTS/tts_v1.py" --stdin
```

多段换情绪 / 声音走轨迹（`segments`、`pos` 的 `from` / `to` / `turns`）见 1_TTS 的 `__TTS_调用方法(完整演示).md` 2.1 节。

## 写台词
情绪由 `mood` 决定，标点只调节奏：急促用逗号串联，深情用句号断句加 `~` 拖尾。
