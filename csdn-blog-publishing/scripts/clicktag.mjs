// 点击标签候选项
const CDP = 'http://127.0.0.1:9222';
const wanted = process.argv[2];

const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find(p => p.type === 'page' && /csdn/.test(p.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout')); } }, 30000); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;

const out = await ev(`(() => {
  const target = ${JSON.stringify(wanted)};
  const nodes = [...document.querySelectorAll('li,div,span,a')];
  const hit = nodes.filter(e => {
    const t = (e.textContent || '').trim();
    return t === target && e.children.length === 0;
  });
  if (!hit.length) return { clicked: false, reason: 'no-node' };
  const el = hit[hit.length - 1];
  el.click();
  return { clicked: true, tag: el.tagName, cls: el.className };
})()`);
console.log(JSON.stringify(out));
await new Promise(r => setTimeout(r, 1200));
const selected = await ev(`(() => {
  const box = document.querySelector('.mark_selection_title_el_tag, .tag-box');
  return { box: box ? box.innerText.replace(/\\s+/g, ' ').trim().slice(0, 120) : null };
})()`);
console.log(JSON.stringify(selected));
process.exit(0);
