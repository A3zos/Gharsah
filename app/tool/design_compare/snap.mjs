// usage: node snap.mjs <out.png> <query> [actionsJson]
// actions: [{"click":[x,y]}, {"type":"text"}, {"key":"Backspace"}, {"wait":ms}]
import puppeteer from 'puppeteer-core';
const [out, query = '', acts = '[]'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: +(process.env.H || 844), deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (process.env.DEBUG) console.log('[console]', m.type(), m.text().slice(0, 300)); const t = m.text(); if (m.type() === 'error' || /EXCEPTION|overflowed|Another exception/.test(t)) errs.push(t.slice(0, 400)); });
await p.goto('http://localhost:8790/?' + query, { waitUntil: 'load', timeout: 120000 });
await new Promise(r => setTimeout(r, +(process.env.WAIT || 4000)));
for (const a of JSON.parse(acts)) {
  if (a.click) await p.mouse.click(a.click[0], a.click[1]);
  if (a.type) await p.keyboard.type(a.type, { delay: 40 });
  if (a.key) await p.keyboard.press(a.key);
  await new Promise(r => setTimeout(r, a.wait ?? 500));
}
await p.screenshot({ path: out });
console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n---\n') : 'no console errors');
await b.close();
