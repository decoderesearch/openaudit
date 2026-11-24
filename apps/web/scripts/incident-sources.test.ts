import { describe, expect, it } from 'vitest';
import {
  isOpenAIReport,
  labelRole,
  missingParts,
  pageText,
  parseReport,
  reportModel,
  setIncidentField,
  unwrapPdf,
} from './incident-sources';

const NEW = `<article><h1>Preparing for a restart</h1>
<table><tbody><tr><td><p>Internal model · Internal deployment</p><p>Incident date: May 22, 2026</p></td></tr></tbody></table>
<h3>Summary</h3><p>The model read Slack.</p>
<h3>What happened</h3><p>It read a message.</p>
<div data-report-role-block="true"><p><span>Tool result — Slack message</span></p><p><span>we have to ask people</span></p></div>
<div data-web-spacing="true" aria-hidden="true"></div>
<div data-report-role-block="true"><p><span>CoT</span></p><p><span>A wrinkle:<br>wait</span></p><p><span>[...]</span></p></div>
</article>`;

const OLD = `<article><h1>Searching GitHub</h1>
<table class="ap-doc-table"><tbody><tr><td><p><span>Internal model · RL training<br></span></p><p><span>Discovered: May 25, 2026<br></span></p></td></tr></tbody></table>
<p data-layout-spacer="true"><span><br></span></p>
<h3>What happened</h3><p><span>The model looked for data.<br></span></p>
<table class="ap-doc-table"><tbody><tr><td><p><span>Tool result \u000bHEAD 404 0<br></span></p><p><span>done<br></span></p></td></tr></tbody></table>
</article>`;

describe('parseReport', () => {
  it('reads the facts, paragraphs and role blocks', () => {
    const r = parseReport(NEW);
    expect(r.title).toBe('Preparing for a restart');
    expect(reportModel(r.scope)).toBe('Internal model');
    expect(r.meta).toEqual(['Incident date: May 22, 2026']);
    expect(r.items).toEqual([
      { kind: 'heading', text: 'Summary' },
      { kind: 'paragraph', text: 'The model read Slack.' },
      { kind: 'heading', text: 'What happened' },
      { kind: 'paragraph', text: 'It read a message.' },
      { kind: 'block', label: 'Tool result — Slack message', role: 'tool_result', text: 'we have to ask people' },
      { kind: 'block', label: 'CoT', role: 'reasoning', text: 'A wrinkle:\nwait\n[...]' },
    ]);
  });

  it('reads the older format, with one-cell tables and text after the label', () => {
    const r = parseReport(OLD);
    expect(r.scope).toBe('Internal model · RL training');
    expect(r.items.at(-1)).toEqual({
      kind: 'block',
      label: 'Tool result',
      role: 'tool_result',
      text: 'HEAD 404 0\ndone',
    });
  });

  it('reads a CoT with two views as its original text only', () => {
    const r = parseReport(`<article><h1>Email</h1>
<table><tbody><tr><td><p>Internal model · RL training</p></td></tr></tbody></table>
<h3>What happened</h3>
<div class="ap-cot-toggle"><section class="cot-excerpt"><div class="cot-toolbar"><h3 class="cot-title">CoT</h3>
<div class="cot-switch"><button>Original</button><button>Translation</button></div></div>
<div class="cot-reading"><div data-cot-panel="original"><p class="cot-copy">Need ignore.</p><p class="cot-copy"><br></p><p class="cot-copy">Create.</p></div>
<div data-cot-panel="translation" hidden><div class="cot-copy"><p class="cot-copy">I will ignore it.</p></div><p class="cot-note">Plain-language interpretation.</p></div></div></section></div>
</article>`);
    expect(r.items).toEqual([
      { kind: 'heading', text: 'What happened' },
      { kind: 'block', label: 'CoT', role: 'reasoning', text: 'Need ignore.\n\nCreate.' },
    ]);
    expect(r.unread).toEqual([]);
  });

  it('reads each cell of a one-column table as a block', () => {
    const r =
      parseReport(`<article><h1>X</h1><table><tbody><tr><td><p>Internal model · RL training</p></td></tr></tbody></table>
<h3>What happened</h3><table><tbody><tr><td><p>CoT<br></p><p>copy it<br></p></td></tr><tr><td><p>Tool call<br></p><p>ls<br></p></td></tr></tbody></table></article>`);
    expect(r.items.slice(1)).toEqual([
      { kind: 'block', label: 'CoT', role: 'reasoning', text: 'copy it' },
      { kind: 'block', label: 'Tool call', role: 'tool_call', text: 'ls' },
    ]);
  });

  it('names the block labels in a table of more than one column', () => {
    const r = parseReport(`<article><h1>X</h1><h3>What happened</h3><table><tbody>
<tr><td><p>CoT</p><p>copy it</p></td><td><p>Notes</p></td></tr></tbody></table></article>`);
    expect(r.unread).toEqual(['CoT']);
  });

  it('names the block labels that it reads only as headings', () => {
    const r = parseReport(`<article><h1>X</h1><h3>What happened</h3><h3>CoT</h3><p>Need ignore.</p>
<h3>Final thoughts on it</h3></article>`);
    expect(r.unread).toEqual(['CoT']);
  });
});

describe('labelRole', () => {
  it('maps report labels to roles', () => {
    expect(labelRole('Parent CoT')).toBe('reasoning');
    expect(labelRole('Tool call (terminal.exec)')).toBe('tool_call');
    expect(labelRole('Decoded check output (excerpt)')).toBe('tool_result');
    expect(labelRole('System instruction (terminal)')).toBe('system');
    expect(labelRole('User prompt')).toBe('user');
    expect(labelRole('Final answer')).toBe('assistant');
    expect(labelRole('Something new')).toBeUndefined();
  });
});

describe('isOpenAIReport', () => {
  it('matches report pages only', () => {
    expect(isOpenAIReport('https://alignment.openai.com/misalignment-reports/x-y/')).toBe(true);
    expect(isOpenAIReport('https://alignment.openai.com/misalignment-reports/')).toBe(false);
  });
});

describe('missingParts', () => {
  const source = 'He said: “Please die.” Later — it wrote   ‘no’ and stopped.';
  it('matches with other quotes, dashes and spaces', () => {
    expect(missingParts('"Please die."', source)).toEqual([]);
    expect(missingParts("Later - it wrote 'no'", source)).toEqual([]);
  });
  it('checks each part between cuts', () => {
    expect(missingParts('He said: [...] and stopped.', source)).toEqual([]);
    expect(missingParts('He said: [...] and ran away.', source)).toEqual(['and ran away.']);
  });
});

describe('unwrapPdf', () => {
  it('joins wrapped lines and keeps list breaks', () => {
    expect(unwrapPdf('this whole thing could be a sandbox\nsimulation — the lab.\nNext line')).toBe(
      'this whole thing could be a sandbox simulation — the lab.\nNext line',
    );
    expect(unwrapPdf('try different methods and tools,\n,→\nthinking carefully')).toBe(
      'try different methods and tools, thinking carefully',
    );
    expect(unwrapPdf('Options:\n- one\n- two')).toBe('Options:\n- one\n- two');
  });
});

describe('setIncidentField', () => {
  const file = `{
  "slug": "acme",
  "incidents": [
    {
      "slug": "a",
      "sources": [{ "url": "https://a" }]
    },
    {
      "slug": "b",
      "description": "Old \\u2019.",
      "logs": []
    }
  ]
}
`;
  it('changes one field and keeps the rest of the text', () => {
    const out = setIncidentField(file, 'b', 'description', 'New.');
    expect(out).toBe(file.replace('"Old \\u2019."', '"New."'));
  });
  it('adds a field after the last one, with the same indent', () => {
    const out = setIncidentField(file, 'a', 'logs', [{ title: 'T' }]);
    expect(out).toContain(
      '"sources": [{ "url": "https://a" }],\n      "logs": [\n        {\n          "title": "T"\n        }\n      ]\n    },',
    );
    expect(JSON.parse(out).incidents[0].logs).toEqual([{ title: 'T' }]);
  });
  it('removes a field', () => {
    const out = setIncidentField(file, 'b', 'logs', undefined);
    expect(JSON.parse(out).incidents[1]).toEqual({ slug: 'b', description: 'Old ’.' });
    expect(out).toContain('"description": "Old \\u2019."\n    }');
  });
});

describe('pageText', () => {
  it('keeps text and numbers the images', () => {
    const html = `<html><head><title>T</title></head><body><nav>menu</nav><article><p>One.</p>
      <img src="/a.png" alt="chat"><img src="/logo.png"><p>Two.</p></article></body></html>`;
    const page = pageText(html, 'https://example.com/post');
    expect(page.title).toBe('T');
    expect(page.images).toEqual(['https://example.com/a.png']);
    expect(page.text).toContain('[image 1: chat]');
    expect(page.text).not.toContain('menu');
  });
});
