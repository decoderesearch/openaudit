// Reads a JSON value, or a Python value as `repr` writes it (single quotes, True, None, tuples).
// Tool results in Inspect transcripts are often Python reprs of lists and dicts.

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '0': '\0' };

/** The value of `text`, or undefined when it is not one whole JSON or Python value. */
export function parseLiteral(text: string): unknown {
  let at = 0;
  const fail = (): never => {
    throw new Error('not a literal');
  };
  const space = () => {
    while (at < text.length && /\s/.test(text[at]!)) at++;
  };
  const string = (): string => {
    const quote = text[at++];
    let out = '';
    while (at < text.length && text[at] !== quote) {
      const c = text[at++]!;
      if (c !== '\\') {
        out += c;
        continue;
      }
      const e = text[at++] ?? fail();
      if (e === 'x' || e === 'u') {
        const n = e === 'x' ? 2 : 4;
        const hex = text.slice(at, at + n);
        if (!/^[\da-f]+$/i.test(hex) || hex.length !== n) fail();
        out += String.fromCharCode(parseInt(hex, 16));
        at += n;
      } else out += ESCAPES[e] ?? e;
    }
    if (text[at++] !== quote) fail();
    return out;
  };
  const items = (close: string, item: () => void) => {
    at++;
    space();
    while (text[at] !== close) {
      item();
      space();
      if (text[at] === ',') {
        at++;
        space();
      } else if (text[at] !== close) fail();
    }
    at++;
  };
  const value = (): unknown => {
    space();
    const c = text[at];
    if (c === '{') {
      const out: Record<string, unknown> = {};
      items('}', () => {
        const key = value();
        space();
        if (text[at++] !== ':') fail();
        out[typeof key === 'string' ? key : JSON.stringify(key)] = value();
      });
      return out;
    }
    if (c === '[' || c === '(') {
      const out: unknown[] = [];
      items(c === '[' ? ']' : ')', () => out.push(value()));
      return out;
    }
    if (c === "'" || c === '"') return string();
    const word = /^(True|False|None|true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(text.slice(at))?.[0];
    if (!word) return fail();
    at += word.length;
    if (word === 'True' || word === 'true') return true;
    if (word === 'False' || word === 'false') return false;
    if (word === 'None' || word === 'null') return null;
    return Number(word);
  };
  try {
    const out = value();
    space();
    return at === text.length ? out : undefined;
  } catch {
    return undefined;
  }
}
