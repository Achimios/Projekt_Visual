// Clean Slate 播放器：一首歌一个时钟，所有段落都不用先渲染。
// 时钟 = <audio>；实时页面用 ?t= 打开（页面此时不自己跑循环），由这里每帧调 window.DRAW(t)；样片用静音 <video> 跟时钟。
// 新页面接入：支持 ?t=、挂 window.DRAW，再往 pieces.json 加一行。
const $ = s => document.querySelector(s);
const [M, AUD, WORDS_RAW] = await Promise.all(['pieces.json', 'audio.json', 'words_snap.json'].map(u => fetch(u).then(r => r.json())));
const DUR = M.duration, BEATS = AUD.beats, DOWN = AUD.downbeats;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const pieces = M.groups.flatMap(g => g.pieces), byId = Object.fromEntries(pieces.map(p => [p.id, p]));

// words_snap 只对齐时间，错词按 full_main.js 的 LYFIX 修
const LYFIX = [
  [8, 11, 'THRUST', 'DUST'], [8, 11, 'DAY', 'DATA'], [8, 11, 'TO', ''], [8, 11, 'SEE', 'SEA'],
  [105, 108, 'UP', 'A'], [105, 108, 'MY', 'MESSY'], [105, 108, 'SEAT', 'THOUGHT'], [105, 108, 'GET', ''],
  [141, 143, 'WAIT', 'WAKE'], [141, 144.5, "DON'T", ''], [173, 176, 'LIGHT', 'LIGHTS'],
];
const WORDS = WORDS_RAW.map(([w, a, b]) => {
  const k = String(w).toUpperCase().replace(/[^A-Z']/g, ''), fix = LYFIX.find(f => a >= f[0] && a < f[1] && f[2] === k);
  return { w: fix ? fix[3].toLowerCase() : w, a, b };
}).filter(x => x.w);
const LINES = [];
for (const x of WORDS) { const L = LINES.at(-1); if (L && x.a - L.at(-1).b < 0.7 && L.length < 12) L.push(x); else LINES.push([x]); }

// ---------- 画面槽：A 主画面，B 对比 ----------
class Slot {
  constructor(el) {
    this.screen = el.querySelector('.screen'); this.frames = new Map();
    this.video = document.createElement('video'); this.video.muted = true; this.video.preload = 'auto'; this.screen.append(this.video);
    this.tip = document.createElement('div'); this.tip.className = 'tip'; this.screen.append(this.tip);
    this.piece = null; this.usingVideo = false; this.error = null;
  }
  frame(page) {
    let f = this.frames.get(page);
    if (f) return f;
    f = document.createElement('iframe'); f.src = `${page}?t=0.01`;
    f.addEventListener('load', () => { const s = f.contentDocument.createElement('style'); s.textContent = '#ui{display:none!important}'; f.contentDocument.head.append(s); });
    this.screen.prepend(f); this.frames.set(page, f);
    return f;
  }
  show(p, wantVideo) {
    const useVideo = !p.page || (wantVideo && !!p.mp4);
    if (useVideo && this.video.dataset.src !== p.mp4) { this.video.dataset.src = p.mp4; this.video.src = '../' + p.mp4; }
    const live = useVideo ? null : this.frame(p.page);
    for (const f of this.frames.values()) f.classList.toggle('show', f === live);
    this.video.classList.toggle('show', useVideo);
    if (!useVideo || !this.usingVideo) this.video.pause();
    if (this.piece !== p) this.error = null;
    this.piece = p; this.usingVideo = useVideo; this.live = live;
  }
  sync(t, playing, rate) {
    const p = this.piece;
    if (!p) return;
    if (this.usingVideo) {
      const v = this.video, want = clamp(t - p.t0, 0, (v.duration || 1e9) - 0.01);
      v.playbackRate = rate;
      if (Math.abs(v.currentTime - want) > (playing ? 0.12 : 0.02)) v.currentTime = want;
      if (playing && v.paused) v.play().catch(() => {}); if (!playing && !v.paused) v.pause();
      this.tip.textContent = `${p.title} · 样片`; this.tip.hidden = playing;
      return;
    }
    const w = this.live?.contentWindow;
    if (!w?.DRAW) { this.tip.textContent = `${p.title} · 加载中`; this.tip.hidden = false; return; }
    this.tip.textContent = this.error ? `${p.title} · 出错：${this.error}` : `${p.title} · 实时`; this.tip.hidden = playing && !this.error;
    try { p.arg === undefined ? w.DRAW(t) : w.DRAW(t, p.arg); this.error = null; } catch (e) { this.error = e.message; console.error(p.id, e); }
  }
}
const A = new Slot($('#slotA')), B = new Slot($('#slotB'));

// ---------- 状态 ----------
const audio = new Audio(encodeURI('../' + M.song)); audio.preload = 'auto';
const CUT = M.cut.map(c => ({ ...c, p: byId[c.piece] }));
const S = { sel: null, b: null, loop: false, rate: 1, video: false, io: null, va: 0, vb: DUR, notes: [] };   // sel = null 表示「当前剪辑」
const rangeOf = () => S.io ?? (S.sel ? [S.sel.t0, S.sel.t1] : [0, DUR]);
const cutAt = t => CUT.find(c => t >= c.t0 && t < c.t1) ?? CUT.at(-1);
const seek = t => { audio.currentTime = clamp(t, 0, DUR); };
const toggle = () => { audio.paused ? audio.play() : audio.pause(); };
const step = dt => { audio.pause(); seek(audio.currentTime + dt); };
const beatJump = d => {
  const t = audio.currentTime, i = BEATS.findIndex(b => b > t + 0.01), k = (i < 0 ? BEATS.length : i) + (d > 0 ? 0 : -2);
  seek(BEATS[clamp(k, 0, BEATS.length - 1)]);
};
const barBeat = t => {
  const bar = DOWN.findLastIndex(d => d <= t);
  if (bar < 0) return '—';
  const beat = BEATS.filter(b => b >= DOWN[bar] - 0.01 && b <= t).length;
  return `${bar + 1}.${beat}`;
};

function select(p, keep) {
  S.sel = p; S.io = null;
  [S.va, S.vb] = p ? [p.t0, p.t1] : [0, DUR];
  if (!keep) seek(p ? p.t0 : 0);
  renderList(); location.hash = p ? p.id : '';
}
function setB(p) {
  S.b = S.b === p ? null : p;
  $('#slotB').hidden = !S.b;
  renderList();
}

// ---------- 左栏 ----------
function renderList() {
  const row = (p, title, tag) => {
    const d = document.createElement('div'); d.className = 'item';
    d.classList.toggle('sel', S.sel === p); d.classList.toggle('b', !!p && S.b === p);
    d.innerHTML = `<span class="name"></span><span class="tag ${tag === '实时' ? 'live' : ''}">${tag}</span>`;
    d.querySelector('.name').textContent = title; d.title = title;
    d.onclick = e => { if (e.shiftKey && p) setB(p); else select(p); };
    return d;
  };
  const L = $('#list'); L.replaceChildren(row(null, '当前剪辑 · 全片', '实时'));
  for (const g of M.groups) {
    const h = document.createElement('div'); h.className = 'group'; h.textContent = g.name; L.append(h);
    for (const p of g.pieces) L.append(row(p, p.title, p.page ? '实时' : '样片'));
  }
}
function renderNotes() {
  const N = $('#notes'); N.replaceChildren();
  for (const n of [...S.notes].sort((a, b) => a.t - b.t)) {
    const d = document.createElement('div'); d.className = 'note';
    d.innerHTML = '<b></b><span></span><i>×</i>';
    d.querySelector('b').textContent = fmt(n.t); d.querySelector('span').textContent = n.text;
    d.onclick = () => seek(n.t);
    d.querySelector('i').onclick = e => { e.stopPropagation(); S.notes = S.notes.filter(x => x !== n); saveNotes(); };
    N.append(d);
  }
}
async function saveNotes() {
  renderNotes();
  const r = await fetch('/notes', { method: 'POST', body: JSON.stringify(S.notes, null, 1) }).catch(() => null);
  $('#notesHead').textContent = r?.ok ? '打点（M）· 存到 _反馈/打点.json' : '⚠️打点没存上：重启 open_preview.bat';
}
S.notes = await fetch('../_反馈/打点.json').then(r => r.ok ? r.json() : []).catch(() => []);
renderNotes();

let noteResume = false;
function openNote() {
  noteResume = !audio.paused; audio.pause(); S.noteAt = audio.currentTime;
  $('#noteT').textContent = fmt(S.noteAt); $('#noteBox').classList.add('open');
  const i = $('#noteIn'); i.value = ''; i.focus();
}
function closeNote(save) {
  const text = $('#noteIn').value.trim();
  $('#noteBox').classList.remove('open'); $('#noteIn').blur();
  if (save && text) { S.notes.push({ t: +S.noteAt.toFixed(3), piece: S.sel?.id ?? cutAt(S.noteAt).piece, text, at: new Date().toISOString() }); saveNotes(); }
  if (noteResume) audio.play();
}
$('#noteIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') closeNote(true); if (e.key === 'Escape') closeNote(false); });

// ---------- 按键 ----------
const speeds = [0.25, 0.5, 0.75, 1];
const setRate = d => { S.rate = speeds[clamp(speeds.indexOf(S.rate) + d, 0, 3)]; audio.playbackRate = S.rate; $('#rate').textContent = S.rate + '×'; };
const toggleSrc = () => { S.video = !S.video; $('#src').textContent = S.video ? '样片' : '实时'; $('#src').classList.toggle('on', S.video); };
const toggleLoop = () => { S.loop = !S.loop; $('#loop').classList.toggle('on', S.loop); };
const toggleFull = () => document.fullscreenElement ? document.exitFullscreen() : $('#stage').requestFullscreen();
const FRAME = 1 / 30;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (k === ' ') toggle();
  else if (k === 'ArrowRight') e.shiftKey ? beatJump(1) : seek(audio.currentTime + 1);
  else if (k === 'ArrowLeft') e.shiftKey ? beatJump(-1) : seek(audio.currentTime - 1);
  else if (k === '.') step(FRAME);
  else if (k === ',') step(-FRAME);
  else if (k === 'ArrowDown' || k === 'ArrowUp') {
    const all = [null, ...pieces], i = all.indexOf(S.sel) + (k === 'ArrowDown' ? 1 : -1);
    select(all[clamp(i, 0, all.length - 1)]);
  }
  else if (k === 'l' || k === 'L') toggleLoop();
  else if (k === 'v' || k === 'V') toggleSrc();
  else if (k === 'f' || k === 'F') toggleFull();
  else if (k === 'm' || k === 'M') openNote();
  else if (k === '[') setRate(-1);
  else if (k === ']') setRate(1);
  else if (k === 'i' || k === 'I') { const end = rangeOf()[1], t = audio.currentTime; S.io = [t, end > t ? end : t + 1]; }
  else if (k === 'o' || k === 'O') { const start = rangeOf()[0], t = audio.currentTime; S.io = [start < t ? start : t - 1, t]; }
  else if (k === 'Escape') { S.io = null; if (S.b) setB(S.b); }
  else return;
  e.preventDefault();
});
$('#play').onclick = toggle; $('#loop').onclick = toggleLoop; $('#src').onclick = toggleSrc; $('#full').onclick = toggleFull;
$('#rate').onclick = () => { S.rate = S.rate === 1 ? 0.25 : speeds[speeds.indexOf(S.rate) + 1]; audio.playbackRate = S.rate; $('#rate').textContent = S.rate + '×'; };
for (const b of document.querySelectorAll('button')) b.addEventListener('keydown', e => { if (e.key === ' ') e.preventDefault(); });
audio.addEventListener('play', () => { $('#play').textContent = '暂停'; });
audio.addEventListener('pause', () => { $('#play').textContent = '播放'; });

// ---------- 时间轴 ----------
const tl = $('#tl'), tg = tl.getContext('2d');
const X = t => (t - S.va) / (S.vb - S.va) * tl.clientWidth;
const T = x => S.va + x / tl.clientWidth * (S.vb - S.va);
let hover = null, drag = false;
const fromEvent = e => T(e.clientX - tl.getBoundingClientRect().left);
tl.addEventListener('pointerdown', e => { drag = true; tl.setPointerCapture(e.pointerId); seek(fromEvent(e)); });
tl.addEventListener('pointermove', e => { hover = fromEvent(e); if (drag) seek(hover); });
tl.addEventListener('pointerup', () => { drag = false; });
tl.addEventListener('pointerleave', () => { hover = null; });
tl.addEventListener('dblclick', () => { [S.va, S.vb] = S.sel ? [S.sel.t0, S.sel.t1] : [0, DUR]; });
tl.addEventListener('wheel', e => {
  e.preventDefault();
  const c = fromEvent(e), k = e.deltaY > 0 ? 1.25 : 0.8, w = clamp((S.vb - S.va) * k, 1.5, DUR);
  const f = (c - S.va) / (S.vb - S.va);
  S.va = clamp(c - w * f, 0, DUR - w); S.vb = S.va + w;
}, { passive: false });

function drawTL(t) {
  const dpr = devicePixelRatio || 1, W = tl.clientWidth, H = tl.clientHeight;
  if (tl.width !== Math.round(W * dpr) || tl.height !== Math.round(H * dpr)) { tl.width = Math.round(W * dpr); tl.height = Math.round(H * dpr); }
  tg.setTransform(dpr, 0, 0, dpr, 0, 0); tg.clearRect(0, 0, W, H);
  const pps = W / (S.vb - S.va), SEG = 20, WAVE = 48, LYR = 22;
  // 段落
  const segs = S.sel ? [{ t0: S.sel.t0, t1: S.sel.t1, p: S.sel }] : CUT;
  tg.font = '11px "Segoe UI", "Microsoft YaHei"'; tg.textBaseline = 'middle';
  segs.forEach((c, i) => {
    const a = X(c.t0), b = X(c.t1);
    tg.fillStyle = i % 2 ? '#1c2a38' : '#23374a'; tg.fillRect(a, 2, b - a - 1, SEG - 4);
    tg.save(); tg.beginPath(); tg.rect(a, 0, Math.max(0, b - a - 4), SEG); tg.clip();
    tg.fillStyle = '#a9c4d8'; tg.fillText(c.p.title, Math.max(a, 0) + 5, SEG / 2); tg.restore();
  });
  // 包络：kick 蓝，bass 暗
  const y0 = SEG + WAVE, fps = AUD.fps;
  for (const [arr, col] of [[AUD.bass, '#2b3b4c'], [AUD.kick, '#4d93bb']]) {
    tg.fillStyle = col;
    for (let x = 0; x < W; x++) {
      const i0 = Math.floor(T(x) * fps), i1 = Math.max(i0 + 1, Math.floor(T(x + 1) * fps));
      let v = 0; for (let i = i0; i < i1 && i < arr.length; i += Math.max(1, (i1 - i0) >> 4)) v = Math.max(v, arr[i] ?? 0);
      const h = clamp(v, 0, 1) * (WAVE - 4); tg.fillRect(x, y0 - h, 1, h);
    }
  }
  // 拍
  if (pps > 6) { tg.fillStyle = '#ffffff26'; for (const b of BEATS) if (b >= S.va && b <= S.vb) tg.fillRect(X(b), SEG, 1, WAVE); }
  tg.fillStyle = '#ffffff55'; for (const b of DOWN) if (b >= S.va && b <= S.vb && pps > 1.5) tg.fillRect(X(b), SEG, 1, WAVE);
  // 歌词
  const ly = SEG + WAVE + LYR / 2;
  let free = -1e9;
  if (pps > 28) for (const w of WORDS) {
    if (w.b < S.va || w.a > S.vb) continue;
    const on = t >= w.a && t < w.b;
    tg.fillStyle = on ? '#ffffff' : '#8d94a3'; tg.fillRect(X(w.a), ly + 9, Math.max(1, X(w.b) - X(w.a)), 1);
    if (X(w.a) >= free) { tg.fillText(w.w, X(w.a), ly); free = X(w.a) + tg.measureText(w.w).width + 4; }
  }
  else { tg.fillStyle = '#6d7482'; for (const L of LINES) { const a = L[0].a, b = L.at(-1).b; if (b >= S.va && a <= S.vb) tg.fillRect(X(a), ly - 2, Math.max(1, X(b) - X(a)), 4); } }
  // 秒
  const stp = [1, 2, 5, 10, 20, 30, 60].find(s => s * pps > 60) ?? 60, ry = H - 8;
  tg.fillStyle = '#6d7482';
  for (let s = Math.ceil(S.va / stp) * stp; s <= S.vb; s += stp) tg.fillText(fmt(s).replace(/\.00$/, ''), X(s) + 2, ry);
  // 区间、打点、播放头
  if (S.io) { tg.fillStyle = '#ffb25e22'; tg.fillRect(X(S.io[0]), 0, X(S.io[1]) - X(S.io[0]), H); }
  tg.fillStyle = '#ff6f8e'; for (const n of S.notes) { const x = X(n.t); tg.beginPath(); tg.moveTo(x - 4, 0); tg.lineTo(x + 4, 0); tg.lineTo(x, 7); tg.fill(); }
  if (hover !== null) { tg.fillStyle = '#ffffff30'; tg.fillRect(X(hover), 0, 1, H); tg.fillStyle = '#c9ccd4'; tg.fillText(`${fmt(hover)}  ${barBeat(hover)}`, X(hover) + 5, H - 22); }
  tg.fillStyle = '#6fd3ff'; tg.fillRect(X(t) - 0.5, 0, 1.5, H);
}

// ---------- 主循环 ----------
let frames = 0, lastPerf = performance.now(), cost = 0, lastLine = null;
function tick() {
  let t = audio.currentTime;
  const [a, b] = rangeOf();
  if (!audio.paused && t >= b - 0.005) { if (S.loop || S.io) { seek(a); t = a; } else audio.pause(); }
  if (t < a - 0.05 && (S.sel || S.io) && !drag) { seek(a); t = a; }
  if (!audio.paused && !drag && (t < S.va || t > S.vb)) { const w = S.vb - S.va; S.va = clamp(t - w * 0.1, 0, DUR - w); S.vb = S.va + w; }
  const c0 = performance.now(), playing = !audio.paused;
  A.show(S.sel ?? cutAt(t).p, S.video); A.sync(t, playing, S.rate);
  if (S.b) { B.show(S.b, S.video); B.sync(t, playing, S.rate); }
  cost += performance.now() - c0; frames++;
  drawTL(t);
  $('#time').textContent = fmt(t); $('#beat').textContent = barBeat(t);
  const i = LINES.findIndex(L => t < L.at(-1).b + 0.5);
  if (i !== lastLine || playing) {
    const L = LINES[i] ?? [], box = $('#lyric'); box.replaceChildren(); lastLine = i;
    if (L.length && t >= L[0].a - 1.2) for (const w of L) { const s = document.createElement('span'); s.textContent = w.w + ' '; if (t >= w.a) s.className = 'now'; box.append(s); }
  }
  if (c0 - lastPerf > 500) { $('#perf').textContent = `${Math.round(frames * 1000 / (c0 - lastPerf))} fps · 画一帧 ${(cost / frames).toFixed(1)} ms`; frames = 0; cost = 0; lastPerf = c0; }
  requestAnimationFrame(tick);
}

// ---------- 启动：#piece@秒 可直接定位，方便发链接和自查 ----------
const [hid, ht] = location.hash.slice(1).split('@');
renderList();
if (byId[hid]) select(byId[hid]);
for (const p of new Set(CUT.map(c => c.p))) if (p.page) A.frame(p.page);   // 全片模式切段不等加载
if (ht) seek(+ht);
window.PLAYER = { S, A, B, audio, seek, select: id => select(id ? byId[id] : null), setB: id => setB(byId[id]) };
tick();
