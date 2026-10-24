/* 打字爆破 · 游戏主循环（阶段 3 核心 + 阶段 5 收尾）
   TB.Screens：屏幕切换
   TB.Game：状态机、实体、输入锁定、计分、结算、暂停、彩蛋、编辑器接线 */
(function () {
  'use strict';
  window.TB = window.TB || {};

  const FONT_MAIN = '600 20px "Segoe UI", "Microsoft YaHei", sans-serif';
  const FONT_SUB = '13px Consolas, "Courier New", monospace';

  /* ==================== 屏幕切换 ==================== */
  const Screens = TB.Screens = {
    current: 'menu',
    show(name) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const el = document.getElementById('screen-' + name);
      if (el) el.classList.add('active');
      this.current = name;
      if (name !== 'game') Game.onLeaveGame();
      if (name === 'menu') refreshMenu();
      if (name === 'editor') renderEditor();
    }
  };

  /* ==================== 游戏本体 ==================== */
  const Game = TB.Game = {
    HP_MAX: 20,
    EASTER: ['下班', '放假', '发工资', '下课'],
    CLICK_BLAST: 10, /* 连点爆破：同一词条累计点击次数 */
    FLAVOR: [
      '这班就上到这儿了。',
      '词是会消失的，班是不会的。',
      '深呼吸，下班再说。',
      '今日份心态：已清空。',
      '至少词爆得挺好看的。',
      '打字速度 +1，血压暂时 -1。'
    ],
    state: 'MENU',            // MENU | PLAYING | PAUSED | OVER
    mode: 'worker',
    words: [],
    score: 0, combo: 0, maxCombo: 0, killed: 0, hp: 20,
    elapsed: 0, spawnTimer: 0.5, locked: null,
    hurtFlash: 0, whiteFlash: 0, fireworkQueue: [],
    rafId: 0, lastTs: 0,
    W: 0, H: 0
  };

  /* DOM 引用 */
  const D = {};
  let canvas, ctx, wrap;
  const hudCache = {};
  let toastTimer = 0;

  /* ==================== 初始化 ==================== */
  function cacheDom() {
    const ids = ['btn-worker', 'btn-cet', 'btn-custom', 'btn-sound', 'hud-score', 'hud-time',
      'hud-combo', 'hp-bar', 'btn-mute', 'toast', 'pause-overlay', 'btn-resume', 'btn-quit',
      'inp-word', 'inp-pinyin', 'btn-add-word', 'add-msg', 'word-list', 'custom-count',
      'io-box', 'btn-export', 'btn-import', 'io-msg', 'btn-play-custom', 'btn-editor-back',
      'r-score', 'r-time', 'r-killed', 'r-combo', 'r-best', 'r-flavor', 'new-record',
      'btn-retry', 'btn-menu', 'best-worker', 'best-cet', 'best-custom',
      'btn-words-minus', 'btn-words-plus', 'words-val'];
    ids.forEach(id => { D[id] = document.getElementById(id); });
    D.best = { worker: D['best-worker'], cet: D['best-cet'], custom: D['best-custom'] };
    D.readingBtns = Array.prototype.slice.call(document.querySelectorAll('#reading-seg button'));
  }

  function buildHpBar() {
    D['hp-bar'].innerHTML = '';
    D.hpSegs = [];
    for (let i = 0; i < Game.HP_MAX; i++) {
      const seg = document.createElement('span');
      D['hp-bar'].appendChild(seg);
      D.hpSegs.push(seg);
    }
  }

  function init() {
    cacheDom();
    buildHpBar();
    canvas = document.getElementById('game-canvas');
    wrap = document.getElementById('canvas-wrap');
    ctx = canvas.getContext('2d');
    bindEvents();
    refreshMenu();
    Screens.show('menu');
  }

  /* ==================== 画布自适应 ==================== */
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w < 10 || h < 10) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Game.W = w;
    Game.H = h;
  }

  /* ==================== 输入 ==================== */
  function onKeyDown(e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const k = (e.key || '').toLowerCase();
    const inGame = Game.state === 'PLAYING';

    /* 静音 / 朗读切换：游戏内需 Alt 前缀（M/T 本身是字母，会和输入冲突） */
    if (k === 'm' && (e.altKey || !inGame)) { e.preventDefault(); toggleMute(); return; }
    if (k === 't' && (e.altKey || !inGame)) { e.preventDefault(); cycleReading(); return; }

    if (Game.state === 'PLAYING') {
      if (e.key === 'Escape') { e.preventDefault(); Game.pause(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); Game.locked = null; return; }
      if (/^[a-z]$/.test(k)) { e.preventDefault(); Game.handleLetter(k); return; }
    } else if (Game.state === 'PAUSED') {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); Game.resume(); }
    } else if (Game.state === 'OVER') {
      if (e.key === 'Enter') { e.preventDefault(); Game.start(Game.mode); }
    } else if (Screens.current === 'editor' && e.key === 'Escape') {
      e.preventDefault();
      Screens.show('menu');
    }
  }

  /* ==================== 游戏流程 ==================== */
  Game.start = function (mode) {
    this.mode = mode;
    this.words = [];
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.killed = 0;
    this.hp = 1; /* 成长制：从 1 格心态起步，越打越稳 */
    this.elapsed = 0; this.spawnTimer = 0.5; this.locked = null;
    this.hurtFlash = 0; this.whiteFlash = 0; this.fireworkQueue = [];
    for (const key of Object.keys(hudCache)) delete hudCache[key];
    TB.FX.clear();
    D['pause-overlay'].classList.add('hidden');
    this.state = 'PLAYING';
    Screens.show('game');
    resizeCanvas();
    updateHUD();
    this.lastTs = performance.now();
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(loop);
  };

  Game.pause = function () {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.locked = null;
    D['pause-overlay'].classList.remove('hidden');
    cancelAnimationFrame(this.rafId);
  };

  Game.resume = function () {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    D['pause-overlay'].classList.add('hidden');
    this.lastTs = performance.now();
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(loop);
  };

  /* 离开游戏屏时调用（结算 / 回菜单） */
  Game.onLeaveGame = function () {
    if (this.state === 'PLAYING' || this.state === 'PAUSED') this.state = 'MENU';
    D['pause-overlay'].classList.add('hidden');
    cancelAnimationFrame(this.rafId);
  };

  Game.gameOver = function () {
    this.state = 'OVER';
    cancelAnimationFrame(this.rafId);
    TB.Audio.play('over');
    const isRecord = TB.Storage.setBest(this.mode, this.score);
    D['r-score'].textContent = this.score;
    D['r-time'].textContent = Math.floor(this.elapsed) + ' 秒';
    D['r-killed'].textContent = this.killed;
    D['r-combo'].textContent = this.maxCombo;
    D['r-best'].textContent = '本模式最高分 ' + TB.Storage.getBest(this.mode);
    D['r-flavor'].textContent = this.FLAVOR[Math.floor(Math.random() * this.FLAVOR.length)];
    D['new-record'].classList.toggle('hidden', !(isRecord && this.score > 0));
    Screens.show('result');
  };

  /* ==================== 实体与主循环 ==================== */
  Game.spawnWord = function () {
    if (this.W < 60) return;
    const entry = TB.Words.pick(this.mode);
    if (!entry) return;
    const base = Math.min(90, 26 + this.elapsed * 0.55);
    const speed = base * (0.9 + Math.random() * 0.2);
    ctx.font = FONT_MAIN;
    const mw = ctx.measureText(entry.main).width;
    ctx.font = FONT_SUB;
    const sw = ctx.measureText(entry.sub).width;
    const bw = Math.max(90, Math.max(mw, sw) + 32);
    const bh = 58;
    /* 生成位置：随机取 5 次，挑与现有词水平距离最远的 */
    const margin = bw / 2 + 16;
    const range = Math.max(1, this.W - margin * 2);
    let bestX = margin + Math.random() * range, bestDist = -1;
    for (let t = 0; t < 5; t++) {
      const x = margin + Math.random() * range;
      let d = Infinity;
      for (const w of this.words) d = Math.min(d, Math.abs(x - w.x));
      if (d > bestDist) { bestDist = d; bestX = x; }
      if (d >= 80) { bestX = x; break; }
    }
    this.words.push({
      typing: entry.typing, main: entry.main, sub: entry.sub,
      progress: 0, x: bestX, y: -bh - 4, speed, bw, bh,
      phase: Math.random() * Math.PI * 2, flash: 0, letterPop: 0,
      clicks: 0, bubblePop: 0,
      easter: this.EASTER.indexOf(entry.main) >= 0
    });
  };

  Game.removeWord = function (w) {
    const i = this.words.indexOf(w);
    if (i >= 0) this.words.splice(i, 1);
  };

  Game.update = function (dt) {
    this.elapsed += dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.whiteFlash > 0) this.whiteFlash -= dt;

    for (const w of this.words) {
      w.y += w.speed * dt;
      w.phase += dt * (1.5 + w.speed * 0.04);
      if (w.flash > 0) w.flash -= dt;
      if (w.letterPop > 0) w.letterPop -= dt;
      if (w.bubblePop > 0) w.bubblePop -= dt;
    }

    /* 生成：间隔随时间变密；同屏上限 = min(玩家设置, 难度爬升值) */
    const interval = Math.max(750, 2300 - this.elapsed * 11);
    const maxWords = Math.min(TB.Storage.getMaxWords(), 3 + Math.floor(this.elapsed / 20));
    this.spawnTimer -= dt * 1000;
    if (this.spawnTimer <= 0) {
      if (this.words.length < maxWords) {
        this.spawnWord();
        this.spawnTimer = interval;
      } else {
        this.spawnTimer = 200;
      }
    }

    /* 彩蛋烟花队列 */
    for (let i = this.fireworkQueue.length - 1; i >= 0; i--) {
      const f = this.fireworkQueue[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.fireworkQueue.splice(i, 1);
        TB.FX.firework(f.x, f.y);
        TB.Audio.play('firework');
      }
    }

    /* 落底判定 */
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      if (w.y + w.bh >= this.H - 2) this.missWord(w);
    }

    TB.FX.update(dt);
  };

  /* ==================== 键盘判定 ==================== */
  Game.handleLetter = function (k) {
    TB.Audio.play('key');
    if (!this.locked) {
      /* 锁定规则：首字母匹配的词里取 y 最大（最接近底部） */
      let best = null;
      for (const w of this.words) {
        if (w.typing[0] === k && (!best || w.y > best.y)) best = w;
      }
      if (!best) return;
      this.locked = best;
    }
    const w = this.locked;
    if (w.typing[w.progress] === k) {
      w.progress++;
      w.letterPop = 0.12;
      TB.Audio.play('hit');
      if (w.progress >= w.typing.length) this.completeWord(w);
    } else {
      this.combo = 0;
      w.flash = 0.3;
      TB.Audio.play('wrong');
    }
  };

  /* 连点爆破：同一词条累计点击 CLICK_BLAST 次直接爆炸，与打字爆破同等待遇 */
  Game.handleClick = function (x, y) {
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      const cx = w.x + Math.sin(w.phase) * 3; /* 与绘制一致的水平摆动 */
      const bx = cx - w.bw / 2;
      if (x >= bx && x <= bx + w.bw && y >= w.y && y <= w.y + w.bh) {
        w.clicks++;
        w.bubblePop = 0.12;
        if (w.clicks >= this.CLICK_BLAST) {
          this.completeWord(w);
        } else {
          TB.Audio.play('key');
        }
        return;
      }
    }
  };

  Game.completeWord = function (w) {
    this.removeWord(w);
    this.locked = null;
    this.killed++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    /* 心态成长：每敲碎一个词 +1 心态（上限 20），往积极方向发展 */
    if (this.hp < this.HP_MAX) {
      this.hp++;
      const marks = { 5: '心态回稳', 10: '心态渐佳', 15: '心态大成', 20: '心态圆满' };
      if (marks[this.hp]) {
        TB.Audio.play('heal');
        TB.FX.floatText(this.W / 2, 72, marks[this.hp], { color: '#2f9e44', size: 20 });
      }
    }

    /* 计分 */
    const mult = Math.min(3, 1 + Math.floor(this.combo / 10) * 0.5);
    const gained = Math.round(10 * w.typing.length * mult);
    this.score += gained;
    const tier = this.combo >= 50 ? 3 : this.combo >= 25 ? 2 : this.combo >= 10 ? 1 : 0;
    TB.FX.explodeAt(w.x, w.y + w.bh / 2, w.sub, tier);
    TB.FX.floatText(w.x, w.y, '+' + gained, { color: '#343a40' });
    TB.FX.shake(4 + tier * 3);
    TB.Audio.play('explode', { tier: tier });

    if (this.combo === 10) this.milestone('手速惊人');
    else if (this.combo === 25) this.milestone('键盘冒烟');
    else if (this.combo === 50) this.milestone('同事侧目');

    /* 彩蛋词：全屏烟花 + 1000 分 */
    if (w.easter) {
      this.score += 1000;
      this.whiteFlash = 0.25;
      TB.FX.floatText(this.W / 2, this.H / 2 - 40, w.main + '！+1000', { color: '#e8590c', size: 26 });
      for (let i = 0; i < 5; i++) {
        this.fireworkQueue.push({
          t: 0.12 + i * 0.22,
          x: this.W * (0.15 + Math.random() * 0.7),
          y: this.H * (0.12 + Math.random() * 0.45)
        });
      }
    }

    /* 四六级模式朗读（按设置读英文或中文） */
    if (this.mode === 'cet') {
      const r = TB.Audio.getReading();
      if (r === 'en') TB.Audio.speak(w.sub, 'en-US');
      else if (r === 'zh') TB.Audio.speak(w.main, 'zh-CN');
    }
  };

  Game.milestone = function (text) {
    TB.FX.floatText(this.W / 2, 92, text, { size: 30, color: '#1c7ed6' });
    TB.Audio.play('milestone');
  };

  Game.missWord = function (w) {
    this.removeWord(w);
    if (this.locked === w) this.locked = null;
    this.hp--;
    this.combo = 0;
    this.hurtFlash = 0.35;
    TB.Audio.play('hurt');
    if (this.hp <= 0) this.gameOver();
  };

  /* ==================== 渲染 ==================== */
  function loop(ts) {
    if (Game.state !== 'PLAYING') return;
    let dt = (ts - Game.lastTs) / 1000;
    Game.lastTs = ts;
    if (!isFinite(dt) || dt <= 0) dt = 0.016;
    if (dt > 0.05) dt = 0.05; /* 切标签页回来的 dt 尖峰钳制 */
    Game.update(dt);
    if (Game.state === 'PLAYING') {
      render();
      Game.rafId = requestAnimationFrame(loop);
    }
  }

  function render() {
    ctx.clearRect(0, 0, Game.W, Game.H);
    ctx.save();
    const s = TB.FX.shakeOffset();
    ctx.translate(s.x, s.y);
    ctx.textBaseline = 'middle';
    for (const w of Game.words) drawWord(w);
    TB.FX.render(ctx);
    ctx.restore();

    /* 受伤红闪 / 彩蛋白闪（不随震动偏移） */
    if (Game.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(240,60,60,' + (0.22 * Math.min(1, Game.hurtFlash / 0.35)) + ')';
      ctx.fillRect(0, 0, Game.W, Game.H);
    }
    if (Game.whiteFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * Math.min(1, Game.whiteFlash / 0.25)) + ')';
      ctx.fillRect(0, 0, Game.W, Game.H);
    }
    updateHUD();
  }

  function drawWord(w) {
    const x = w.x + Math.sin(w.phase) * 3;
    const y = w.y;
    const bx = x - w.bw / 2;

    /* 连点时整只气泡弹一下 */
    const pop = w.bubblePop > 0 ? 1 + 0.08 * (w.bubblePop / 0.12) : 1;
    ctx.save();
    if (pop !== 1) {
      ctx.translate(x, y + w.bh / 2);
      ctx.scale(pop, pop);
      ctx.translate(-x, -(y + w.bh / 2));
    }

    ctx.beginPath();
    roundRect(bx, y, w.bw, w.bh, 10);
    ctx.fillStyle = w.easter ? '#fff9db' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = w.easter ? 2.5 : (Game.locked === w ? 2.5 : 1.5);
    ctx.strokeStyle = w.easter ? '#f08c00' : (Game.locked === w ? '#339af0' : '#dee2e6');
    ctx.stroke();

    if (w.flash > 0) {
      ctx.fillStyle = 'rgba(255,80,80,' + (0.45 * Math.min(1, w.flash / 0.3)) + ')';
      ctx.beginPath();
      roundRect(bx, y, w.bw, w.bh, 10);
      ctx.fill();
    }

    /* 主文本（中文词 / 中文释义） */
    ctx.font = FONT_MAIN;
    ctx.fillStyle = '#343a40';
    ctx.textAlign = 'center';
    ctx.fillText(w.main, x, y + 20);

    /* 副文本逐字符：已敲对高亮、刚敲中的弹一下 */
    ctx.font = FONT_SUB;
    const subY = y + 41;
    const totalW = ctx.measureText(w.sub).width;
    let cx = x - totalW / 2;
    ctx.textAlign = 'left';
    let ti = 0;
    for (const ch of w.sub) {
      const cw = ctx.measureText(ch).width;
      if (ch !== ' ') {
        const typed = ti < w.progress;
        const popping = (ti === w.progress - 1) && w.letterPop > 0;
        if (popping) {
          const scale = 1 + 0.15 * (w.letterPop / 0.12);
          ctx.save();
          ctx.translate(cx + cw / 2, subY);
          ctx.scale(scale, scale);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#2f9e44';
          ctx.font = 'bold ' + FONT_SUB;
          ctx.fillText(ch, 0, 0);
          ctx.restore();
          ctx.font = FONT_SUB;
        } else {
          ctx.fillStyle = typed ? '#2f9e44' : '#868e96';
          ctx.fillText(ch, cx, subY);
        }
        ti++;
      }
      cx += cw;
    }
    ctx.textAlign = 'center';

    /* 连点进度角标：N/10 */
    if (w.clicks > 0) {
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.fillStyle = '#e8590c';
      ctx.textAlign = 'right';
      ctx.fillText(w.clicks + '/' + Game.CLICK_BLAST, bx + w.bw - 6, y + 10);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ==================== HUD ==================== */
  function updateHUD() {
    if (hudCache.score !== Game.score) {
      hudCache.score = Game.score;
      D['hud-score'].textContent = Game.score;
    }
    const t = Math.floor(Game.elapsed);
    if (hudCache.time !== t) {
      hudCache.time = t;
      D['hud-time'].textContent = t + 's';
    }
    if (hudCache.combo !== Game.combo) {
      hudCache.combo = Game.combo;
      const m = Math.min(3, 1 + Math.floor(Game.combo / 10) * 0.5);
      D['hud-combo'].textContent = Game.combo + (m > 1 ? ' ×' + String(m).replace(/\.0$/, '') : '');
    }
    if (hudCache.hp !== Game.hp) {
      const grew = hudCache.hp !== undefined && Game.hp > hudCache.hp;
      hudCache.hp = Game.hp;
      for (let i = 0; i < D.hpSegs.length; i++) {
        D.hpSegs[i].classList.toggle('on', i < Game.hp);
      }
      /* 心态 +1 时新获得的格闪烁一下 */
      if (grew) {
        const seg = D.hpSegs[Game.hp - 1];
        if (seg) {
          seg.classList.remove('gain');
          void seg.offsetWidth; /* 强制重排以重启动画 */
          seg.classList.add('gain');
          setTimeout(() => seg.classList.remove('gain'), 500);
        }
      }
      D['hp-bar'].classList.toggle('low', Game.hp <= 3);
      D['hp-bar'].classList.toggle('mid', Game.hp > 3 && Game.hp <= 10);
    }
  }

  /* ==================== 菜单 / 声音 / 朗读 UI ==================== */
  function refreshMenu() {
    ['worker', 'cet', 'custom'].forEach(m => {
      const best = TB.Storage.getBest(m);
      D.best[m].textContent = best > 0 ? '最高分 ' + best : '暂无纪录';
    });
    D['words-val'].textContent = TB.Storage.getMaxWords();
    refreshSoundUI();
    refreshReadingSeg();
  }

  function changeMaxWords(delta) {
    D['words-val'].textContent = TB.Storage.setMaxWords(TB.Storage.getMaxWords() + delta);
  }

  function refreshSoundUI() {
    const muted = TB.Audio.isMuted();
    D['btn-sound'].textContent = muted ? '关' : '开';
    D['btn-sound'].classList.toggle('off', muted);
    D['btn-mute'].textContent = muted ? '🔇' : '🔊';
  }

  function refreshReadingSeg() {
    const cur = TB.Audio.getReading();
    D.readingBtns.forEach(b => b.classList.toggle('on', b.dataset.val === cur));
  }

  function toggleMute() {
    TB.Audio.toggleMute();
    refreshSoundUI();
    toast(TB.Audio.isMuted() ? '音效：关' : '音效：开');
  }

  function cycleReading() {
    const order = ['en', 'zh', 'off'];
    const cur = TB.Audio.getReading();
    const next = order[(order.indexOf(cur) + 1) % order.length];
    TB.Audio.setReading(next);
    refreshReadingSeg();
    toast({ en: '朗读：英文', zh: '朗读：中文', off: '朗读：关闭' }[next]);
  }

  function toast(msg) {
    D.toast.textContent = msg;
    D.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => D.toast.classList.add('hidden'), 1300);
  }

  /* ==================== 自定义词库编辑器 ==================== */
  function renderEditor() {
    const list = TB.Storage.getCustom();
    D['word-list'].innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = '词库还是空的，先加几个最烦的词';
      D['word-list'].appendChild(li);
    } else {
      list.forEach(x => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = x.pinyin ? x.word + '（' + x.pinyin + '）' : x.word;
        const del = document.createElement('button');
        del.textContent = '删除';
        del.addEventListener('click', () => {
          TB.Storage.removeCustom(x.word);
          renderEditor();
        });
        li.appendChild(span);
        li.appendChild(del);
        D['word-list'].appendChild(li);
      });
    }
    D['custom-count'].textContent = '当前 ' + list.length + ' 个词（至少 5 个才能开局）';
    D['custom-count'].className = 'msg' + (list.length < 5 ? ' error' : ' ok');
  }

  function addWord() {
    const word = D['inp-word'].value.trim();
    const pinyin = D['inp-pinyin'].value.trim();
    const v = TB.Words.validateEntry({ word: word, pinyin: pinyin });
    if (!v.ok) {
      D['add-msg'].textContent = v.reason;
      D['add-msg'].className = 'msg error';
      return;
    }
    if (TB.Storage.getCustom().some(x => x.word === word)) {
      D['add-msg'].textContent = '这个词已经在词库里了';
      D['add-msg'].className = 'msg error';
      return;
    }
    TB.Storage.addCustom({ word: word, pinyin: pinyin.toLowerCase() });
    D['inp-word'].value = '';
    D['inp-pinyin'].value = '';
    D['add-msg'].textContent = '已添加「' + word + '」';
    D['add-msg'].className = 'msg ok';
    renderEditor();
  }

  function exportWords() {
    D['io-box'].value = TB.Storage.exportCustom();
    D['io-msg'].textContent = '已导出，全选复制即可';
    D['io-msg'].className = 'msg ok';
  }

  function importWords() {
    const ok = TB.Storage.importCustom(D['io-box'].value);
    if (ok) {
      D['io-msg'].textContent = '导入成功';
      D['io-msg'].className = 'msg ok';
      renderEditor();
    } else {
      D['io-msg'].textContent = '导入失败：不是合法的词库 JSON，或没有有效词条';
      D['io-msg'].className = 'msg error';
    }
  }

  function playCustom() {
    if (TB.Storage.getCustom().length < 5) {
      D['add-msg'].textContent = '至少录入 5 个词才能开局';
      D['add-msg'].className = 'msg error';
      return;
    }
    Game.start('custom');
  }

  /* ==================== 事件绑定 ==================== */
  function bindEvents() {
    D['btn-worker'].addEventListener('click', () => Game.start('worker'));
    D['btn-cet'].addEventListener('click', () => Game.start('cet'));
    D['btn-custom'].addEventListener('click', () => Screens.show('editor'));
    D['btn-sound'].addEventListener('click', toggleMute);
    D['btn-mute'].addEventListener('click', toggleMute);
    D['btn-words-minus'].addEventListener('click', () => changeMaxWords(-1));
    D['btn-words-plus'].addEventListener('click', () => changeMaxWords(1));
    D.readingBtns.forEach(b => b.addEventListener('click', () => {
      TB.Audio.setReading(b.dataset.val);
      refreshReadingSeg();
    }));
    D['btn-resume'].addEventListener('click', () => Game.resume());
    D['btn-quit'].addEventListener('click', () => Screens.show('menu'));
    D['btn-retry'].addEventListener('click', () => Game.start(Game.mode));
    D['btn-menu'].addEventListener('click', () => Screens.show('menu'));
    D['btn-add-word'].addEventListener('click', addWord);
    D['btn-export'].addEventListener('click', exportWords);
    D['btn-import'].addEventListener('click', importWords);
    D['btn-play-custom'].addEventListener('click', playCustom);
    D['btn-editor-back'].addEventListener('click', () => Screens.show('menu'));

    document.addEventListener('keydown', onKeyDown);
    /* 连点爆破：画布点击（含触摸） */
    canvas.addEventListener('pointerdown', (e) => {
      if (Game.state !== 'PLAYING') return;
      const rect = canvas.getBoundingClientRect();
      Game.handleClick(e.clientX - rect.left, e.clientY - rect.top);
    });
    /* 首次交互解锁 AudioContext */
    document.addEventListener('pointerdown', () => TB.Audio.unlock());

    window.addEventListener('resize', () => {
      if (Screens.current === 'game') resizeCanvas();
    });
    /* 失焦 / 切标签页自动暂停 */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Game.state === 'PLAYING') Game.pause();
    });
    window.addEventListener('blur', () => {
      if (Game.state === 'PLAYING') Game.pause();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
