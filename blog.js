const list = document.getElementById('blog-list');
const reader = document.getElementById('article-reader');
const content = document.getElementById('article-content');
const backButton = document.getElementById('back-to-list');
let currentRequest;
let lastLink;
let currentArticle;
const cardPreviews = [];

function articleUrl(file) {
    return file.split('/').map(encodeURIComponent).join('/');
}

function articleHtml(post, source) {
    if (!window.DOMPurify || (!post.file.toLowerCase().endsWith('.html') &&
        (!window.marked || !window.markdownExtensionsReady))) {
        throw new Error('文章解析工具載入失敗');
    }
    const html = post.file.toLowerCase().endsWith('.html') ? source : marked.parse(source);
    return DOMPurify.sanitize(html);
}

function articleText(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const blocks = /^(ADDRESS|ARTICLE|BLOCKQUOTE|BR|DIV|H[1-6]|HR|LI|P|PRE|SECTION|TABLE|TD|TH|TR)$/;
    function textOf(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
        if (node.nodeType === Node.ELEMENT_NODE && /^(RT|RP)$/.test(node.tagName)) return '';
        const text = Array.from(node.childNodes, textOf).join('');
        return node.nodeType === Node.ELEMENT_NODE && blocks.test(node.tagName)
            ? ` ${text} `
            : text;
    }
    return textOf(template.content).replace(/\s+/g, ' ').trim();
}

function updateExcerptOverflow() {
    list.querySelectorAll('.excerpt-preview').forEach(preview => {
        const text = preview.querySelector('.article-excerpt');
        preview.classList.toggle('is-overflowing', text.scrollHeight > text.clientHeight + 1);
    });
}

function renderCardPreview(preview) {
    try {
        const text = articleText(articleHtml(preview.post, preview.source));
        preview.excerpt.textContent = text;
        let characters = 0;
        for (const character of text) {
            if (/[\p{L}\p{N}]/u.test(character)) characters++;
        }
        preview.count.textContent = `${characters} 字`;
        updateExcerptOverflow();
    } catch (err) {
        console.error('載入文章預覽失敗:', err);
        preview.excerpt.textContent = '文章預覽載入失敗。';
        preview.count.textContent = '字數無法取得';
    }
}

async function loadCardPreview(post, excerpt, count) {
    try {
        const response = await fetch(articleUrl(post.file));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        const preview = { post, source, excerpt, count };
        cardPreviews.push(preview);
        renderCardPreview(preview);
    } catch (err) {
        console.error('載入文章預覽失敗:', err);
        excerpt.textContent = '文章預覽載入失敗。';
        count.textContent = '字數無法取得';
    }
}

function renderOpenArticle() {
    const { post, source, url } = currentArticle;
    try {
        if (!source.trim()) {
            content.textContent = '這篇文章目前沒有內容。';
            return;
        }
        content.innerHTML = articleHtml(post, source);
        content.querySelectorAll('[href], [src]').forEach(element => {
            const attribute = element.hasAttribute('href') ? 'href' : 'src';
            const value = element.getAttribute(attribute);
            if (value && !value.startsWith('#')) {
                element.setAttribute(attribute, new URL(value, url).href);
            }
        });
    } catch (err) {
        console.error('載入文章失敗:', err);
        content.textContent = '文章載入失敗，請稍後再試。';
    }
}

async function openArticle(post, link) {
    if (currentRequest) currentRequest.abort();
    const request = new AbortController();
    currentRequest = request;
    currentArticle = null;
    lastLink = link;
    list.hidden = true;
    reader.hidden = false;
    content.textContent = '文章載入中…';
    backButton.focus();

    try {
        const url = new URL(articleUrl(post.file), document.baseURI);
        const response = await fetch(url, { signal: request.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        if (request.signal.aborted) return;
        currentArticle = { post, source, url };
        renderOpenArticle();
    } catch (err) {
        if (request.signal.aborted) return;
        console.error('載入文章失敗:', err);
        content.textContent = '文章載入失敗，請稍後再試。';
    }
}

backButton.addEventListener('click', () => {
    if (currentRequest) currentRequest.abort();
    reader.hidden = true;
    list.hidden = false;
    currentArticle = null;
    updateExcerptOverflow();
    if (lastLink) lastLink.focus();
});

document.addEventListener('secret-mode-change', () => {
    cardPreviews.forEach(renderCardPreview);
    if (currentArticle) renderOpenArticle();
});

async function renderArticleCards() {
    try {
        const response = await fetch('posts.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const posts = await response.json();
        posts.sort((a, b) => Number(b.pinned === true || b.file.split('/').pop().startsWith('[T]'))
            - Number(a.pinned === true || a.file.split('/').pop().startsWith('[T]')));

        list.replaceChildren(...posts.map(post => {
            const article = document.createElement('article');
            article.className = 'card-blogs';

            const header = document.createElement('div');
            header.className = 'card-header';
            const title = document.createElement('h2');
            const link = document.createElement('a');
            link.href = articleUrl(post.file);
            link.textContent = post.file.split('/').pop()
                .replace(/^\[T\]/, '')
                .replace(/\.(md|html)$/i, '')
                .replace(/^\d{4}-\d{2}-\d{2}[-_\s]+/, '');
            link.addEventListener('click', event => {
                if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                openArticle(post, link);
            });
            title.appendChild(link);
            const date = document.createElement('div');
            date.className = 'card-types';
            date.textContent = post.date;
            header.append(title, date);

            const excerpt = document.createElement('p');
            excerpt.className = 'article-excerpt';
            excerpt.textContent = '文章預覽載入中…';
            const preview = document.createElement('div');
            preview.className = 'excerpt-preview';
            preview.appendChild(excerpt);
            const count = document.createElement('div');
            count.className = 'article-word-count';
            count.textContent = '字數計算中…';
            article.append(header, preview, count);
            loadCardPreview(post, excerpt, count);
            return article;
        }));
    } catch (err) {
        console.error('載入文章列表失敗:', err);
        list.textContent = location.protocol === 'file:'
            ? '請使用本地 HTTP 伺服器開啟網站，無法直接從檔案載入文章列表。'
            : '文章列表載入失敗，請稍後再試。';
    }
}

new ResizeObserver(updateExcerptOverflow).observe(list);
renderArticleCards();
