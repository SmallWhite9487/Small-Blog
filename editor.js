(() => {
    const token = window.localEditorToken;
    delete window.localEditorToken;
    const editor = document.createElement('section');
    editor.className = 'local-editor';
    editor.hidden = true;
    editor.innerHTML = `
        <div class="editor-filebar">
            <label>文章 <select id="editor-file" aria-label="選擇文章"></select></label>
            <button type="button" id="editor-new">新增文章</button>
            <button type="button" id="editor-save">儲存</button>
            <button type="button" id="editor-view">僅預覽</button>
            <span id="editor-status" role="status" aria-live="polite"></span>
        </div>
        <label id="editor-name-row" hidden>檔名 <input id="editor-name" placeholder="2026-11-24-標題.md"></label>
        <div class="editor-toolbar" role="toolbar" aria-label="編輯工具">
            <button type="button" data-action="h1">H1</button>
            <button type="button" data-action="h2">H2</button>
            <button type="button" data-action="h3">H3</button>
            <button type="button" data-action="bold">粗體</button>
            <button type="button" data-action="italic">斜體</button>
            <button type="button" data-action="strike">刪除線</button>
            <button type="button" data-action="code">行內程式碼</button>
            <button type="button" data-action="quote">引用</button>
            <button type="button" data-action="list">列表</button>
            <button type="button" data-action="link">連結</button>
            <button type="button" data-action="image">圖片</button>
            <button type="button" data-action="ruby">假名</button>
            <button type="button" data-action="url">自訂連結</button>
            <button type="button" data-action="hide">隱藏文字</button>
            <button type="button" data-action="time">日期計數</button>
            <button type="button" data-action="card">評分卡</button>
            <button type="button" data-action="sort">排序區塊</button>
            <button type="button" data-action="series">系列</button>
            <button type="button" data-action="placeholder">佔位符</button>
            <form class="editor-url-form" hidden>
                <label>網址 <input aria-label="連結或圖片網址" required></label>
                <button type="submit" title="確認網址" aria-label="確認網址">✓</button>
                <button type="button" class="editor-url-cancel" title="取消" aria-label="取消">×</button>
            </form>
        </div>
        <p class="editor-hint">直接輸入或選取文字後使用工具列；點擊自訂指令可修改參數。無法編輯的區塊會保留原文。</p>
        <textarea id="editor-source" hidden tabindex="-1" aria-hidden="true"></textarea>
        <dialog class="editor-dialog" aria-labelledby="editor-dialog-title">
            <form>
                <h2 id="editor-dialog-title"></h2>
                <div class="editor-dialog-fields"></div>
                <p class="editor-dialog-error" role="alert"></p>
                <div class="editor-dialog-actions">
                    <button type="button" class="editor-dialog-cancel">取消</button>
                    <button type="submit">確定</button>
                </div>
            </form>
        </dialog>`;
    content.before(editor);
    const newArticle = document.createElement('button');
    newArticle.type = 'button';
    newArticle.className = 'local-editor-new';
    newArticle.textContent = '＋ 新增文章';
    list.before(newArticle);
    const $ = selector => editor.querySelector(selector);
    const file = $('#editor-file');
    const nameInput = $('#editor-name');
    const nameRow = $('#editor-name-row');
    const source = $('#editor-source');
    const status = $('#editor-status');
    const saveButton = $('#editor-save');
    const viewButton = $('#editor-view');
    const toolbar = $('.editor-toolbar');
    const urlForm = $('.editor-url-form');
    const urlInput = urlForm.querySelector('input');
    let pendingUrl = null;
    const toolbarIcons = {
        h1: 'H₁', h2: 'H₂', h3: 'H₃', bold: '𝐁', italic: '𝑰',
        strike: 'S̶', code: '‹›', quote: '❝', list: '☷', link: '↗',
        image: '▧', ruby: 'あ', url: '↗̲', hide: '◉', time: '◷',
        card: '★', sort: '⇅', series: '▤', placeholder: '□'
    };
    toolbar.querySelectorAll('button[data-action]').forEach(button => {
        const label = button.textContent;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.textContent = toolbarIcons[button.dataset.action];
    });
    let activeName = '';
    let savedSource = '';
    let savedName = '';
    let currentRevision = null;
    let lineEnding = '\n';
    let busy = false;
    let previewOnly = false;
    let parts = [];
    let visualValid = true;
    let composing = false;
    let manualHistory = [];
    let manualCursor = 0;
    const blockOriginals = new WeakMap();
    const rawComments = new WeakMap();

    function dirty() {
        return composing || !visualValid || source.value !== savedSource || (!currentRevision && nameInput.value !== savedName);
    }

    function setStatus(message, error = false) {
        status.textContent = message;
        status.classList.toggle('editor-error', error);
    }

    function recordManualHistory(before) {
        if (before === source.value) return;
        manualHistory = manualHistory.slice(0, manualCursor);
        if (manualHistory.length && manualHistory[manualHistory.length - 1].after !== before) {
            manualHistory = [];
        }
        manualHistory.push({ before, after: source.value });
        manualCursor = manualHistory.length;
    }

    async function api(path, options = {}) {
        const headers = { 'X-Editor-Token': token, ...options.headers };
        const response = await fetch(path, { ...options, headers, cache: 'no-store' });
        if (!response.headers.get('Content-Type')?.includes('application/json')) {
            throw new Error(`伺服器回應錯誤（HTTP ${response.status}）。`);
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    }

    function confirmDiscard() {
        return !dirty() || window.confirm('文章尚未儲存，確定捨棄修改嗎？');
    }

    function showEditor() {
        newArticle.hidden = true;
        list.hidden = true;
        reader.hidden = false;
        editor.hidden = false;
    }

    list.addEventListener('click', event => {
        const link = event.target.closest('.card-header h2 a');
        if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const filename = decodeURIComponent(new URL(link.href).pathname.split('/').pop());
        if (!filename.toLowerCase().endsWith('.md')) return;
        event.preventDefault();
        event.stopPropagation();
        if (busy || !confirmDiscard()) return;
        showEditor();
        load(filename);
    }, true);

    backButton.addEventListener('click', event => {
        if (editor.hidden) return;
        event.stopImmediatePropagation();
        if (busy || !confirmDiscard()) return;
        reader.hidden = true;
        editor.hidden = true;
        list.hidden = false;
        newArticle.hidden = false;
        source.value = savedSource = '';
        activeName = '';
        currentRevision = null;
        clearArticleToc();
    }, true);

    function escapeEditableText(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, '\\$&');
    }

    function addPart(raw) {
        const part = { raw };
        parts.push(part);
        return part;
    }

    function addEditableText(parent, raw, allowNewlines, text = raw) {
        const part = addPart(raw);
        const span = document.createElement('span');
        span.className = 'editor-text';
        span.textContent = text;
        span.dataset.editorRaw = raw;
        span.dataset.editorText = text;
        part.element = span;
        parent.appendChild(span);
    }

    function inlineMarkdown(root) {
        const segments = [];
        function push(raw, styles) {
            if (!raw) return;
            const key = styles.join(',');
            const last = segments[segments.length - 1];
            if (last && last.key === key) last.raw += raw;
            else segments.push({ raw, styles, key });
        }
        function walk(node, styles) {
            if (node.nodeType === Node.TEXT_NODE) {
                push(escapeEditableText(node.data), styles);
                return;
            }
            if (node.nodeType === Node.COMMENT_NODE) return;
            if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
                throw new Error('正文包含無法保存的內容。');
            }
            if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                node.childNodes.forEach(child => walk(child, styles));
                return;
            }
            if (node.getAttribute('contenteditable') === 'false') {
                if (!node.hasAttribute('data-editor-raw')) throw new Error('受保護內容無法安全保存。');
                push(node.dataset.editorRaw, styles);
                return;
            }
            const tag = node.tagName;
            if (tag === 'BR') {
                push(node.dataset.editorRaw || '  \n', styles);
                return;
            }
            if (node.classList.contains('editor-text') &&
                Array.from(node.childNodes).every(child => child.nodeType === Node.TEXT_NODE)) {
                const text = node.textContent;
                push(text === node.dataset.editorText ? node.dataset.editorRaw : escapeEditableText(text), styles);
                return;
            }
            if (tag === 'CODE') {
                const text = node.textContent;
                const longest = Math.max(0, ...Array.from(text.matchAll(/`+/g), match => match[0].length));
                const fence = '`'.repeat(longest + 1);
                const padding = /^[ `]|[ `]$/.test(text) && text.trim() ? ' ' : '';
                push(fence + padding + text + padding + fence, styles);
                return;
            }
            if (tag === 'A') {
                const prefix = node.dataset.editorLinkPrefix || '[';
                const href = (node.getAttribute('href') || '').replace(/[\\()]/g, '\\$&').replace(/ /g, '%20');
                const suffix = node.dataset.editorLinkSuffix || `](${href})`;
                push(prefix + inlineMarkdown(node) + suffix, styles);
                return;
            }
            const names = { B: 'bold', STRONG: 'bold', I: 'italic', EM: 'italic',
                S: 'strike', STRIKE: 'strike', DEL: 'strike' };
            const next = new Set(styles);
            if (names[tag]) next.add(names[tag]);
            if (node.style.fontWeight === 'normal' || node.style.fontWeight === '400') next.delete('bold');
            if (node.style.fontStyle === 'normal') next.delete('italic');
            if (node.style.textDecorationLine === 'none') next.delete('strike');
            if (!['SPAN', 'B', 'STRONG', 'I', 'EM', 'S', 'STRIKE', 'DEL', 'U'].includes(tag)) {
                throw new Error(`無法安全保存「${tag}」格式。`);
            }
            const ordered = ['bold', 'italic', 'strike'].filter(style => next.has(style));
            node.childNodes.forEach(child => walk(child, ordered));
        }
        root.childNodes.forEach(node => walk(node, []));
        const normalized = [];
        for (const segment of segments) {
            if (!segment.styles.length) {
                normalized.push(segment);
                continue;
            }
            const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(segment.raw);
            if (match[1]) normalized.push({ raw: match[1], styles: [] });
            if (match[2]) normalized.push({ raw: match[2], styles: segment.styles });
            if (match[3]) normalized.push({ raw: match[3], styles: [] });
        }
        const markers = { bold: '**', italic: '*', strike: '~~' };
        let output = '';
        let active = [];
        for (const segment of normalized) {
            let common = 0;
            while (common < active.length && common < segment.styles.length &&
                   active[common] === segment.styles[common]) common++;
            for (let i = active.length - 1; i >= common; i--) output += markers[active[i]];
            for (let i = common; i < segment.styles.length; i++) output += markers[segment.styles[i]];
            output += segment.raw;
            active = segment.styles;
        }
        for (let i = active.length - 1; i >= 0; i--) output += markers[active[i]];
        return output;
    }

    function blockMarkdown(block) {
        const original = blockOriginals.get(block);
        if (original && block.innerHTML === original.html) return original.raw;
        if (block.getAttribute('contenteditable') === 'false') {
            if (!block.classList.contains('editor-protected-block') || !block.hasAttribute('data-editor-raw')) {
                throw new Error('受保護區塊無法安全保存。');
            }
            return block.dataset.editorRaw;
        }
        const tag = block.tagName;
        if (/^H[1-6]$/.test(tag)) {
            const prefix = original?.prefix || '#'.repeat(Number(tag[1])) + ' ';
            return prefix + inlineMarkdown(block) + (original?.suffix || '');
        }
        if (tag === 'BLOCKQUOTE') {
            const nested = Array.from(block.children).some(child => /^(P|DIV)$/.test(child.tagName));
            if (nested && (Array.from(block.childNodes).some(node =>
                node.nodeType === Node.TEXT_NODE && node.textContent.trim()) ||
                Array.from(block.children).some(child => !/^(P|DIV)$/.test(child.tagName)))) {
                throw new Error('混合引用內容無法安全保存。');
            }
            const text = nested ? Array.from(block.children).map(child => blockMarkdown(child)).join('\n')
                : inlineMarkdown(block);
            return text.split('\n').map(line => '> ' + line).join('\n') +
                (original?.raw.endsWith('\n') ? '\n' : '');
        }
        if (tag === 'UL' || tag === 'OL') {
            return Array.from(block.children).map((item, index) => {
                if (item.tagName !== 'LI') throw new Error('列表內容無法安全保存。');
                return `${tag === 'UL' ? '-' : `${index + 1}.`} ${inlineMarkdown(item)}`;
            }).join('\n');
        }
        if (tag === 'P' || tag === 'DIV') {
            const nested = Array.from(block.children).filter(child => /^(P|DIV|UL|OL|BLOCKQUOTE|H[1-6])$/.test(child.tagName));
            if (nested.length) {
                if (Array.from(block.childNodes).some(node =>
                    node.nodeType === Node.TEXT_NODE && node.textContent.trim()) ||
                    Array.from(block.children).some(child => !nested.includes(child))) {
                    throw new Error('混合區塊內容無法安全保存。');
                }
                return nested.map(blockMarkdown).join('\n\n') + (original?.suffix || '');
            }
            if (block.childNodes.length === 1 && block.firstChild.nodeName === 'BR') return '<br>' + (original?.suffix || '');
            return inlineMarkdown(block) + (original?.suffix || '');
        }
        throw new Error(`無法安全保存「${tag}」區塊。`);
    }

    function syncVisual() {
        try {
            let result = '';
            let previousBlock = false;
            let boundary = false;
            for (const node of content.childNodes) {
                if (node.nodeType === Node.COMMENT_NODE) {
                    if (!rawComments.has(node)) throw new Error('文章結構無法安全保存。');
                    result += rawComments.get(node);
                    boundary = true;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const raw = blockMarkdown(node);
                    if (!raw && blockOriginals.get(node)?.placeholder) continue;
                    if (previousBlock && (!boundary || blockOriginals.get(node)?.placeholder)) {
                        if (!result.endsWith('\n\n')) result += result.endsWith('\n') ? '\n' : '\n\n';
                    }
                    result += raw;
                    previousBlock = true;
                    boundary = false;
                } else if (node.nodeType === Node.TEXT_NODE) {
                    result += escapeEditableText(node.data);
                    previousBlock = true;
                    boundary = false;
                } else {
                    throw new Error('文章結構無法安全保存。');
                }
            }
            source.value = result;
            visualValid = true;
            changed(false);
            return true;
        } catch (error) {
            visualValid = false;
            console.error('正文同步失敗:', error);
            setStatus(`無法安全保存：${error.message} 請撤銷最後的操作。`, true);
            return false;
        }
    }

    const commandLabels = {
        ruby: ['文字', '假名'], pronouns: ['文字', '假名'],
        link: ['文字', '網址'], url: ['文字', '網址'],
        hide: ['一般模式文字', '隱藏模式文字'], secret: ['一般模式文字', '隱藏模式文字'],
        time: ['日期（YYYY-MM-DD）', '單位（y、m、d）'],
        time_counter: ['日期（YYYY-MM-DD）', '單位（y、m、d）'],
        mini_view_card: ['作品標題', '評分（1.0–5.0）', '評論', '海報網址']
    };

    function commandInfo(raw) {
        const match = /^c_([a-z_]+)\(/.exec(raw);
        if (!match || !commandLabels[match[1]]) return null;
        const parsed = parseCommandArguments(raw, match[1], commandLabels[match[1]].length);
        return parsed && parsed.raw === raw ? { name: match[1], args: parsed.args } : null;
    }

    function editFields(title, labels, values, onApply, onRemove) {
        const dialog = $('.editor-dialog');
        const form = dialog.querySelector('form');
        const fields = dialog.querySelector('.editor-dialog-fields');
        const error = dialog.querySelector('.editor-dialog-error');
        dialog.querySelector('#editor-dialog-title').textContent = title;
        error.textContent = '';
        fields.replaceChildren();
        const inputs = labels.map((label, index) => {
            const wrapper = document.createElement('label');
            wrapper.textContent = label;
            const input = document.createElement(label.includes('評論') || values[index].length > 120 ? 'textarea' : 'input');
            input.value = values[index];
            wrapper.appendChild(input);
            fields.appendChild(wrapper);
            return input;
        });
        let remove = form.querySelector('.editor-dialog-remove');
        if (remove) remove.remove();
        if (onRemove) {
            remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'editor-dialog-remove';
            remove.textContent = '刪除';
            remove.addEventListener('click', () => {
                if (!window.confirm('確定刪除這個內容嗎？')) return;
                dialog.close();
                onRemove();
            });
            dialog.querySelector('.editor-dialog-actions').prepend(remove);
        }
        form.onsubmit = event => {
            event.preventDefault();
            try {
                const commit = onApply(inputs.map(input => input.value));
                dialog.close();
                if (typeof commit === 'function') commit();
            } catch (problem) {
                if (!dialog.open) dialog.showModal();
                error.textContent = problem.message;
            }
        };
        dialog.querySelector('.editor-dialog-cancel').onclick = () => dialog.close();
        dialog.showModal();
        inputs[0]?.focus();
    }

    function commandEditor(raw, update, remove) {
        const info = commandInfo(raw);
        if (!info) return;
        editFields(`編輯 c_${info.name}`, commandLabels[info.name], info.args, values => {
            if (values.every((value, index) => value === info.args[index])) return;
            if (info.name === 'time' || info.name === 'time_counter') timeCounter(values[0], values[1]);
            if (info.name === 'mini_view_card' &&
                (!/^\d+(?:\.\d+)?$/.test(values[1]) || Number(values[1]) < 1 || Number(values[1]) > 5)) {
                throw new Error('評分必須介於 1.0 至 5.0。');
            }
            const next = `c_${info.name}(${values.map(quoted).join(', ')})`;
            if (!commandInfo(next)) throw new Error('指令內容無效，請檢查嵌套指令。');
            update(next);
        }, remove);
    }

    function updatePart(part, raw) {
        const before = source.value;
        part.raw = raw;
        part.element.dataset.editorRaw = raw;
        if (syncVisual()) {
            recordManualHistory(before);
            renderPreview();
        }
    }

    function protectInline(parent, token) {
        const part = addPart(token.raw);
        const span = document.createElement('span');
        span.className = 'editor-protected';
        span.contentEditable = 'false';
        span.dataset.editorRaw = token.raw;
        part.element = span;
        span.innerHTML = DOMPurify.sanitize(marked.Parser.parseInline([token], marked.defaults));
        const info = commandInfo(token.raw);
        if (info || token.type === 'placeholder') {
            span.classList.add('editor-command');
            span.tabIndex = 0;
            span.setAttribute('role', 'button');
            span.title = '點擊編輯指令';
        } else {
            span.title = '此內容受保護，原文會保留';
        }
        parent.appendChild(span);
    }

    function openInlineCommand(event) {
        const element = event.target.closest('.editor-protected.editor-command');
        if (!element || !content.contains(element) || previewOnly) return;
        event.preventDefault();
        event.stopPropagation();
        const update = raw => {
            const before = source.value;
            element.dataset.editorRaw = raw;
            if (syncVisual()) {
                recordManualHistory(before);
                renderPreview();
            }
        };
        const remove = () => {
            const before = source.value;
            element.remove();
            if (syncVisual()) {
                recordManualHistory(before);
                renderPreview();
            }
        };
        if (commandInfo(element.dataset.editorRaw)) {
            commandEditor(element.dataset.editorRaw, update, remove);
        } else {
            editFields('佔位符', [], [], () => {}, remove);
        }
    }
    content.addEventListener('click', openInlineCommand);
    content.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            if (event.target.closest('.editor-protected.editor-command')) openInlineCommand(event);
        }
    });

    function addInline(parent, tokens, allowNewlines) {
        for (const token of tokens) {
            if ((token.type === 'text' && !token.tokens) || token.type === 'escape') {
                const template = document.createElement('template');
                template.innerHTML = DOMPurify.sanitize(marked.Parser.parseInline([token], marked.defaults));
                if (!template.content.children.length) {
                    addEditableText(parent, token.raw, allowNewlines, template.content.textContent);
                } else {
                    protectInline(parent, token);
                }
            } else if (token.type === 'br') {
                addPart(token.raw);
                const br = document.createElement('br');
                br.dataset.editorRaw = token.raw;
                parent.appendChild(br);
            } else if (token.type === 'codespan') {
                addPart(token.raw);
                const code = document.createElement('code');
                code.textContent = token.text;
                parent.appendChild(code);
            } else if (['strong', 'em', 'del', 'link'].includes(token.type) &&
                inlineMatches(token.tokens, token.text) && token.raw.includes(token.text)) {
                const template = document.createElement('template');
                template.innerHTML = DOMPurify.sanitize(marked.Parser.parseInline([token], marked.defaults));
                const element = template.content.firstElementChild;
                if (!element || template.content.children.length !== 1) {
                    protectInline(parent, token);
                    continue;
                }
                element.replaceChildren();
                const start = token.raw.indexOf(token.text);
                if (token.type === 'link') {
                    element.dataset.editorLinkPrefix = token.raw.slice(0, start);
                    element.dataset.editorLinkSuffix = token.raw.slice(start + token.text.length);
                    element.addEventListener('click', event => event.preventDefault());
                }
                addPart(token.raw.slice(0, start));
                addInline(element, token.tokens, allowNewlines);
                addPart(token.raw.slice(start + token.text.length));
                parent.appendChild(element);
            } else {
                protectInline(parent, token);
            }
        }
        if (!tokens.length) {
            addEditableText(parent, '', allowNewlines);
        }
    }

    function inlineMatches(tokens, text) {
        return Array.isArray(tokens) && tokens.map(token => token.raw).join('') === text;
    }

    function addCardButton(parent, part, close) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'editor-add-card';
        button.textContent = '＋ 作品';
        button.addEventListener('click', () => {
            editFields('新增評分卡', commandLabels.mini_view_card, ['', '5.0', '', ''], fields => {
                if (!/^\d+(?:\.\d+)?$/.test(fields[1]) || Number(fields[1]) < 1 || Number(fields[1]) > 5) {
                    throw new Error('評分必須介於 1.0 至 5.0。');
                }
                const card = `c_mini_view_card(${fields.map(quoted).join(', ')})`;
                if (!commandInfo(card)) throw new Error('指令內容無效，請檢查嵌套指令。');
                const before = part.raw.slice(0, close);
                const trimmed = before.trimEnd();
                const next = trimmed + (trimmed.endsWith(',') ? '' : ',') + '\n    ' + card
                    + before.slice(trimmed.length) + part.raw.slice(close);
                const tokens = marked.lexer(next);
                if (tokens.length !== 1 || tokens[0].type !== 'sortHelper' || tokens[0].raw !== next) {
                    throw new Error('無法安全新增評分卡。');
                }
                updatePart(part, next);
            });
        });
        parent.appendChild(button);
    }

    function addProtectedBlock(token) {
        const part = addPart(token.raw);
        const wrapper = document.createElement('div');
        wrapper.className = 'editor-protected-block';
        wrapper.contentEditable = 'false';
        wrapper.dataset.editorRaw = token.raw;
        part.element = wrapper;
        wrapper.title = '此區塊受保護，原文會保留';
        wrapper.innerHTML = DOMPurify.sanitize(marked.parser([token]));
        if (token.type === 'sortHelper') {
            let offset = 0;
            const cards = [];
            const series = [];
            for (const entry of token.entries) {
                const start = token.raw.indexOf(entry.raw, offset);
                if (start < 0) throw new Error('無法定位排序區塊內容');
                if (entry.type === 'miniViewSeries') {
                    const opening = /^c_series\(\s*/.exec(entry.raw);
                    const title = opening && readQuotedArgument(entry.raw, opening[0].length, 0);
                    if (!title) throw new Error('無法定位系列名稱');
                    series.push({ start: start + opening[0].length, end: start + title.end, title: title.value,
                        close: start + entry.raw.lastIndexOf(')') });
                    let cardOffset = start;
                    for (const card of entry.cards) {
                        const cardStart = token.raw.indexOf(card.raw, cardOffset);
                        if (cardStart < 0 || cardStart + card.raw.length > start + entry.raw.length) {
                            throw new Error('無法定位系列作品');
                        }
                        cards.push({ raw: card.raw, start: cardStart });
                        cardOffset = cardStart + card.raw.length;
                    }
                } else {
                    cards.push({ raw: entry.raw, start });
                }
                offset = start + entry.raw.length;
            }
            const elements = wrapper.querySelectorAll('.mini-view-card');
            if (elements.length !== cards.length) throw new Error('評分卡顯示與原文不一致');
            elements.forEach((element, index) => {
                element.classList.add('editor-command');
                element.tabIndex = 0;
                element.title = '點擊編輯評分卡';
                const open = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const card = cards[index];
                    commandEditor(card.raw, raw => {
                        updatePart(part, part.raw.slice(0, card.start) + raw + part.raw.slice(card.start + card.raw.length));
                    });
                };
                element.addEventListener('click', open);
                element.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') open(event);
                });
            });
            const titles = wrapper.querySelectorAll('.mini-view-series-title');
            if (titles.length !== series.length) throw new Error('系列顯示與原文不一致');
            titles.forEach((element, index) => {
                element.classList.add('editor-command');
                element.tabIndex = 0;
                element.title = '點擊編輯系列名稱';
                const open = event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const item = series[index];
                    editFields('編輯系列', ['系列名稱'], [item.title], values => {
                        if (!values[0].trim()) throw new Error('系列名稱不能為空。');
                        if (values[0] === item.title) return;
                        updatePart(part, part.raw.slice(0, item.start) + quoted(values[0]) + part.raw.slice(item.end));
                    });
                };
                element.addEventListener('click', open);
                element.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') open(event);
                });
                addCardButton(element.parentElement.querySelector('.mini-view-series-list'), part, series[index].close);
            });
            addCardButton(wrapper.querySelector('.mini-view-sort-list'), part, token.raw.lastIndexOf(')'));
        }
        content.appendChild(wrapper);
    }

    function addQuote(token) {
        const lines = token.raw.match(/[^\n]*(?:\n|$)/g).filter(Boolean);
        const matches = lines.map(line => /^( {0,3}>[ \t]?)([^\n]*)(\n?)$/.exec(line));
        if (!matches.length || matches.some(match => !match || !match[2].trim())) return false;
        const lexed = matches.map(match => marked.Lexer.lexInline(match[2], marked.defaults));
        if (lexed.some((tokens, index) => !inlineMatches(tokens, matches[index][2]))) return false;
        const quote = document.createElement('blockquote');
        const paragraph = document.createElement('p');
        quote.appendChild(paragraph);
        matches.forEach((match, index) => {
            addPart(match[1]);
            addInline(paragraph, lexed[index], false);
            addPart(match[3]);
            if (index < matches.length - 1) paragraph.appendChild(document.createElement('br'));
        });
        blockOriginals.set(quote, { raw: token.raw });
        content.appendChild(quote);
        return true;
    }

    function renderVisualArticle() {
        parts = [];
        visualValid = true;
        content.replaceChildren();
        content.contentEditable = 'true';
        content.spellcheck = false;
        content.setAttribute('aria-label', '文章正文編輯區');
        const tokens = marked.lexer(source.value);
        if (tokens.map(token => token.raw).join('') !== source.value) {
            throw new Error('文章原文無法安全對應至編輯畫面');
        }
        if (!tokens.length) {
            const paragraph = document.createElement('p');
            paragraph.appendChild(document.createElement('br'));
            blockOriginals.set(paragraph, { raw: '' });
            content.appendChild(paragraph);
        }
        let hadBlock = false;
        for (const token of tokens) {
            if (token.type === 'space') {
                addPart(token.raw);
                const marker = document.createComment('');
                rawComments.set(marker, token.raw);
                content.appendChild(marker);
                hadBlock = false;
            } else if (token.type === 'html' && /^<br\s*\/?>\s*$/i.test(token.raw)) {
                if (hadBlock) {
                    const marker = document.createComment('');
                    rawComments.set(marker, '');
                    content.appendChild(marker);
                }
                const paragraph = document.createElement('p');
                paragraph.appendChild(document.createElement('br'));
                addPart(token.raw);
                blockOriginals.set(paragraph, { raw: token.raw, suffix: (token.raw.match(/\n+$/) || [''])[0] });
                content.appendChild(paragraph);
                hadBlock = true;
            } else if (token.type === 'paragraph' && inlineMatches(token.tokens, token.text) && token.raw.startsWith(token.text)) {
                if (hadBlock) {
                    const marker = document.createComment('');
                    rawComments.set(marker, '');
                    content.appendChild(marker);
                }
                const paragraph = document.createElement('p');
                addInline(paragraph, token.tokens, true);
                const suffix = token.raw.slice(token.text.length);
                addPart(suffix);
                blockOriginals.set(paragraph, { raw: token.raw, suffix });
                content.appendChild(paragraph);
                hadBlock = true;
            } else if (token.type === 'heading' && inlineMatches(token.tokens, token.text)) {
                if (hadBlock) {
                    const marker = document.createComment('');
                    rawComments.set(marker, '');
                    content.appendChild(marker);
                }
                const prefix = /^ {0,3}#{1,6}[ \t]+/.exec(token.raw);
                if (!prefix || !token.raw.slice(prefix[0].length).startsWith(token.text)) {
                    addProtectedBlock(token);
                    hadBlock = true;
                    continue;
                }
                const heading = document.createElement(`h${token.depth}`);
                addPart(prefix[0]);
                addInline(heading, token.tokens, false);
                const suffix = token.raw.slice(prefix[0].length + token.text.length);
                addPart(suffix);
                blockOriginals.set(heading, { raw: token.raw, prefix: prefix[0], suffix });
                if (token.depth <= 3) {
                    const marker = document.createElement('span');
                    marker.dataset.tocHeading = '';
                    heading.appendChild(marker);
                }
                content.appendChild(heading);
                hadBlock = true;
            } else {
                if (hadBlock) {
                    const marker = document.createComment('');
                    rawComments.set(marker, '');
                    content.appendChild(marker);
                }
                if (token.type !== 'blockquote' || !addQuote(token)) addProtectedBlock(token);
                hadBlock = true;
            }
        }
        if (tokens.length && (source.value.endsWith('\n\n') ||
            content.lastElementChild?.getAttribute('contenteditable') === 'false')) {
            const paragraph = document.createElement('p');
            paragraph.appendChild(document.createElement('br'));
            blockOriginals.set(paragraph, { raw: '', placeholder: true });
            content.appendChild(paragraph);
        }
        if (parts.map(part => part.raw).join('') !== source.value) {
            throw new Error('文章原文無法安全對應至編輯畫面');
        }
        updateArticleToc();
    }

    function renderPreview() {
        const previous = document.createDocumentFragment();
        while (content.firstChild) previous.appendChild(content.firstChild);
        const editable = content.getAttribute('contenteditable');
        const label = content.getAttribute('aria-label');
        try {
            if (!window.marked || !window.DOMPurify || !window.markdownExtensionsReady) {
                throw new Error('文章解析工具載入失敗，請檢查網路後重新載入。');
            }
            if (posterPreview.open) posterPreview.close();
            if (miniViewModal.open) miniViewModal.close();
            if (previewOnly) {
                content.removeAttribute('contenteditable');
                content.removeAttribute('aria-label');
                renderMarkdownArticle(source.value);
            } else {
                renderVisualArticle();
            }
            resolveArticleUrls(content, { file: `articles/${activeName || 'draft.md'}` });
            if (previewOnly) {
                enablePosterPreview();
            } else {
                for (const element of content.children) {
                    const original = blockOriginals.get(element);
                    if (original) original.html = element.innerHTML;
                }
            }
        } catch (error) {
            console.error('預覽失敗:', error);
            content.replaceChildren(previous);
            if (editable === null) content.removeAttribute('contenteditable');
            else content.setAttribute('contenteditable', editable);
            if (label === null) content.removeAttribute('aria-label');
            else content.setAttribute('aria-label', label);
            visualValid = false;
            setStatus(`預覽失敗：${error.message}`, true);
        }
    }

    function changed(rerender = true) {
        setStatus(dirty() ? '尚未儲存' : '已儲存');
        if (rerender) renderPreview();
    }
    source.addEventListener('input', changed);
    nameInput.addEventListener('input', () => changed(false));
    content.addEventListener('compositionstart', () => {
        if (!editor.hidden && !previewOnly) composing = true;
    });
    content.addEventListener('compositionend', () => {
        if (!editor.hidden && !previewOnly) {
            composing = false;
            syncVisual();
        }
    });
    content.addEventListener('input', () => {
        if (!editor.hidden && !previewOnly && !composing) syncVisual();
    });
    content.addEventListener('paste', event => {
        if (editor.hidden || previewOnly) return;
        event.preventDefault();
        document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    });
    content.addEventListener('drop', event => {
        if (!editor.hidden && !previewOnly) {
            event.preventDefault();
            setStatus('請貼上文字，暫不支援拖放內容。', true);
        }
    });
    document.addEventListener('secret-mode-change', () => {
        if (!editor.hidden && visualValid && !composing) renderPreview();
    });

    async function refreshFiles(selected) {
        const names = await api('/_editor/articles');
        file.replaceChildren(...names.map(name => new Option(name, name)));
        if (selected) file.value = selected;
    }

    async function load(name) {
        busy = true;
        file.disabled = true;
        source.disabled = true;
        try {
            const data = await api(`/_editor/article?name=${encodeURIComponent(name)}`);
            activeName = data.name;
            currentRevision = data.revision;
            source.value = data.source;
            savedSource = source.value;
            manualHistory = [];
            manualCursor = 0;
            const endings = new Set(data.source.match(/\r\n|\r|\n/g) || []);
            lineEnding = endings.size > 1 ? null : (endings.values().next().value || '\n');
            nameInput.value = savedName = data.name;
            nameRow.hidden = true;
            file.value = data.name;
            setStatus(lineEnding === null
                ? '文章混用多種換行格式，請先統一格式後重新載入。'
                : '已載入', lineEnding === null);
            renderPreview();
        } catch (error) {
            file.value = activeName;
            setStatus(`載入失敗：${error.message}`, true);
        } finally {
            file.disabled = false;
            source.disabled = false;
            busy = false;
        }
    }

    file.addEventListener('change', () => {
        const next = file.value;
        if (busy || !confirmDiscard()) {
            file.value = activeName;
            return;
        }
        load(next);
    });
    $('#editor-new').addEventListener('click', () => {
        if (busy || !confirmDiscard()) return;
        activeName = '';
        currentRevision = null;
        lineEnding = '\n';
        file.value = '';
        source.value = savedSource = '';
        manualHistory = [];
        manualCursor = 0;
        nameInput.value = savedName = '';
        nameRow.hidden = false;
        setStatus('新文章：請輸入 .md 檔名');
        renderPreview();
        nameInput.focus();
    });
    newArticle.addEventListener('click', () => {
        if (busy || !confirmDiscard()) return;
        showEditor();
        $('#editor-new').click();
    });
    saveButton.addEventListener('click', async () => {
        if (busy) return;
        if (!visualValid || composing) {
            setStatus('正文尚未安全同步，請完成輸入或撤銷最後的操作。', true);
            return;
        }
        if (currentRevision && !dirty()) {
            setStatus('沒有需要儲存的修改');
            return;
        }
        if (lineEnding === null) {
            setStatus('文章混用多種換行格式，為避免改寫原文，請先統一換行格式後重新載入。', true);
            return;
        }
        const name = currentRevision ? activeName : nameInput.value.trim();
        if (!name) {
            setStatus('請輸入文章檔名。', true);
            nameInput.focus();
            return;
        }
        const snapshot = source.value;
        busy = true;
        saveButton.disabled = true;
        file.disabled = true;
        nameInput.disabled = true;
        try {
            const result = await api('/_editor/article', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, source: snapshot.replace(/\n/g, lineEnding), revision: currentRevision })
            });
            activeName = result.name;
            currentRevision = result.revision;
            savedSource = snapshot;
            savedName = nameInput.value = activeName;
            nameRow.hidden = true;
            try {
                await refreshFiles(activeName);
            } catch (error) {
                setStatus(`文章已儲存，但列表更新失敗：${error.message}`, true);
                return;
            }
            if (!visualValid || composing) {
                setStatus('已儲存先前版本；正文尚未安全同步，請完成輸入或撤銷最後的操作。', true);
                return;
            }
            setStatus(dirty() ? '已儲存先前版本，仍有未儲存修改' : '已儲存');
            if (visualValid && !composing && source.value === snapshot) renderPreview();
        } catch (error) {
            setStatus(`儲存失敗：${error.message}`, true);
        } finally {
            saveButton.disabled = false;
            file.disabled = false;
            nameInput.disabled = false;
            busy = false;
        }
    });
    viewButton.addEventListener('click', () => {
        if (!visualValid || composing) {
            setStatus('正文尚未安全同步，請完成輸入或撤銷最後的操作。', true);
            return;
        }
        previewOnly = !previewOnly;
        toolbar.hidden = previewOnly;
        $('.editor-hint').hidden = previewOnly;
        viewButton.textContent = previewOnly ? '繼續編輯' : '僅預覽';
        renderPreview();
    });
    window.addEventListener('beforeunload', event => {
        if (dirty()) {
            event.preventDefault();
            event.returnValue = '';
        }
    });

    function quoted(value) {
        let result = '';
        let plain = '';
        for (let i = 0; i < value.length;) {
            const nested = parseNestedCommand(value.slice(i));
            if (nested) {
                result += JSON.stringify(plain).slice(1, -1) + nested.raw;
                plain = '';
                i += nested.raw.length;
            } else {
                plain += value[i++];
            }
        }
        return `"${result}${JSON.stringify(plain).slice(1, -1)}"`;
    }

    function visualRange() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return null;
        const range = selection.getRangeAt(0);
        if (!content.contains(range.startContainer) || !content.contains(range.endContainer)) return null;
        return range.cloneRange();
    }

    function partialProtected(range) {
        if (range.collapsed) return false;
        return Array.from(content.querySelectorAll('[contenteditable="false"][data-editor-raw]')).some(element => {
            if (!range.intersectsNode(element)) return false;
            const nodeRange = document.createRange();
            nodeRange.selectNode(element);
            return range.compareBoundaryPoints(Range.START_TO_START, nodeRange) > 0 ||
                range.compareBoundaryPoints(Range.END_TO_END, nodeRange) < 0;
        });
    }

    function restoreManualHistory(redo) {
        const entry = manualHistory[redo ? manualCursor : manualCursor - 1];
        if (!entry || composing || source.value !== (redo ? entry.before : entry.after)) return false;
        source.value = redo ? entry.after : entry.before;
        renderPreview();
        if (visualValid) {
            manualCursor += redo ? 1 : -1;
            changed(false);
        }
        content.focus();
        return true;
    }

    content.addEventListener('keydown', event => {
        if (editor.hidden || previewOnly || !(event.ctrlKey || event.metaKey) || event.altKey) return;
        const key = event.key.toLowerCase();
        const redo = key === 'y' || (key === 'z' && event.shiftKey);
        if ((key === 'z' || key === 'y') && restoreManualHistory(redo)) event.preventDefault();
    });

    content.addEventListener('beforeinput', event => {
        if (editor.hidden || previewOnly) return;
        if ((event.inputType === 'historyUndo' || event.inputType === 'historyRedo') &&
            restoreManualHistory(event.inputType === 'historyRedo')) {
            event.preventDefault();
            return;
        }
        const range = visualRange();
        if (range && partialProtected(range)) {
            event.preventDefault();
            setStatus('請完整選取指令，避免修改其一部分。', true);
        }
    });

    function applyInlineFormat(range, action, command) {
        const parent = node => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)
            .closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
        const startBlock = parent(range.startContainer);
        const endBlock = parent(range.endContainer);
        if (!range.collapsed && startBlock && startBlock === endBlock &&
            !document.queryCommandState(command)) {
            const tags = { bold: 'strong', italic: 'em', strike: 'del' };
            const element = document.createElement(tags[action]);
            if (range.cloneContents().querySelector('[contenteditable="false"]')) {
                const before = source.value;
                element.appendChild(range.extractContents());
                range.insertNode(element);
                range.selectNodeContents(element);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                if (syncVisual()) recordManualHistory(before);
                return;
            }
        }
        if (!document.execCommand(command, false)) {
            setStatus('無法套用此格式。', true);
        } else {
            syncVisual();
        }
    }

    function selectedCommandText(range, preserveCommands) {
        const fragment = range.cloneContents();
        fragment.querySelectorAll('rt, rp').forEach(element => element.remove());
        function text(node) {
            if (node.nodeType === Node.TEXT_NODE) return node.data;
            if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
            if (preserveCommands && node.nodeType === Node.ELEMENT_NODE &&
                node.getAttribute('contenteditable') === 'false' && node.hasAttribute('data-editor-raw')) {
                return node.dataset.editorRaw;
            }
            return Array.from(node.childNodes).map(text).join('');
        }
        return text(fragment);
    }

    function insertInlineCommand(range, raw) {
        if (!content.contains(range.commonAncestorContainer)) throw new Error('選取位置已失效，請重新選取。');
        const tokens = marked.Lexer.lexInline(raw, marked.defaults);
        if (tokens.length !== 1 || tokens[0].raw !== raw) throw new Error('指令內容無效。');
        const fragment = document.createDocumentFragment();
        protectInline(fragment, tokens[0]);
        const node = fragment.firstChild;
        const selection = window.getSelection();
        content.focus();
        selection.removeAllRanges();
        selection.addRange(range);
        const before = source.value;
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        if (syncVisual()) {
            recordManualHistory(before);
            resolveArticleUrls(content, { file: `articles/${activeName || 'draft.md'}` });
        }
    }

    function insertSortBlock(range, raw) {
        if (!content.contains(range.commonAncestorContainer)) throw new Error('選取位置已失效，請重新選取。');
        const element = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer : range.startContainer.parentElement;
        const block = element.closest('p, h1, h2, h3, h4, h5, h6');
        if (!block || block.parentElement !== content || !block.contains(range.endContainer)) {
            throw new Error('請在同一個正文段落中插入排序區塊。');
        }
        const tokens = marked.lexer(raw);
        if (tokens.length !== 1 || tokens[0].type !== 'sortHelper' || tokens[0].raw !== raw) {
            throw new Error('排序區塊內容無效。');
        }
        const before = source.value;
        range.deleteContents();
        const remainder = document.createRange();
        remainder.selectNodeContents(block);
        remainder.setStart(range.startContainer, range.startOffset);
        const tail = document.createElement('p');
        tail.appendChild(remainder.extractContents());
        addProtectedBlock(tokens[0]);
        const inserted = content.lastElementChild;
        block.after(inserted, tail);
        content.focus();
        const cursor = document.createRange();
        cursor.selectNodeContents(tail);
        cursor.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(cursor);
        if (syncVisual()) {
            recordManualHistory(before);
            resolveArticleUrls(content, { file: `articles/${activeName || 'draft.md'}` });
            updateArticleToc();
        }
    }

    function toggleCode(range) {
        if (range.collapsed) {
            setStatus('請先選取要標記為行內程式碼的文字。', true);
            return;
        }
        const fragment = range.cloneContents();
        if (fragment.querySelector('[contenteditable="false"], p, div, blockquote, h1, h2, h3, ul, ol')) {
            setStatus('行內程式碼不能跨越區塊或受保護內容。', true);
            return;
        }
        const parent = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
        const existing = parent.closest('code');
        let html;
        if (existing && content.contains(existing)) {
            range.selectNode(existing);
            const text = document.createElement('span');
            text.textContent = existing.textContent;
            html = text.innerHTML;
        } else {
            const code = document.createElement('code');
            code.textContent = fragment.textContent;
            html = code.outerHTML;
        }
        content.focus();
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        if (!document.execCommand('insertHTML', false, html)) {
            setStatus('無法套用行內程式碼。', true);
            return;
        }
        syncVisual();
    }

    toolbar.addEventListener('mousedown', event => {
        if (event.target.closest('button[data-action]')) event.preventDefault();
    });
    urlForm.addEventListener('submit', event => {
        event.preventDefault();
        if (!pendingUrl || !urlInput.value.trim()) return;
        const { action, range } = pendingUrl;
        const url = urlInput.value.trim();
        if (!content.contains(range.commonAncestorContainer)) {
            setStatus('選取位置已失效，請重新選取。', true);
            return;
        }
        content.focus();
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        if (action === 'link') {
            if (!document.execCommand('createLink', false, url)) {
                setStatus('無法建立連結。', true);
                return;
            }
            syncVisual();
        } else {
            const text = selectedCommandText(range, false).replace(/[\[\]\\]/g, '\\$&');
            try {
                insertInlineCommand(range, `![${text}](${url.replace(/[\\()]/g, '\\$&').replace(/ /g, '%20')})`);
            } catch (error) {
                setStatus(`無法插入圖片：${error.message}`, true);
                return;
            }
        }
        pendingUrl = null;
        urlForm.hidden = true;
    });
    $('.editor-url-cancel').addEventListener('click', () => {
        pendingUrl = null;
        urlForm.hidden = true;
        content.focus();
    });
    toolbar.addEventListener('click', event => {
        const action = event.target.closest('button')?.dataset.action;
        if (!action) return;
        if (!visualValid || composing) {
            setStatus('正文尚未安全同步，請完成輸入或撤銷最後的操作。', true);
            return;
        }
        const range = visualRange();
        if (!range) {
            setStatus('請先在正文中放置游標或選取文字。', true);
            return;
        }
        if (partialProtected(range)) {
            setStatus('請完整選取指令，避免修改其一部分。', true);
            return;
        }
        const commands = { bold: 'bold', italic: 'italic', strike: 'strikeThrough', list: 'insertUnorderedList' };
        if (commands[action]) {
            if (action === 'list') {
                if (!document.execCommand(commands[action], false)) setStatus('無法套用此格式。', true);
                else syncVisual();
            } else {
                applyInlineFormat(range, action, commands[action]);
            }
            return;
        }
        if (action === 'code') return toggleCode(range);
        if (['h1', 'h2', 'h3', 'quote'].includes(action)) {
            if (!document.execCommand('formatBlock', false, action === 'quote' ? 'blockquote' : action)) {
                setStatus('無法套用此格式。', true);
            } else syncVisual();
            return;
        }
        if (action === 'link' || action === 'image') {
            if (action === 'link' && (range.collapsed || range.cloneContents().querySelector('[contenteditable="false"]'))) {
                setStatus('請選取不含受保護指令的連結文字。', true);
                return;
            }
            pendingUrl = { action, range };
            urlInput.value = '';
            urlForm.hidden = false;
            urlInput.focus();
            return;
        }
        if (action === 'placeholder') {
            insertInlineCommand(range, '[PlaceHolder]');
            return;
        }
        const plain = selectedCommandText(range, false);
        const nested = selectedCommandText(range, true);
        const definitions = {
            ruby: { name: 'ruby', values: [plain, ''] },
            url: { name: 'url', values: [nested, ''] },
            hide: { name: 'hide', values: [nested, ''] },
            time: { name: 'time', values: ['', 'd'] },
            card: { name: 'mini_view_card', values: [nested, '5.0', '', ''] },
            sort: { name: 'mini_view_card', values: [nested, '5.0', '', ''] },
            series: { name: 'mini_view_card', values: ['', nested, '5.0', '', ''] }
        };
        const definition = definitions[action];
        if (!definition) return;
        const labels = action === 'series'
            ? ['系列名稱', ...commandLabels.mini_view_card] : commandLabels[definition.name];
        editFields(action === 'series' ? '新增系列' : action === 'sort' ? '新增排序區塊'
            : `新增 c_${definition.name}`, labels, definition.values, values => {
            const args = action === 'series' ? values.slice(1) : values;
            if (action === 'series' && !values[0].trim()) throw new Error('系列名稱不能為空。');
            if (definition.name === 'time') timeCounter(args[0], args[1]);
            if (definition.name === 'mini_view_card' &&
                (!/^\d+(?:\.\d+)?$/.test(args[1]) || Number(args[1]) < 1 || Number(args[1]) > 5)) {
                throw new Error('評分必須介於 1.0 至 5.0。');
            }
            const command = `c_${definition.name}(${args.map(quoted).join(', ')})`;
            if (!commandInfo(command)) throw new Error('指令內容無效，請檢查嵌套指令。');
            if (action === 'sort' || action === 'series') {
                const entry = action === 'series' ? `c_series(${quoted(values[0])},\n        ${command}\n    )` : command;
                return () => insertSortBlock(range, `c_sort_helper(\n    ${entry}\n)`);
            } else {
                return () => insertInlineCommand(range, command);
            }
        });
    });

    refreshFiles().catch(error => {
        console.error('載入文章列表失敗:', error);
        newArticle.textContent = `載入文章列表失敗：${error.message}`;
        newArticle.disabled = true;
    });
})();
