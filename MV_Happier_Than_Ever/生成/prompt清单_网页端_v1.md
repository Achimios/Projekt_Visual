# HTE · 给网页端生成的视频镜头 prompt 清单 v1（Fable，2026-10-24）

> 👤：贵的视频镜头只写成清单，Leo 去网页端（Seedance 2.5 草稿模式 480p → 正式）生成。每条带首帧（我们已有的 Seedream 静帧），运动描述只写一件事。角色规范 `角色规范.md` 的 CHARACTER_SPEC 原样附上。生成后放 `素材/`，我用 redraw.py 重绘（观众只看代码层，所以视频本身不用完美，运动对就行）。
> 优先级：⭐ 必要（静帧撑不住的运动）> ○ 加分。全部 16:9，5 s，`generate_audio` 关。

| 优先 | 镜头（分镜 id） | 首帧 | 运动 prompt（英文，一件事） | 时长 |
|---|---|---|---|---|
| ⭐ | L08 俯拍折信 | P08 | Her hands fold the letter in half, then in half again, slowly and very precisely; nothing else moves; the camera holds still. | 5 s |
| ⭐ | E02 撕信 | P20（待生成） | Top-down: her hands tear a letter into small squares one by one and lay them in rows by size; a trophy at the edge tips over and cereal spills; the lamp light slowly turns grey. | 8 s |
| ⭐ | L25 车灯亮起 | P21（待生成） | Night parking lot: the headlights of a dark sedan switch on toward the camera; she stands small at the edge and does not move; lens flare minimal. | 5 s |
| ⭐ | L31/L32 天台 | P26 | Rooftop at night: wind blows her single orange braid straight sideways; her body does not move; city lights flicker slightly below. | 5 s |
| ⭐ | L37 吸尘器 | P31（待生成） | She pushes a vacuum cleaner slowly across a kitchen floor covered with paper scraps; the scraps get pulled toward the nozzle; deadpan; cold light. | 6 s |
| ○ | L07 打字 | P07 | Extreme close-up: her fingers type on a vintage typewriter, one key at a time, the paper advancing by one line. | 5 s |
| ○ | L09 剪杂志 | P09（待生成） | She cuts a face out of a magazine page with scissors and tapes it to the fridge door; slow, exact. | 6 s |
| ○ | L13 空车位 | P13（待生成） | Night: she speaks silently toward an empty parking space under one street lamp; only her lips move; the lamp flickers once. | 5 s |
| ○ | L16 坐冰箱里 | P16（待生成） | She sits inside an open refrigerator; her breath fogs in the cold light; she does not move otherwise. | 5 s |

**不要**：真人脸、Billie 的任何符号、oversized 衣服、雨中走、慢动作回头、第二种饱和色。首帧要明显 CG（我们的静帧已是）。
