// mk-readme.mjs — 由发布正文生成 GitHub README（去 front matter/内部链接/关联记录）
// 用法：node mk-readme.mjs <body.md> <README.md> <articleUrl> [repoTitle]
import fs from 'node:fs';

const [, , srcPath, outPath, articleUrl, repoTitle] = process.argv;
if (!srcPath || !outPath || !articleUrl) {
  console.error('usage: node mk-readme.mjs <body.md> <README.md> <articleUrl> [repoTitle]');
  process.exit(2);
}

const src = fs.readFileSync(srcPath, 'utf8');
let body = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
// 去掉正文自带 H1 与首个引用块（README 头部会重写）
body = body.replace(/^\s*#\s+.*\r?\n/, '');
body = body.replace(/^\s*>.*\r?\n(>\s*\r?\n)?/, '');
const cut = body.indexOf('## 关联记录');
body = (cut >= 0 ? body.slice(0, cut) : body).trim();
// 公开仓库不保留内部链接语法
body = body.replace(/\[\[[^\]]+\]\]/g, '').replace(/\n{3,}/g, '\n\n');

const title = repoTitle || (src.match(/^#\s+(.+)$/m) || [])[1] || '技术记录';
const header = `# ${title}

> 本文同步自 CSDN 博客：[${title}](${articleUrl})
>
> 文中出现的主机、路径、账号、渠道标识与配置项均为通用描述或占位符，不代表任何具体部署环境；示例代码只保留最小可运行片段。

---

`;

const out = header + body + '\n';
fs.writeFileSync(outPath, out, 'utf8');
console.log(JSON.stringify({
  bytes: Buffer.byteLength(out, 'utf8'),
  internalLinkLeak: /\[\[|\]\]/.test(out),
  relatedSectionRemoved: cut >= 0,
  lines: out.split('\n').length,
}, null, 1));
