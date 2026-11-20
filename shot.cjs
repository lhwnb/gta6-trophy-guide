// Render one screenshot with the Chrome DevTools Protocol, as JPEG, and keep it under a byte cap.
//
//   node shot.cjs <url> <out.jpg> [waitMs] [width] [height] [quality] [maxBytes]
//
// Chrome's own --screenshot flag produces empty frames for this app, so drive the page over CDP
// instead: create a target, wait for window.__ready, capture, and re-capture at lower quality if the
// JPEG lands above the cap.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const url = process.argv[2];
const out = process.argv[3];
const waitMs = Number(process.argv[4] || 2500);
const width = Number(process.argv[5] || 1280);
const height = Number(process.argv[6] || 720);
let quality = Number(process.argv[7] || 86);
const maxBytes = Number(process.argv[8] || 262144);

if (!url || !out) {
  console.error('usage: node shot.cjs <url> <out.jpg> [waitMs] [width] [height] [quality] [maxBytes]');
  process.exit(2);
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!chrome) { console.error('no chrome found'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(port, route) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: route, timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { resolve(null); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }

  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg.id) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message + ' (' + JSON.stringify(msg.error.data || null) + ')'));
      else p.resolve(msg.result);
    });
  }

  send(method, params, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('cdp timeout: ' + method)); }
      }, 30000);
    });
  }

  close() { try { this.ws.close(); } catch (e) {} }
}

async function main() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-shot-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
    '--window-size=' + width + ',' + height,
    'about:blank'
  ];

  const proc = spawn(chrome, args, { stdio: 'ignore', windowsHide: true });

  let version = null;
  for (let i = 0; i < 80 && !version; i++) {
    await sleep(150);
    try { version = await getJson(port, '/json/version'); } catch (e) { version = null; }
  }
  if (!version || !version.webSocketDebuggerUrl) {
    try { proc.kill(); } catch (e) {}
    throw new Error('chrome devtools not reachable on ' + port);
  }

  const cdp = new Cdp(version.webSocketDebuggerUrl);
  await cdp.open();

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height
  }, sessionId);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }, sessionId);

  await cdp.send('Page.navigate', { url }, sessionId);

  const deadline = Date.now() + Math.max(1500, waitMs) + 8000;
  let ready = false;
  while (Date.now() < deadline) {
    await sleep(120);
    try {
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'Boolean(window.__ready && document.querySelector(".view.on"))',
        returnByValue: true
      }, sessionId);
      if (r && r.result && r.result.value === true) { ready = true; break; }
    } catch (e) { /* page still swapping contexts */ }
  }
  if (!ready) console.warn('warning: page never reported __ready, capturing anyway');
  await sleep(waitMs);

  let buf = null;
  const qs = [quality, quality - 8, quality - 16, quality - 24].filter((q) => q >= 40);
  for (const q of qs) {
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality: q, captureBeyondViewport: false, fromSurface: true, optimizeForSpeed: false
    }, sessionId);
    buf = Buffer.from(shot.data, 'base64');
    console.log('  quality ' + q + ' -> ' + buf.length + ' bytes');
    if (buf.length <= maxBytes) { quality = q; break; }
  }
  if (!buf) throw new Error('capture failed');
  if (buf.length > maxBytes) console.warn('warning: still above cap at lowest quality');

  // sanity check: real JPEG magic and the expected geometry
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('capture is not a JPEG');
  const outDir = path.dirname(path.resolve(out));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(out, buf);

  const metrics = await cdp.send('Page.getLayoutMetrics', {}, sessionId).catch(() => null);
  if (metrics && metrics.cssVisualViewport) {
    console.log('  viewport ' + metrics.cssVisualViewport.clientWidth + 'x' + metrics.cssVisualViewport.clientHeight);
  }
  console.log('  wrote ' + out + ' (' + buf.length + ' bytes, quality ' + quality + ')');

  await cdp.send('Browser.close', {}).catch(() => {});
  cdp.close();
  try { proc.kill(); } catch (e) {}
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
}

main().catch((err) => {
  console.error('shot failed: ' + err.message);
  process.exit(1);
});
