/* ============================================================
   SNM.ui — 모달 / 토스트 / 카운트다운 / 컨페티 / 헤더
   허브가 없는 단독 프로젝트이므로 gameOver·뱃지 헬퍼는 제외.
   대신 무대 진행용 전체화면 토글을 헤더에 추가한다.
   ============================================================ */
window.SNM = window.SNM || {};

SNM.ui = (function () {
  'use strict';

  var U = SNM.util;
  var openModalEl = null, lastFocused = null, keyTrapHandler = null;

  /* ─────────────── 모달 ─────────────── */
  /**
   * @param {Object} o
   *   title, mascot('default'|'happy'|'sad'|'surprised'|null),
   *   grade, headline, rows:[[label,value],...], chips:[{label,variant}],
   *   note, html(추가 마크업), buttons:[{label,variant,onClick,keepOpen}],
   *   size('lg'), dismissible
   * @returns {{close:Function, el:Element}}
   */
  function modal(o) {
    o = o || {};
    close(); // 중복 방지

    lastFocused = document.activeElement;

    var backdrop = U.el('div', 'modal-backdrop');
    var panel = U.el('div', 'modal' + (o.size === 'lg' ? ' modal--lg' : ''));
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    var titleId = 'modalTitle_' + Date.now();
    var html = '';

    if (o.mascot) html += '<div class="modal__mascot">' + SNM.mascot.svg(o.mascot, 130) + '</div>';
    if (o.title)  html += '<h2 class="modal__title" id="' + titleId + '">' + o.title + '</h2>';
    if (o.grade)  html += '<div class="modal__grade">' + o.grade + '</div>';
    if (o.headline) html += '<div class="modal__headline num">' + o.headline + '</div>';
    if (o.chips && o.chips.length) {
      html += '<div class="modal__badges">';
      o.chips.forEach(function (c, i) {
        html += '<span class="modal__badge" style="animation-delay:' + (i * 90 + 200) + 'ms">' +
                c.label + '</span>';
      });
      html += '</div>';
    }
    if (o.rows && o.rows.length) {
      html += '<div class="modal__rows">';
      o.rows.forEach(function (r) {
        html += '<div class="modal__row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
      });
      html += '</div>';
    }
    if (o.html) html += o.html;
    if (o.note) html += '<p class="modal__note">' + o.note + '</p>';

    html += '<div class="modal__buttons"></div>';
    panel.innerHTML = html;
    if (o.title) panel.setAttribute('aria-labelledby', titleId);

    // 버튼 생성
    var btnWrap = panel.querySelector('.modal__buttons');
    (o.buttons || [{ label: '확인', variant: 'primary' }]).forEach(function (b) {
      var node = U.el('button', 'btn btn--' + (b.variant || 'ghost'), b.label);
      node.type = 'button';
      node.addEventListener('click', function (e) {
        SNM.audio.sfx.tap();
        if (b.onClick) b.onClick(e);
        if (b.keepOpen !== true) close();
      });
      btnWrap.appendChild(node);
    });

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    openModalEl = backdrop;

    // 포커스 트랩
    var focusables = panel.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
    if (focusables.length) focusables[0].focus();

    keyTrapHandler = function (e) {
      if (e.key === 'Escape' && o.dismissible) { close(); return; }
      if (e.key !== 'Tab' || !focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyTrapHandler);

    if (o.dismissible) {
      backdrop.addEventListener('pointerdown', function (e) { if (e.target === backdrop) close(); });
    }

    return { close: close, el: panel };
  }

  function close() {
    if (!openModalEl) return;
    openModalEl.remove();
    openModalEl = null;
    if (keyTrapHandler) { document.removeEventListener('keydown', keyTrapHandler); keyTrapHandler = null; }
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
    lastFocused = null;
  }

  function isOpen() { return !!openModalEl; }

  /** 확인 모달 (콜백 방식) */
  function confirm(opts, onYes) {
    return modal({
      title: opts.title || '확인',
      mascot: Object.prototype.hasOwnProperty.call(opts, 'mascot') ? opts.mascot : 'surprised',
      note: opts.message,
      dismissible: true,
      buttons: [
        { label: opts.yes || '확인', variant: opts.danger ? 'danger' : 'primary', onClick: onYes },
        { label: opts.no || '취소', variant: 'ghost' }
      ]
    });
  }

  /* ─────────────── 토스트 ─────────────── */
  var toastWrap = null;
  function toast(msg, ms) {
    ms = ms || 1800;
    if (!toastWrap) {
      toastWrap = U.el('div', 'toast-wrap');
      toastWrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastWrap);
    }
    var t = U.el('div', 'toast', msg);
    toastWrap.appendChild(t);
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { t.remove(); }, 260);
    }, ms);
  }

  /* ─────────────── 카운트다운 ─────────────── */
  /** 3 → 2 → 1 → 시작! 후 cb 호출. container 는 position:relative 여야 함 */
  function countdown(container, cb) {
    if (!container) { if (cb) cb(); return null; }
    var overlay = U.el('div', 'countdown');
    var num = U.el('div', 'countdown__num');
    overlay.appendChild(num);
    overlay.setAttribute('aria-live', 'assertive');
    container.appendChild(overlay);

    var steps = ['3', '2', '1', '시작!'], i = 0, timer = 0, cancelled = false;
    function tick() {
      if (cancelled) return;
      if (i >= steps.length) {
        overlay.remove();
        if (cb) cb();
        return;
      }
      num.textContent = steps[i];
      num.style.animation = 'none';
      void num.offsetWidth;
      num.style.animation = '';
      if (i === steps.length - 1) { SNM.audio.sfx.start(); num.style.fontSize = '56px'; }
      else SNM.audio.sfx.tick();
      i++;
      timer = setTimeout(tick, 700);
    }
    tick();
    return { cancel: function () { cancelled = true; clearTimeout(timer); overlay.remove(); } };
  }

  /* ─────────────── 컨페티 ─────────────── */
  function confetti(n) {
    if (U.reduceMotion()) return;
    n = n || 24;
    var wrap = U.el('div', 'confetti-wrap');
    var colors = ['#FF97B0', '#FFC94B', '#7FDCC2', '#8FCBF2', '#B6A8F0', '#FFB392'];
    for (var i = 0; i < n; i++) {
      var c = U.el('i', 'confetti');
      c.style.left = U.rand(0, 100).toFixed(1) + '%';
      c.style.background = U.pick(colors);
      c.style.animationDuration = U.rand(1.3, 2.2).toFixed(2) + 's';
      c.style.animationDelay = U.rand(0, 0.45).toFixed(2) + 's';
      c.style.transform = 'rotate(' + U.randInt(0, 360) + 'deg)';
      wrap.appendChild(c);
    }
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 2900);
  }

  /* ─────────────── 전체화면 ─────────────── */
  function fullscreenSupported() {
    var d = document.documentElement;
    return !!(d.requestFullscreen || d.webkitRequestFullscreen);
  }
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function toggleFullscreen() {
    var d = document.documentElement;
    try {
      if (isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        (d.requestFullscreen || d.webkitRequestFullscreen).call(d);
      }
    } catch (e) { /* iOS Safari 등 미지원 — 조용히 무시 */ }
  }

  /* ─────────────── 헤더 ─────────────── */
  function headerHTML(title) {
    return '' +
      '<header class="app-header"><div class="container app-header__inner">' +
        '<span class="app-header__brand">' +
          '<img class="app-header__ci" src="./assets/seongnam-ci.svg" alt="성남시">' +
          '<span>' + (title || '청년의 날 9.19 타이밍 챌린지') + '</span>' +
        '</span>' +
        '<div class="app-header__spacer"></div>' +
        '<div class="app-header__actions">' +
          '<button class="btn btn--icon" id="snmFullBtn" type="button" aria-pressed="false" aria-label="전체화면" title="전체화면">⛶</button>' +
          '<button class="btn btn--icon" id="snmSoundBtn" type="button" aria-pressed="true" aria-label="소리 끄기" title="소리">🔊</button>' +
        '</div>' +
      '</div></header>';
  }

  function bindHeaderButtons() {
    var sound = document.getElementById('snmSoundBtn');
    if (sound) {
      var paint = function () {
        var on = !!SNM.store.getSetting('sound');
        sound.textContent = on ? '🔊' : '🔇';
        sound.setAttribute('aria-pressed', String(on));
        sound.setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기');
      };
      paint();
      sound.addEventListener('click', function () {
        var next = !SNM.store.getSetting('sound');
        SNM.store.setSetting('sound', next);
        paint();
        if (next) SNM.audio.sfx.tap();
      });
    }

    var full = document.getElementById('snmFullBtn');
    if (full) {
      if (!fullscreenSupported()) { full.hidden = true; return; }
      var paintFull = function () {
        var on = isFullscreen();
        full.textContent = on ? '⤡' : '⛶';
        full.setAttribute('aria-pressed', String(on));
        full.setAttribute('aria-label', on ? '전체화면 끄기' : '전체화면');
      };
      paintFull();
      full.addEventListener('click', function () { toggleFullscreen(); });
      document.addEventListener('fullscreenchange', paintFull);
      document.addEventListener('webkitfullscreenchange', paintFull);
    }
  }

  function mountHeader(title) {
    var holder = document.getElementById('appHeader');
    if (holder) holder.outerHTML = headerHTML(title);
    else document.body.insertAdjacentHTML('afterbegin', headerHTML(title));
    bindHeaderButtons();
  }

  return {
    modal: modal, close: close, isOpen: isOpen, confirm: confirm,
    toast: toast, countdown: countdown, confetti: confetti,
    mountHeader: mountHeader, toggleFullscreen: toggleFullscreen
  };
})();
