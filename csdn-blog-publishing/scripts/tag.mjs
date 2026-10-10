// 向标签输入框输入文字，并打印候选标签
const CDP = 'http://127.0.0.1:9222';
const text = process.argv[2] || '人工智能';

const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find(p => p.type === 'page' && /csdn/.test(p.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 30000); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;

await ev(`(() => { const i = [...document.querySelectorAll('input')].find(x => /键入可添加/.test(x.placeholder||'')); i.focus(); return 'focused'; })()`);
for (const ch of text) {
  await send('Input.insertText', { text: ch });
  await new Promise(r => setTimeout(r, 60));
}
await new Promise(r => setTimeout(r, 1200));

const out = await ev(`(() => {
  const cands = [...document.querySelectorAll('li,div,span')]
    .filter(e => /el_mcm-select|suggest|option|tag/i.test(e.className || ''))
    .map(e => (e.textContent || '').trim()).filter(Boolean);
  const uniq = [...new Set(cands)].slice(0, 25);
  const i = [...document.querySelectorAll('input')].find(x => /键入可添加/.test(x.placeholder||''));
  return { inputValue: i ? i.value : null, cands: uniq };
})()`);
console.log(JSON.stringify(out, null, 1));
process.exit(0);
