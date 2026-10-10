// publish-csdn.mjs — 点击"发布博客"并轮询结果
// 用法：node publish-csdn.mjs [port]
// 注意：这是外部写入动作，执行前必须已取得用户对当前草稿的明确确认。
const PORT = process.argv[2] || '9222';
const CDP = `http://127.0.0.1:${PORT}`;
const BUTTON_TEXT = '发布博客';

const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find(p => p.type === 'page' && /csdn/.test(p.url));
if (!page) { console.error('csdn page not found'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
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
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 30000);
});
await send('Runtime.enable');
const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
};

const clicked = await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === ${JSON.stringify(BUTTON_TEXT)});
  if (!btn) return 'no-button';
  btn.click();
  return 'clicked';
})()`);
console.log('publish click:', clicked);
if (clicked !== 'clicked') process.exit(1);

for (let i = 0; i < 12; i++) {
  await new Promise(r => setTimeout(r, 2500));
  const st = await ev(`({ url: location.href, text: document.body.innerText.replace(/\\s+/g,' ').slice(0, 160) })`);
  console.log(i, st.url);
  if (/creation\/success\//.test(st.url) || /发布成功|审核中|已发布/.test(st.text)) {
    const m = st.url.match(/creation\/success\/(\d+)/);
    console.log(JSON.stringify({ articleId: m ? m[1] : null, pageText: st.text }, null, 1));
    process.exit(0);
  }
}
console.error('no success indication within timeout; check the editor page state');
process.exit(1);
