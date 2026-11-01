// piece-api.js —— 让播放器（player.html）能控制任何一个片段页面。
//
// 原理：所有页面都是 `const a = new Audio('...wav')`。这个脚本在它们之前加载，
// 把 window.Audio 换成"记录实例"的版本，于是播放器可以透过同源 iframe 拿到
// iframe.contentWindow.__piece，读 currentTime、seek、play/pause、mute。
//
// 不用改页面自己的逻辑；页面原来点一下播放、空格暂停仍然有效。

(function () {
  if (window.__piece) return;

  var Native = window.Audio;
  var el = null;
  function remember(a) { el = a; window.__pieceAudio = a; return a; }

  function Patched() {
    var a = new (Function.prototype.bind.apply(Native, [null].concat([].slice.call(arguments))))();
    return remember(a);
  }
  Patched.prototype = Native.prototype;
  window.Audio = Patched;

  // 兜底：万一某个页面用 document.createElement('audio')
  var ce = document.createElement.bind(document);
  document.createElement = function (tag) {
    var n = ce.apply(document, arguments);
    if (String(tag).toLowerCase() === 'audio') remember(n);
    return n;
  };

  window.__piece = {
    get el() { return el; },
    get ready() { return !!el; },
    get duration() { return el && isFinite(el.duration) && el.duration > 0 ? el.duration : null; },
    get time() { return el ? el.currentTime : 0; },
    get playing() { return !!el && !el.paused && !el.ended; },
    get muted() { return !!el && el.muted; },
    seek: function (t) { if (el) { try { el.currentTime = t; } catch (e) {} } },
    play: function () { if (!el) return false; var p = el.play(); if (p && p.catch) p.catch(function () {}); return true; },
    pause: function () { if (el && !el.paused) el.pause(); },
    toggle: function () { if (this.playing) this.pause(); else this.play(); },
    mute: function (v) { if (el) el.muted = !!v; }
  };

  // 父页面也可以走 postMessage（不依赖同源细节）
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.__pieceCmd === 'seek') window.__piece.seek(d.t);
    else if (d.__pieceCmd === 'play') window.__piece.play();
    else if (d.__pieceCmd === 'pause') window.__piece.pause();
    else if (d.__pieceCmd === 'toggle') window.__piece.toggle();
    else if (d.__pieceCmd === 'mute') window.__piece.mute(d.v);
  });
})();
