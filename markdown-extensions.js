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

function escapeHtmlAttribute(value) {
    return value.replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

const COMMAND_NAMES = ['secret', 'hide', 'link', 'url', 'pronouns', 'ruby', 'time_counter', 'time'];
const COMMAND_ALIASES = {
    secret: ['secret', 'hide'],
    link: ['link', 'url'],
    pronouns: ['pronouns', 'ruby'],
    time_counter: ['time_counter', 'time']
};
const MAX_COMMAND_DEPTH = 10;

function findCommandStart(source, names) {
    let start = -1;
    for (const name of names) {
        const index = source.indexOf(`c_${name}(`);
        if (index !== -1 && (start === -1 || index < start)) start = index;
    }
    return start === -1 ? undefined : start;
}

function parseCommand(source, names, depth = 0) {
    for (const name of names) {
        const command = parseTwoArgumentCommand(source, name, depth);
        if (command) return command;
    }
    return null;
}

function parseTwoArgumentCommand(source, name, depth = 0) {
    const prefix = `c_${name}(`;
    if (!source.startsWith(prefix)) return null;
    if (depth >= MAX_COMMAND_DEPTH) throw new Error('指令嵌套層數過多');
    let index = prefix.length;
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
            const nested = parseNestedCommand(source.slice(index), depth + 1);
            if (nested) {
                value += nested.raw;
                index += nested.raw.length;
            } else {
                if (source[index] === '\n' || source[index] === '\r') return null;
                value += source[index++];
            }
        }
        return null;
    }
    const first = readArgument();
    if (first === null) return null;
    skipSpaces();
    if (source[index++] !== ',') return null;
    const second = readArgument();
    if (second === null) return null;
    skipSpaces();
    if (source[index++] !== ')') return null;
    return { raw: source.slice(0, index), first, second };
}

function parseNestedCommand(source, depth) {
    return parseCommand(source, COMMAND_NAMES, depth);
}

function parseSecret(source, depth = 0) {
    const command = parseCommand(source, COMMAND_ALIASES.secret, depth);
    return command && {
        type: 'secret',
        raw: command.raw,
        normal: command.first,
        secret: command.second
    };
}

let secretRenderDepth = 0;
function renderSecretText(text, allowLinks = true) {
    if (secretRenderDepth >= MAX_COMMAND_DEPTH) throw new Error('指令嵌套層數過多');
    secretRenderDepth++;
    try {
        let result = '';
        let index = 0;
        const pattern = allowLinks
            ? /c_(?:pronouns|ruby|time_counter|time|link|url|secret|hide)\(/g
            : /c_(?:pronouns|ruby|time_counter|time|secret|hide)\(/g;
        let match;
        while ((match = pattern.exec(text))) {
            const remaining = text.slice(match.index);
            const name = /^c_([a-z_]+)\(/.exec(remaining);
            const command = name && parseTwoArgumentCommand(remaining, name[1]);
            if (!command) continue;
            result += escapeMarkdownText(text.slice(index, match.index));
            result += marked.parseInline(command.raw);
            index = match.index + command.raw.length;
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
            name: 'customLink',
            level: 'inline',
            start(source) {
                return findCommandStart(source, COMMAND_ALIASES.link);
            },
            tokenizer(source) {
                const command = parseCommand(source, COMMAND_ALIASES.link);
                if (command) {
                    return {
                        type: 'customLink',
                        raw: command.raw,
                        text: command.first,
                        url: command.second
                    };
                }
            },
            renderer(token) {
                return `<a class="c-link" href="${escapeHtmlAttribute(token.url)}">${renderSecretText(token.text, false)}</a>`;
            }
        }, {
            name: 'pronouns',
            level: 'inline',
            start(source) {
                return findCommandStart(source, COMMAND_ALIASES.pronouns);
            },
            tokenizer(source) {
                const command = parseCommand(source, COMMAND_ALIASES.pronouns);
                if (command) {
                    return {
                        type: 'pronouns',
                        raw: command.raw,
                        base: command.first,
                        reading: command.second
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
                return findCommandStart(source, COMMAND_ALIASES.secret);
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
                return findCommandStart(source, COMMAND_ALIASES.time_counter);
            },
            tokenizer(source) {
                const command = parseCommand(source, COMMAND_ALIASES.time_counter);
                if (command) return {
                    type: 'timeCounter',
                    raw: command.raw,
                    date: command.first,
                    unit: command.second
                };
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
