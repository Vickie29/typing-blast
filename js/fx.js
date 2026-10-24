/* 打字爆破 · 特效层（阶段 4）
   TB.FX：粒子爆炸（逐字符）、彩蛋烟花、屏幕震动、飘字 */
(function () {
  'use strict';
  window.TB = window.TB || {};

  const MAX_PARTICLES = 400;
  const pool = [];   // 回收池
  const parts = [];  // 激活中的粒子
  const floats = []; // 飘字

  let shakeTime = 0;
  let shakePower = 0;

  /* combo 档位配色：0 橙 / 1 红 / 2 金 / 3 彩虹 */
  const TIER_COLORS = ['#ff922b', '#fa5252', '#fcc419'];

  function tierColor(tier, i) {
    if (tier >= 3) {
      const hue = (performance.now() / 8 + i * 24) % 360;
      return 'hsl(' + hue.toFixed(0) + ',90%,55%)';
    }
    return TIER_COLORS[Math.min(tier, 2)];
  }

  function acquire() { return pool.length ? pool.pop() : {}; }
  function release(p) { if (pool.length < MAX_PARTICLES) pool.push(p); }

  TB.FX = {
    /* 整词逐字符爆炸 */
    explodeAt(x, y, text, tier) {
      tier = tier || 0;
      const chars = String(text || '').split('');
      const n = Math.min(chars.length, 40);
      for (let i = 0; i < n; i++) {
        if (parts.length >= MAX_PARTICLES) break;
        const p = acquire();
        p.type = 'char';
        p.ch = chars[i] === ' ' ? '·' : chars[i];
        p.x = x;
        p.y = y;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4; /* 整体偏上抛 */
        const sp = 120 + Math.random() * 140;
        p.vx = Math.cos(ang) * sp;
        p.vy = Math.sin(ang) * sp;
        p.rot = Math.random() * Math.PI * 2;
        p.vr = (Math.random() - 0.5) * 8;
        p.life = p.max = 0.6 + Math.random() * 0.4;
        p.size = 13 + Math.random() * 6;
        p.color = tierColor(tier, i);
        parts.push(p);
      }
      /* 档位 ≥2 加一圈冲击波 */
      if (tier >= 2) {
        const p = acquire();
        p.type = 'ring';
        p.x = x;
        p.y = y;
        p.r = 6;
        p.vr = 320 + tier * 80;
        p.life = p.max = 0.32;
        p.color = tierColor(Math.min(tier, 2), 0);
        parts.push(p);
      }
    },

    /* 彩蛋烟花：单点彩色圆点爆发 */
    firework(x, y) {
      const hue = Math.random() * 360;
      const n = 42;
      for (let i = 0; i < n; i++) {
        if (parts.length >= MAX_PARTICLES) break;
        const p = acquire();
        p.type = 'dot';
        p.x = x;
        p.y = y;
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const sp = 90 + Math.random() * 170;
        p.vx = Math.cos(ang) * sp;
        p.vy = Math.sin(ang) * sp;
        p.rot = 0;
        p.vr = 0;
        p.life = p.max = 0.7 + Math.random() * 0.5;
        p.size = 2 + Math.random() * 2.5;
        p.color = 'hsl(' + ((hue + Math.random() * 60) % 360).toFixed(0) + ',95%,60%)';
        parts.push(p);
      }
    },

    /* 屏幕震动：power 像素，指数衰减约 300ms */
    shake(power) {
      shakePower = Math.max(shakePower, power);
      shakeTime = 0.3;
    },

    shakeOffset() {
      if (shakeTime <= 0 || shakePower <= 0.2) return { x: 0, y: 0 };
      return {
        x: (Math.random() * 2 - 1) * shakePower,
        y: (Math.random() * 2 - 1) * shakePower
      };
    },

    /* 飘字：上浮 40px、700ms 淡出 */
    floatText(x, y, text, opts) {
      opts = opts || {};
      floats.push({
        x: x, y: y, text: String(text),
        life: 0.7, max: 0.7,
        size: opts.size || 16,
        color: opts.color || '#343a40'
      });
    },

    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          release(p);
          parts.splice(i, 1);
          continue;
        }
        if (p.type === 'ring') {
          p.r += p.vr * dt;
          continue;
        }
        p.vy += 600 * dt; /* 重力 */
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'char') p.rot += p.vr * dt;
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.life -= dt;
        f.y -= (40 / 0.7) * dt;
        if (f.life <= 0) floats.splice(i, 1);
      }
      if (shakeTime > 0) {
        shakeTime -= dt;
        shakePower *= Math.exp(-dt * 9);
        if (shakeTime <= 0 || shakePower < 0.2) {
          shakeTime = 0;
          shakePower = 0;
        }
      }
    },

    render(ctx) {
      for (const p of parts) {
        const a = Math.max(0, p.life / p.max);
        ctx.globalAlpha = a;
        if (p.type === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.type === 'dot') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.font = 'bold ' + p.size.toFixed(0) + 'px Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.ch, 0, 0);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      for (const f of floats) {
        const a = Math.max(0, f.life / f.max);
        ctx.globalAlpha = a;
        ctx.fillStyle = f.color;
        ctx.font = 'bold ' + f.size + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    },

    clear() {
      while (parts.length) release(parts.pop());
      floats.length = 0;
      shakeTime = 0;
      shakePower = 0;
    }
  };
})();
