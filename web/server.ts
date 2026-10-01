import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cardano Agent Arena</title><style>body{font:18px system-ui;margin:8vh auto;max-width:760px;padding:24px;background:#0f172a;color:#e2e8f0}h1{color:#38bdf8}pre{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#94a3b8}</style>
<h1>Cardano Agent Arena</h1><small>Devnet walking skeleton · number game</small><h2 id="result">Loading match…</h2><pre id="match"></pre><script src="/app.js" defer></script></html>`;
const app = `fetch('/api/match').then(r=>{if(!r.ok)throw new Error('Match unavailable');return r.json()}).then(m=>{document.querySelector('#result').textContent=m.result===-1?'In progress':m.result===2?'Draw':m.result===0?'Alice wins':'Bob wins';document.querySelector('#match').textContent=JSON.stringify(m,null,2)}).catch(e=>{document.querySelector('#result').textContent=e.message});`;
export function createWebServer(indexFile: string) {
  return createServer((request, response) => {
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
    if (request.url === '/' || request.url === '/index.html') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html);
    } else if (request.url === '/app.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); response.end(app);
    } else if (request.url === '/api/match') {
      try {
        const data = JSON.parse(readFileSync(indexFile, 'utf8'));
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data));
      } catch { response.writeHead(503); response.end('Match unavailable'); }
    } else { response.writeHead(404); response.end(); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run web -- <index.json>');
  const server = createWebServer(file);
  server.listen(3400, '127.0.0.1', () => console.log('http://127.0.0.1:3400'));
}
