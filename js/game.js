/* ============================================================
   🎡 성남 9.19 룰렛 — 청년의 날 블라인드 타이밍
   - 성남 8대 명소 룰렛이 정확히 9.19초에 한 바퀴 돈다.
   - 5~7초(설정) 가 지나면 커튼이 화면 전체를 가린다.
   - [정지] 를 누르면 커튼이 열리며 기록이 공개된다.
   - 히든 미션(9.19 / 9.91 / 9.09 / 9.20 / 7.77) 은 적중 순간에만 공개.
   - 참가자 1~6명이 한 명씩 단 한 번 도전하고 9.19초에 가까운 순으로 순위.

   ★ 판정 시각은 rAF 루프가 아니라 입력 이벤트 안에서 performance.now() 로
     즉시 캡처한다. 루프에서 읽으면 최대 16.7ms 의 양자화 오차가 생겨
     9.19 정확히 맞추기가 불가능해진다.
   ============================================================ */
(function () {
  'use strict';

  var U = SNM.util;

  /* ───────────────────────── 상수 ───────────────────────── */

  var TARGET_MS   = 9190;               // 목표 9.19초 (고정 · 변경 금지)
  var LAP_MS      = TARGET_MS;          // 룰렛 1바퀴 = 9.19초
  var SEG_N       = 8;
  var SEG_DEG     = 360 / SEG_N;        // 45도
  var SEG_MS      = LAP_MS / SEG_N;     // 1148.75ms
  var BLIND_MIN   = 5000;               // 랜덤 가림 시점 하한
  var BLIND_MAX   = 7000;               // 랜덤 가림 시점 상한
  var BLIND_FIXED = 5000;               // 고정 모드 가림 시점
  var WARN_MS     = 1000;               // 가려지기 몇 ms 전에 경고할지
  var AUTO_STOP   = 15000;              // 자동 정지(시간 초과)
  var LOCK_MS     = 220;                // 정지 직후 입력 무시 구간
  var MIN_PLAYERS = 1, MAX_PLAYERS = 6;

  /* 성남 8대 명소 — 룰렛 순서(= 시간 순서) 고정.
     i번 명소는 i*1.14875초 지점부터 포인터를 지나간다. */
  var SEGMENTS = [
    { name: '판교테크노밸리',       short: '판교',     fill: 'var(--sn-gold)',  ink: 'var(--c-on-gold)',
      desc: '대한민국 IT의 심장, 판교테크노밸리 구간에서 멈췄습니다.' },
    { name: '분당 정자동 카페거리', short: '정자동',   fill: 'var(--sn-blue)',  ink: 'var(--sn-white)',
      desc: '커피 향 가득한 정자동 카페거리 구간입니다.' },
    { name: '탄천 산책로',          short: '탄천',     fill: 'var(--sn-white)', ink: 'var(--c-text)',
      desc: '도심을 가로지르는 초록 물길, 탄천 구간입니다.' },
    { name: '남한산성',             short: '남한산성', fill: 'var(--sn-red)',   ink: 'var(--sn-white)',
      desc: '세계유산 남한산성 성곽길 구간입니다.' },
    { name: '모란민속5일장',        short: '모란장',   fill: 'var(--sn-gold)',  ink: 'var(--c-on-gold)',
      desc: '정이 넘치는 모란민속5일장 구간입니다.' },
    { name: '신구대식물원',         short: '식물원',   fill: 'var(--sn-blue)',  ink: 'var(--sn-white)',
      desc: '사계절 꽃이 피는 신구대학교식물원 구간입니다.' },
    { name: '성남아트센터',         short: '아트센터', fill: 'var(--sn-red)',   ink: 'var(--sn-white)',
      desc: '문화가 흐르는 성남아트센터 구간입니다.' },
    { name: '위례신도시',           short: '위례',     fill: 'var(--sn-white)', ink: 'var(--c-text)',
      desc: '새롭게 피어나는 위례신도시 구간입니다.' }
  ];

  /* 명소 아이콘 8종 — 로컬 좌표계 0..24, stroke=currentColor */
  var ICONS = [
    /* 0 판교: 빌딩군 */
    '<rect x="2" y="9" width="6" height="13" rx="1"/><rect x="9" y="3" width="6.5" height="19" rx="1"/>' +
    '<rect x="16.5" y="12" width="5.5" height="10" rx="1"/><path d="M11 7h2.5M11 11h2.5M11 15h2.5"/>',
    /* 1 정자동: 커피컵 */
    '<path d="M4 8h13v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 10h1.6a2.9 2.9 0 0 1 0 5.8H17"/>' +
    '<path d="M8 2.5v3M12 2.5v3"/>',
    /* 2 탄천: 물결 + 나무 */
    '<path d="M2 16.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>' +
    '<path d="M7 12.5V8"/><path d="M7 3.5 3.4 9.2h7.2z"/>',
    /* 3 남한산성: 성곽 */
    '<path d="M2 21V9h3V6h3v3h3V6h3v3h3v3h3v9z"/><path d="M2 15h20"/><path d="M10.5 21v-4h3v4"/>',
    /* 4 모란장: 천막 장터 */
    '<path d="M2.5 9.5 5.5 4h13l3 5.5z"/><path d="M4.5 9.5V21h15V9.5"/>' +
    '<path d="M2.5 9.5c1.6 2.4 3.2 2.4 4.8 0 1.6 2.4 3.2 2.4 4.8 0 1.6 2.4 3.2 2.4 4.8 0 1.6 2.4 3.2 2.4 4.8 0"/>',
    /* 5 신구대: 온실 + 꽃 */
    '<path d="M3 21V10l9-6.5L21 10v11z"/><path d="M12 3.5V21M3 14h18"/>' +
    '<circle cx="12" cy="11" r="2"/>',
    /* 6 아트센터: 공연 마스크 */
    '<path d="M3.5 4.5h17V12a8.5 8.5 0 0 1-17 0z"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/>' +
    '<path d="M8.5 15.5c2.2 1.8 4.8 1.8 7 0"/>',
    /* 7 위례: 아파트 + 새싹 */
    '<rect x="3" y="6" width="7.5" height="15" rx="1"/><rect x="13" y="10.5" width="8" height="10.5" rx="1"/>' +
    '<path d="M5.2 9.5h3M5.2 13h3M5.2 16.5h3M15.3 14h3.4M15.3 17.5h3.4"/>'
  ];

  /* ── 미션 정의 ──
     기본(9.19): 초 끝자리가 19 이면 성공 (8.19 · 10.19 … 모두 포함)
     히든 4종  : 센티초까지 정확히 일치해야 성공 */
  var MISSIONS = [
    { id: 'm919', code: '9.19', kind: 'basic',  cs: 919, icon: '🎯',
      title: '9월 19일 · 청년의 날',
      desc: '9월 19일은 법정기념일 <b>청년의 날</b>입니다. 초 끝자리가 <b>19</b>면 청년의 날 미션 성공!' },
    { id: 'm991', code: '9.91', kind: 'hidden', cs: 991, icon: '🔄',
      title: '19를 뒤집은 숫자',
      desc: '<b>19</b>를 뒤집으면 <b>91</b>. 뒤집어도 청년의 날입니다!' },
    { id: 'm909', code: '9.09', kind: 'hidden', cs: 909, icon: '📅',
      title: '9월을 의미하는 숫자',
      desc: '청년의 날이 있는 달, <b>9월</b>을 나타내는 숫자입니다.' },
    { id: 'm920', code: '9.20', kind: 'hidden', cs: 920, icon: '🎂',
      title: '스무 살, 성인의 시작',
      desc: '<b>20살</b> 성인의 시작을 알리는 숫자입니다.' },
    { id: 'm777', code: '7.77', kind: 'hidden', cs: 777, icon: '🍀',
      title: '행운의 숫자 777',
      desc: '행운의 숫자 <b>7</b>이 세 번! 오늘의 행운을 잡았습니다.' }
  ];

  function missionById(id) {
    for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i];
    return null;
  }

  /* ───────────────────────── DOM ───────────────────────── */

  var elStage, elRotor, elPlate, elBig, elSegLabel, elPlateMascot;
  var elCurtain, elHudTurn, elHudName, elHint, elLive;
  var elSetup, elReady, elReadyTurn, elReadyName;
  var elNameList, elAddBtn, elBlindBtn, elBlindLabel, elStartBtn, elReadyBtn, elStopBtn;
  var elBoardList, elResetBtn;
  var elMissionBoard, elMissionList, elMissionCount;

  /* ───────────────────────── 상태 ───────────────────────── */

  var phase     = 'SETUP';    // SETUP | READY | COUNT | RUN | REVEAL | RESULT | FINAL
  var players   = [];         // [{ name, ms, err, missions, done, timedOut, voided }]
  var turnIdx   = 0;
  var blindMode = 'random';   // 'random' | 'fixed'

  var runStartAt = 0;         // performance.now() 기준 시작 시각
  var blindAt    = 0;         // 이번 차례에 화면이 가려지는 시각(ms)
  var stopMs     = 0;
  var curtainClosed = false;
  var warned     = false;
  var tickDone   = 0;
  var liveAt     = 0;
  var gameLoop   = null;
  var cdHandle   = null;
  var revealed   = {};        // missionId → 최초 적중자 이름
  var settleRaf  = 0;

  /* ── 리허설(테스트) 모드 ──
     index.html?test 로 열었을 때만 켜진다. 무대에서는 파라미터 없이 열면
     패널이 아예 생성되지 않으므로 관객에게 노출될 일이 없다. */
  var TEST = (function () {
    var q = (location.search + ' ' + location.hash).toLowerCase();
    return q.indexOf('test') >= 0 || q.indexOf('debug') >= 0;
  })();
  var forcedMs = null;        // 다음 정지에 강제로 기록될 값(ms)

  /* ───────────────────── 시간 포맷 / 판정 ───────────────────── */

  /** 스톱워치 관례대로 버림(truncate). 표시값과 판정값이 반드시 같아야 한다. */
  function centi(ms) { return Math.floor(ms / 10); }
  function fmt(ms)   { return U.pad2(Math.floor(ms / 1000)) + '.' + U.pad2(centi(ms) % 100); }
  function fmt3(ms)  { return (Math.floor(ms) / 1000).toFixed(3); }

  /** 정지 시각에 걸린 미션 id 배열 */
  function evalMissions(ms) {
    var cs = centi(ms), out = [];
    MISSIONS.forEach(function (m) {
      if (m.kind === 'basic') { if (cs % 100 === 19) out.push(m.id); }
      else if (cs === m.cs) out.push(m.id);
    });
    return out;
  }

  /** 정지 시각이 속한 명소 (룰렛은 9.19초에 한 바퀴) */
  function segAt(ms) {
    var i = Math.floor(ms / SEG_MS) % SEG_N;
    if (i < 0) i += SEG_N;
    return SEGMENTS[i];
  }

  /* ───────────────────── 룰렛 SVG 생성 ───────────────────── */

  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }

  /**
   * 슬롯 k(12시부터 시계방향 k번째 45도)에는 SEGMENTS[7-k] 를 그린다.
   * 이렇게 해야 로터를 시계방향으로 회전(A = 360·t/9.19s)시켰을 때
   * 포인터 아래 명소가 floor(t / 1.14875s) 번째 명소와 정확히 일치한다.
   */
  function buildWheelSVG() {
    var cx = 160, cy = 160, r = 158;
    var out = '<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">';

    out += '<circle cx="160" cy="160" r="159" style="fill:var(--sn-gray-100)"/>';

    for (var k = 0; k < SEG_N; k++) {
      var idx = (SEG_N - 1) - k;                   // 슬롯 k ↔ 명소 7-k
      var s   = SEGMENTS[idx];
      var a0  = k * SEG_DEG;
      var a1  = (k + 1) * SEG_DEG;
      var p0  = polar(cx, cy, r, a0);
      var p1  = polar(cx, cy, r, a1);
      var mid = a0 + SEG_DEG / 2;

      out += '<path d="M' + cx + ' ' + cy +
             ' L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
             ' A' + r + ' ' + r + ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + ' Z"' +
             ' style="fill:' + s.fill + ';stroke:var(--c-border)" stroke-width="2"/>';

      // 아이콘
      out += '<g transform="rotate(' + mid + ' ' + cx + ' ' + cy + ') translate(148 30)"' +
             ' style="color:' + s.ink + '" fill="none" stroke="currentColor" stroke-width="1.7"' +
             ' stroke-linecap="round" stroke-linejoin="round" opacity="0.92">' +
             ICONS[idx] + '</g>';

      // 바깥 테두리 쪽 눈금 숫자 = 이 명소가 포인터를 지나기 시작하는 시각,
      // 안쪽에 명소 이름. (중앙 판독판이 반지름 83 안쪽을 덮으므로 그보다 바깥에 둔다)
      out += '<g transform="rotate(' + mid + ' ' + cx + ' ' + cy + ')">' +
               '<text x="160" y="22" text-anchor="middle" style="fill:' + s.ink + '"' +
               ' font-size="13" font-weight="800" font-family="sans-serif" opacity="0.75">' +
               (idx * SEG_MS / 1000).toFixed(1) + 's</text>' +
               '<text x="160" y="74" text-anchor="middle" style="fill:' + s.ink + '"' +
               ' font-size="15" font-weight="800" font-family="sans-serif">' + s.short + '</text>' +
             '</g>';
    }

    // 칸 경계 장식 + 링
    for (var b = 0; b < SEG_N; b++) {
      var pb = polar(cx, cy, r - 4, b * SEG_DEG);
      out += '<circle cx="' + pb[0].toFixed(2) + '" cy="' + pb[1].toFixed(2) + '" r="4.5"' +
             ' style="fill:var(--sn-gold-light);stroke:var(--sn-gold-dark)" stroke-width="1.5"/>';
    }
    out += '<circle cx="160" cy="160" r="158" style="fill:none;stroke:var(--sn-gold)" stroke-width="4"/>';
    out += '<circle cx="160" cy="160" r="86" style="fill:none;stroke:var(--sn-gold-light)" stroke-width="2" opacity=".7"/>';
    out += '</svg>';
    return out;
  }

  /* ───────────────────────── 렌더 ───────────────────────── */

  function setAngle(deg) {
    elRotor.style.transform = 'rotate(' + deg.toFixed(2) + 'deg)';
  }
  function angleOf(ms) { return (ms / LAP_MS) * 360; }

  function setBig(txt) { if (elBig.textContent !== txt) elBig.textContent = txt; }
  function setSeg(txt) { if (elSegLabel.textContent !== txt) elSegLabel.textContent = txt; }
  function setHint(html) { elHint.innerHTML = html; }

  /** 스크린리더 안내 — 1초 throttle · 가려진 뒤에는 시간을 읽지 않는다 */
  function pushLive(txt) {
    var now = performance.now();
    if (now - liveAt < 1000) return;
    liveAt = now;
    elLive.textContent = txt;
  }

  function renderHUD() {
    if (phase === 'SETUP') {
      elHudTurn.textContent = '–';
      elHudName.textContent = '대기 중';
      return;
    }
    if (phase === 'FINAL') {
      elHudTurn.textContent = players.length + '/' + players.length;
      elHudName.textContent = '최종 결과';
      return;
    }
    elHudTurn.textContent = (turnIdx + 1) + '/' + players.length;
    elHudName.textContent = players[turnIdx] ? players[turnIdx].name : '–';
  }

  /* ── 커튼 ── */
  function closeCurtain() {
    if (curtainClosed) return;
    curtainClosed = true;
    elCurtain.classList.add('is-active');
    // 리플로우를 강제해야 첫 프레임부터 transition 이 걸린다
    void elCurtain.offsetWidth;
    elCurtain.classList.remove('is-opening');
    elCurtain.classList.add('is-closed');
    SNM.audio.sfx.blind();
    setHint('화면이 가려졌습니다. <b>감각</b>으로 9.19초를 맞춰 <b>[정지]</b>!');
    pushLive('화면이 가려졌습니다');
  }

  function openCurtain() {
    if (!curtainClosed) return;
    curtainClosed = false;
    elCurtain.classList.add('is-opening');
    elCurtain.classList.remove('is-closed');
    SNM.audio.sfx.reveal();
    U.after(620, function () { elCurtain.classList.remove('is-active', 'is-opening'); });
  }

  function resetCurtain() {
    curtainClosed = false;
    elCurtain.classList.remove('is-active', 'is-closed', 'is-opening');
  }

  /* ───────────────────────── 루프 ───────────────────────── */

  /* 루프는 보여주기 전용. 판정에는 절대 관여하지 않는다. */
  function update() {
    if (phase !== 'RUN') return;
    var t = performance.now() - runStartAt;

    // 1초 틱은 공개 구간에서만 — 가려진 뒤 소리로 세는 것을 막는다
    var whole = Math.floor(t / 1000);
    if (whole > tickDone && whole * 1000 < blindAt && !curtainClosed) {
      tickDone = whole;
      SNM.audio.beep(440, 45, 'triangle');
    }

    if (!warned && t >= blindAt - WARN_MS && t < blindAt) {
      warned = true;
      elPlate.classList.add('is-half');
      SNM.audio.beep(300, 120, 'sine', 0.7);
      setHint('⚠️ 곧 화면이 가려집니다 — 페이스를 기억하세요!');
    }
    if (!curtainClosed && t >= blindAt) closeCurtain();

    if (t >= AUTO_STOP) { stopMs = AUTO_STOP; doStop(true); }
  }

  function render() {
    if (phase !== 'RUN') return;
    var t = performance.now() - runStartAt;

    if (t < blindAt) {
      setAngle(angleOf(t));
      setBig(fmt(t));
      setSeg(segAt(t).short + ' 구간');
      pushLive(Math.floor(t / 1000) + '초대');
    } else {
      // 가려진 뒤에도 로터는 계속 돈다(커튼 뒤). DOM 의 숫자는 실제로 지운다.
      setAngle(angleOf(t));
      setBig('██.██');
      setSeg('블라인드');
      elPlate.classList.remove('is-half');
      elPlate.classList.add('is-blind');
    }
  }

  /* ───────────────────── 차례 시작 / 정지 ───────────────────── */

  function showReady() {
    phase = 'READY';
    resetCurtain();
    elPlate.classList.remove('is-half', 'is-blind', 'is-hit', 'is-spinning');
    setBig('00.00');
    setSeg('대기 중');
    setAngle(0);
    elStopBtn.disabled = true;
    elStopBtn.textContent = '정 지';
    elSetup.hidden = true;
    elReady.hidden = false;
    elReadyTurn.textContent = (turnIdx + 1) + '번째 차례 · 전체 ' + players.length + '명';
    elReadyName.textContent = players[turnIdx].name;
    SNM.mascot.setExpression(elReady, 'default');
    renderHUD();
    renderBoard();
    setHint('<b>' + escapeHTML(players[turnIdx].name) + '</b> 님 차례입니다. 준비되면 시작하세요.');
    elReadyBtn.focus();
  }

  function startTurn() {
    if (phase !== 'READY') return;      // 카운트다운 중 재입력으로 두 번 시작되는 사고 방지
    phase = 'COUNT';
    elReady.hidden = true;
    elPlate.classList.remove('is-half', 'is-blind', 'is-hit');
    setBig('00.00');
    setSeg('출발선');
    setAngle(0);
    resetCurtain();

    blindAt = (blindMode === 'fixed')
      ? BLIND_FIXED
      : Math.round(U.rand(BLIND_MIN, BLIND_MAX));

    cdHandle = SNM.ui.countdown(elStage, beginRun);
  }

  function beginRun() {
    cdHandle = null;
    phase      = 'RUN';
    runStartAt = performance.now();      // ★ 이후 절대 재계산하지 않는다
    stopMs     = 0;
    tickDone   = 0;
    liveAt     = 0;
    warned     = false;
    elStopBtn.disabled = false;
    elStopBtn.textContent = '정 지';
    elPlate.classList.add('is-spinning');
    setHint('9.19초라고 느껴지는 순간 <b>[정지]</b> · <b>Space</b> · 화면 탭!');
    gameLoop = U.loop(update, render);
  }

  /** 정지 처리 — stopMs 는 호출 전에 이미 캡처되어 있어야 한다 */
  function doStop(timedOut) {
    if (phase !== 'RUN') return;
    phase = 'REVEAL';
    if (gameLoop) { gameLoop.stop(); gameLoop = null; }

    elStopBtn.disabled = true;
    elStopBtn.textContent = timedOut ? '시간 초과' : '정지됨';
    elPlate.classList.remove('is-spinning', 'is-half');

    var wasBlind = curtainClosed;
    openCurtain();

    // 로터를 정지 각도에 고정하고 살짝 흔들어 세운다
    settleWheel(angleOf(stopMs));

    var delay = wasBlind ? 460 : 120;
    U.after(delay, function () { rollNumber(stopMs, timedOut); });
  }

  /** 정지 각도에서 감쇠 진동 후 정확히 멈춘다 (연출 전용) */
  function settleWheel(finalDeg) {
    if (settleRaf) { cancelAnimationFrame(settleRaf); settleRaf = 0; }
    if (U.reduceMotion()) { setAngle(finalDeg); return; }
    var t0 = performance.now(), DUR = 620, AMP = 3.2;
    function step(now) {
      var t = (now - t0) / DUR;
      if (t >= 1) { setAngle(finalDeg); settleRaf = 0; return; }
      setAngle(finalDeg + Math.sin(t * Math.PI * 3) * AMP * (1 - t));
      settleRaf = requestAnimationFrame(step);
    }
    settleRaf = requestAnimationFrame(step);
    // rAF 가 멈춘 환경에서도 각도는 정확히 자리잡아야 한다
    U.after(DUR + 200, function () {
      if (!settleRaf) return;
      cancelAnimationFrame(settleRaf); settleRaf = 0;
      setAngle(finalDeg);
    });
  }

  /** 숫자 공개 연출 — 0.00 에서 실제 기록까지 굴러간다 */
  function rollNumber(ms, timedOut) {
    elPlate.classList.remove('is-blind');
    var DUR = U.reduceMotion() ? 0 : 780;
    var t0 = performance.now(), settled = false;

    function done() {
      if (settled) return;
      settled = true;
      setBig(fmt(ms));
      setSeg(segAt(ms).short + ' 구간');
      U.after(180, function () { finishTurn(timedOut); });
    }
    // ★ 연출이 결과를 막아서는 안 된다 — rAF 가 멈춰도 결과는 반드시 나온다
    U.after(DUR + 500, done);
    if (!DUR) { done(); return; }

    (function step(now) {
      if (settled) return;
      var t = U.clamp((now - t0) / DUR, 0, 1);
      setBig(fmt(ms * U.ease.outQuart(t)));
      if (t < 1) requestAnimationFrame(step);
      else done();
    })(t0);
  }

  /* ───────────────────── 차례 결과 ───────────────────── */

  function finishTurn(timedOut) {
    phase = 'RESULT';

    var p    = players[turnIdx];
    var hits = timedOut ? [] : evalMissions(stopMs);
    var err  = Math.abs(stopMs - TARGET_MS);

    p.ms       = stopMs;
    p.err      = err;
    p.missions = hits;
    p.done     = true;
    p.timedOut = !!timedOut;
    p.voided   = false;

    var exact = (centi(stopMs) === 919);

    // 미션 공개 처리 (최초 적중자 기록)
    hits.forEach(function (id) {
      if (!revealed[id]) revealed[id] = p.name;
    });
    renderMissions(hits.length > 0);
    renderBoard();
    elLive.textContent = '정지 ' + fmt3(stopMs) + '초, 오차 ' + Math.round(err) + '밀리초';

    // 연출
    if (exact)       { elPlate.classList.add('is-hit'); SNM.audio.sfx.fanfare(); SNM.ui.confetti(54); }
    else if (hits.length) { elPlate.classList.add('is-hit'); SNM.audio.sfx.hidden(); SNM.ui.confetti(34); }
    else if (timedOut)    { SNM.audio.sfx.bad(); }
    else if (err <= 100)  { SNM.audio.sfx.good(); SNM.ui.confetti(16); }
    else                  { SNM.audio.sfx.tick(); }

    SNM.mascot.setExpression(elPlateMascot, hits.length ? 'happy' : (err <= 300 ? 'happy' : 'default'));

    var seg   = segAt(stopMs);
    var sign  = (stopMs >= TARGET_MS) ? '+' : '-';
    var title = timedOut ? '⏰ 시간 초과'
              : exact ? '🏆 9.19 완벽 적중!'
              : hits.length ? '🎁 미션 적중!'
              : err <= 100 ? '🎉 아깝다, 거의 9.19!'
              : '기록 확인';

    var html = '';
    hits.forEach(function (id) {
      var m = missionById(id);
      html += '<div class="mission-note">' +
                '<div class="mission-note__code">' + m.icon + ' ' + m.code +
                  (m.kind === 'hidden' ? ' <span class="chip chip--red">히든</span>'
                                       : ' <span class="chip chip--gold">기본</span>') + '</div>' +
                '<div class="mission-note__title">' + m.title + '</div>' +
                '<div class="mission-note__desc">' + m.desc + '</div>' +
              '</div>';
    });

    var isLast = (turnIdx >= players.length - 1);
    var buttons = [{
      label: isLast ? '최종 결과 보기' : '다음 참가자 (' + (turnIdx + 2) + '/' + players.length + ')',
      variant: 'primary',
      // modal 은 onClick 직후 close() 하므로, 새 모달을 열 때는 다음 틱으로 미룬다
      onClick: function () {
        U.after(40, isLast ? function () { showFinal(true); } : nextTurn);
      }
    }, {
      label: '이 차례 다시 측정',
      variant: 'ghost',
      onClick: function () { U.after(40, retryTurn); }
    }];

    setHint(seg.desc);

    SNM.ui.modal({
      title: title,
      mascot: hits.length ? 'happy' : (timedOut ? 'sad' : (err <= 300 ? 'happy' : 'default')),
      grade: escapeHTML(p.name),
      headline: '<span class="' + (hits.length ? 'modal__headline--hit' : '') + '">' +
                fmt(stopMs) + '</span><small>초</small>',
      rows: [
        ['기록',       fmt3(stopMs) + '초'],
        ['목표',       '9.190초'],
        ['오차',       sign + U.fmtNum(Math.round(err)) + 'ms'],
        ['멈춘 명소',  seg.name]
      ],
      html: html,
      size: hits.length ? 'lg' : null,
      dismissible: false,
      buttons: buttons
    });
  }

  function nextTurn() {
    turnIdx += 1;
    if (turnIdx >= players.length) { showFinal(true); return; }
    showReady();
  }

  function retryTurn() {
    var p = players[turnIdx];
    p.done = false; p.ms = null; p.err = null; p.missions = [];
    // 이 참가자만 지웠으므로, 그가 최초 공개자였던 미션은 공개 상태를 되돌린다
    Object.keys(revealed).forEach(function (id) {
      var stillHit = players.some(function (q) {
        return q.done && (q.missions || []).indexOf(id) >= 0;
      });
      if (!stillHit) delete revealed[id];
    });
    if (!Object.keys(revealed).length) elMissionBoard.hidden = true;
    renderMissions(false);
    showReady();
  }

  /* ───────────────────── 무효 처리 ───────────────────── */

  /** 계측 중 화면을 벗어나면 절대 시각이 어긋난다 — 일시정지가 아니라 무효가 옳다 */
  function voidTurn() {
    if (phase !== 'RUN') return;
    phase = 'RESULT';
    if (gameLoop) { gameLoop.stop(); gameLoop = null; }
    openCurtain();
    elStopBtn.disabled = true;
    elStopBtn.textContent = '무효';
    elPlate.classList.remove('is-spinning', 'is-half', 'is-blind');
    setBig('--.--');
    setSeg('무효');
    setHint('계측 중 화면을 벗어나 이번 차례가 무효 처리되었습니다.');

    SNM.ui.modal({
      title: '⚠️ 무효 처리',
      mascot: 'sad',
      note: '계측 중 다른 화면으로 이동해 시간이 어긋났습니다. 이 차례를 다시 진행해 주세요.',
      dismissible: false,
      buttons: [{ label: '이 차례 다시 진행', variant: 'primary',
                  onClick: function () { U.after(40, retryTurn); } }]
    });
  }

  /* ───────────────────── 최종 결과 ───────────────────── */

  /** 화면에 보인 값(1/100초) 기준 오차 — 같은 기록이 표시됐다면 같은 순위여야 한다 */
  function dispErr(p) { return Math.abs(centi(p.ms) - centi(TARGET_MS)); }

  /** 표시 오차 오름차순. 동률은 공동 순위(p.rank)로 묶는다 */
  function ranked() {
    var list = players.slice().filter(function (p) { return p.done; });
    list.sort(function (a, b) {
      var d = dispErr(a) - dispErr(b);
      return d !== 0 ? d : (a.err - b.err);       // 표시가 같으면 실제 오차로 정렬만
    });
    var rank = 0, prev = null;
    list.forEach(function (p, i) {
      var d = dispErr(p);
      if (prev === null || d !== prev) { rank = i + 1; prev = d; }
      p.rank = rank;
    });
    return list;
  }

  /** @param {Boolean} celebrate false 면 축하 연출 없이 결과만 다시 띄운다 */
  function showFinal(celebrate) {
    phase = 'FINAL';
    renderHUD();
    renderMissions(true, true);
    renderBoard();
    elResetBtn.hidden = false;
    // 진행자가 결과를 닫았다가 다시 띄울 수 있도록 정지 버튼을 재활용한다
    elStopBtn.disabled = false;
    elStopBtn.textContent = '최종 결과 다시 보기';

    var list  = ranked();
    var medal = ['🥇', '🥈', '🥉'];
    var html  = '<div class="final-list">';

    // 꼴찌 표시는 "표시된 기록" 기준. 전원 동률이면 아무도 꼴찌가 아니다.
    var worst = list.length ? dispErr(list[list.length - 1]) : 0;
    var allTied = list.length ? (dispErr(list[0]) === worst) : true;

    list.forEach(function (p, i) {
      var last = (!allTied && dispErr(p) === worst);
      var tags = (p.missions || []).map(function (id) {
        var m = missionById(id);
        return '<span class="chip ' + (m.kind === 'hidden' ? 'chip--red' : 'chip--gold') + '">' +
               m.icon + ' ' + m.code + '</span>';
      }).join(' ');
      if (last) tags += ' <span class="chip chip--blue">9.19에서 가장 먼 기록</span>';

      html += '<div class="board__row is-done">' +
                '<span class="board__rank board__rank--medal">' + (medal[p.rank - 1] || p.rank) + '</span>' +
                '<span class="board__who">' +
                  '<span class="board__name">' + escapeHTML(p.name) + '</span>' +
                  (tags ? '<span class="board__tags">' + tags + '</span>' : '') +
                '</span>' +
                '<span class="board__score">' +
                  '<span class="board__time">' + fmt(p.ms) + '</span>' +
                  '<span class="board__err">' + (p.ms >= TARGET_MS ? '+' : '-') +
                    U.fmtNum(Math.round(p.err)) + 'ms</span>' +
                '</span>' +
              '</div>';
    });
    html += '</div>';

    var hitCount = Object.keys(revealed).length;
    if (hitCount) {
      html += '<p class="modal__note">이번 회차에 공개된 미션 ' + hitCount + '종 — 아래 미션 보드에서 확인하세요.</p>';
    }

    var winners = list.filter(function (p) { return p.rank === 1; });
    var gradeTxt = winners.length
      ? (winners.length > 1 ? '공동 1위 · ' : '') +
        winners.map(function (p) { return escapeHTML(p.name); }).join(', ') +
        ' 님이 9.19초에 가장 근접!'
      : null;

    SNM.store.saveLast(players);
    if (celebrate !== false) { SNM.ui.confetti(40); SNM.audio.sfx.clear(); }

    SNM.ui.modal({
      title: '🏁 최종 결과',
      mascot: 'happy',
      grade: gradeTxt,
      html: html,
      size: 'lg',
      dismissible: true,
      buttons: [
        { label: '같은 참가자로 다시', variant: 'primary', onClick: function () { U.after(40, restartSameRoster); } },
        { label: '참가자 변경', variant: 'ghost', onClick: function () { U.after(40, backToSetup); } }
      ]
    });
  }

  /* ───────────────────── 현황판 / 미션 보드 ───────────────────── */

  function renderBoard() {
    var html = '';
    players.forEach(function (p, i) {
      var cls = p.done ? 'is-done' : (i === turnIdx && phase !== 'SETUP' && phase !== 'FINAL' ? 'is-current' : '');
      var tags = (p.missions || []).map(function (id) {
        var m = missionById(id);
        return '<span class="chip ' + (m.kind === 'hidden' ? 'chip--red' : 'chip--gold') + '">' +
               m.icon + ' ' + m.code + '</span>';
      }).join(' ');
      if (p.timedOut) tags += ' <span class="chip">시간 초과</span>';

      html += '<li class="board__row ' + cls + '">' +
                '<span class="board__rank">' + (i + 1) + '</span>' +
                '<span class="board__who">' +
                  '<span class="board__name">' + escapeHTML(p.name) + '</span>' +
                  (tags ? '<span class="board__tags">' + tags + '</span>' : '') +
                '</span>' +
                '<span class="board__score">' +
                  (p.done
                    ? '<span class="board__time">' + fmt(p.ms) + '</span>' +
                      '<span class="board__err">' + (p.ms >= TARGET_MS ? '+' : '-') +
                        U.fmtNum(Math.round(p.err)) + 'ms</span>'
                    : '<span class="board__time board__time--wait">--.--</span>' +
                      '<span class="board__err">' + (i === turnIdx ? '진행 중' : '대기') + '</span>') +
                '</span>' +
              '</li>';
    });
    elBoardList.innerHTML = html;
  }

  /**
   * @param {Boolean} show     보드를 노출할지 (첫 적중 이후부터 노출)
   * @param {Boolean} openAll  최종 결과에서 미적중 미션까지 전부 공개
   */
  function renderMissions(show, openAll) {
    var html = '', opened = 0;
    MISSIONS.forEach(function (m) {
      var by = revealed[m.id];
      var state = by ? 'is-hit' : (openAll ? 'is-open' : '');
      if (by || openAll) opened++;
      html += '<li class="mission ' + state + '">' +
                '<span class="mission__code">' + (by || openAll ? m.icon + ' ' + m.code : '❓ ?.??') + '</span>' +
                '<span class="mission__title">' + (by || openAll ? m.title : '히든 미션') + '</span>' +
                (by ? '<span class="mission__by">' + escapeHTML(by) + ' 적중!</span>' : '') +
              '</li>';
    });
    elMissionList.innerHTML = html;
    elMissionCount.textContent = opened + ' / ' + MISSIONS.length + ' 공개';
    if (show || openAll) elMissionBoard.hidden = false;
  }

  /* ───────────────────── 참가자 설정 ───────────────────── */

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderNameInputs(names) {
    var html = '';
    names.forEach(function (n, i) {
      html += '<li class="setup__item">' +
                '<span class="setup__no">' + (i + 1) + '</span>' +
                '<input class="setup__input" type="text" maxlength="12" data-idx="' + i + '"' +
                  ' value="' + escapeHTML(n) + '" aria-label="' + (i + 1) + '번 참가자 이름">' +
                '<button class="btn setup__del" type="button" data-del="' + i + '"' +
                  ' aria-label="' + (i + 1) + '번 참가자 삭제"' + (names.length <= MIN_PLAYERS ? ' hidden' : '') + '>×</button>' +
              '</li>';
    });
    elNameList.innerHTML = html;
    elAddBtn.disabled = names.length >= MAX_PLAYERS;
  }

  function readNames() {
    return U.$$('.setup__input', elNameList).map(function (input, i) {
      var v = input.value.trim();
      return v || ('참가자 ' + (i + 1));
    });
  }

  function paintBlindMode() {
    var random = (blindMode === 'random');
    elBlindLabel.textContent = random ? '5~7초 랜덤' : '5초 고정';
    elBlindBtn.setAttribute('aria-pressed', String(random));
    var t = U.$('#setupBlindText');
    if (t) t.textContent = random ? '5~7초' : '5초';
  }

  function bindSetup() {
    elNameList.addEventListener('click', function (e) {
      var del = e.target.closest && e.target.closest('[data-del]');
      if (!del) return;
      var names = readNames();
      if (names.length <= MIN_PLAYERS) return;
      names.splice(Number(del.getAttribute('data-del')), 1);
      renderNameInputs(names);
      SNM.audio.sfx.tap();
    });

    elAddBtn.addEventListener('click', function () {
      var names = readNames();
      if (names.length >= MAX_PLAYERS) return;
      names.push('참가자 ' + (names.length + 1));
      renderNameInputs(names);
      SNM.audio.sfx.tap();
      var inputs = U.$$('.setup__input', elNameList);
      inputs[inputs.length - 1].focus();
    });

    elBlindBtn.addEventListener('click', function () {
      blindMode = (blindMode === 'random') ? 'fixed' : 'random';
      SNM.store.setSetting('blindMode', blindMode);
      paintBlindMode();
      SNM.audio.sfx.tap();
    });
  }

  /* ───────────────────── 세션 시작 / 초기화 ───────────────────── */

  function startSession() {
    var names = readNames();
    SNM.store.setSetting('names', names);

    players = names.map(function (n) {
      return { name: n, ms: null, err: null, missions: [], done: false, timedOut: false, voided: false };
    });
    turnIdx  = 0;
    revealed = {};
    elMissionBoard.hidden = true;
    elResetBtn.hidden = false;
    renderMissions(false);
    renderBoard();
    SNM.audio.sfx.tap();
    showReady();
  }

  function restartSameRoster() {
    players.forEach(function (p) {
      p.ms = null; p.err = null; p.missions = []; p.done = false; p.timedOut = false;
    });
    turnIdx  = 0;
    revealed = {};
    elMissionBoard.hidden = true;
    renderMissions(false);
    renderBoard();
    showReady();
  }

  function backToSetup() {
    phase = 'SETUP';
    if (gameLoop) { gameLoop.stop(); gameLoop = null; }
    if (cdHandle) { cdHandle.cancel(); cdHandle = null; }
    resetCurtain();
    elReady.hidden = true;
    elSetup.hidden = false;
    elResetBtn.hidden = true;
    elMissionBoard.hidden = true;
    elStopBtn.disabled = true;
    elStopBtn.textContent = '정 지';
    elPlate.classList.remove('is-half', 'is-blind', 'is-hit', 'is-spinning');
    setBig('00.00');
    setSeg('대기 중');
    setAngle(0);
    renderNameInputs(players.length ? players.map(function (p) { return p.name; })
                                    : SNM.store.getSetting('names'));
    players = [];
    turnIdx = 0;
    revealed = {};
    renderBoard();
    renderHUD();
    setHint('참가자 이름을 확인하고 <b>[게임 시작]</b>을 누르세요.');
  }

  /* ───────────────────────── 입력 ───────────────────────── */

  /* ★ 정지 시각은 이벤트 핸들러 안에서 가장 먼저 읽는다. */
  function onStopInput(e) {
    if (phase !== 'RUN') return;
    var now = performance.now();            // ← 어떤 처리보다 먼저 캡처
    if (now - runStartAt < LOCK_MS) return;                 // 시작 직후 오입력 방지
    if (e && e.preventDefault) e.preventDefault();
    stopMs = now - runStartAt;
    if (forcedMs != null) { stopMs = forcedMs; forcedMs = null; paintDev(); }
    doStop(false);
  }

  function isEnterOrSpace(e) {
    return e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar';
  }

  function bindInput() {
    // 스테이지 전체가 정지 버튼
    U.onTap(elStage, function (e) { if (phase === 'RUN') onStopInput(e); });
    U.onTap(elStopBtn, function (e) {
      if (phase === 'FINAL') { SNM.audio.sfx.tap(); showFinal(false); return; }
      onStopInput(e);
    });
    U.onTap(elStartBtn, function (e) {
      if (e && e.preventDefault) e.preventDefault();
      startSession();
    });
    U.onTap(elReadyBtn, function (e) {
      if (e && e.preventDefault) e.preventDefault();
      SNM.audio.sfx.tap();
      startTurn();
    });
    elResetBtn.addEventListener('click', function () {
      SNM.ui.confirm({
        title: '처음부터 진행할까요?',
        message: '현재 기록과 공개된 미션이 모두 초기화됩니다.',
        yes: '초기화', danger: true
      }, backToSetup);
    });

    document.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (!isEnterOrSpace(e)) return;
      if (SNM.ui.isOpen()) return;                      // 모달은 자체 버튼이 처리
      var ae  = document.activeElement;
      var tag = ae && ae.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'A') return;
      e.preventDefault();
      if (phase === 'RUN') onStopInput(e);
      else if (phase === 'READY') { SNM.audio.sfx.tap(); startTurn(); }
      else if (phase === 'SETUP') startSession();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) voidTurn();
    });
  }

  /* ───────────────────── 리허설 패널 (테스트 모드 전용) ───────────────────── */

  function paintDev() {
    var st = document.getElementById('devState');
    if (!st) return;
    st.textContent = (forcedMs == null) ? '해제됨' : ('예약 ' + fmt(forcedMs));
    st.classList.toggle('is-armed', forcedMs != null);
  }

  /** 다음 정지에 기록될 값을 예약한다 (연출은 실제 플레이와 완전히 동일) */
  function devArm(ms) {
    forcedMs = ms;
    paintDev();
    SNM.ui.toast('다음 정지를 <b>' + fmt(ms) + '초</b>로 기록합니다', 2200);
  }

  function devStopNow() {
    if (phase !== 'RUN') { SNM.ui.toast('계측 중일 때만 사용할 수 있어요', 1600); return; }
    stopMs = (forcedMs != null) ? forcedMs : (performance.now() - runStartAt);
    forcedMs = null;
    paintDev();
    doStop(false);
  }

  function buildDevBar() {
    var bar = U.el('div', 'devbar');
    var html = '<span class="devbar__tag">🧪 리허설 모드</span>';
    MISSIONS.forEach(function (m) {
      html += '<button class="devbar__btn" type="button" data-ms="' + (m.cs * 10) + '">' +
              m.icon + ' ' + m.code + '</button>';
    });
    html += '<button class="devbar__btn" type="button" data-ms="9250">9.25 (근접)</button>' +
            '<button class="devbar__btn" type="button" data-ms="8190">8.19 (끝자리 19)</button>' +
            '<input class="devbar__input" id="devMs" type="text" inputmode="decimal"' +
              ' placeholder="9.19" aria-label="직접 입력할 정지 값(초)">' +
            '<button class="devbar__btn" type="button" id="devArm">입력값 예약</button>' +
            '<button class="devbar__btn devbar__btn--go" type="button" id="devStop">⏹ 즉시 정지</button>' +
            '<button class="devbar__btn" type="button" id="devClear">해제</button>' +
            '<span class="devbar__state" id="devState">해제됨</span>';
    bar.innerHTML = html;

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('button');
      if (!btn) return;
      SNM.audio.sfx.tap();
      if (btn.id === 'devStop')  { devStopNow(); return; }
      if (btn.id === 'devClear') { forcedMs = null; paintDev(); return; }
      if (btn.id === 'devArm') {
        var v = parseFloat(U.$('#devMs', bar).value.replace(',', '.'));
        if (isNaN(v) || v < 0 || v > 60) { SNM.ui.toast('0~60 사이의 초를 입력하세요', 1800); return; }
        devArm(Math.round(v * 1000));
        return;
      }
      var ms = btn.getAttribute('data-ms');
      if (ms) devArm(Number(ms));
    });

    // 패널의 Enter/Space 가 정지 입력으로 새어나가지 않도록 차단
    bar.addEventListener('keydown', function (e) { e.stopPropagation(); });

    U.$('.game-shell__body').appendChild(bar);
    paintDev();
  }

  /* ───────────────────────── 초기화 ───────────────────────── */

  function init() {
    if (!U.$('#stage')) return;      // 규칙 검증 페이지(test.html) 등에서는 UI 를 붙이지 않는다
    SNM.ui.mountHeader('성남 9.19 룰렛');

    elStage        = U.$('#stage');
    elRotor        = U.$('#wheelRotor');
    elPlate        = U.$('#plate');
    elBig          = U.$('#bigTime');
    elSegLabel     = U.$('#segLabel');
    elPlateMascot  = U.$('#plateMascot');
    elCurtain      = U.$('#curtain');
    elHudTurn      = U.$('#hudTurn');
    elHudName      = U.$('#hudName');
    elHint         = U.$('#hint');
    elLive         = U.$('#live');
    elSetup        = U.$('#setupOverlay');
    elReady        = U.$('#readyOverlay');
    elReadyTurn    = U.$('#readyTurn');
    elReadyName    = U.$('#readyName');
    elNameList     = U.$('#nameList');
    elAddBtn       = U.$('#addPlayerBtn');
    elBlindBtn     = U.$('#blindModeBtn');
    elBlindLabel   = U.$('#blindModeLabel');
    elStartBtn     = U.$('#startBtn');
    elReadyBtn     = U.$('#readyBtn');
    elStopBtn      = U.$('#stopBtn');
    elBoardList    = U.$('#boardList');
    elResetBtn     = U.$('#resetBtn');
    elMissionBoard = U.$('#missionBoard');
    elMissionList  = U.$('#missionList');
    elMissionCount = U.$('#missionCount');

    elRotor.innerHTML = buildWheelSVG();
    SNM.mascot.mount(elPlateMascot, 'default', 34, { idle: false });
    SNM.mascot.mount(U.$('#setupMascot'), 'happy', 92, { idle: true, label: '성나미' });
    SNM.mascot.mount(U.$('#readyMascot'), 'surprised', 104, { idle: true, label: '성나미' });
    SNM.mascot.mount(U.$('#curtainMascot'), 'surprised', 74, { idle: false });

    var s = SNM.store.getSettings();
    blindMode = (s.blindMode === 'fixed') ? 'fixed' : 'random';
    paintBlindMode();
    renderNameInputs(Array.isArray(s.names) && s.names.length ? s.names : ['참가자 1', '참가자 2', '참가자 3']);
    renderMissions(false);
    renderBoard();
    renderHUD();
    setAngle(0);

    bindSetup();
    bindInput();
    if (TEST) buildDevBar();
  }

  /* 판정 규칙 공개 — test.html 이 사본이 아니라 실제 구현을 검증한다 */
  SNM.rules = {
    TARGET_MS: TARGET_MS, SEG_MS: SEG_MS, AUTO_STOP: AUTO_STOP,
    MISSIONS: MISSIONS, SEGMENTS: SEGMENTS,
    centi: centi, fmt: fmt, fmt3: fmt3,
    evalMissions: evalMissions, segAt: segAt, missionById: missionById
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
