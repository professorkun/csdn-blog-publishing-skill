// md2html.mjs — 把文章 Markdown 转成编辑器可用的 HTML（覆盖常用语法）
// 用法：node md2html.mjs <input.md> <output.html>
// 默认截断 "## 关联记录" 及其后内容（该节仅本地保留，不发布）。
import fs from 'node:fs';

const src = fs.readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];

let text = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
const cut = text.indexOf('## 关联记录');
if (cut >= 0) text = text.slice(0, cut);

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  let o = esc(s);
  o = o.replace(/`([^`]+)`/g, '<code>$1</code>');
  o = o.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  o = o.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return o;
}

const lines = text.split(/\r?\n/);
const buf = [];
let i = 0;
let listOpen = null;
const closeList = () => { if (listOpen) { buf.push(`</${listOpen}>`); listOpen = null; } };

while (i < lines.length) {
  const line = lines[i];

  if (/^```/.test(line)) {
    closeList();
    const lang = line.replace(/^```/, '').trim();
    const code = [];
    i++;
    while (i < lines.length && !/^```/.test(lines[i])) { code.push(esc(lines[i])); i++; }
    i++;
    buf.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${code.join('\n')}</code></pre>`);
    continue;
  }

  if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1])) {
    closeList();
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
    const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    buf.push('<table><thead><tr>' + cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
    for (const r of rows.slice(2)) buf.push('<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>');
    buf.push('</tbody></table>');
    continue;
  }

  const h = line.match(/^(#{1,4})\s+(.*)$/);
  if (h) { closeList(); buf.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

  if (/^>\s?/.test(line)) {
    closeList();
    const q = [];
    while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(inline(lines[i].replace(/^>\s?/, ''))); i++; }
    buf.push(`<blockquote>${q.join('<br>')}</blockquote>`);
    continue;
  }

  if (/^\d+\.\s+/.test(line)) {
    if (listOpen !== 'ol') { closeList(); buf.push('<ol>'); listOpen = 'ol'; }
    buf.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
    i++;
    continue;
  }

  if (/^[-*]\s+/.test(line)) {
    if (listOpen !== 'ul') { closeList(); buf.push('<ul>'); listOpen = 'ul'; }
    buf.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
    i++;
    continue;
  }

  if (!line.trim()) { closeList(); i++; continue; }

  closeList();
  buf.push(`<p>${inline(line)}</p>`);
  i++;
}
closeList();

const html = buf.join('\n');
fs.writeFileSync(out, html, 'utf8');
console.log(JSON.stringify({
  htmlBytes: Buffer.byteLength(html, 'utf8'),
  h2: (html.match(/<h2/g) || []).length,
  pre: (html.match(/<pre/g) || []).length,
  table: (html.match(/<table/g) || []).length,
  relatedSectionRemoved: cut >= 0,
}, null, 1));
