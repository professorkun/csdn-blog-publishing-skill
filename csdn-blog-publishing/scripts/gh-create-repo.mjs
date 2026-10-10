// gh-create-repo.mjs — 用个人 token 创建公开仓库
// 用法：node gh-create-repo.mjs <token> <owner> <name> [description] [homepage]
// 安全：token 只经参数传入，不落盘、不打印；执行前确认用户已授权对外创建公开仓库。
const [, , token, owner, name, description = '', homepage = ''] = process.argv;
if (!token || !owner || !name) { console.error('usage: node gh-create-repo.mjs <token> <owner> <name> [desc] [homepage]'); process.exit(2); }

const H = {
  Authorization: 'token ' + token,
  'User-Agent': 'dsh-agent',
  Accept: 'application/vnd.github+json',
};

async function api(url, init = {}) {
  const r = await fetch(url, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}

const existing = await api(`https://api.github.com/repos/${owner}/${name}`);
if (existing.status === 200) {
  console.log('EXISTS ' + existing.json.full_name + ' private=' + existing.json.private);
  process.exit(0);
}

const created = await api('https://api.github.com/user/repos', {
  method: 'POST',
  body: JSON.stringify({ name, description, homepage, private: false, has_issues: true, has_wiki: false, auto_init: false }),
});

if (created.status === 201) {
  console.log(JSON.stringify({
    full_name: created.json.full_name,
    html_url: created.json.html_url,
    clone_url: created.json.clone_url,
    private: created.json.private,
  }, null, 1));
} else {
  console.error('FAILED status=' + created.status);
  console.error(created.text.slice(0, 500));
  process.exit(1);
}
