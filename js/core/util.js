/* ============================================================
   SNM.util — 공용 헬퍼
   클래식 스크립트. 반드시 가장 먼저 로드.
   ============================================================ */
window.SNM = window.SNM || {};

SNM.util = (function () {
  'use strict';

  /* ── 수학 ── */
  function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /** 가중치 추첨. items: [{weight:Number, ...}] → index 반환 */
  function weightedIndex(items, weightKey) {
    var key = weightKey || 'weight';
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += (items[i][key] || 0);
    if (total <= 0) return randInt(0, items.length - 1);
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= (items[i][key] || 0);
      if (r <= 0) return i;
    }
    return items.length - 1;
  }

  /** Fisher–Yates. 원본 배열을 변형하지 않음 */
  function shuffle(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ── 이징 ── */
  var ease = {
    linear:      function (t) { return t; },
    outCubic:    function (t) { return 1 - Math.pow(1 - t, 3); },
    outQuart:    function (t) { return 1 - Math.pow(1 - t, 4); },
    outQuint:    function (t) { return 1 - Math.pow(1 - t, 5); },
    inOutCubic:  function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outBack:     function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic:  function (t) {
      var c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
  };

  /* ── 포맷 ── */
  function fmtNum(n) { return Math.round(n).toLocaleString('ko-KR'); }
  /** 초 → "M:SS" */
  function formatTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ── DOM ── */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  /** pointerdown + 키보드(Enter/Space) 동시 바인딩. 모바일 300ms 지연 회피 */
  function onTap(node, handler) {
    if (!node) return function () {};
    var down = function (e) {
      if (node.disabled || node.getAttribute('aria-disabled') === 'true') return;
      handler(e);
    };
    var key = function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); down(e);
      }
    };
    node.addEventListener('pointerdown', down);
    // 키보드 접근. <button>/<a> 도 포함해야 한다 —
    // pointerdown 만 듣고 있으므로 Enter/Space 로 생성되는 click 은 잡히지 않는다.
    // key 핸들러에서 preventDefault 하므로 합성 click 과 중복 실행되지 않는다.
    node.addEventListener('keydown', key);
    return function off() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('keydown', key);
    };
  }

  /** HUD 값 갱신 + bump 애니메이션 */
  function bump(node, value) {
    if (!node) return;
    if (value != null) node.textContent = value;
    node.classList.remove('is-bump');
    void node.offsetWidth;              // 리플로우 강제 → 애니메이션 재시작
    node.classList.add('is-bump');
    setTimeout(function () { node.classList.remove('is-bump'); }, 200);
  }

  /** 0 → to 카운트업 애니메이션 */
  function countUp(node, to, ms, done) {
    if (!node) return;
    var from = 0, start = null, dur = ms || 900;
    function step(ts) {
      if (start === null) start = ts;
      var t = clamp((ts - start) / dur, 0, 1);
      node.textContent = fmtNum(lerp(from, to, ease.outCubic(t)));
      if (t < 1) requestAnimationFrame(step);
      else { node.textContent = fmtNum(to); if (done) done(); }
    }
    requestAnimationFrame(step);
  }

  /* ── 루프 & 타이머 (페이지 이탈 시 일괄 정리) ── */
  var rafIds = [], timerIds = [];

  /**
   * 고정 타임스텝 게임 루프.
   * onUpdate(dtSec) 는 step 초 단위로 정확히 호출되고, onRender(alpha) 는 프레임당 1회.
   * 반환: { stop(), running }
   */
  function loop(onUpdate, onRender, stepSec) {
    var step = stepSec || 1 / 120;
    var acc = 0, last = performance.now(), id = 0, running = true;
    function frame(now) {
      if (!running) return;
      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;          // 탭 복귀 시 스파이크 방지
      acc += dt;
      var guard = 0;
      while (acc >= step && guard++ < 300) { onUpdate(step); acc -= step; }
      if (onRender) onRender(acc / step);
      id = requestAnimationFrame(frame);
      rafIds.push(id);
    }
    id = requestAnimationFrame(frame);
    rafIds.push(id);
    return {
      stop: function () { running = false; cancelAnimationFrame(id); },
      isRunning: function () { return running; }
    };
  }

  function after(ms, fn) { var id = setTimeout(fn, ms); timerIds.push(id); return id; }
  function every(ms, fn) { var id = setInterval(fn, ms); timerIds.push(id); return id; }
  function clearAll() {
    rafIds.forEach(cancelAnimationFrame); rafIds.length = 0;
    timerIds.forEach(clearTimeout); timerIds.forEach(clearInterval); timerIds.length = 0;
  }
  window.addEventListener('pagehide', clearAll);

  /* ── 캔버스 ── */
  /** DPR 대응 캔버스 리사이즈. CSS 픽셀 기준 좌표계를 유지 */
  function fitCanvas(canvas, cssW, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  return {
    clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, pick: pick,
    weightedIndex: weightedIndex, shuffle: shuffle, ease: ease,
    fmtNum: fmtNum, formatTime: formatTime, pad2: pad2,
    $: $, $$: $$, el: el, onTap: onTap, bump: bump, countUp: countUp,
    loop: loop, after: after, every: every, clearAll: clearAll,
    fitCanvas: fitCanvas, roundRect: roundRect, reduceMotion: reduceMotion
  };
})();
