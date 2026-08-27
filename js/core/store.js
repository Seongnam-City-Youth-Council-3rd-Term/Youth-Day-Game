/* ============================================================
   SNM.store — 9.19 룰렛 전용 슬림 스토리지
   키: snm919_v1_settings / snm919_v1_last
   허브(성남 미니게임 랜드)의 점수·뱃지 스키마는 사용하지 않는다.
   이 프로젝트는 무대 진행용 단독 게임이므로 "설정 + 직전 세션" 만 남긴다.
   ============================================================ */
window.SNM = window.SNM || {};

SNM.store = (function () {
  'use strict';

  var K_SETTINGS = 'snm919_v1_settings';
  var K_LAST     = 'snm919_v1_last';

  var MEM = {};            // localStorage 실패 시 메모리 폴백
  var storageOK = true;

  function safeGet(k) {
    try {
      var raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      storageOK = false;
      return MEM[k] || null;
    }
  }

  function safeSet(k, v) {
    MEM[k] = v;
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      storageOK = false;
      return false;
    }
  }

  function defaultSettings() {
    return {
      schema: 1,
      sound: true,
      blindMode: 'random',        // 'random' = 5~7초 랜덤 / 'fixed' = 5초 고정
      names: ['참가자 1', '참가자 2', '참가자 3']
    };
  }

  /** 저장된 값으로 기본 스키마의 누락 필드를 보정 */
  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    Object.keys(saved).forEach(function (k) { base[k] = saved[k]; });
    return base;
  }

  function getSettings() { return merge(defaultSettings(), safeGet(K_SETTINGS)); }
  function saveSettings(s) { return safeSet(K_SETTINGS, s); }

  function getSetting(k) { return getSettings()[k]; }

  function setSetting(k, v) {
    var s = getSettings();
    s[k] = v;
    saveSettings(s);
    if (k === 'sound' && SNM.audio && SNM.audio.setEnabled) SNM.audio.setEnabled(!!v);
    return v;
  }

  /** 직전 세션 결과 (진행자가 새로고침해도 명단이 남도록) */
  function getLast() { return safeGet(K_LAST); }
  function saveLast(session) {
    return safeSet(K_LAST, {
      at: Date.now(),
      players: (session || []).map(function (p) {
        return { name: p.name, ms: p.ms, err: p.err, missions: p.missions || [] };
      })
    });
  }
  function clearLast() {
    try { localStorage.removeItem(K_LAST); } catch (e) { /* noop */ }
    delete MEM[K_LAST];
  }

  function isPersistent() {
    try {
      var t = '__snm919_probe__';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return storageOK;
    } catch (e) { return false; }
  }

  return {
    getSettings: getSettings, saveSettings: saveSettings,
    getSetting: getSetting, setSetting: setSetting,
    getLast: getLast, saveLast: saveLast, clearLast: clearLast,
    isPersistent: isPersistent
  };
})();
