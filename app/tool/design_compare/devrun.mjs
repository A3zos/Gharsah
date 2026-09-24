// Runs `flutter run -d web-server` with a control endpoint: GET /R (hot restart), /q (quit), /log
import { spawn } from 'child_process'; import http from 'http'; import fs from 'fs';
const LOG = process.argv[2];
const log = fs.createWriteStream(LOG);
const fl = spawn('flutter.bat', ['run', '-d', process.env.DEVICE || 'web-server', '--no-web-resources-cdn', '--web-port', '8790', '--web-hostname', 'localhost'],
  { cwd: 'C:/Users/abdal/OneDrive/Documentos/Gharsah', shell: true });
let buf = '';
const on = d => { const s = d.toString(); buf += s; log.write(s); };
fl.stdout.on('data', on); fl.stderr.on('data', on);
fl.on('exit', c => { log.write(`\n[flutter exited ${c}]\n`); process.exit(0); });
http.createServer((q, s) => {
  if (q.url === '/log') return s.end(buf.slice(-4000));
  if (q.url === '/R' || q.url === '/r') { const mark = buf.length; fl.stdin.write(q.url.slice(1));
    const t0 = Date.now(); const iv = setInterval(() => { const tail = buf.slice(mark);
      if (/Recompile complete|Restarted application|Reloaded|Page requires refresh|Error|error:/i.test(tail) || Date.now() - t0 > 180000) {
        clearInterval(iv); s.end(tail.slice(-3000)); } }, 300); return; }
  if (q.url === '/q') { fl.stdin.write('q'); return s.end('bye'); }
  s.end('?');
}).listen(8799);

