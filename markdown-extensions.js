function utcDate(year, month, day) {
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    return date;
}

function timeCounter(dateString, unit) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (!match || !['y', 'm', 'd'].includes(unit)) {
        throw new Error('日期或單位格式無效');
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const target = utcDate(year, month, day);
    if (year === 0 || target.getUTCFullYear() !== year ||
        target.getUTCMonth() !== month - 1 || target.getUTCDate() !== day) {
        throw new Error('日期無效');
    }

    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(new Date());
    const values = {};
    parts.forEach(part => { values[part.type] = Number(part.value); });
    const today = utcDate(values.year, values.month, values.day);
    const start = target <= today ? target : today;
    const end = target <= today ? today : target;

    if (unit === 'd') return (end - start) / 86400000;

    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
        + end.getUTCMonth() - start.getUTCMonth();
    const lastDay = utcDate(end.getUTCFullYear(), end.getUTCMonth() + 2, 0).getUTCDate();
    if (end.getUTCDate() < Math.min(start.getUTCDate(), lastDay)) months--;
    return unit === 'y' ? Math.floor(months / 12) : months;
}

function escapeMarkdownText(text) {
    return text.replace(/[&<>]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;'
    })[character]);
}

const nestedCommandPattern = /^c_(?:pronouns|time_counter)\(\s*"(?:[^"\\\r\n]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"\s*,\s*"(?:[^"\\\r\n]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"\s*\)/;
const MAX_SECRET_DEPTH = 10;

function parseSecret(source, depth = 0) {
    if (!source.startsWith('c_secret(')) return null;
    if (depth >= MAX_SECRET_DEPTH) throw new Error('指令嵌套層數過多');
    let index = 'c_secret('.length;
    function skipSpaces() {
        while (index < source.length && /\s/.test(source[index])) index++;
    }
    function readArgument() {
        skipSpaces();
        if (source[index++] !== '"') return null;
        let value = '';
        while (index < source.length) {
            if (source[index] === '"') {
                index++;
                return value;
            }
            if (source[index] === '\\') {
                const escape = /^\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/.exec(source.slice(index));
                if (!escape) return null;
                value += JSON.parse(`"${escape[0]}"`);
                index += escape[0].length;
                continue;
            }
            const remaining = source.slice(index);
            const nested = parseSecret(remaining, depth + 1);
            const command = nested ? nested.raw : (nestedCommandPattern.exec(remaining) || [])[0];
            if (command) {
                value += command;
                index += command.length;
            } else {
                if (source[index] === '\n' || source[index] === '\r') return null;
                value += source[index++];
            }
        }
        return null;
    }
    const normal = readArgument();
    if (normal === null) return null;
    skipSpaces();
    if (source[index++] !== ',') return null;
    const secret = readArgument();
    if (secret === null) return null;
    skipSpaces();
    if (source[index++] !== ')') return null;
    return { type: 'secret', raw: source.slice(0, index), normal, secret };
}

let secretRenderDepth = 0;
function renderSecretText(text) {
    if (secretRenderDepth >= MAX_SECRET_DEPTH) throw new Error('指令嵌套層數過多');
    secretRenderDepth++;
    try {
        let result = '';
        let index = 0;
        const pattern = /c_(?:pronouns|time_counter|secret)\(/g;
        let match;
        while ((match = pattern.exec(text))) {
            const remaining = text.slice(match.index);
            const nested = parseSecret(remaining);
            const command = nested ? nested.raw : (nestedCommandPattern.exec(remaining) || [])[0];
            if (!command) continue;
            result += escapeMarkdownText(text.slice(index, match.index));
            result += marked.parseInline(command);
            index = match.index + command.length;
            pattern.lastIndex = index;
        }
        return result + escapeMarkdownText(text.slice(index));
    } finally {
        secretRenderDepth--;
    }
}

if (window.marked) {
    marked.use({
        extensions: [{
            name: 'pronouns',
            level: 'inline',
            start(source) {
                return source.indexOf('c_pronouns(');
            },
            tokenizer(source) {
                const match = /^c_pronouns\(\s*("(?:[^"\\\r\n]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")\s*,\s*("(?:[^"\\\r\n]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")\s*\)/.exec(source);
                if (match) {
                    return {
                        type: 'pronouns',
                        raw: match[0],
                        base: JSON.parse(match[1]),
                        reading: JSON.parse(match[2])
                    };
                }
            },
            renderer(token) {
                return `<ruby>${escapeMarkdownText(token.base)}<rt>${escapeMarkdownText(token.reading)}</rt></ruby>`;
            }
        }, {
            name: 'secret',
            level: 'inline',
            start(source) {
                return source.indexOf('c_secret(');
            },
            tokenizer(source) {
                return parseSecret(source) || undefined;
            },
            renderer(token) {
                return renderSecretText(secretMode ? token.secret : token.normal);
            }
        }, {
            name: 'timeCounter',
            level: 'inline',
            start(source) {
                return source.indexOf('c_time_counter(');
            },
            tokenizer(source) {
                const match = /^c_time_counter\(\s*"([^"\r\n]*)"\s*,\s*"([^"\r\n]*)"\s*\)/.exec(source);
                if (match) {
                    return { type: 'timeCounter', raw: match[0], date: match[1], unit: match[2] };
                }
            },
            renderer(token) {
                try {
                    return String(timeCounter(token.date, token.unit));
                } catch (error) {
                    console.error('日期計算失敗:', error);
                    return '[日期或單位無效]';
                }
            }
        }]
    });
    window.markdownExtensionsReady = true;
}
