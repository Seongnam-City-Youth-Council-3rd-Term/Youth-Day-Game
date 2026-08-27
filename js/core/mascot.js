/* ============================================================
   SNM.mascot — 성나미 SVG 생성기
   성남시 캐릭터 원화의 노란 후드·케이프·별 브로치를 살린 성나미.
   viewBox 0 0 200 200 고정.
   ============================================================ */
window.SNM = window.SNM || {};

SNM.mascot = (function () {
  'use strict';

  var GOLD = '#F7C928', GOLD_D = '#D7A91C', GOLD_L = '#FFE36A';
  var BLUE = '#005BAC', RED = '#DF003C';
  var INK = '#1A2027', LINE = '#E1E6ED', BLUSH = '#FF9BB3';

  /** 5각 별 path 생성 */
  function star(cx, cy, size, fill, opacity) {
    var pts = [], i, ang, r;
    for (i = 0; i < 10; i++) {
      ang = (Math.PI / 5) * i - Math.PI / 2;
      r = (i % 2 === 0) ? size : size * 0.42;
      pts.push((cx + Math.cos(ang) * r).toFixed(1) + ',' + (cy + Math.sin(ang) * r).toFixed(1));
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '"' +
           (opacity != null ? ' opacity="' + opacity + '"' : '') + '/>';
  }

  /* ── 원화의 둥근 노란 후드 + 정수리 3줄 장식 ── */
  function crown() {
    return '' +
      '<g class="nami-crown" stroke="#343434" stroke-width="2.4" stroke-linejoin="round">' +
        '<path d="M52 92 Q49 62 61 39 Q75 15 100 14 Q125 15 139 39 Q151 62 148 92 L130 110 Q100 101 70 110 Z" fill="' + GOLD_L + '"/>' +
        '<path d="M92 23 L92 49" stroke="' + GOLD_D + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M100 19 L100 48" stroke="' + GOLD_D + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M108 23 L108 49" stroke="' + GOLD_D + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M69 76 Q70 50 100 48 Q130 50 131 76 Q131 103 100 106 Q69 103 69 76 Z" fill="#FFFFFF"/>' +
      '</g>';
  }

  /* ── 몸통 + 손 + 발 (표정 제외) ── */
  function bodyParts(handsUp) {
    var lh = handsUp ? 'translate(49,94) rotate(-24)' : 'translate(45,121) rotate(-42)';
    var rh = handsUp ? 'translate(151,94) rotate(24)' : 'translate(155,121) rotate(42)';
    return '' +
      // 팔은 원화처럼 머리 옆에서 크게 벌어진 흰색 곡선
      '<g class="nami-hand nami-hand--l" transform="' + lh + '">' +
        '<path d="M3 28 Q-10 16 -12 -9 Q-13 -25 -4 -29 Q7 -32 12 -18 L18 13 Z" fill="#FFFFFF" stroke="#343434" stroke-width="2.5"/></g>' +
      '<g class="nami-hand nami-hand--r" transform="' + rh + '">' +
        '<path d="M-3 28 Q10 16 12 -9 Q13 -25 4 -29 Q-7 -32 -12 -18 L-18 13 Z" fill="#FFFFFF" stroke="#343434" stroke-width="2.5"/></g>' +
      // 한 덩어리처럼 둥글고 짧은 몸과 발
      '<path d="M69 111 Q57 123 57 145 L53 166 Q50 178 62 181 L80 177 Q100 175 120 177 L138 181 Q150 178 147 166 L143 145 Q143 123 131 111 Q116 101 100 102 Q84 101 69 111 Z" fill="#FFFFFF" stroke="#343434" stroke-width="2.7" stroke-linejoin="round"/>' +
      // 노란 케이프와 중앙 별 브로치
      '<path d="M100 108 Q84 97 70 110 L66 134 Q82 130 98 116 Z" fill="' + GOLD_L + '" stroke="#343434" stroke-width="2.4"/>' +
      '<path d="M100 108 Q116 97 130 110 L134 134 Q118 130 102 116 Z" fill="' + GOLD_L + '" stroke="#343434" stroke-width="2.4"/>' +
      star(100, 108, 8, GOLD);
  }

  /* ── 표정 4종 (눈 + 입 + 부가효과) ── */
  var FACES = {
    'default': function () {
      return '' +
        '<path d="M77 76 L84 80 L77 83" stroke="' + INK + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
        '<path d="M123 76 L116 80 L123 83" stroke="' + INK + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="68" cy="91" rx="8" ry="4" fill="' + BLUSH + '" opacity=".65"/>' +
        '<ellipse cx="132" cy="91" rx="8" ry="4" fill="' + BLUSH + '" opacity=".65"/>' +
        '<path d="M94 87 Q100 99 106 87 Z" fill="' + RED + '" stroke="' + INK + '" stroke-width="2.5"/>';
    },
    'happy': function () {
      return '' +
        '<path d="M75 80 Q81 73 87 80" stroke="' + INK + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
        '<path d="M113 80 Q119 73 125 80" stroke="' + INK + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="68" cy="91" rx="8" ry="4" fill="' + BLUSH + '"/>' +
        '<ellipse cx="132" cy="91" rx="8" ry="4" fill="' + BLUSH + '"/>' +
        '<path d="M92 86 Q100 101 108 86 Z" fill="' + RED + '" stroke="' + INK + '" stroke-width="2.5"/>' +
        star(46, 44, 7, GOLD_L) + star(158, 32, 6, GOLD_L) + star(172, 96, 5, GOLD_L);
    },
    'sad': function () {
      return '' +
        '<path d="M74 73 L87 78" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M126 73 L113 78" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="82" cy="82" r="4.5" fill="' + INK + '"/><circle cx="118" cy="82" r="4.5" fill="' + INK + '"/>' +
        '<ellipse cx="69" cy="92" rx="8" ry="4" fill="' + BLUSH + '" opacity=".55"/><ellipse cx="131" cy="92" rx="8" ry="4" fill="' + BLUSH + '" opacity=".55"/>' +
        '<path d="M94 96 Q100 89 106 96" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<path d="M77 87 Q73 96 77 100 Q82 97 80 89 Z" fill="#4D96D6"/>';
    },
    'surprised': function () {
      return '' +
        '<circle cx="82" cy="80" r="7" fill="#FFFFFF" stroke="' + INK + '" stroke-width="2.5"/><circle cx="118" cy="80" r="7" fill="#FFFFFF" stroke="' + INK + '" stroke-width="2.5"/>' +
        '<circle cx="82" cy="81" r="3.5" fill="' + INK + '"/><circle cx="118" cy="81" r="3.5" fill="' + INK + '"/>' +
        '<ellipse cx="69" cy="92" rx="8" ry="4" fill="' + BLUSH + '" opacity=".8"/><ellipse cx="131" cy="92" rx="8" ry="4" fill="' + BLUSH + '" opacity=".8"/>' +
        '<ellipse cx="100" cy="95" rx="6" ry="8" fill="' + INK + '"/>' +
        '<text x="152" y="30" font-size="30" font-weight="800" fill="' + RED + '" font-family="sans-serif">!</text>';
    }
  };

  function faceOf(expr) {
    return (FACES[expr] || FACES['default'])();
  }

  /**
   * @param {String} expression 'default'|'happy'|'sad'|'surprised'
   * @param {Number} size       px (정사각)
   * @param {Object} opts       { idle:Boolean, cls:String, label:String }
   * @returns {String} SVG 마크업
   */
  function svg(expression, size, opts) {
    expression = expression || 'default';
    size = size || 200;
    opts = opts || {};
    var handsUp = (expression === 'surprised');
    var idleCls = (opts.idle && !SNM.util.reduceMotion()) ? ' nami-idle' : '';
    var a11y = opts.label
      ? ' role="img" aria-label="' + opts.label + '"'
      : ' aria-hidden="true" focusable="false"';

    return '<svg class="nami ' + (opts.cls || '') + '" viewBox="0 0 200 200" width="' + size + '" height="' + size + '"' +
             ' xmlns="http://www.w3.org/2000/svg"' + a11y + ' data-expr="' + expression + '">' +
             '<g class="nami-root' + idleCls + '">' +
               crown() +
               '<g class="nami-body">' + bodyParts(handsUp) + '</g>' +
               '<g class="nami-face">' + faceOf(expression) + '</g>' +
             '</g>' +
           '</svg>';
  }

  /**
   * 이미 삽입된 성나미의 표정만 교체 (몸통 리렌더 없음).
   * @param {Element} rootEl  svg.nami 또는 그 조상 요소
   */
  function setExpression(rootEl, expression) {
    if (!rootEl) return;
    var svgEl = rootEl.matches && rootEl.matches('svg.nami') ? rootEl : rootEl.querySelector('svg.nami');
    if (!svgEl) return;
    if (svgEl.getAttribute('data-expr') === expression) return;

    var face = svgEl.querySelector('.nami-face');
    if (face) face.innerHTML = faceOf(expression);

    // 놀람 표정은 손을 위로
    var up = (expression === 'surprised');
    var l = svgEl.querySelector('.nami-hand--l'), r = svgEl.querySelector('.nami-hand--r');
    if (l) l.setAttribute('transform', up ? 'translate(49,94) rotate(-24)' : 'translate(45,121) rotate(-42)');
    if (r) r.setAttribute('transform', up ? 'translate(151,94) rotate(24)' : 'translate(155,121) rotate(42)');

    svgEl.setAttribute('data-expr', expression);

    // 팝 연출
    var root = svgEl.querySelector('.nami-root');
    if (root && !SNM.util.reduceMotion()) {
      root.classList.remove('nami-pop');
      void root.offsetWidth;
      root.classList.add('nami-pop');
    }
  }

  /** 컨테이너에 성나미를 렌더 후 svg 요소 반환 */
  function mount(container, expression, size, opts) {
    if (!container) return null;
    container.innerHTML = svg(expression, size, opts);
    return container.querySelector('svg.nami');
  }

  return { svg: svg, setExpression: setExpression, mount: mount, star: star };
})();
