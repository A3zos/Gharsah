// Minimal static server for build/web (exits when killed). usage: node serve.mjs <root> <port>
import http from 'http'; import fs from 'fs'; import path from 'path';
const [root, port = '8790'] = process.argv.slice(2);
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json',
  '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.otf': 'font/otf', '.symbols': 'text/plain' };
http.createServer((q, s) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
}).listen(+port);
