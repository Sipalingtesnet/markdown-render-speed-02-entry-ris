// ris's markdown-render-speed-02 parser
// High-performance, dependency-free ES module matching marked 18.1.3 default options.

function escapeHtml(html, encode) {
  if (encode) {
    if (escapeTest.test(html)) {
      return html.replace(escapeReplace, htmlReplacer);
    }
  } else {
    if (escapeTestNoEncode.test(html)) {
      return html.replace(escapeReplaceNoEncode, htmlReplacerNoEncode);
    }
  }
  return html;
}

const escapeTest = /[&<>"']/;
const escapeReplace = /[&<>"']/g;
const escapeReplacer = (ch) => {
  switch (ch) {
    case '&': return '&amp;';
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '"': return '&quot;';
    case "'": return '&#39;';
    default: return ch;
  }
};

const escapeTestNoEncode = new RegExp('[<>"\']|&(?!#?\\w+;)');
const escapeReplaceNoEncode = new RegExp('[<>"\']|&(?!#?\\w+;)', 'g');
const htmlReplacerNoEncode = (ch) => {
  switch (ch) {
    case '&': return '&amp;';
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '"': return '&quot;';
    case "'": return '&#39;';
    default: return ch;
  }
};

function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(/%25/g, '%');
  } catch {
    return null;
  }
  return href;
}

function parseInline(src, links = {}) {
  let out = '';
  let i = 0;

  while (i < src.length) {
    const char = src.charCodeAt(i);

    if (char === 92) {
      if (i + 1 < src.length) {
        const next = src.charCodeAt(i + 1);
        if (next === 10) {
          out += '<br>\n';
          i += 2;
          continue;
        }
        out += escapeHtml(src[i + 1]);
        i += 2;
        continue;
      }
      out += '\\';
      i++;
      continue;
    }

    if (char === 96) {
      let start = i;
      i++;
      while (i < src.length && src.charCodeAt(i) === 96) i++;
      const numBackticks = i - start;
      const codeStart = i;
      let found = false;
      while (i < src.length) {
        if (src.charCodeAt(i) === 96) {
          let endBackticks = 0;
          let endIdx = i;
          while (endIdx < src.length && src.charCodeAt(endIdx) === 96) {
            endBackticks++;
            endIdx++;
          }
          if (endBackticks === numBackticks) {
            let code = src.slice(codeStart, i);
            if (code.startsWith(' ') && code.endsWith(' ') && code.length > 2 && code.trim().length > 0) {
              code = code.slice(1, -1);
            }
            out += `<code>${escapeHtml(code)}</code>`;
            i = endIdx;
            found = true;
            break;
          }
        }
        i++;
      }
      if (!found) {
        out += '`'.repeat(numBackticks);
        i = codeStart;
      }
      continue;
    }

    if (char === 60) {
      let end = i + 1;
      let isEmail = false;
      let isUrl = false;
      while (end < src.length && src.charCodeAt(end) !== 62 && src.charCodeAt(end) !== 10) {
        const c = src.charCodeAt(end);
        if (c === 64) isEmail = true;
        if (c === 58) isUrl = true;
        end++;
      }
      if (end < src.length && src.charCodeAt(end) === 62) {
        const content = src.slice(i + 1, end);
        if (isEmail) {
          const mailto = content.startsWith('mailto:') ? content : 'mailto:' + content;
          out += `<a href="${escapeHtml(mailto)}">${escapeHtml(content)}</a>`;
          i = end + 1;
          continue;
        } else if (isUrl || /^[a-zA-Z][a-zA-Z0-9+.-]{1,31}:/.test(content)) {
          out += `<a href="${escapeHtml(content)}">${escapeHtml(content)}</a>`;
          i = end + 1;
          continue;
        }
      }
    }

    if (char === 60) {
      const tagMatch = src.slice(i).match(/^<\/?[a-zA-Z][a-zA-Z0-9-]*(\s+[a-zA-Z:_][a-zA-Z0-9._:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>=]+))*\s*\/?>/);
      if (tagMatch) {
        out += tagMatch[0];
        i += tagMatch[0].length;
        continue;
      }
      const commentMatch = src.slice(i).match(/^<!--[\s\S]*?-->/);
      if (commentMatch) {
        out += commentMatch[0];
        i += commentMatch[0].length;
        continue;
      }
      const piMatch = src.slice(i).match(/^<\?[\s\S]*?\?>/);
      if (piMatch) {
        out += piMatch[0];
        i += piMatch[0].length;
        continue;
      }
    }

    if (char === 32 && i + 1 < src.length && src.charCodeAt(i + 1) === 32) {
      let spaces = 0;
      let idx = i;
      while (idx < src.length && src.charCodeAt(idx) === 32) {
        spaces++;
        idx++;
      }
      if (spaces >= 2 && idx < src.length && src.charCodeAt(idx) === 10) {
        out += '<br>\n';
        i = idx + 1;
        continue;
      }
    }

    if (char === 33 && i + 1 < src.length && src.charCodeAt(i + 1) === 91) {
      let depth = 1;
      let j = i + 2;
      while (j < src.length) {
        if (src.charCodeAt(j) === 91) depth++;
        else if (src.charCodeAt(j) === 93) {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (depth === 0 && j + 1 < src.length && src.charCodeAt(j + 1) === 40) {
        const alt = src.slice(i + 2, j);
        let k = j + 2;
        let parenDepth = 1;
        let hrefStart = k;
        while (k < src.length) {
          if (src.charCodeAt(k) === 40) parenDepth++;
          else if (src.charCodeAt(k) === 41) {
            parenDepth--;
            if (parenDepth === 0) break;
          }
          k++;
        }
        if (parenDepth === 0) {
          const destAndTitle = src.slice(hrefStart, k).trim();
          let href = destAndTitle;
          let title = '';
          const titleMatch = destAndTitle.match(/^([^\s]+)\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/);
          if (titleMatch) {
            href = titleMatch[1];
            title = titleMatch[2] || titleMatch[3] || titleMatch[4] || '';
          }
          if (href.startsWith('<') && href.endsWith('>')) {
            href = href.slice(1, -1);
          }
          const cleanHref = cleanUrl(href);
          let tag = `<img src="${escapeHtml(cleanHref !== null ? cleanHref : href)}" alt="${escapeHtml(alt)}"` + (title ? ` title="${escapeHtml(title)}"` : '') + `>`;
          out += tag;
          i = k + 1;
          continue;
        }
      }
    }

    if (char === 126 && i + 1 < src.length && src.charCodeAt(i + 1) === 126) {
      let end = i + 2;
      while (end < src.length) {
        if (src.charCodeAt(end) === 126 && end + 1 < src.length && src.charCodeAt(end + 1) === 126) {
          const inner = src.slice(i + 2, end);
          out += `<del>${parseInline(inner, links)}</del>`;
          i = end + 2;
          break;
        }
        end++;
      }
      if (end >= src.length) {
        out += escapeHtml(src[i]);
        i++;
      }
      continue;
    }

    if (char === 42 || char === 95) {
      const marker = src[i];
      let len = 1;
      while (i + len < src.length && src[i + len] === marker) len++;
      
      let end = i + len;
      let found = false;
      while (end < src.length) {
        if (src[end] === marker) {
          let endLen = 1;
          while (end + endLen < src.length && src[end + endLen] === marker) endLen++;
          if (endLen === len) {
            const inner = src.slice(i + len, end);
            const tag = len === 1 ? 'em' : 'strong';
            out += `<${tag}>${parseInline(inner, links)}</${tag}>`;
            i = end + len;
            found = true;
            break;
          }
        }
        end++;
      }
      if (!found) {
        out += escapeHtml(src[i]);
        i++;
      }
      continue;
    }

    if (char === 91) {
      let depth = 1;
      let j = i + 1;
      while (j < src.length) {
        if (src.charCodeAt(j) === 91) depth++;
        else if (src.charCodeAt(j) === 93) {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (depth === 0) {
        const text = src.slice(i + 1, j);
        if (j + 1 < src.length && src.charCodeAt(j + 1) === 40) {
          let k = j + 2;
          let parenDepth = 1;
          let hrefStart = k;
          while (k < src.length) {
            if (src.charCodeAt(k) === 40) parenDepth++;
            else if (src.charCodeAt(k) === 41) {
              parenDepth--;
              if (parenDepth === 0) break;
            }
            k++;
          }
          if (parenDepth === 0) {
            const destAndTitle = src.slice(hrefStart, k).trim();
            let href = destAndTitle;
            let title = '';
            const titleMatch = destAndTitle.match(/^([^\s]+)\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/);
            if (titleMatch) {
              href = titleMatch[1];
              title = titleMatch[2] || titleMatch[3] || titleMatch[4] || '';
            }
            if (href.startsWith('<') && href.endsWith('>')) {
              href = href.slice(1, -1);
            }
            const cleanHref = cleanUrl(href);
            let tag = `<a href="${escapeHtml(cleanHref !== null ? cleanHref : href)}"` + (title ? ` title="${escapeHtml(title)}"` : '') + `>${parseInline(text, links)}</a>`;
            out += tag;
            i = k + 1;
            continue;
          }
        }
        let refKey = '';
        let nextIdx = j + 1;
        if (nextIdx < src.length && src.charCodeAt(nextIdx) === 91) {
          let refEnd = nextIdx + 1;
          while (refEnd < src.length && src.charCodeAt(refEnd) !== 93) refEnd++;
          if (refEnd < src.length) {
            refKey = src.slice(nextIdx + 1, refEnd);
            nextIdx = refEnd + 1;
          }
        }
        if (!refKey) refKey = text;
        const refObj = links[refKey.trim().toLowerCase()];
        if (refObj) {
          const cleanHref = cleanUrl(refObj.href);
          let tag = `<a href="${escapeHtml(cleanHref !== null ? cleanHref : refObj.href)}"` + (refObj.title ? ` title="${escapeHtml(refObj.title)}"` : '') + `>${parseInline(text, links)}</a>`;
          out += tag;
          i = nextIdx;
          continue;
        }
      }
    }

    out += escapeHtml(src[i]);
    i++;
  }

  return out;
}

export function parse(markdown) {
  const src = (markdown || '').replace(/\r\n|\r/g, '\n');
  const links = {};
  const lines = src.split('\n');
  const cleanLines = [];

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const refMatch = line.match(/^\s{0,3}\[([^\]]+)\]:\s*([^\s]+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/);
    if (refMatch) {
      const id = refMatch[1].trim().toLowerCase();
      const href = refMatch[2];
      const title = refMatch[3] || refMatch[4] || refMatch[5] || '';
      if (!links[id]) {
        links[id] = { href, title };
      }
      continue;
    }
    cleanLines.push(line);
  }

  const processed = cleanLines.join('\n');
  const trimmed = processed.trim();
  if (!trimmed) return '';

  let html = '';

  if (trimmed.startsWith('>')) {
    const bqContent = trimmed.replace(/^>\s?/gm, '');
    return `<blockquote>\n${parse(bqContent)}</blockquote>\n`;
  }

  if (/^(?: {4}|\t)/.test(processed)) {
    const codeLines = processed.split('\n');
    const res = [];
    for (const cl of codeLines) {
      if (cl.startsWith('    ')) res.push(cl.slice(4));
      else if (cl.startsWith('\t')) res.push(cl.slice(1));
      else res.push(cl);
    }
    while (res.length > 0 && res[res.length - 1] === '') res.pop();
    return `<pre><code>${escapeHtml(res.join('\n'))}\n</code></pre>\n`;
  }

  const fenceMatch = trimmed.match(/^( {0,3})(```+|~~~+)([^`~\n]*)\n([\s\S]*?)\n\1\2\s*$/);
  if (fenceMatch) {
    const info = fenceMatch[3].trim();
    const code = fenceMatch[4];
    const lang = info ? info.split(/\s+/)[0] : '';
    const classAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    return `<pre><code${classAttr}>${escapeHtml(code)}\n</code></pre>\n`;
  }

  const atxMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (atxMatch) {
    const level = atxMatch[1].length;
    const content = atxMatch[2].replace(/#+\s*$/, '').trim();
    return `<h${level}>${parseInline(content, links)}</h${level}>\n`;
  }

  if (/^(?:(?:\* *){3,}|(?:- *){3,}|(?:_ *){3,})$/.test(trimmed)) {
    return '<hr>\n';
  }

  html += `<p>${parseInline(trimmed, links)}</p>\n`;
  return html;
}
