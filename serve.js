/* 打字爆破 · 局域网分享服务器（可选，双击 index.html 无需它）
   用法：node serve.js   然后浏览器打开 http://localhost:8123
   - 自动探测本机局域网 IPv4，手机连同一 WiFi 即可访问
   - /poster.html 的二维码自动指向局域网地址 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8123;
const root = __dirname;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function lanUrls() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        out.push('http://' + net.address + ':' + PORT);
      }
    }
  }
  return out;
}

http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    /* 海报：把二维码指向局域网地址 */
    if (path.basename(file) === 'poster.html') {
      const lan = lanUrls()[0] || ('http://localhost:' + PORT);
      data = Buffer.from(String(data).split('@__LAN_URL__@').join(lan));
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('打字爆破已就绪：');
  console.log('  本机游玩    http://localhost:' + PORT);
  lanUrls().forEach(u => console.log('  局域网分享  ' + u + '   （手机连同一 WiFi 可访问）'));
  console.log('  宣传海报    http://localhost:' + PORT + '/poster.html');
});
