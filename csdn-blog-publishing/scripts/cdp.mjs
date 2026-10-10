// cdp.mjs — 极简 Chrome DevTools Protocol 客户端（Node 22+ 内置 WebSocket）
// 用法：node cdp.mjs <tabs|nav|eval|click|shot> [arg]
// 端口可用 CDP_PORT 覆盖（默认 9222）。
import fs from 'node:fs';

const CDP = `http://127.0.0.1:${process.env.CDP_PORT || 9222}`;
const [cmd, ...rest] = process.argv.slice(2);

async function pickTarget() {
  const list = await (await fetch(CDP + '/json/list')).json();
  const pages = list.filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!pages.length) throw new Error('no page target');
  return pages.find(p => /csdn|mp\.csdn/.test(p.url)) || pages[0];
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  };
  return {
    send: (method, params = {}) => new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 60000);
    }),
  };
}

const t = await pickTarget();
const cli = await connect(t.webSocketDebuggerUrl);
await cli.send('Runtime.enable');

if (cmd === 'tabs') {
  const list = await (await fetch(CDP + '/json/list')).json();
  for (const p of list.filter(x => x.type === 'page')) console.log(p.url.slice(0, 140));
} else if (cmd === 'nav') {
  await cli.send('Page.enable');
  await cli.send('Page.navigate', { url: rest[0] });
  await new Promise(r => setTimeout(r, 4000));
  console.log('navigated');
} else if (cmd === 'eval') {
  const r = await cli.send('Runtime.evaluate', { expression: rest.join(' '), returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify(r.result?.value ?? r.result?.description ?? r, null, 1));
} else if (cmd === 'click') {
  const r = await cli.send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(rest[0])}); if (!el) return 'not-found'; el.click(); return 'clicked'; })()`,
    returnByValue: true,
  });
  console.log(JSON.stringify(r.result?.value));
} else if (cmd === 'shot') {
  await cli.send('Page.enable');
  const r = await cli.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(rest[0], Buffer.from(r.data, 'base64'));
  console.log('saved ' + rest[0]);
} else {
  console.error('unknown command: ' + cmd);
  process.exit(2);
}
process.exit(0);
