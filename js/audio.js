/* 打字爆破 · 音效层（阶段 4）
   TB.Audio：WebAudio 全合成音效 + speechSynthesis 单词朗读 + 声音总开关 */
(function () {
  'use strict';
  window.TB = window.TB || {};

  let ctx = null;      // AudioContext（懒创建）
  let master = null;   // 总增益
  let noiseBuf = null; // 复用的白噪声缓冲
  let voices = [];     // 可用语音列表
  let speechQueued = 0;

  /* ---------- localStorage 工具 ---------- */
  function lsGet(k, d) {
    try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* 存储不可用时静默降级 */ }
  }

  /* ---------- AudioContext 懒创建 ---------- */
  function ensureCtx() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      /* 预生成 1 秒白噪声，所有噪声音色复用 */
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 音色原件 ---------- */
  function tone(t0, freq, dur, opts) {
    opts = opts || {};
    const osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type;
      f.frequency.value = opts.filter.freq;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /* 柔和起音（回血用） */
  function softTone(t0, freq, dur, gain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(t0, dur, opts) {
    opts = opts || {};
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    let node = src;
    if (opts.hp) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = opts.hp;
      node.connect(f);
      node = f;
    }
    if (opts.lpStart) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(opts.lpStart, t0);
      f.frequency.exponentialRampToValueAtTime(opts.lpEnd, t0 + dur);
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    g.connect(master);
    /* 随机起点避免每次同一段噪声 */
    const offset = Math.random() * 0.5;
    src.start(t0, offset, dur + 0.02);
  }

  /* ---------- 统一播放入口 ---------- */
  function play(name, params) {
    if (isMuted()) return;
    if (!ensureCtx()) return;
    const t = ctx.currentTime + 0.001;
    params = params || {};
    switch (name) {
      case 'key':
        noise(t, 0.012, { gain: 0.12, hp: 3000 });
        break;
      case 'hit':
        tone(t, 660, 0.04, { gain: 0.15 });
        break;
      case 'wrong':
        tone(t, 110, 0.09, { type: 'square', gain: 0.12, filter: { type: 'lowpass', freq: 400 } });
        break;
      case 'explode': {
        const tier = params.tier || 0;
        noise(t, 0.18, { gain: 0.22 + tier * 0.1, lpStart: 3000, lpEnd: 200 });
        tone(t, 55, 0.15, { gain: 0.2 + tier * 0.08 });
        break;
      }
      case 'hurt':
        tone(t, 440, 0.09, { gain: 0.2 });
        tone(t + 0.1, 220, 0.1, { gain: 0.2 });
        break;
      case 'heal':
        softTone(t, 660, 0.09, 0.16);
        softTone(t + 0.09, 880, 0.09, 0.16);
        break;
      case 'over':
        tone(t, 330, 0.6, { type: 'sawtooth', gain: 0.15, slideTo: 82 });
        break;
      case 'milestone':
        [523, 659, 784].forEach((f, i) => tone(t + i * 0.11, f, 0.12, { gain: 0.14 }));
        break;
      case 'firework':
        for (let i = 0; i < 5; i++) {
          noise(t + i * 0.05, 0.05, { gain: 0.12, hp: 1200 });
          tone(t + i * 0.05, 1500 + i * 250, 0.08, { gain: 0.05 });
        }
        break;
    }
  }

  /* ---------- 单词朗读（speechSynthesis 本地语音） ---------- */
  function pickVoice(lang) {
    const prefix = lang.slice(0, 2).toLowerCase();
    const list = voices.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().indexOf(prefix) === 0);
    return list.find(v => v.localService) || list[0] || null;
  }

  function speak(text, lang) {
    if (isMuted()) return;
    if (!('speechSynthesis' in window) || !text) return;
    /* 待播积压 ≥ 3 条：清空队列，防止越拖越远 */
    if (speechQueued >= 3) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
      speechQueued = 0;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = lang === 'en-US' ? 0.9 : 1.0;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      const done = () => { speechQueued = Math.max(0, speechQueued - 1); };
      u.onend = done;
      u.onerror = done;
      speechQueued++;
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* 环境不支持时静默跳过 */
    }
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    }
    speechQueued = 0;
  }

  if ('speechSynthesis' in window) {
    try {
      voices = window.speechSynthesis.getVoices() || [];
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices() || [];
      };
    } catch (e) {
      voices = [];
    }
  }

  /* ---------- 声音总开关 / 朗读设置 ---------- */
  function isMuted() { return lsGet('TB_MUTED', '0') === '1'; }
  function setMuted(m) {
    lsSet('TB_MUTED', m ? '1' : '0');
    if (m) stopSpeech();
  }
  function toggleMute() {
    setMuted(!isMuted());
    return isMuted();
  }
  function getReading() {
    const v = lsGet('TB_READING', 'en');
    return ['en', 'zh', 'off'].indexOf(v) >= 0 ? v : 'en';
  }
  function setReading(v) {
    if (['en', 'zh', 'off'].indexOf(v) >= 0) lsSet('TB_READING', v);
  }

  TB.Audio = {
    play: play,
    speak: speak,
    unlock: function () { ensureCtx(); },
    stopSpeech: stopSpeech,
    isMuted: isMuted,
    setMuted: setMuted,
    toggleMute: toggleMute,
    getReading: getReading,
    setReading: setReading
  };
})();
