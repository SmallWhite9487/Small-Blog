// ===== 初始化 =====
const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'articles');
const files = fs.readdirSync(postsDir)
  .filter(file => file.endsWith('.md') || file.endsWith('.html'))
  .sort()
  .reverse();

// ===== 生成文章列表 =====
const posts = files.map(file => {
  let name = file;
  let priority = 0;
  let secret = false;
  let tag;
  while ((tag = /^\[(T[1-3]?|S)\]/.exec(name))) {
    if (tag[1] === 'S') {
      secret = true;
    } else {
      const level = tag[1] === 'T' ? 1 : Number(tag[1].slice(1));
      priority = Math.max(priority, 4 - level);
    }
    name = name.slice(tag[0].length);
  }
  const pinned = priority > 0;
  // 1. 以去除日期和副檔名的檔名作為標題
  const title = name.replace(/\.(md|html)$/, '').replace(/^\d{4}-\d{2}-\d{2}[-_\s]+/, '');

  // 2. 提取日期
  const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '';

  // ===== 初始化日期 =====
  return {
    file: `articles/${file}`,
    title,
    date,
    pinned,
    priority,
    secret
  };
});

fs.writeFileSync(path.join(__dirname, 'posts.json'), JSON.stringify(posts, null, 2), 'utf-8');