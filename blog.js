const list = document.getElementById('blog-list');
const reader = document.getElementById('article-reader');
const content = document.getElementById('article-content');
const backButton = document.getElementById('back-to-list');
const furiganaToggle = document.getElementById('show-furigana');
const preferenceStatus = document.getElementById('reading-preference-status');
const articleToc = document.getElementById('article-toc');
const articleTocList = document.getElementById('article-toc-list');
const posterPreview = document.getElementById('poster-preview');
const posterPreviewImage = document.getElementById('poster-preview-image');
const furiganaPreferenceKey = 'furigana-mode';
const legacyFuriganaPreferenceKey = 'show-furigana';
const furiganaModes = ['off', 'focus', 'on'];
let furiganaMode = 'off';
let furiganaFocusPoint = null;
let furiganaFocusFrame = null;
let currentRequest;
let lastLink;
let currentArticle;
const cardPreviews = [];

function reportPreferenceError(error) {
    console.error('假名顯示設定無法儲存或讀取:', error);
    preferenceStatus.textContent = '無法讀取或儲存假名設定，本次選擇僅在此頁面生效。';
    preferenceStatus.hidden = false;
}

try {
    const preference = localStorage.getItem(furiganaPreferenceKey);
    if (furiganaModes.includes(preference)) {
        furiganaMode = preference;
    } else {
        const legacyPreference = localStorage.getItem(legacyFuriganaPreferenceKey);
        if (legacyPreference === 'true') furiganaMode = 'on';
        if (legacyPreference === 'false') furiganaMode = 'off';
    }
} catch (error) {
    reportPreferenceError(error);
}

function clearFuriganaFocus() {
    furiganaFocusPoint = null;
    if (furiganaFocusFrame !== null) {
        cancelAnimationFrame(furiganaFocusFrame);
        furiganaFocusFrame = null;
    }
    content.querySelectorAll('rt, rp').forEach(annotation => {
        annotation.style.removeProperty('--furigana-focus-x');
        annotation.style.removeProperty('--furigana-focus-y');
    });
}

function updateFuriganaFocus() {
    furiganaFocusFrame = null;
    if (furiganaMode !== 'focus' || !furiganaFocusPoint) return;
    const annotations = Array.from(content.querySelectorAll('rt, rp'));
    const bounds = annotations.map(annotation => annotation.getBoundingClientRect());
    annotations.forEach((annotation, index) => {
        annotation.style.setProperty(
            '--furigana-focus-x',
            `${furiganaFocusPoint.x - bounds[index].left}px`
        );
        annotation.style.setProperty(
            '--furigana-focus-y',
            `${furiganaFocusPoint.y - bounds[index].top}px`
        );
    });
}

function scheduleFuriganaFocus() {
    if (furiganaMode === 'focus' && furiganaFocusPoint && furiganaFocusFrame === null) {
        furiganaFocusFrame = requestAnimationFrame(updateFuriganaFocus);
    }
}

function setFuriganaFocusPoint(x, y) {
    if (furiganaMode !== 'focus') return;
    furiganaFocusPoint = { x, y };
    scheduleFuriganaFocus();
}

function updateFurigana() {
    content.classList.toggle('hide-furigana', furiganaMode === 'off');
    content.classList.toggle('focus-furigana', furiganaMode === 'focus');
    furiganaToggle.setAttribute('aria-pressed',
        furiganaMode === 'focus' ? 'mixed' : String(furiganaMode === 'on'));
    furiganaToggle.textContent = {
        off: '顯示假名：關閉',
        focus: '顯示假名：焦點',
        on: '顯示假名：開啟'
    }[furiganaMode];
    clearFuriganaFocus();
}
updateFurigana();

furiganaToggle.addEventListener('click', () => {
    furiganaMode = furiganaModes[(furiganaModes.indexOf(furiganaMode) + 1) % furiganaModes.length];
    updateFurigana();
    try {
        localStorage.setItem(furiganaPreferenceKey, furiganaMode);
        preferenceStatus.hidden = true;
    } catch (error) {
        reportPreferenceError(error);
    }
});

content.addEventListener('pointermove', event => {
    setFuriganaFocusPoint(event.clientX, event.clientY);
});
content.addEventListener('pointerleave', () => {
    if (!content.contains(document.activeElement)) clearFuriganaFocus();
});
content.addEventListener('focusin', event => {
    if (!(event.target instanceof Element)) return;
    const bounds = event.target.getBoundingClientRect();
    setFuriganaFocusPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
});
content.addEventListener('focusout', event => {
    if (!event.relatedTarget || !content.contains(event.relatedTarget)) clearFuriganaFocus();
});
window.addEventListener('scroll', scheduleFuriganaFocus, { passive: true });
window.addEventListener('resize', scheduleFuriganaFocus);

function articleUrl(file) {
    return file.split('/').map(encodeURIComponent).join('/');
}

function articleTags(file) {
    let name = file.split('/').pop();
    let priority = 0;
    let secret = false;
    let match;
    while ((match = /^\[(T[1-3]?|S)\]/.exec(name))) {
        if (match[1] === 'S') {
            secret = true;
        } else {
            const level = match[1] === 'T' ? 1 : Number(match[1].slice(1));
            priority = Math.max(priority, 4 - level);
        }
        name = name.slice(match[0].length);
    }
    return { name, priority, secret };
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

function markdownPreview(source) {
    const tokens = marked.lexer(source);
    let excerpt = '';
    let lineCount = 0;
    let truncated = false;
    for (const token of tokens) {
        if (token.type === 'heading') continue;
        const raw = token.type === 'sortHelper' ? token.cards.map(card => `${card.raw}\n`).join('') : token.raw;
        const lines = raw.match(/[^\n]*\n|[^\n]+$/g) || [];
        const containerLine = line => line.replace(/^(?:(?: {0,3}> ?)|(?: {0,3}(?:[-+*]|\d+[.)])\s+))*/, '');
        let fence = null;
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const nested = token.type === 'blockquote' || token.type === 'list';
            const text = nested ? containerLine(line) : line;
            if (nested) {
                const marker = /^ {0,3}(`{3,}|~{3,})/.exec(text);
                if (marker && !fence) {
                    fence = marker[1];
                } else if (marker && fence && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
                    fence = null;
                } else if (!fence) {
                    if (/^ {0,3}#{1,6}(?:\s|$)/.test(text)) continue;
                    if (text.trim() && index + 1 < lines.length &&
                        /^ {0,3}(?:=+|-+)\s*$/.test(containerLine(lines[index + 1]))) {
                        index++;
                        continue;
                    }
                }
            }
            if (text.trim()) lineCount++;
            if (lineCount > 3) {
                truncated = true;
                break;
            }
            if (lineCount < 3 || text.trim()) excerpt += line;
        }
        if (truncated) break;
    }

    const lexer = new marked.Lexer();
    lexer.tokens.links = tokens.links;
    const template = document.createElement('template');
    template.innerHTML = DOMPurify.sanitize(marked.parser(lexer.lex(excerpt)));
    template.content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => heading.remove());
    return { html: template.innerHTML, truncated };
}

function updateHtmlPreviewOverflow() {
    list.querySelectorAll('.html-excerpt').forEach(excerpt => {
        excerpt.classList.toggle('is-truncated', excerpt.scrollHeight > excerpt.clientHeight + 1);
    });
}

function resolveArticleUrls(container, post) {
    const url = new URL(articleUrl(post.file), document.baseURI);
    container.querySelectorAll('[href], [src]').forEach(element => {
        const attribute = element.hasAttribute('href') ? 'href' : 'src';
        const value = element.getAttribute(attribute);
        if (value && !value.startsWith('#')) {
            element.setAttribute(attribute, new URL(value, url).href);
        }
    });
}

function enablePosterPreview() {
    content.querySelectorAll('.mini-view-card > img.mini-view-poster[src]:not([src=""])').forEach(poster => {
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'mini-view-poster-trigger';
        trigger.setAttribute('aria-label', `放大${poster.alt}`);
        trigger.setAttribute('aria-haspopup', 'dialog');
        poster.before(trigger);
        trigger.appendChild(poster);
        trigger.addEventListener('click', event => {
            event.preventDefault();
            trigger.focus({ preventScroll: true });
            posterPreviewImage.alt = poster.alt;
            posterPreviewImage.src = poster.currentSrc || poster.src;
            posterPreview.showModal();
        });
    });
}

posterPreview.addEventListener('click', event => {
    if (event.target === posterPreview) posterPreview.close();
});
posterPreview.addEventListener('close', () => {
    if (!posterPreview.open) posterPreviewImage.removeAttribute('src');
});

function clearArticleToc() {
    articleToc.hidden = true;
    articleTocList.replaceChildren();
}

function renderMarkdownArticle(source) {
    if (!window.DOMPurify || !window.marked || !window.markdownExtensionsReady) {
        throw new Error('文章解析工具載入失敗');
    }
    const tokens = marked.lexer(source.replace(/\r\n?|\n/g, '\n'));
    for (const token of tokens) {
        if (token.type === 'heading' && token.depth <= 3 &&
            /^ {0,3}#{1,3}(?:[ \t]|$)/.test(token.raw)) {
            token.tokens.push({
                type: 'html',
                raw: '',
                text: '<span data-toc-heading></span>'
            });
        }
    }
    content.innerHTML = DOMPurify.sanitize(marked.parser(tokens));
    updateArticleToc();
    enableCardSorting();
}

function plainArticleTitle(element) {
    const title = element.cloneNode(true);
    title.querySelectorAll('rt, rp').forEach(annotation => annotation.remove());
    return title.textContent.trim();
}

function updateArticleToc() {
    clearArticleToc();
    const tocEntries = content.querySelectorAll(
        'h1 > [data-toc-heading], h2 > [data-toc-heading], h3 > [data-toc-heading], ' +
        '.mini-view-card > .mini-view-details > .mini-view-title'
    );
    tocEntries.forEach(entry => {
        const card = entry.matches('.mini-view-title') ? entry.closest('.mini-view-card') : null;
        const target = card || entry.parentElement;
        const level = card ? '2' : target.tagName.slice(1);
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `toc-level-${level}`;
        const label = document.createElement('span');
        label.className = 'toc-title';
        label.textContent = plainArticleTitle(card ? entry : target) || '（無標題）';
        button.appendChild(label);
        button.addEventListener('click', () => {
            target.scrollIntoView({ block: 'start' });
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        });
        item.appendChild(button);
        articleTocList.appendChild(item);
    });
    articleToc.hidden = !articleTocList.children.length;
}

function enableCardSorting() {
    const names = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
    content.querySelectorAll('.mini-view-sort > .mini-view-sort-list').forEach(group => {
        const slots = Array.from(group.children);
        const cards = slots.filter(node => node.matches('.mini-view-card[data-rating]')).map(node => ({
            node,
            name: plainArticleTitle(node.querySelector('.mini-view-title')),
            rating: Number(node.dataset.rating)
        }));
        if (!cards.length) return;
        group.insertAdjacentHTML('beforebegin', `
            <div class="mini-view-sort-toolbar" role="group" aria-label="評分卡排序">
                <label>排序依據
                    <select class="mini-view-sort-key">
                        <option value="original">默認</option>
                        <option value="name">名稱</option>
                        <option value="rating">評分</option>
                    </select>
                </label>
                <label>排序方向
                    <select class="mini-view-sort-direction" disabled>
                        <option value="asc">升序</option>
                        <option value="desc">降序</option>
                    </select>
                </label>
            </div>`);
        const toolbar = group.previousElementSibling;
        const key = toolbar.querySelector('.mini-view-sort-key');
        const direction = toolbar.querySelector('.mini-view-sort-direction');
        toolbar.addEventListener('change', () => {
            direction.disabled = key.value === 'original';
            const ordered = cards.slice();
            if (!direction.disabled) {
                const sign = direction.value === 'desc' ? -1 : 1;
                ordered.sort((a, b) => sign * (key.value === 'name'
                    ? names.compare(a.name, b.name)
                    : a.rating - b.rating));
            }
            let index = 0;
            group.replaceChildren(...slots.map(node => node.matches('.mini-view-card[data-rating]')
                ? ordered[index++].node : node));
            updateArticleToc();
        });
    });
}

function renderCardPreview(preview) {
    preview.article.hidden = preview.post.secret && !secretMode;
    try {
        const html = articleHtml(preview.post, preview.source);
        const text = articleText(html);
        if (preview.post.file.toLowerCase().endsWith('.html')) {
            preview.excerpt.textContent = text;
            preview.excerpt.classList.add('html-excerpt');
            updateHtmlPreviewOverflow();
        } else {
            const result = markdownPreview(preview.source);
            preview.excerpt.innerHTML = result.html;
            preview.excerpt.classList.toggle('is-truncated', result.truncated);
            resolveArticleUrls(preview.excerpt, preview.post);
            preview.excerpt.querySelectorAll('a, button, input, select, textarea').forEach(element => {
                element.tabIndex = -1;
            });
        }
        let characters = 0;
        for (const character of text) {
            if (/[\p{L}\p{N}]/u.test(character)) characters++;
        }
        preview.count.textContent = `${characters} 字`;
    } catch (err) {
        console.error('載入文章預覽失敗:', err);
        preview.excerpt.textContent = '文章預覽載入失敗。';
        preview.count.textContent = '字數無法取得';
    }
}

async function loadCardPreview(post, excerpt, count, article) {
    try {
        const response = await fetch(articleUrl(post.file));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        const preview = { post, source, excerpt, count, article };
        cardPreviews.push(preview);
        renderCardPreview(preview);
    } catch (err) {
        console.error('載入文章預覽失敗:', err);
        excerpt.textContent = '文章預覽載入失敗。';
        count.textContent = '字數無法取得';
    }
}

function renderOpenArticle() {
    const { post, source } = currentArticle;
    if (posterPreview.open) posterPreview.close();
    clearArticleToc();
    if (post.secret && !secretMode) {
        content.textContent = '此文章僅在隱藏模式下顯示。';
        return;
    }
    try {
        if (!source.trim()) {
            content.textContent = '這篇文章目前沒有內容。';
            return;
        }
        if (post.file.toLowerCase().endsWith('.html')) {
            content.innerHTML = articleHtml(post, source);
        } else {
            renderMarkdownArticle(source);
        }
        resolveArticleUrls(content, post);
        enablePosterPreview();
    } catch (err) {
        clearArticleToc();
        console.error('載入文章失敗:', err);
        content.textContent = '文章載入失敗，請稍後再試。';
    }
}

async function openArticle(post, link) {
    if (currentRequest) currentRequest.abort();
    const request = new AbortController();
    currentRequest = request;
    currentArticle = null;
    clearArticleToc();
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
        currentArticle = { post, source };
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
    clearArticleToc();
    updateHtmlPreviewOverflow();
    if (lastLink) lastLink.focus();
});

document.addEventListener('secret-mode-change', () => {
    list.querySelectorAll('.card-blogs[data-secret-only]').forEach(article => {
        article.hidden = !secretMode;
    });
    cardPreviews.forEach(renderCardPreview);
    if (currentArticle) renderOpenArticle();
});

async function renderArticleCards() {
    try {
        const response = await fetch('posts.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const posts = (await response.json()).map(post => {
            const tags = articleTags(post.file);
            return {
                ...post,
                priority: tags.priority || (post.pinned === true ? 3 : 0),
                secret: tags.secret || post.secret === true,
                title: tags.name
                    .replace(/\.(md|html)$/i, '')
                    .replace(/^\d{4}-\d{2}-\d{2}[-_\s]+/, '')
            };
        });
        posts.sort((a, b) => b.priority - a.priority);

        list.replaceChildren(...posts.map(post => {
            const article = document.createElement('article');
            article.className = 'card-blogs';
            if (post.secret) {
                article.dataset.secretOnly = 'true';
                article.hidden = !secretMode;
            }

            const header = document.createElement('div');
            header.className = 'card-header';
            const title = document.createElement('h2');
            const link = document.createElement('a');
            link.href = articleUrl(post.file);
            link.textContent = post.title;
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

            const excerpt = document.createElement('div');
            excerpt.className = 'article-excerpt';
            excerpt.textContent = '文章預覽載入中…';
            const preview = document.createElement('div');
            preview.className = 'excerpt-preview';
            preview.appendChild(excerpt);
            const count = document.createElement('div');
            count.className = 'article-word-count';
            count.textContent = '字數計算中…';
            article.append(header, preview, count);
            loadCardPreview(post, excerpt, count, article);
            return article;
        }));
    } catch (err) {
        console.error('載入文章列表失敗:', err);
        list.textContent = location.protocol === 'file:'
            ? '請使用本地 HTTP 伺服器開啟網站，無法直接從檔案載入文章列表。'
            : '文章列表載入失敗，請稍後再試。';
    }
}

new ResizeObserver(updateHtmlPreviewOverflow).observe(list);
renderArticleCards();
