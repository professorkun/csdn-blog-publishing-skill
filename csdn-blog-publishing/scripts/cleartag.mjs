// 清空标签输入框里的文字（用于切换下一个候选）
const CDP = 'http://127.0.0.1:9222';
const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find(p => p.type === 'page' && /csdn/.test(p.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout')); } }, 30000); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;

await ev(`(() => { const i = [...document.querySelectorAll('input')].find(x => /键入可添加/.test(x.placeholder||'')); i.focus(); i.select(); return i.value; })()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8, key: 'Backspace', code: 'Backspace' });
await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8, key: 'Backspace', code: 'Backspace' });
await new Promise(r => setTimeout(r, 800));
const out = await ev(`(() => { const i = [...document.querySelectorAll('input')].find(x => /键入可添加/.test(x.placeholder||'')); const box = document.querySelector('.mark_selection_title_el_tag'); const open = !!i && i.offsetParent !== null; const options = open ? [...document.querySelectorAll('.el_mcm-select-dropdown li, .el_mcm-select-dropdown__item')].map(e=>e.innerText.trim()).filter(Boolean).slice(0,8) : []; return { inputValue: i ? i.value : null, selected: box ? box.innerText.replace(/\\s+/g,' ').trim().slice(0,80) : null, options }; })()`);
console.log(JSON.stringify(out, null, 1));
process.exit(0);
