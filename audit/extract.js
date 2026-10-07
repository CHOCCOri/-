/* 从 index.html 里按函数名抽取源码（花括号配平，带正则字面量识别），拼成可在 jsdom 里跑的测试模块。 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name, src = SRC) {
  const re = new RegExp(`function\\s+${name}\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(src))) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    if (!/^\s*$/.test(src.slice(lineStart, m.index))) continue;
    /* 跳过参数表（可能含 {} 默认值），再从函数体的第一个 { 开始配平 */
    const parenStart = src.indexOf('(', m.index);
    let pd = 0, p = parenStart, pstr = null;
    for (; p < src.length; p++) {
      const c = src[p];
      if (pstr) { if (c === '\\') { p++; continue; } if (c === pstr) pstr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { pstr = c; continue; }
      if (c === '(') pd++;
      else if (c === ')') { pd--; if (pd === 0) break; }
    }
    const braceStart = src.indexOf('{', p);
    if (braceStart < 0) continue;
    let depth = 0, i = braceStart, str = null, prevToken = '';
    for (; i < src.length; i++) {
      const c = src[i];
      if (str) {
        if (c === '\\') { i++; continue; }
        if (c === str) str = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { str = c; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
      if (c === '/') {
        /* 正则字面量判定：前一个有效字符不是标识符/数字/右括号/右方括号 */
        const p = prevToken;
        if (!/[\w$)\]}"'`]/.test(p || '')) {
          let j = i + 1, cls = false;
          for (; j < src.length; j++) {
            const d = src[j];
            if (d === '\\') { j++; continue; }
            if (d === '[') cls = true;
            else if (d === ']') cls = false;
            else if (d === '/' && !cls) break;
            else if (d === '\n') { j = -1; break; }
          }
          if (j > 0) { i = j; prevToken = '/'; continue; }
        }
      }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) break; }
      if (!/\s/.test(c)) prevToken = c;
    }
    return src.slice(lineStart, i + 1).trim();
  }
  throw new Error('not found: ' + name);
}

module.exports = { SRC, extractFunction };
