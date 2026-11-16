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

const namedEntities = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  nbsp: '\u00A0',
  copy: '\u00A9',
  reg: '\u00AE',
  hellip: '\u2026',
  mdash: '\u2014',
  ouml: '\u00F6',
  auml: '\u00E4',
  frac34: '\u00BE',
  AElig: '\u00C6',
  DifferentialD: '\u2146',
  HilbertSpace: '\u210B',
  Dcaron: '\u010E',
  ClockwiseContourIntegral: '\u2232',
  ngE: '\u2267\u0338',
  hl: '\u2502'
};

function parseInline(src, links = {}) {
  let out = '';
  let i = 0;

  while (i < src.length) {
    const char = src.charCodeAt(i);

    if (char === 38) {
      const entityMatch = src.slice(i).match(/^&#([0-9]+);|^&#[xX]([0-9a-fA-F]+);|^&([A-Za-z][A-Za-z0-9]{1,31});/);
      if (entityMatch) {
        if (entityMatch[1]) {
          const num = parseInt(entityMatch[1], 10);
          if (num === 0 || num > 0x10FFFF || (num >= 0xD800 && num <= 0xDFFF)) {
            out += '\uFFFD';
          } else {
            try {
              out += String.fromCodePoint(num);
            } catch {
              out += '\uFFFD';
            }
          }
          i += entityMatch[0].length;
          continue;
        } else if (entityMatch[2]) {
          const num = parseInt(entityMatch[2], 16);
          if (num === 0 || num > 0x10FFFF || (num >= 0xD800 && num <= 0xDFFF)) {
            out += '\uFFFD';
          } else {
            try {
              out += String.fromCodePoint(num);
            } catch {
              out += '\uFFFD';
            }
          }
          i += entityMatch[0].length;
          continue;
        } else if (entityMatch[3]) {
          const name = entityMatch[3];
          const decoded = namedEntities[name];
          if (decoded !== undefined) {
            out += decoded;
            i += entityMatch[0].length;
            continue;
          }
        }
      }
    }

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

  let i = 0;
  let html = '';

  function isBlockStart(line) {
    if (/^ {0,3}#{1,6}(\s|$)/.test(line)) return true;
    if (/^ {0,3}(```+|~~~+)/.test(line)) return true;
    if (/^ {0,3}>/.test(line)) return true;
    if (/^ {0,3}(?:(?:\* *){3,}|(?:- *){3,}|(?:_ *){3,})\s*$/.test(line)) return true;
    if (/^ {0,3}<(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)\b/i.test(line)) return true;
    if (/^ {0,3}<!--/.test(line)) return true;
    const listMatch = line.match(/^ {0,3}(?:([-*+])|(\d{1,9})([.)]))(\s+|$)/);
    if (listMatch) {
      if (listMatch[4] && listMatch[4].trim() === '') return false;
      if (listMatch[2] && listMatch[2] !== '1') return false;
      return true;
    }
    return false;
  }

  function parseList(cleanLines, startIdx) {
    function matchListItem(line) {
      const m = line.match(/^([ \t]{0,3})(?:([-+*])|(\d{1,9})([.)]))([ \t]+)(.*)$/);
      if (!m) {
        const m2 = line.match(/^([ \t]{0,3})(?:([-+*])|(\d{1,9})([.)]))([ \t]*)$/);
        if (!m2) return null;
        return {
          indent: m2[1],
          type: m2[2] ? 'bullet' : 'ordered',
          markerChar: m2[2] || m2[4],
          num: m2[3] ? parseInt(m2[3], 10) : 1,
          rest: '',
          spaces: m2[5],
          rawMarker: m2[0]
        };
      }
      return {
        indent: m[1],
        type: m[2] ? 'bullet' : 'ordered',
        markerChar: m[2] || m[4],
        num: m[3] ? parseInt(m[3], 10) : 1,
        rest: m[6],
        spaces: m[5],
        rawMarker: m[0].slice(0, m[0].length - m[6].length)
      };
    }

    const firstMatch = matchListItem(cleanLines[startIdx]);
    if (!firstMatch) return null;

    const listType = firstMatch.type;
    const bulletChar = firstMatch.markerChar;
    const startNum = listType === 'ordered' ? firstMatch.num : 1;

    let items = [];
    let currentIndex = startIdx;
    let hasLooseBlankLine = false;

    while (currentIndex < cleanLines.length) {
      const line = cleanLines[currentIndex];
      const itemMatch = matchListItem(line);
      if (!itemMatch) break;
      if (itemMatch.type !== listType || itemMatch.markerChar !== bulletChar) break;

      let itemLines = [itemMatch.rest];
      currentIndex++;
      let blankLinesCount = 0;

      while (currentIndex < cleanLines.length) {
        const nextLine = cleanLines[currentIndex];
        if (nextLine.trim() === '') {
          blankLinesCount++;
          itemLines.push('');
          currentIndex++;
          continue;
        }

        const nextItemMatch = matchListItem(nextLine);
        if (nextItemMatch && nextItemMatch.type === listType && nextItemMatch.markerChar === bulletChar) {
          if (blankLinesCount > 0) {
            hasLooseBlankLine = true;
          }
          break;
        }

        if (isBlockStart(nextLine) && blankLinesCount > 0) {
          break;
        }

        const indentMatch = nextLine.match(/^[ \t]{1,4}/);
        if (indentMatch || blankLinesCount === 0) {
          if (blankLinesCount > 0) {
            hasLooseBlankLine = true;
            blankLinesCount = 0;
          }
          itemLines.push(nextLine);
          currentIndex++;
        } else {
          break;
        }
      }

      while (itemLines.length > 0 && itemLines[itemLines.length - 1] === '') {
        itemLines.pop();
      }

      items.push({
        lines: itemLines,
        hasBlankInside: blankLinesCount > 0
      });
    }

    let isLoose = hasLooseBlankLine;
    for (const item of items) {
      if (item.hasBlankInside) isLoose = true;
    }

    let resultHtml = '';
    const tag = listType === 'ordered' ? 'ol' : 'ul';
    const startAttr = (listType === 'ordered' && startNum !== 1) ? ` start="${startNum}"` : '';
    resultHtml += `<${tag}${startAttr}>\n`;

    for (const item of items) {
      let itemContent = item.lines.join('\n');
      let taskCheckbox = '';
      const taskMatch = itemContent.match(/^\[([ xX])\][ \t]([\s\S]*)$/);
      if (taskMatch) {
        const checked = taskMatch[1].toLowerCase() === 'x';
        taskCheckbox = `<input${checked ? ' checked=""' : ''} disabled="" type="checkbox"> `;
        itemContent = taskMatch[2];
      }

      let parsedInner = parse(itemContent).trim();

      if (!isLoose && items.length > 0) {
        if (parsedInner.startsWith('<p>') && parsedInner.endsWith('</p>') && parsedInner.indexOf('<p>', 3) === -1) {
          parsedInner = parsedInner.slice(3, -4);
        }
      }

      resultHtml += `<li>${taskCheckbox}${parsedInner}</li>\n`;
    }

    resultHtml += `</${tag}>\n`;

    return {
      html: resultHtml,
      nextIndex: currentIndex
    };
  }

  while (i < cleanLines.length) {
    while (i < cleanLines.length && cleanLines[i].trim() === '') {
      i++;
    }
    if (i >= cleanLines.length) break;

    const line = cleanLines[i];

    const listMatch = line.match(/^ {0,3}(?:([-*+])|(\d{1,9})([.)]))([ \t]|$)/);
    if (listMatch) {
      const res = parseList(cleanLines, i);
      if (res) {
        html += res.html;
        i = res.nextIndex;
        continue;
      }
    }

    if (/^ {0,3}>/.test(line)) {
      let bqLines = [];
      while (i < cleanLines.length && (/^ {0,3}>/.test(cleanLines[i]) || (cleanLines[i].trim() !== '' && !isBlockStart(cleanLines[i])))) {
        bqLines.push(cleanLines[i]);
        i++;
      }
      const bqContent = bqLines.map(l => l.replace(/^ {0,3}>\s?/, '')).join('\n');
      html += `<blockquote>\n${parse(bqContent)}</blockquote>\n`;
      continue;
    }

    const fenceMatch = line.match(/^( {0,3})(```+|~~~+)([^`~\n]*)$/);
    if (fenceMatch) {
      const fence = fenceMatch[2];
      const info = fenceMatch[3].trim();
      i++;
      let codeLines = [];
      while (i < cleanLines.length) {
        const cl = cleanLines[i];
        if (new RegExp(`^ {0,3}${fence}\\s*$`).test(cl)) {
          i++;
          break;
        }
        codeLines.push(cl);
        i++;
      }
      const lang = info ? info.split(/\s+/)[0] : '';
      const classAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      html += `<pre><code${classAttr}>${escapeHtml(codeLines.join('\n'))}\n</code></pre>\n`;
      continue;
    }

    if (/^(?: {4}|\t)/.test(line)) {
      let codeLines = [];
      while (i < cleanLines.length && (/^(?: {4}|\t)/.test(cleanLines[i]) || cleanLines[i].trim() === '')) {
        codeLines.push(cleanLines[i]);
        i++;
      }
      while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
        codeLines.pop();
      }
      const res = [];
      for (const cl of codeLines) {
        if (cl.startsWith('    ')) res.push(cl.slice(4));
        else if (cl.startsWith('\t')) res.push(cl.slice(1));
        else res.push(cl);
      }
      html += `<pre><code>${escapeHtml(res.join('\n'))}\n</code></pre>\n`;
      continue;
    }

    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      const level = atxMatch[1].length;
      const content = atxMatch[2].replace(/#+\s*$/, '').trim();
      html += `<h${level}>${parseInline(content, links)}</h${level}>\n`;
      i++;
      continue;
    }

    if (/^ {0,3}(?:(?:\* *){3,}|(?:- *){3,}|(?:_ *){3,})\s*$/.test(line)) {
      html += '<hr>\n';
      i++;
      continue;
    }

    if (i + 1 < cleanLines.length) {
      const nextLine = cleanLines[i + 1];
      const underlineMatch = nextLine.match(/^ {0,3}(=+|-+)\s*$/);
      if (underlineMatch && line.trim() !== '') {
        const level = underlineMatch[1].startsWith('=') ? 1 : 2;
        html += `<h${level}>${parseInline(line.trim(), links)}</h${level}>\n`;
        i += 2;
        continue;
      }
    }

    let paraLines = [line];
    i++;
    while (i < cleanLines.length) {
      const nextLine = cleanLines[i];
      if (nextLine.trim() === '') {
        break;
      }
      if (isBlockStart(nextLine)) {
        break;
      }
      if (i + 1 < cleanLines.length && /^ {0,3}(=+|-+)\s*$/.test(cleanLines[i+1]) && nextLine.trim() !== '') {
        break;
      }
      paraLines.push(nextLine);
      i++;
    }
    const paraText = paraLines.join('\n').trim();
    if (paraText) {
      html += `<p>${parseInline(paraText, links)}</p>\n`;
    }
  }

  return html;
}
