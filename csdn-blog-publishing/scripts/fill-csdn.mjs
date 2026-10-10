// fill-csdn.mjs — 向 CSDN 编辑器写入标题与正文（HTML），并回读校验
// 用法：node fill-csdn.mjs <title> <body.html> [port]
// 依赖：Node 22+（内置 WebSocket）；编辑器已打开且已登录。
import fs from 'node:fs';

const [, , TITLE, HTML_PATH, PORT = '9222'] = process.argv;
if (!TITLE || !HTML_PATH) { console.error('usage: node fill-csdn.mjs <title> <body.html> [port]'); process.exit(2); }
const CDP = `http://127.0.0.1:${PORT}`;
const html = fs.readFileSync(HTML_PATH, 'utf8');
const b64 = Buffer.from(html, 'utf8').toString('base64');

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
  setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 60000);
});
await send('Runtime.enable');
const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result?.value;
};

// 1) 标题：必须用原生 setter，否则框架不认
console.log('title:', await ev(`(() => {
  const ta = document.querySelector('textarea.el_mcm-textarea__inner');
  if (!ta) return 'title-textarea-not-found';
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, ${JSON.stringify(TITLE)});
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new Event('change', { bubbles: true }));
  return ta.value;
})()`));

// 2) 正文：CKEditor setData；base64 -> bytes -> UTF-8 解码，否则中文变实体
console.log('body:', await ev(`(() => {
  const names = window.CKEDITOR && CKEDITOR.instances ? Object.keys(CKEDITOR.instances) : [];
  if (!names.length) return 'no-editor';
  const bin = atob(${JSON.stringify(b64)});
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  CKEDITOR.instances[names[0]].setData(new TextDecoder('utf-8').decode(bytes));
  return 'ok';
})()`));

await new Promise(r => setTimeout(r, 1500));
console.log('readback:', JSON.stringify(await ev(`(() => {
  const names = window.CKEDITOR && CKEDITOR.instances ? Object.keys(CKEDITOR.instances) : [];
  const data = names.length ? CKEDITOR.instances[names[0]].getData() : '';
  const ta = document.querySelector('textarea.el_mcm-textarea__inner');
  const h1 = data.match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/);
  return {
    title: ta ? ta.value : null,
    dataLen: data.length,
    h2: (data.match(/<h2/g) || []).length,
    pre: (data.match(/<pre/g) || []).length,
    table: (data.match(/<table/g) || []).length,
    h1: h1 ? h1[1] : '',
  };
})()`), null, 1));
process.exit(0);
