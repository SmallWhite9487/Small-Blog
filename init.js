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
  // 1. 以去除日期和副檔名的檔名作為標題
  const title = file.replace(/\.(md|html)$/, '').replace(/^\d{4}-\d{2}-\d{2}[-_\s]+/, '');

  // 2. 提取日期
  const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '';

  // ===== 初始化日期 =====
  return {
    file: `articles/${file}`,
    title,
    date
  };
});

fs.writeFileSync(path.join(__dirname, 'posts.json'), JSON.stringify(posts, null, 2), 'utf-8');