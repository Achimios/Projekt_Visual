// 她 v2：赛博像素动漫肖像（原创）。先在 200×250 的小画布上用矢量画，再按调色板量化 → 像素质感（VA-11 Hall-A 的路子，不画任何现成角色）。
// 设定 v3（👤「好傻」→ 更酷）：凌乱蓝紫波波头压着眼睛，上半张脸在阴影里只露发光的眼缝（「Eyes wide open」才揭晓）；
// 呼吸面罩（笑的时候收起）；粗颈环四散线缆；白色肩甲 + 胸甲；头发里嵌着 HUD 碎片。

export const PAL = [
  [12, 9, 30], [26, 20, 62], [48, 34, 110], [80, 50, 170], [58, 92, 220], [108, 160, 255], [61, 224, 255],
  [255, 61, 154], [255, 142, 200], [255, 222, 214], [234, 176, 204], [166, 104, 176], [246, 242, 252], [176, 178, 214], [92, 92, 146], [255, 138, 42],
];
const LW = 200, LH = 250;
const low = document.createElement('canvas'); low.width = LW; low.height = LH;
const g = low.getContext('2d', { willReadFrequently: true });
const out = document.createElement('canvas'); out.width = LW; out.height = LH;
const og = out.getContext('2d');

const hex = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
const blob = (cx, cy, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 6.2832); g.fill(); };
const curve = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length - 1; i += 2) g.quadraticCurveTo(...pts[i], ...pts[i + 1]); g.stroke(); };

// st: { eyes: 'closed'|'half'|'open'|'wide', glow: 0–1（眼缝 / LED）, mask: 0–1（1 = 面罩戴着，0 = 收起）,
//       mouth: 'flat'|'smile'|'oh'（面罩收起才看得到）, sway: -1..1, hud: 0–1, t }
export function drawCyberGirl(st = {}) {
  const { eyes = 'half', glow = 1, mask = 1, mouth = 'flat', sway = 0, hud = 1, t = 0 } = st;
  g.clearRect(0, 0, LW, LH);
  const P = i => hex(PAL[i]);
  // —— 线缆：从颈环四散出去（先画，压在身体后面）
  const cab = [[86, 150, 40, 175, 10, 250], [92, 152, 60, 200, 46, 250], [114, 152, 150, 196, 170, 250], [108, 150, 168, 170, 196, 236], [100, 156, 84, 210, 96, 250]];
  cab.forEach(([x0, y0, x1, y1, x2, y2], i) => curve([[x0, y0], [x1, y1], [x2, y2]], P(i === 4 ? 14 : 0), i === 4 ? 2 : 3));
  // —— 后发（凌乱的波波头，右边长）
  poly([[50, 74], [58, 40], [100, 20], [144, 36], [154, 80], [158, 128 + sway * 3], [150, 148 + sway * 4], [138, 128], [132, 146], [122, 118], [80, 118], [70, 144 + sway * 3], [62, 126], [48, 136 - sway * 2], [46, 104]], P(2));
  // —— 身体：深色紧身里衣 + 白色胸甲 + 两块白肩甲
  poly([[24, 250], [34, 200], [64, 176], [136, 176], [166, 200], [176, 250]], P(1));
  poly([[66, 176], [100, 214], [134, 176], [128, 176], [100, 206], [72, 176]], P(13));                     // V 形束带
  blob(100, 214, 4, 4, P(6)); blob(100, 214, 2, 2, P(12));                                                      // 胸灯
  poly([[30, 204], [44, 184], [70, 178], [66, 194], [46, 212]], P(12)); poly([[34, 206], [46, 212], [42, 222], [28, 214]], P(13));   // 左肩甲
  poly([[170, 204], [156, 184], [130, 178], [134, 194], [154, 212]], P(13)); poly([[166, 206], [154, 212], [158, 222], [172, 214]], P(14));
  poly([[46, 196], [62, 188], [62, 191], [46, 199]], P(7)); poly([[154, 196], [138, 188], [138, 191], [154, 199]], P(6));   // 肩甲上的灯条
  // —— 脖子 + 粗颈环
  poly([[88, 124], [112, 124], [114, 150], [86, 150]], P(11));
  poly([[80, 138], [120, 138], [122, 158], [78, 158]], P(1)); poly([[80, 138], [120, 138], [120, 142], [80, 142]], P(14));
  for (let k = 0; k < 4; k++) blob(86 + k * 9.5, 150, 1.6, 1.6, k % 2 ? P(6) : P(7));
  // —— 脸：被下方的紫光照着；上半张埋在刘海的阴影里
  poly([[70, 72], [130, 72], [131, 100], [122, 120], [100, 132], [78, 120], [69, 100]], P(10));
  poly([[70, 72], [130, 72], [131, 100], [69, 100]], P(11));                                    // 眼睛那一条在阴影里（紫）
  poly([[122, 104], [131, 100], [122, 120], [114, 128]], P(11));
  // —— 眼睛：缝里透出品红光；只有 open / wide 才真正露出来
  const E = [[86, 96], [116, 96]];
  E.forEach(([x, y], k) => {
    if (eyes === 'closed') { if (glow > 0) poly([[x - 8, y + 1], [x + 8, y + 1], [x + 8, y + 2.5], [x - 8, y + 2.5]], P(3)); return; }
    if (eyes === 'half') { poly([[x - 9, y], [x + 9, y - 1], [x + 8, y + 2.5], [x - 8, y + 3]], glow > 0.5 ? P(7) : P(3)); poly([[x - 3, y - 0.5], [x + 3, y - 0.5], [x + 3, y + 2], [x - 3, y + 2]], P(8)); return; }
    const h = eyes === 'wide' ? 9 : 7;
    blob(x, y + 1, 8, h, P(12));
    blob(x + (k ? -0.5 : 0.5), y + 2, 6, Math.min(h, 7), P(7)); blob(x + (k ? -0.5 : 0.5), y + 4, 4, Math.min(h, 3.5), P(8));
    blob(x + (k ? -0.5 : 0.5), y + 2, 2.2, Math.min(h, 3.6), P(0));
    blob(x + (k ? -3 : -1.5), y - 1.5, 2, 2, P(12));
    curve([[x - 9, y - h + 3], [x, y - h], [x + 9, y - h + 3]], P(0), 2.6);
  });
  // —— 鼻 + 嘴（面罩收起才看得见）
  blob(101, 110, 1.2, 1.2, P(11));
  if (mask < 1) {
    if (mouth === 'smile') curve([[93, 120], [100, 125], [107, 120]], P(7), 2);
    else if (mouth === 'oh') blob(100, 122, 3, 3.5, P(7));
    else curve([[95, 122], [100, 123], [105, 122]], P(11), 1.6);
  }
  // —— 呼吸面罩：mask = 1 戴着；0 → 往下收进颈环
  if (mask > 0) {
    const dy = (1 - mask) * 30;
    poly([[84, 116 + dy], [116, 116 + dy], [120, 124 + dy], [110, 134 + dy], [90, 134 + dy], [80, 124 + dy]], P(1));
    poly([[84, 116 + dy], [116, 116 + dy], [117, 118 + dy], [83, 118 + dy]], P(14));
    for (let k = 0; k < 3; k++) poly([[93 + k * 6, 123 + dy], [95 + k * 6, 123 + dy], [95 + k * 6, 129 + dy], [93 + k * 6, 129 + dy]], P(0));
    blob(113, 122 + dy, 1.6, 1.6, glow > 0.3 ? P(6) : P(14));
    curve([[81, 122 + dy], [74, 132], [84, 142]], P(0), 2); curve([[119, 122 + dy], [126, 132], [116, 142]], P(0), 2);
  }
  // —— 刘海：长、碎，压到眼睛
  poly([[54, 78], [60, 44], [100, 24], [142, 40], [150, 80], [144, 98], [136, 78], [130, 94], [120, 74], [112, 90], [104, 70], [96, 92], [88, 74], [80, 94], [74, 76], [64, 100]], P(4));
  poly([[66, 62], [90, 40], [112, 34], [98, 48], [82, 64]], P(5));
  poly([[142, 40], [150, 80], [156, 122 + sway * 3], [148, 108], [144, 82]], P(6));            // 右侧青色轮廓光
  poly([[54, 78], [50, 104], [56, 124], [58, 100]], P(7));                                         // 左侧品红轮廓光
  // —— 头发里嵌着的 HUD 碎片（参考图 1）
  if (hud > 0) {
    const frag = [[72, 38, 18, 12], [96, 30, 14, 16], [116, 40, 20, 10], [66, 84, 16, 9], [124, 60, 12, 14], [36, 70, 18, 12], [152, 140, 22, 14]];
    frag.forEach(([x, y, w, h], i) => {
      const dy = Math.sin(t * 2 + i) * 1.5, on = (Math.floor(t * 8) + i * 3) % 11 !== 0;      // 偶尔闪断一帧
      if (!on) return;
      g.globalAlpha = 0.85 * hud; g.fillStyle = P(i % 3 === 0 ? 6 : i % 3 === 1 ? 12 : 8); g.fillRect(x, y + dy, w, h);
      g.fillStyle = P(1); for (let r = 0; r < 3; r++) g.fillRect(x + 2, y + dy + 2 + r * 3, (w - 4) * (0.3 + 0.7 * ((i * 7 + r * 3) % 5) / 5), 1);
      g.globalAlpha = 1;
    });
  }
  quantize();
  return out;
}

// 量化到调色板（最近色），透明的保持透明
function quantize() {
  const im = g.getImageData(0, 0, LW, LH), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    let best = 0, bd = 1e9;
    for (let k = 0; k < PAL.length; k++) { const c = PAL[k], e = (c[0] - d[i]) ** 2 * 0.3 + (c[1] - d[i + 1]) ** 2 * 0.59 + (c[2] - d[i + 2]) ** 2 * 0.11; if (e < bd) { bd = e; best = k; } }
    d[i] = PAL[best][0]; d[i + 1] = PAL[best][1]; d[i + 2] = PAL[best][2]; d[i + 3] = 255;
  }
  og.clearRect(0, 0, LW, LH); og.putImageData(im, 0, 0);
}

// 贴到主画布：px = 每个小像素放大几倍
export function blitGirl(ctx, img, x, y, px) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, x, y, LW * px, LH * px); ctx.restore(); }
export const SIZE = [LW, LH];
