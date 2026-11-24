import type { JlensOption } from '@/lib/jlens';
import { loadJlensModels, resetJlensModels } from '@/lib/jlens-models';
import { CANARY, NO_TRAINING } from '@/lib/legal';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JlensButton, TOOL_CALL_WARNING } from './jlens-button';

const full: JlensOption = { messages: [{ role: 'user', content: '<think>x</think>Hi' }], refusal: null };
const bare: JlensOption = { messages: [{ role: 'user', content: 'Hi' }], refusal: null };
const QWEN = ['Qwen/Qwen3.6-27B'];
const LLAMA = ['meta-llama/Llama-3.3-70B-Instruct'];
const source = { evalName: 'E', sample: 's1', modelName: 'Model A', url: 'https://openaudit.com/runs/r/attempts/1' };

// Part of Neuronpedia's `/api/global` reply.
const global = {
  models: [
    {
      id: 'qwen3.6-27b',
      displayName: 'Qwen3.6-27B',
      hfRepoId: 'Qwen/Qwen3.6-27B',
      inferenceEnabled: true,
      instruct: true,
    },
    {
      id: 'llama3.3-70b-it',
      displayName: 'Llama-3.3-70B-Instruct',
      hfRepoId: 'meta-llama/Llama-3.3-70B-Instruct',
      inferenceEnabled: true,
      instruct: true,
    },
    {
      id: 'gemma-4-31b-it',
      displayName: 'Gemma-4-31B-IT',
      hfRepoId: 'google/gemma-4-31B-it',
      inferenceEnabled: true,
      instruct: true,
    },
    {
      id: 'deepseek-v4-flash',
      displayName: 'Deepseek-V4-Flash',
      hfRepoId: 'deepseek-ai/DeepSeek-V4-Flash',
      inferenceEnabled: true,
      instruct: true,
    },
  ],
};

let submits: { action: string; method: string; target: string }[] = [];
let shares: { modelId: string; chat: unknown; lensColumns: string[]; description: string }[] = [];
type FakeTab = { document: Document & { write: ReturnType<typeof vi.fn> }; opener: unknown };
let tab: FakeTab | null;
const open = vi.fn(() => tab);
const fetchGlobal = vi.fn(async () => new Response(JSON.stringify(global)));

beforeEach(() => {
  resetJlensModels();
  vi.stubGlobal('fetch', fetchGlobal);
  // A document that jsdom does not load: `write` only records.
  const doc = document.implementation.createHTMLDocument('');
  Object.assign(doc, { write: vi.fn(), close: vi.fn() });
  tab = { document: doc as FakeTab['document'], opener: window };
  vi.stubGlobal('open', open);
  // jsdom does not navigate.
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
    submits.push({ action: this.action, method: this.method, target: this.target });
    shares.push(JSON.parse(String(new FormData(this).get('share'))));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  open.mockClear();
  fetchGlobal.mockClear();
  submits = [];
  shares = [];
});

type Props = ComponentProps<typeof JlensButton>;

/** Renders the button and waits for the models. */
async function show(props: Partial<Props>) {
  render(<JlensButton names={QWEN} source={source} full={full} hasToolCalls={false} {...props} />);
  await act(async () => {
    await loadJlensModels();
  });
}

const openMenu = () => fireEvent.keyDown(screen.getByRole('button', { name: 'Interpretability' }), { key: 'Enter' });
const item = (name: string | RegExp) => {
  openMenu();
  return screen.getByRole('menuitem', { name });
};

describe('JlensButton', () => {
  it('opens a tab with a loading page, which posts the share to Neuronpedia', async () => {
    await show({});
    fireEvent.click(item('Open in Jacobian Lens'));
    expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank');
    expect(tab!.document.write).toHaveBeenCalledWith(expect.stringContaining('Opening J-Lens on Qwen3.6-27B&hellip;'));
    expect(tab!.opener).toBeNull();
    expect(submits).toEqual([{ action: 'https://www.neuronpedia.org/api/lens/share', method: 'post', target: '' }]);
    expect(shares[0]).toMatchObject({ modelId: 'qwen3.6-27b', chat: full.messages, numCompletionTokens: 0 });
    expect(shares[0].description).not.toMatch(/Warning/);
    expect(shares[0].description.endsWith(`${NO_TRAINING}  \n${CANARY}`)).toBe(true);
  });

  it('gets the models from Neuronpedia once for all buttons', async () => {
    await show({});
    await show({ names: LLAMA });
    expect(fetchGlobal).toHaveBeenCalledOnce();
  });

  it('posts to a new tab with no loading page when the browser blocks the tab', async () => {
    tab = null;
    await show({});
    fireEvent.click(item('Open in Jacobian Lens'));
    expect(submits[0]?.target).toBe('_blank');
  });

  it('uses the J-Lens of the model that wrote the transcript', async () => {
    await show({ names: ['llama-3.3', ...LLAMA] });
    fireEvent.click(item('Open in Jacobian Lens'));
    expect(shares[0]).toMatchObject({ modelId: 'llama3.3-70b-it', lensColumns: ['JACOBIAN_LENS'] });
  });

  it('opens a model whose servers have no J-Lens on Qwen 3.6 27B', async () => {
    await show({ names: ['google/gemma-4-31B-it'] });
    fireEvent.click(item('Open in Jacobian Lens (Qwen3.6-27B)'));
    expect(shares[0].modelId).toBe('qwen3.6-27b');
  });

  it('opens a model with no J-Lens on Qwen 3.6 27B, with a note and a warning in the share', async () => {
    await show({ names: ['openai/gpt-5'] });
    const open = item('Open in Jacobian Lens (Qwen3.6-27B)');
    expect(screen.getByText('Neuronpedia has no J-Lens for Model A. It opens on Qwen3.6-27B.')).toBeTruthy();
    fireEvent.click(open);
    expect(shares[0].modelId).toBe('qwen3.6-27b');
    expect(shares[0].description).toMatch(/\*\*Warning:\*\* Model A wrote this transcript/);
  });

  it('opens DeepSeek-V4-Flash-0731 on the earlier DeepSeek-V4-Flash, with the model in amber and no note', async () => {
    await show({ names: ['deepseek-ai/DeepSeek-V4-Flash-0731'] });
    const open = item('Open in Jacobian Lens (Deepseek-V4-Flash)');
    expect(screen.getByText('(Deepseek-V4-Flash)').className).toContain('text-amber-700');
    expect(screen.queryByText(/Neuronpedia has no J-Lens/)).toBeNull();
    fireEvent.click(open);
    expect(shares[0].modelId).toBe('deepseek-v4-flash');
  });

  it('checks the character limit of DeepSeek-V4-Flash', async () => {
    const long: JlensOption = {
      messages: [
        { role: 'user', content: 'x'.repeat(9000) },
        { role: 'user', content: 'x'.repeat(3000) },
      ],
      refusal: null,
    };
    await show({ names: ['deepseek-ai/DeepSeek-V4-Flash-0731'], full: long });
    expect(item(/Open in Jacobian Lens/).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/longer than the 11,000-character limit/)).toBeTruthy();
  });

  it('opens on Qwen 3.6 27B when Neuronpedia does not reply', async () => {
    fetchGlobal.mockRejectedValueOnce(new Error('offline'));
    await show({ names: LLAMA });
    fireEvent.click(item('Open in Jacobian Lens (Qwen3.6-27B)'));
    expect(shares[0].modelId).toBe('qwen3.6-27b');
  });

  it('waits for the models before it opens', () => {
    fetchGlobal.mockReturnValueOnce(new Promise(() => {}));
    render(<JlensButton names={QWEN} source={source} full={full} hasToolCalls={false} />);
    expect(item('Open in Jacobian Lens').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/Getting the J-Lens models/)).toBeTruthy();
  });

  it('sends the transcript with thinking when it fits, with no switch', async () => {
    await show({ bare });
    fireEvent.click(item('Open in Jacobian Lens'));
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
    expect(shares[0]).toMatchObject({ chat: full.messages });
  });

  it('sends the transcript without thinking, with a note, when only that one fits', async () => {
    const refused = { messages: [], refusal: 'Too long.' };
    await show({ full: refused, bare });
    const open = item('Open in Jacobian Lens');
    expect(open.getAttribute('aria-disabled')).toBeNull();
    expect(screen.getByText(/without thinking. With thinking, it is too long/)).toBeTruthy();
    expect(screen.queryByText(refused.refusal)).toBeNull();
    fireEvent.click(open);
    expect(shares[0]).toMatchObject({ chat: bare.messages });
  });

  it('sends the transcript without thinking to a model that does not read think tags', async () => {
    await show({ names: LLAMA, bare });
    const open = item('Open in Jacobian Lens');
    expect(screen.getByText(/Llama-3.3-70B-Instruct uses another thinking format/)).toBeTruthy();
    fireEvent.click(open);
    expect(shares[0]).toMatchObject({ chat: bare.messages });
  });

  it('checks the token limit of the model', async () => {
    const long: JlensOption = { messages: [{ role: 'user', content: 'x'.repeat(7000) }], refusal: null };
    await show({ names: LLAMA, full: long });
    expect(item('Open in Jacobian Lens').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/longer than the 1,024-token limit/)).toBeTruthy();
  });

  it('warns first about tool calls, and posts only on "Open anyway"', async () => {
    await show({ hasToolCalls: true });
    fireEvent.click(item('Open in Jacobian Lens'));
    expect(screen.getByText(TOOL_CALL_WARNING)).toBeTruthy();
    expect(submits).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(TOOL_CALL_WARNING)).toBeNull();
    expect(submits).toHaveLength(0);

    fireEvent.click(item('Open in Jacobian Lens'));
    fireEvent.click(screen.getByRole('button', { name: 'Open anyway' }));
    expect(shares).toHaveLength(1);
    expect(shares[0]).toMatchObject({ chat: full.messages });
  });

  it.each([false, true])('disables the item and shows the refusal below it (compact: %s)', async (compact) => {
    const refused = { messages: [], refusal: 'The dataset terms limit who can read this sample.' };
    await show({ full: refused, compact });
    expect(screen.queryByText(refused.refusal)).toBeNull();
    expect(item('Open in Jacobian Lens').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(refused.refusal)).toBeTruthy();
  });

  it('is gray and does not open when disabled, with the reason on hover', async () => {
    await show({ disabled: 'Hidden.' });
    const button = screen.getByRole('button', { name: /Interpretability/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.parentElement!.getAttribute('title')).toBe('Hidden.');
    fireEvent.pointerDown(button, { button: 0, ctrlKey: false });
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
