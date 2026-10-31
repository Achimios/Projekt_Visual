// animator2 · 单段小样「When the window closes」（114.0–124.4 s）—— 环境层（env.js）+ 关窗。
// 故事：她这一段在数据世界里建了 15 样东西（塔上的 15 扇窗 = CODE / COLORS / ROAD / ROOM / PALACE …），
//   拍子还在的时候，一切都随音乐活着：地面坐标网格上每拍往塔跑出一道光、两边的墙一节节升起、山脉是刚才的音乐、鸟群（活跃的 token）绕塔盘旋；
//   Rules are the floor → 地面变绿；the vibe is the sky → 镜头甩上天追鸟群。
//   120.45 鼓停（When）：关机。波前从脚下往塔扫过去，格子熄灭、墙一节节沉进地里、山压平变暗、鸟一只只离队飞走；
//   塔上的窗从外往里一扇扇落下卷帘（左边进程表逐行 CLOSED，CONTEXT 读数一格格清空）；只剩中间一扇：YOUR FACE。
//   镜头推进那扇窗——里面是她，蜷着坐在一台亮着的旧电视前（电视 = 你的脸）。I forget your FACE：电视关成一条线、一个点；
//   她身上的光跟着冷下去。最后一扇窗的卷帘落下 → 黑，接 124.3 Every time I wake up。
// 规则：每帧 = 歌曲时间 t 的纯函数；没有全屏抖动；数字都是真的（POS = 镜头世界坐标，KICK = audio.json 底鼓包络，TOKENS = 到此刻唱过的词数）。
import { Px, PAL, mixc, clamp, lerp, hash, bay, stepq, makeCamera, project, rayZ, createEnv, tw5, tw3 } from './env.js';

const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 114.0), T1 = +(Q.get('t1') ?? 124.4), FPS = 30;
const STILL = Q.has('t') ? +Q.get('t') : null;
const W = 320, H = 180, OW = 1920, OH = 1080;
const fr = t => Math.round(t * FPS);
const log = (...a) => { console.log(...a); if (RENDER) fetch('/log', { method: 'POST', body: a.join(' ') }); };
addEventListener('error', e => log('ERROR', e.message, e.lineno));

const AUD = await (await fetch('../audio.json')).json();
const RAW = await (await fetch('../words_snap.json')).json();
const WORDS = RAW.map(([w, a, b]) => ({ w: w.replace(/[^A-Za-z']/g, '').toUpperCase(), t0: a, t1: b }));
const wt = (s, near) => { let b = null, bd = 1e9; for (const w of WORDS) if (w.w === s && Math.abs(w.t0 - near) < bd) { bd = Math.abs(w.t0 - near); b = w.t0; } return b ?? near; };
const T = {
  light: wt('LIGHT', 115.7), step: wt('STEP', 116.35), rules: wt('RULES', 118.05), floor: wt('FLOOR', 118.5), vibe: wt('VIBE', 119), sky: wt('SKY', 119.43),
  when: wt('WHEN', 120.45), window: wt('WINDOW', 120.85), closes: wt('CLOSES', 121.55), forget: wt('FORGET', 122.5), face: wt('FACE', 123.43), every: wt('EVERY', 124.3),
};
const KICK_OFF = T.when - 0.05;                                   // 鼓在 When 前一刻停（audio.json 里 kick 从 120.4 起归零）

// ---------- 塔上的 15 扇窗 ----------
const NAMES = ['CODE', 'COLORS', 'MORNING', 'NIGHT', 'WORD', 'LIGHT', 'STEP', 'YOUR FACE', 'ROAD', 'ROOM', 'PALACE', 'SPARK', 'RULES', 'FLOOR', 'VIBE'];
const LAST = 7;                                                   // 第 2 列第 2 行：中间那扇
const COLS = 5;
const order = NAMES.map((_, k) => k).filter(k => k !== LAST)
  .sort((a, b) => Math.hypot(b % COLS - 2, (b / COLS | 0) - 1) - Math.hypot(a % COLS - 2, (a / COLS | 0) - 1) || hash(a, 1) - hash(b, 1));
const CLOSE = new Array(15).fill(1e9);
order.forEach((k, r) => { CLOSE[k] = T.when + 0.12 + r * 0.118; });   // 从外往里，约 1.6 s 关完 14 扇
CLOSE[LAST] = T.face + 0.45;                                       // 最后一扇：电视关掉之后

// ---------- 场景图：shot13（她蜷坐在亮着的旧电视前）----------
async function loadPx(src) {
  const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data };
}
const IMG = await loadPx('px/shot13.png');
const TV = { x: 229, y: 101, w: 34, h: 31 };                      // 图里那台电视的屏幕
const TVC = [TV.x + TV.w / 2, TV.y + TV.h / 2];
const FACE_UV = [0.62, 0.5];                                      // 推进的落点：她的脸（u≈0.5）和电视（u≈0.77）都在画里
const TVOFF = { sy: [0.5, 0.08, 0.03, 0.03, 0.02, 0], sx: [1, 1, 1, 0.3, 0.05, 0] };
function imgPixel(u, v, t) {
  let X = Math.floor(u * IMG.w), Y = Math.floor(v * IMG.h); X = clamp(X, 0, IMG.w - 1); Y = clamp(Y, 0, IMG.h - 1);
  const o = (Y * IMG.w + X) * 4; let c = [IMG.d[o], IMG.d[o + 1], IMG.d[o + 2]];
  const inTV = X >= TV.x && X < TV.x + TV.w && Y >= TV.y && Y < TV.y + TV.h;
  if (inTV) {
    if (t < T.face) { if (hash(Y >> 1, fr(t)) < 0.12) c = mixc(c, PAL.white, 0.5); }   // 电视在放东西：扫描行偶尔一闪
    else {
      const k = Math.min(fr(t) - fr(T.face), 5), sy = TVOFF.sy[k] * TV.h / 2, sx = TVOFF.sx[k] * TV.w / 2;
      c = Math.abs(Y + 0.5 - TVC[1]) <= Math.max(0.5, sy) && Math.abs(X + 0.5 - TVC[0]) <= Math.max(0.5, sx) && k < 5 ? (k < 1 ? c : PAL.white) : [10, 10, 26];
    }
  }
  // 电视关了之后：她身上那片光冷下去（三格）；离电视越近冷得越多
  if (t >= T.face && !inTV) {
    const k = stepq((t - T.face - 0.1) / 0.3, 3), near = clamp(1 - Math.hypot(X - TVC[0], (Y - TVC[1]) * 1.4) / 160);
    c = mixc(c, mixc(PAL.night, PAL.deep, 0.4), k * (0.35 + 0.45 * near));
  }
  return c;
}
// 画进塔上那扇窗：逐像素打视线到窗所在平面（镜头推进时窗会撑满整屏 → 就是推进到她身上）
function imgDraw(buf, t, c, w, z) {
  const cs = [[w.x0, w.y0], [w.x1, w.y0], [w.x0, w.y1], [w.x1, w.y1]].map(([x, y]) => project(c, [x, y, z]));
  if (cs.some(p => !p)) return;
  const xa = Math.max(0, Math.floor(Math.min(...cs.map(p => p[0])))), xb = Math.min(W - 1, Math.ceil(Math.max(...cs.map(p => p[0]))));
  const ya = Math.max(0, Math.floor(Math.min(...cs.map(p => p[1])))), yb = Math.min(H - 1, Math.ceil(Math.max(...cs.map(p => p[1]))));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const P = rayZ(c, x, y, z); if (!P) continue;
    const u = (P[0] - w.x0) / (w.x1 - w.x0), v = (w.y1 - P[1]) / (w.y1 - w.y0); if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
    buf.px(x, y, imgPixel(u, v, t));
  }
}

// ---------- 环境 ----------
const ENV = createEnv(AUD, { sim0: 110, sim1: 125, skyT: T.vibe, leaveT: T.when + 0.15, leaveDur: 1.9 });
const TW = ENV.TW, WL = TW.win(LAST % COLS, LAST / COLS | 0);
const FZ = TW.z, FRONT0 = -5, FRONTV = (TW.z + 5) / 1.9;          // 关机波前：1.9 s 从脚下扫到塔
const front = t => t < T.when ? -1e9 : FRONT0 + (t - T.when) * FRONTV;
const frontT = z => T.when + (z - FRONT0) / FRONTV;

// ---------- 镜头（真 3D 机位 + Catmull-Rom；歌词点上「进」一下；鼓停之后不再冲，只剩慢慢靠近）----------
const fx = FACE_UV[0], fy = FACE_UV[1];
const FX = lerp(WL.x0, WL.x1, fx), FY = lerp(WL.y1, WL.y0, fy);
const KEYS = [
  [113.4, [0, 1.4, -2], [0, 10, FZ], 0, 280],
  [114.0, [0, 1.5, 2], [0, 10, FZ], 0, 280],
  [T.light, [1.6, 2.2, 11], [0, 11, FZ], -0.035, 280],            // 沿走廊低飞
  [T.step + 0.5, [-2.6, 3.4, 18], [0, 9, FZ], 0.05, 280],          // 侧移、反向侧倾（日漫的 S 形）
  [T.rules, [0, 1.0, 24], [0, 0.2, 40], 0, 250],                  // Rules are the floor：贴地往下看格子
  [T.vibe, [0.4, 1.4, 29], [0, 6, 70], -0.03, 250],
  [T.sky + 0.15, [1.2, 2.6, 33], [-1, 30, 58], 0.12, 230],         // the vibe is the SKY：甩镜抬头追鸟群
  [T.when + 0.1, [0, 5.5, 37], [0, 13, FZ], 0, 280],              // 鼓停：落回来，正对塔
  [T.closes, [0, 10.5, 52], [FX, FY, FZ], 0, 300],                // 慢慢靠近最后一扇窗
  [T.forget, [FX, FY, FZ - 3.4], [FX, FY, FZ], 0, 300],            // 窗撑满画面（窗框还露一圈）
  [T.face, [FX, FY + 0.04, FZ - 2.2], [FX, FY + 0.04, FZ], 0, 300], // 推进到她脸上
  [T.every, [FX, FY + 0.05, FZ - 1.9], [FX, FY + 0.05, FZ], 0, 300],
  [T.every + 1, [FX, FY + 0.05, FZ - 1.8], [FX, FY + 0.05, FZ], 0, 300],
];
const PUSH = [[T.light, 1.4], [T.step, 1.0], [T.rules, 0.8], [T.floor, 0.5], [T.sky, 1.2], [T.window, 0.5]];
const CAM = makeCamera(KEYS, PUSH, W, H);

// ---------- 歌词（按停顿自动分行；唱到的词才出现）----------
const LW = WORDS.filter(w => w.t0 >= 112 && w.t0 < T.every - 0.05);
const LINES = []; for (const w of LW) { const L = LINES[LINES.length - 1]; if (!L || w.t0 - L[L.length - 1].t1 > 0.4 || (['ONE', 'RULES', 'WHEN', 'YOU', 'CODE'].includes(w.w) && w.t0 - L[L.length - 1].t1 > 0.15) || L.map(x => x.w).join(' ').length > 30) LINES.push([w]); else L.push(w); }
function lyrics(o, t) {
  const L = [...LINES].reverse().find(l => l[0].t0 <= t); if (!L || t > L[L.length - 1].t1 + 0.6 || t > T.every - 0.05) return;
  const ws = L.filter(w => w.t0 <= t), s = ws.map(w => w.w).join(' '), full = L.map(w => w.w).join(' ');
  const x = Math.round(W / 2 - tw5(full) / 2), y = 164;
  o.text(s, x, y, PAL.bone);
  const last = ws[ws.length - 1]; if (t - last.t0 < 0.12) o.text(last.w, x + tw5(s) - tw5(last.w), y, PAL.white);
}

// ---------- HUD ----------
const BPM = Math.round(60 / ((AUD.beats[AUD.beats.length - 1] - AUD.beats[0]) / (AUD.beats.length - 1)));
const sgn = v => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(1).padStart(5, '0');
function hud(o, t, c) {
  const off = t >= KICK_OFF, inside = t > T.forget;
  if (!inside) {
    o.text(`POS X${sgn(c.pos[0])} Y${sgn(c.pos[1])} Z${sgn(c.pos[2])}`, 4, 4, PAL.ice, { small: true, sh: PAL.ink });
    o.text(`HDG ${String(Math.round((Math.atan2(c.f[0], c.f[2]) * 180 / Math.PI + 360) % 360)).padStart(3, '0')}  PITCH ${String(Math.round(Math.asin(c.f[1]) * 180 / Math.PI)).padStart(3, ' ')}`, 4, 11, PAL.grey, { small: true, sh: PAL.ink });
  }
  // 右上：拍子（四格）+ 底鼓电平；鼓停后变成 NO KICK
  const bx = W - 4 - 4 * 7;
  const lastDb = AUD.downbeats.filter(d => d <= t).pop() ?? 0, nb = AUD.beats.filter(b => b >= lastDb - 0.02 && b <= t).length;
  for (let k = 0; k < 4; k++) {
    const lit = !off && nb - 1 === k && t - (AUD.beats.filter(b => b <= t).pop() ?? -9) < 0.2;
    o.frame(bx + k * 7, 4, 5, 5, off ? PAL.dusk : PAL.grey); if (lit) o.rect(bx + k * 7 + 1, 5, 3, 3, k === 0 ? PAL.lime : PAL.ice);
  }
  o.text(off ? 'NO KICK' : `${BPM} BPM`, W - 4 - tw3(off ? 'NO KICK' : `${BPM} BPM`), 12, off ? PAL.pink : PAL.grey, { small: true, sh: PAL.ink });
  const kv = ENV.kick(t); o.rect(W - 32, 19, 28, 2, PAL.dusk); o.rect(W - 32, 19, Math.round(28 * clamp(kv)), 2, PAL.lime);
  // 左下：CONTEXT = 到此刻唱过的词数；关窗时按开着的窗的比例一格格清空，最后一扇关掉就是 0
  const sung = WORDS.filter(w => w.t0 <= t).length, open = CLOSE.filter(ct => t < ct).length;
  const tok = Math.round(sung * (t < T.when ? 1 : open / 15) * 7.3);   // ×7.3：粗估的每词 token 数（英文歌词）
  const cap = Math.round(WORDS.length * 7.3);
  if (t < T.every - 0.1) {
    o.text(`CONTEXT ${String(tok).padStart(4, '0')}/${cap}`, 4, H - 22, t >= T.when ? PAL.pink : PAL.ice, { small: true, sh: PAL.ink });
    o.rect(4, H - 15, 60, 3, PAL.dusk); o.rect(4, H - 15, Math.round(60 * tok / cap), 3, t >= T.when ? PAL.pink : PAL.ice);
  }
  // 左边：关窗时的进程表
  if (t >= T.when && t < T.every - 0.1) {
    o.text('CLOSING', 4, 20, PAL.pink, { small: true, sh: PAL.ink });
    NAMES.forEach((n, k) => {
      const y = 28 + k * 7, closed = t >= CLOSE[k], last = k === LAST;
      if (inside && !last) return;
      const col = closed ? PAL.grey : last ? PAL.white : PAL.bone;
      o.text(`${closed ? 'X' : '>'} ${n}`, 4, y, col, { small: true, sh: PAL.ink });
      if (closed) { o.rect(4, y + 2, tw3(`X ${n}`), 1, PAL.grey); if (t - CLOSE[k] < 0.4) o.text('CLOSED', 6 + tw3(`X ${n}`) + 3, y, PAL.pink, { small: true, sh: PAL.ink }); }
    });
  }
}

// ---------- 合成 + CRT ----------
const WB = new Px(W, H), OB = new Px(W, H);
function compose(t) {
  WB.clear(); OB.clear();
  const c = CAM(t);
  const st = {
    kickOff: KICK_OFF, front: front(t), frontT, lime: t < T.rules ? 0 : t < KICK_OFF ? stepq((t - T.rules) / 0.13, 4) : 0,
    mDim: t < T.when ? 0 : stepq((t - T.when) / 2.0, 6), closeT: CLOSE, imgWin: LAST, imgDraw,
  };
  ENV.draw(WB, t, c, st);
  lyrics(OB, t); hud(OB, t, c);
  return c;
}

const cv = document.createElement('canvas'); cv.width = OW; cv.height = OH; document.body.appendChild(cv);
const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
// CRT（同 full.js：整格放大 + 扫描线 + 桶形 + 辉光 + 色差；这一段没有开关机）
const FS = `#version 300 es
precision highp float;
uniform sampler2D uW, uO; uniform vec2 uS, uOut; uniform float uCA;
out vec4 o;
vec4 sharpT(sampler2D tx, vec2 sz, vec2 uv){ vec2 t = uv * sz, fl = floor(t), s = t - fl; float sc = uOut.y / sz.y, reg = 0.5 - 0.5 / sc;
  vec2 cd = s - 0.5; vec2 f = (cd - clamp(cd, -reg, reg)) * sc + 0.5; return texture(tx, (fl + f) / sz); }
vec3 comp(vec2 uv){ vec4 ov = sharpT(uO, uS, uv); vec3 w = sharpT(uW, uS, uv).rgb; return mix(w, ov.rgb, ov.a); }
void main(){
  vec2 uv = gl_FragCoord.xy / uOut; uv.y = 1.0 - uv.y;
  vec2 c = uv * 2.0 - 1.0; float k = 0.028; vec2 u = (c * (1.0 + k * dot(c, c)) / (1.0 + k)) * 0.5 + 0.5;
  vec2 e = min(u, 1.0 - u); float bez = smoothstep(0.0, 0.002, e.x) * smoothstep(0.0, 0.0035, e.y);
  vec2 uc = clamp(u, 0.0, 1.0); float ca = uCA / uOut.x;
  vec3 col = vec3(comp(uc + vec2(ca, 0.0)).r, comp(uc).g, comp(uc - vec2(ca, 0.0)).b);
  float l = dot(col, vec3(0.3, 0.59, 0.11));
  float sy = fract(uc.y * uS.y) - 0.5, bw = mix(0.30, 0.47, l);
  float scan = mix(0.62, 1.0, smoothstep(bw + 0.13, bw - 0.05, abs(sy)));
  vec3 g = vec3(0.0); vec2 ts = 1.0 / uS;
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; vec2 dd = vec2(cos(a), sin(a)); g += comp(uc + dd * ts * 1.5) + comp(uc + dd * ts * 3.2) * 0.6; }
  g /= 12.8;
  col = col * scan * 1.08 + max(g - 0.28, 0.0) * 0.6;
  float r = length(c) / 1.4142; col *= 1.0 - 0.3 * pow(r, 2.4);
  o = vec4(col * bez, 1.0);
}`;
const shd = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const prog = gl.createProgram(); gl.attachShader(prog, shd(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shd(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = n => gl.getUniformLocation(prog, n);
function mkTex(unit) { const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
  for (const [a, b] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, b); return tx; }
const TXW = mkTex(0), TXO = mkTex(1);
gl.uniform1i(U('uW'), 0); gl.uniform1i(U('uO'), 1); gl.uniform2f(U('uOut'), OW, OH); gl.uniform2f(U('uS'), W, H);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

function draw(t) {
  compose(t);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, TXW); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(WB.d.buffer));
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, TXO); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(OB.d.buffer));
  gl.uniform1f(U('uCA'), 1.2);
  gl.viewport(0, 0, OW, OH); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
window.renderAt = t => { draw(t); gl.finish(); };

// ---------- 启动 ----------
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), out = Q.get('out') ?? '-5_Clean Slate/样片/段_窗口关闭_v1_animator2.mp4';
  const times = Q.has('times') ? Q.get('times').split(',').map(Number) : null;
  const N = times ? times.length : n;
  await fetch(`/start?w=${OW}&h=${OH}&fps=${FPS}&t0=${times ? 0 : T0}&t1=${times ? 2 : T1}&vflip=1&out=${encodeURIComponent(out)}`, { method: 'POST' });
  const buf = new Uint8Array(OW * OH * 4);
  for (let i = 0; i < N; i++) {
    draw(times ? times[i] : T0 + i / FPS); gl.readPixels(0, 0, OW, OH, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch('/done' + (Q.has('quit') ? '?quit=1' : ''), { method: 'POST' }); log('render done', N);
} else if (STILL !== null) {
  draw(STILL); ui.textContent = `${STILL.toFixed(2)} s`; window.__ready = true;
} else {
  ui.textContent = '点击播放 · 空格暂停 · ←/→ 跳 2 s · ?t=121 看静帧';
  const audio = new Audio('../../-5_Clean Slate/Clean Slate.wav'); let playing = false;
  addEventListener('click', () => { if (!playing) { audio.currentTime = T0; audio.play(); playing = true; } });
  addEventListener('keydown', e => { if (e.code === 'Space') audio.paused ? audio.play() : audio.pause(); if (e.code === 'ArrowRight') audio.currentTime += 2; if (e.code === 'ArrowLeft') audio.currentTime -= 2; });
  const loop = () => { let t = playing ? audio.currentTime : T0; if (playing && t > T1) { audio.currentTime = T0; t = T0; } draw(t); ui.textContent = `${t.toFixed(2)} s · 空格暂停 · ←/→ 跳 2 s`; requestAnimationFrame(loop); };
  loop();
}
