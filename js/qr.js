/* 打字爆破 · 零依赖二维码生成器（版本 1-4，字节模式，L/M 级纠错）
   参考 ISO/IEC 18004 实现：RS 纠错 + 8 种掩码惩罚评估 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.TB = root.TB || {};

  /* ---------- GF(256)，本原多项式 0x11D ---------- */
  const EXP = new Array(512), LOG = new Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function gmul(a, b) {
    return (a !== 0 && b !== 0) ? EXP[LOG[a] + LOG[b]] : 0;
  }
  function polyMul(a, b) {
    const r = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++)
        r[i + j] ^= gmul(a[i], b[j]);
    return r;
  }
  function rsGen(degree) {
    let g = [1];
    for (let i = 0; i < degree; i++) g = polyMul(g, [EXP[i], 1]);
    return g;
  }
  function rsEncode(data, ecLen) {
    const gen = rsGen(ecLen);
    const res = new Array(ecLen).fill(0);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      if (factor !== 0) {
        for (let j = 0; j < ecLen; j++) res[j] ^= gmul(gen[j + 1], factor);
      }
    }
    return res;
  }

  /* 纠错块表：version → level → [块数, 每块数据码字, 每块纠错码字] */
  const ECC = {
    1: { L: [1, 19, 7], M: [1, 16, 10], Q: [1, 13, 13], H: [1, 9, 17] },
    2: { L: [1, 34, 10], M: [1, 28, 16], Q: [1, 22, 22], H: [1, 16, 28] },
    3: { L: [1, 55, 15], M: [1, 44, 26], Q: [2, 17, 18], H: [2, 13, 22] },
    4: { L: [1, 80, 20], M: [2, 32, 18], Q: [2, 24, 26], H: [4, 9, 16] }
  };
  const LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26] };

  /* 生成：文本 → 模块矩阵 */
  function make(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else if (c < 2048) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }

    /* 选版本：优先 M 级，放不下退 L 级，最大 V4 */
    let version = 0, level = null;
    outer:
    for (let li = 0; li < 2; li++) {
      const lv = li === 0 ? 'M' : 'L';
      for (let v = 1; v <= 4; v++) {
        const spec = ECC[v][lv];
        if (bytes.length <= Math.floor((spec[0] * spec[1] * 8 - 12) / 8)) {
          version = v; level = lv; break outer;
        }
      }
    }
    if (!version) throw new Error('内容太长（超过 77 个字符），请缩短地址');

    const blocks = ECC[version][level][0], dataPer = ECC[version][level][1], ecPer = ECC[version][level][2];
    const dataTotal = blocks * dataPer;

    /* 比特流：模式 0100 + 8 位长度 + 数据 + 终止符 + 填充 */
    const bits = [];
    function pushBits(val, n) {
      for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    }
    pushBits(4, 4);
    pushBits(bytes.length, 8);
    for (let i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
    pushBits(0, Math.min(4, dataTotal * 8 - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codewords.push(b);
    }
    for (let pad = 0xec; codewords.length < dataTotal; pad ^= 0xec ^ 0x11) codewords.push(pad);

    /* 分块纠错 + 交错 */
    const dataBlocks = [], ecBlocks = [];
    for (let b = 0; b < blocks; b++) dataBlocks.push(codewords.slice(b * dataPer, (b + 1) * dataPer));
    for (let i = 0; i < dataBlocks.length; i++) ecBlocks.push(rsEncode(dataBlocks[i], ecPer));
    const stream = [];
    for (let i = 0; i < dataPer; i++) for (let b = 0; b < blocks; b++) stream.push(dataBlocks[b][i]);
    for (let i = 0; i < ecPer; i++) for (let b = 0; b < blocks; b++) stream.push(ecBlocks[b][i]);

    return buildMatrix(stream, version, level);
  }

  /* 功能图案矩阵（测试回读用） */
  function functionMap(version) {
    const size = 17 + version * 4;
    const m = [], f = [];
    for (let i = 0; i < size; i++) {
      m.push(new Array(size).fill(false));
      f.push(new Array(size).fill(false));
    }
    const set = (x, y) => { m[y][x] = true; f[y][x] = true; };
    function finder(cx, cy) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    for (const cy of ALIGN[version]) for (const cx of ALIGN[version]) {
      if (f[cy][cx]) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy);
    }
    for (let i = 8; i < size - 8; i++) { set(i, 6); set(6, i); }
    for (let i = 0; i <= 8; i++) { set(i, 8); set(8, i); }
    for (let i = 0; i < 8; i++) { set(size - 1 - i, 8); set(8, size - 1 - i); }
    set(8, size - 8);
    return { size: size, isFunc: f };
  }

  function buildMatrix(codewords, version, level) {
    const size = 17 + version * 4;
    const modules = [], isFunc = [];
    for (let i = 0; i < size; i++) {
      modules.push(new Array(size).fill(false));
      isFunc.push(new Array(size).fill(false));
    }
    const set = (x, y, dark) => { modules[y][x] = dark; isFunc[y][x] = true; };

    /* 定位图案（含分隔） */
    function finder(cx, cy) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, dist !== 2 && dist !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    /* 校正图案 */
    for (const cy of ALIGN[version]) for (const cx of ALIGN[version]) {
      if (isFunc[cy][cx]) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }

    /* 时序图案 */
    for (let i = 8; i < size - 8; i++) {
      if (!isFunc[6][i]) set(i, 6, i % 2 === 0);
      if (!isFunc[i][6]) set(6, i, i % 2 === 0);
    }

    /* 预留格式信息区 + 固定暗模块 */
    for (let i = 0; i <= 8; i++) { if (!isFunc[8][i]) set(i, 8, false); if (!isFunc[i][8]) set(8, i, false); }
    for (let i = 0; i < 8; i++) { if (!isFunc[8][size - 1 - i]) set(size - 1 - i, 8, false); if (!isFunc[size - 1 - i][8]) set(8, size - 1 - i, false); }
    set(8, size - 8, true);

    /* 数据放置：两列蛇形 */
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunc[y][x] && bi < codewords.length * 8) {
            modules[y][x] = ((codewords[bi >> 3] >>> (7 - (bi & 7))) & 1) !== 0;
            bi++;
          }
        }
      }
    }

    /* 掩码：8 种里选惩罚最低的 */
    let bestMask = 0, bestScore = Infinity, bestGrid = null;
    for (let mask = 0; mask < 8; mask++) {
      const grid = modules.map(r => r.slice());
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (!isFunc[y][x] && maskBit(mask, x, y)) grid[y][x] = !grid[y][x];
      const score = penalty(grid, size);
      if (score < bestScore) { bestScore = score; bestMask = mask; bestGrid = grid; }
    }

    drawFormat(bestGrid, size, formatBits(level, bestMask));
    return { size: size, modules: bestGrid, version: version, level: level, mask: bestMask };
  }

  function maskBit(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
    return false;
  }

  /* BCH(15,5) 格式信息 */
  function formatBits(level, mask) {
    const data = (LEVEL_BITS[level] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return (((data << 10) | (rem & 0x3ff)) ^ 0x5412) & 0x7fff;
  }
  function drawFormat(grid, size, bits) {
    const bit = i => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) grid[i][8] = bit(i);      /* (x=8,y=i) */
    grid[7][8] = bit(6);
    grid[8][8] = bit(7);
    grid[8][7] = bit(8);
    for (let i = 9; i <= 14; i++) grid[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 14; i++) grid[size - 15 + i][8] = bit(i);
    grid[size - 8][8] = true; /* 固定暗模块 */
  }

  /* 掩码惩罚评估（ISO 四规则） */
  function penalty(g, size) {
    let result = 0;
    for (let y = 0; y < size; y++) {
      let runColor = false, runLen = 0;
      for (let x = 0; x < size; x++) {
        if (g[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += 3; else if (runLen > 5) result++;
        } else { runColor = g[y][x]; runLen = 1; }
      }
    }
    for (let x = 0; x < size; x++) {
      let runColor = false, runLen = 0;
      for (let y = 0; y < size; y++) {
        if (g[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += 3; else if (runLen > 5) result++;
        } else { runColor = g[y][x]; runLen = 1; }
      }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = g[y][x];
      if (c === g[y][x + 1] && c === g[y + 1][x] && c === g[y + 1][x + 1]) result += 3;
    }
    const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function scanPad(g, size, idx, dir) {
      const get = dir === 'row' ? (i => g[idx][i]) : (i => g[i][idx]);
      let cnt = 0;
      for (let s = 0; s + 11 <= size; s++) {
        let m1 = true, m2 = true;
        for (let i = 0; i < 11; i++) {
          const v = get(s + i) ? 1 : 0;
          if (v !== p1[i]) m1 = false;
          if (v !== p2[i]) m2 = false;
        }
        if (m1 || m2) cnt += 40;
      }
      return cnt;
    }
    result += 0;
    for (let y = 0; y < size; y++) result += scanPad(g, size, y, 'row');
    for (let x = 0; x < size; x++) result += scanPad(g, size, x, 'col');
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (g[y][x]) dark++;
    const total = size * size;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
  }
  function scanPad(scan, g, size, idx, dir) {
    return scan(dir === 'row' ? (i => g[idx][i]) : (i => g[i][idx]));
  }

  const api = {
    make: make,
    functionMap: functionMap,
    /* 画到 canvas：quiet zone 4 模块 */
    render(canvas, text, opts) {
      opts = opts || {};
      const qr = make(text);
      const scale = opts.scale || 8;
      const quiet = 4;
      const px = (qr.size + quiet * 2) * scale;
      canvas.width = px;
      canvas.height = px;
      if (opts.display) {
        canvas.style.width = opts.display + 'px';
        canvas.style.height = opts.display + 'px';
      }
      const c = canvas.getContext('2d');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, px, px);
      c.fillStyle = opts.dark || '#1e4639';
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (qr.modules[y][x]) {
            c.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
          }
        }
      }
      return qr;
    }
  };

  root.TB.QR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
