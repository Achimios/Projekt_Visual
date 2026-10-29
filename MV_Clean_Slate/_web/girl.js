// 她：原创像素角色（全片同一个人，所有场景都从这里画）
// 比例拉长、带明暗（不是 Q 版）：乱糟糟的粉色短发 + 一根呆毛、一副大耳机（她听不见，耳机是空的）、
// 宽大的蓝卫衣（袖子太长）、左右不一样的袜子、白球鞋橙鞋底。goofy 靠姿势和表情，不靠大头。

// 调色：每种材质 3 档（亮 / 中 / 暗）
export const PAL = {
  i: [255, 196, 228], H: [255, 128, 196], h: [206, 80, 164],          // 头发
  S: [255, 218, 192], s: [232, 172, 150],                              // 皮肤
  E: [30, 22, 60], O: [255, 255, 255], B: [255, 132, 168], M: [196, 64, 108], b: [120, 70, 110],  // 眼 / 高光 / 腮红 / 嘴 / 眉
  P: [52, 50, 78], p: [255, 138, 42], q: [255, 186, 110],              // 耳机：头梁 / 橙色耳罩 / 耳罩高光
  v: [190, 228, 255], W: [126, 192, 255], w: [80, 140, 226], c: [244, 239, 230], k: [64, 108, 196],  // 卫衣 / 抽绳 / 口袋
  L: [64, 58, 112], l: [44, 40, 84],                                   // 打底裤
  Y: [214, 255, 74], G: [255, 92, 170],                                // 一只黄绿袜、一只粉袜
  F: [248, 246, 240], o: [255, 138, 42],                               // 鞋 / 鞋底
};

// 20 列 × 46 行；'.' = 空
const BASE = [
  "..........iH........",   // 0 呆毛
  ".........HHi........",
  ".......HHHHHHH......",
  "......HHiHHHHHH.....",
  ".....HHHHHHHHHHH....",
  "....PHHHHHHHHHHHP...",   // 5 耳机头梁
  "...pPHhHHHHHHhHHPp..",
  "...ppHhSSSSSSShHpp..",
  "...qpHSSSSSSSSSHpq..",   // 8
  "...ppHSEESSSEESHpp..",   // 9 眼
  "...ppHSSSSSSSSSHpp..",
  "....pHBSSSMSSSBHp...",   // 11 腮红 / 嘴
  ".....hHSSSSSSSHh....",
  "......hH.sSs.Hh.....",
  ".........sSs........",   // 14 脖子
  ".......vWcWcWv......",
  "......WWWcWcWWW.....",
  ".....WWWWcWcWWWW....",
  "....WWWwWcWcWwWWW...",
  "....WWwWWWWWWWwWW...",
  "...WWWwWWWWWWWwWWW..",
  "...WWwWWWWWWWWWwWW..",
  "...WWwWWWWWWWWWwWW..",
  "...WWwWWkkkkkWWwWW..",   // 23 口袋
  "...WWwWWkkkkkWWwWW..",
  "...WwwWWWWWWWWWwwW..",
  "...vwWWWWWWWWWWWwv..",   // 26 太长的袖口
  "....wwwwwwwwwwwww...",   // 27 下摆
  "......LLL...LLL.....",
  "......LLL...LLL.....",
  "......LLl...lLL.....",
  "......LLl...lLL.....",
  "......LLl...lLL.....",
  "......LLl...lLL.....",
  "......LLl...lLL.....",
  "......LL.....LL.....",
  "......LL.....LL.....",
  "......LL.....LL.....",
  "......YY.....GG.....",   // 38 袜子
  "......YY.....GG.....",
  "......YY.....GG.....",
  ".....FFFF...FFFF....",
  "....FFFFF...FFFFF...",
  "....ooooo...ooooo...",
  "....................",
  "....................",
];
export const COLS = 20, ROWS = BASE.length;

// 表情 / 姿势 = 在底图上打补丁（行, 起始列, 字符串）
const PATCH = {
  closed: [[9, 6, 'SbbSSSbbS']],                                                          // 闭眼：两条短线
  wide: [[7, 7, 'bbSSSbb'], [9, 6, 'SOESSSOES'], [10, 6, 'SEESSSEES']],                   // 睁大：眉毛挑起、两格高的眼带高光
  smile: [[11, 9, 'MSSM'], [12, 10, 'MM']],                                                  // 咧嘴笑
  oh: [[11, 10, 'MM'], [12, 10, 'MM']],                                                      // 「哦！」
  armsUp: [[15, 2, 'vw'], [16, 2, 'Ww'], [17, 3, 'W'], [15, 16, 'wv'], [16, 16, 'wW'], [17, 15, 'W'],
           [25, 3, '...'], [26, 3, '...'], [25, 15, '...'], [26, 15, '...'], [13, 2, 'SS'], [14, 2, 'S'], [13, 16, 'SS'], [14, 17, 'S']],
  crouch: [[30, 6, 'LLL...LLL'], [33, 5, 'LLL.....LLL'], [34, 5, 'LL.......LL'], [35, 5, '...........'], [36, 5, '...........'], [37, 5, '...........']],
};

// 状态 → 一张字符网格（每帧现算，纯函数）
export function sprite({ eyes = 'open', mouth = 'flat', pose = 'stand', ahoge = 0 } = {}) {
  const g = BASE.map(r => r.split(''));
  const put = list => { for (const [r, c, s] of list) for (let k = 0; k < s.length; k++) if (g[r] && c + k < COLS) g[r][c + k] = s[k]; };
  if (eyes === 'closed') put(PATCH.closed);
  if (eyes === 'wide') put(PATCH.wide);
  if (mouth === 'smile') put(PATCH.smile);
  if (mouth === 'oh') put(PATCH.oh);
  if (pose === 'armsUp') put(PATCH.armsUp);
  if (pose === 'crouch') put(PATCH.crouch);
  if (ahoge) { g[0][10] = '.'; g[0][11] = '.'; g[0][12] = 'i'; g[0][13] = 'H'; g[1][12] = 'H'; }   // 呆毛甩到另一边
  return g;
}

// 画出来：px = 一格的大小；gap = 格与格之间的细缝（像素格感，参考 PLAYER 卡）
export function drawSprite(ctx, g, x, y, px, { alpha = 1, gap = 1, tint = null } = {}) {
  for (let r = 0; r < g.length; r++) for (let c = 0; c < COLS; c++) {
    const ch = g[r][c]; if (ch === '.' || !PAL[ch]) continue;
    let col = PAL[ch];
    if (tint) col = col.map((v, i) => Math.round(v + (tint[0][i] - v) * tint[1]));
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
    ctx.fillRect(x + c * px, y + r * px, px - gap, px - gap);
  }
}
