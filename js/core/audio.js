/* ============================================================
   SNM.audio — Web Audio 비프 (오디오 파일 0개)
   AudioContext 는 첫 사용자 제스처 이후 lazy 생성 (모바일 정책)
   ============================================================ */
window.SNM = window.SNM || {};

SNM.audio = (function () {
  'use strict';

  var ctx = null, master = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = SNM.store.getSetting('sound') ? 0.25 : 0;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function beep(freq, ms, type, vol) {
    freq = freq || 440; ms = ms || 80; type = type || 'square'; vol = (vol == null ? 1 : vol);
    if (!SNM.store.getSetting('sound')) return;
    var c = ensure();
    if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      var t = c.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * 0.9, t + 0.006);       // 클릭 노이즈 방지 어택
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000); // 릴리즈
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + ms / 1000 + 0.02);
    } catch (e) { /* noop */ }
  }

  /** notes: [[freq, ms, delayMs], ...] */
  function seq(notes) {
    notes.forEach(function (n) {
      setTimeout(function () { beep(n[0], n[1], n[3], n[4]); }, n[2]);
    });
  }

  function setEnabled(on) {
    if (master) master.gain.value = on ? 0.25 : 0;
    if (on) ensure();
  }

  /* ── 사운드 사전 (전 게임 공통) ── */
  var sfx = {
    tap:       function () { beep(520, 45, 'triangle'); },
    good:      function () { beep(880, 70, 'sine'); },
    bad:       function () { beep(160, 220, 'sawtooth', 0.8); },
    combo:     function (n) { beep(Math.min(660 + (n || 0) * 20, 1600), 55, 'square'); },
    tick:      function () { beep(440, 60); },
    start:     function () { beep(880, 140); },
    rouletteTick: function () { beep(1000, 22, 'square', 0.5); },
    clear:     function () { seq([[523, 120, 0], [659, 120, 130], [784, 120, 260], [1047, 240, 390]]); },
    gameover:  function () { seq([[440, 160, 0], [349, 160, 170], [262, 320, 340]]); },
    newBest:   function () { seq([[784, 90, 0], [988, 90, 100], [1319, 90, 200], [1568, 300, 300]]); },

    /* ── 9.19 룰렛 전용 ── */
    // 화면이 가려지는 순간 — 아래로 미끄러지는 하강음
    blind:     function () { seq([[660, 90, 0, 'sine'], [520, 90, 70, 'sine'], [392, 200, 140, 'sine'], [294, 260, 240, 'sine']]); },
    // 커튼이 열리는 순간 — 상승음
    reveal:    function () { seq([[392, 70, 0, 'triangle'], [523, 70, 60, 'triangle'], [659, 70, 120, 'triangle'], [880, 220, 180, 'triangle']]); },
    // 히든 미션 적중 — 반짝이는 아르페지오
    hidden:    function () { seq([[1047, 80, 0], [1319, 80, 90], [1568, 80, 180], [2093, 320, 270]]); },
    // 청년의 날(9.19) 적중 팡파르
    fanfare:   function () { seq([[523, 130, 0], [659, 130, 140], [784, 130, 280], [1047, 160, 420], [784, 120, 600], [1047, 420, 720]]); }
  };

  // 첫 제스처에서 컨텍스트 준비 (재생 지연 제거)
  function warm() {
    if (SNM.store.getSetting('sound')) ensure();
    window.removeEventListener('pointerdown', warm);
    window.removeEventListener('keydown', warm);
  }
  window.addEventListener('pointerdown', warm, { once: true });
  window.addEventListener('keydown', warm, { once: true });

  return { ensure: ensure, beep: beep, seq: seq, setEnabled: setEnabled, sfx: sfx };
})();
