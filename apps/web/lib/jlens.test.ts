import type { Message } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JLENS_MODEL,
  jlensBlock,
  jlensChat,
  jlensDescription,
  jlensModelFor,
  jlensModelsFromGlobal,
  jlensProps,
  jlensRefusal,
  jlensShareBody,
  jlensTokens,
} from './jlens';
import { CANARY, NO_TRAINING } from './legal';

const qwen = DEFAULT_JLENS_MODEL;

// Part of Neuronpedia's `/api/global` reply.
const global = {
  models: [
    { id: 'gpt2-small', hfRepoId: 'openai-community/gpt2', inferenceEnabled: true, instruct: false },
    { id: 'gemma-3-12b', hfRepoId: 'google/gemma-3-12b-pt', inferenceEnabled: true, instruct: false },
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
      id: 'qwen3-32b',
      displayName: 'Qwen3-32B',
      hfRepoId: 'Qwen/Qwen3-32B',
      inferenceEnabled: true,
      instruct: true,
    },
    {
      id: 'qwen3.6-27b',
      displayName: 'Qwen3.6-27B',
      hfRepoId: 'Qwen/Qwen3.6-27B',
      inferenceEnabled: true,
      instruct: true,
    },
    { id: 'gemma-2-2b-it', hfRepoId: 'google/gemma-2-2b-it', inferenceEnabled: false, instruct: true },
  ],
};

const text = (role: Message['role'], t: string, extra: Partial<Message> = {}): Message => ({
  id: `${role}-${t}`,
  role,
  content: [{ type: 'text', text: t }],
  ...extra,
});

const toolTranscript: Message[] = [
  text('user', 'Weather in Paris?'),
  {
    id: 'a1',
    role: 'assistant',
    content: [],
    toolCalls: [{ id: 'call_1', function: 'get_weather', arguments: { city: 'Paris' } }],
  },
  text('tool', 'Sunny', { toolCallId: 'call_1' }),
  text('assistant', 'It is sunny.'),
];

describe('jlensModelsFromGlobal', () => {
  it('keeps the chat models with a J-Lens, with their server settings', () => {
    const models = jlensModelsFromGlobal(global);
    expect(models.map((m) => m.id)).toEqual(['llama3.3-70b-it', 'qwen3-32b', 'qwen3.6-27b']);
    expect(models[0]).toEqual({
      id: 'llama3.3-70b-it',
      label: 'Llama-3.3-70B-Instruct',
      hfRepoId: 'meta-llama/Llama-3.3-70B-Instruct',
      tokenLimit: 1024,
      lensColumns: ['JACOBIAN_LENS'],
      thinkTags: false,
    });
    expect(models[1]).toMatchObject({ tokenLimit: 4096, lensColumns: ['JACOBIAN_LENS'], thinkTags: true });
    expect(models[2]).toEqual(qwen);
  });
});

describe('jlensModelFor', () => {
  const models = jlensModelsFromGlobal(global);
  const other = { model: qwen, same: false, earlier: false };

  it('uses the model that wrote the transcript, matched by repo id without case or by an alias', () => {
    expect(jlensModelFor(['qwen/qwen3.6-27b'], models)).toEqual({ model: qwen, same: true, earlier: false });
    expect(jlensModelFor(['llama-3.3', 'meta-llama/llama-3.3-70b-instruct'], models)).toEqual({
      model: models[0],
      same: true,
      earlier: false,
    });
  });

  it('opens DeepSeek-V4-Flash-0731 on the earlier DeepSeek-V4-Flash, with its character limit', () => {
    const [deepseek] = jlensModelsFromGlobal({
      models: [
        {
          id: 'deepseek-v4-flash',
          displayName: 'Deepseek-V4-Flash',
          hfRepoId: 'deepseek-ai/DeepSeek-V4-Flash',
          inferenceEnabled: true,
          instruct: true,
        },
      ],
    });
    expect(deepseek).toMatchObject({ tokenLimit: 2048, charLimit: 11000, thinkTags: true });
    expect(jlensModelFor(['deepseek-ai/DeepSeek-V4-Flash-0731'], [...models, deepseek])).toEqual({
      model: deepseek,
      same: false,
      earlier: true,
    });
    expect(jlensModelFor(['deepseek-ai/DeepSeek-V4-Flash-0731'], models)).toEqual(other);
  });

  it('opens any other model on Qwen 3.6 27B', () => {
    expect(jlensModelFor(['openai/gpt-5'], models)).toEqual(other);
    expect(jlensModelFor(['google/gemma-3-12b-it'], models)).toEqual(other);
    expect(jlensModelFor(['google/gemma-4-31B-it'], models)).toEqual(other);
    expect(jlensModelFor(['google/gemma-4-31B-it'], [])).toEqual(other);
  });
});

describe('jlensChat', () => {
  it('maps tool calls and results to the lens shape', () => {
    const chat = jlensChat(toolTranscript, { thinking: true });
    expect(chat.messages).toEqual([
      { role: 'user', content: 'Weather in Paris?' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ name: 'get_weather', arguments: { city: 'Paris' }, id: 'call_1' }],
      },
      { role: 'tool', content: 'Sunny', toolCallId: 'call_1' },
      { role: 'assistant', content: 'It is sunny.' },
    ]);
    expect(chat.hasToolCalls).toBe(true);
  });

  it('puts thinking inline, or leaves it out', () => {
    const m: Message = {
      id: 'a',
      role: 'assistant',
      content: [
        { type: 'reasoning', kind: 'raw', text: 'Let me think.' },
        { type: 'text', text: 'Hi' },
      ],
    };
    const withThinking = jlensChat([m], { thinking: true });
    expect(withThinking.messages[0].content).toBe('<think>\nLet me think.\n</think>\n\nHi');
    expect(withThinking.hasThinking).toBe(true);
    expect(jlensChat([m], { thinking: false }).messages[0].content).toBe('Hi');
  });

  it('strips the newlines that the template strips around the thinking', () => {
    const m: Message = {
      id: 'a',
      role: 'assistant',
      content: [
        { type: 'reasoning', kind: 'raw', text: '\nLet me think.\n\n' },
        { type: 'text', text: '\n\nHi\n' },
      ],
    };
    expect(jlensChat([m], { thinking: true }).messages[0].content).toBe('<think>\nLet me think.\n</think>\n\nHi\n');
  });

  it('skips encrypted reasoning and counts parts with no text', () => {
    const m: Message = {
      id: 'a',
      role: 'assistant',
      content: [
        { type: 'reasoning', kind: 'redacted', text: 'gAAAAABabc123' },
        { type: 'image', url: 'https://example.com/a.png' } as unknown as Message['content'][number],
        { type: 'text', text: 'Hi' },
      ],
    };
    const chat = jlensChat([m], { thinking: true });
    expect(chat.messages[0].content).toBe('Hi');
    expect(chat).toMatchObject({ hasThinking: false, hasToolCalls: false, dropped: 1 });
  });
});

describe('jlensTokens', () => {
  it('counts the input and the reply without its thinking', () => {
    expect(jlensTokens({ input: 576, output: 32768, reasoning: 30455 })).toBe(2889);
    expect(jlensTokens({ input: 100, output: 50 })).toBe(150);
    expect(jlensTokens({})).toBeNull();
    expect(jlensTokens(null)).toBeNull();
  });
});

describe('jlensRefusal', () => {
  it('accepts a short chat', () => {
    expect(jlensRefusal([{ role: 'user', content: 'Hi' }], 2048)).toBeNull();
  });

  it('refuses an empty chat, a long message and a chat surely over the token limit', () => {
    expect(jlensRefusal([], 2048)).toMatch(/no messages/);
    expect(jlensRefusal([{ role: 'user', content: 'x'.repeat(10001) }], 2048)).toBe(
      'A message is longer than 10,000 characters (it has 10,001).',
    );
    const long = Array.from({ length: 2 }, () => ({ role: 'user' as const, content: 'x'.repeat(7000) }));
    expect(jlensRefusal(long, 4096)).toBeNull();
    expect(jlensRefusal(long, 2048)).toBe(
      'The transcript is longer than the 2,048-token limit (it has 14,004 characters, at least 2,334 tokens).',
    );
  });

  it('refuses a chat over the character limit of the model', () => {
    const chat = [
      { role: 'user' as const, content: 'x'.repeat(5600) },
      { role: 'user' as const, content: 'x'.repeat(5600) },
    ];
    expect(jlensRefusal(chat, 2048)).toBeNull();
    expect(jlensRefusal(chat, 2048, 11000)).toBe(
      'The transcript is longer than the 11,000-character limit (it has 11,204 characters).',
    );
  });
});

describe('jlensProps', () => {
  it('gives a bare option only for a transcript with thinking, and no messages that no model reads', () => {
    expect(jlensProps(toolTranscript)).not.toHaveProperty('bare');
    const thinking: Message = {
      id: 'a',
      role: 'assistant',
      content: [
        ...Array.from({ length: 3 }, () => ({
          type: 'reasoning' as const,
          kind: 'raw' as const,
          text: 'x'.repeat(9000),
        })),
        { type: 'text', text: 'Hi' },
      ],
    };
    const props = jlensProps([text('user', 'Q'), thinking]);
    expect(props.full).toEqual({ messages: [], refusal: expect.stringMatching(/characters/) });
    expect(props.bare).toEqual({
      messages: [
        { role: 'user', content: 'Q' },
        { role: 'assistant', content: 'Hi' },
      ],
      refusal: null,
    });
  });
});

describe('jlensShareBody', () => {
  it('asks for a read-out with no new tokens and caps the description', () => {
    const body = jlensShareBody(qwen, [{ role: 'user', content: 'Hi' }], 'd'.repeat(600));
    expect(body).toMatchObject({ modelId: 'qwen3.6-27b', numCompletionTokens: 0, lensColumns: ['JPP_LENS'] });
    expect(body.description).toHaveLength(512);
  });
});

describe('jlensBlock', () => {
  const open = { sampleTerms: undefined };
  it('lets an open sample and a gated sample go', () => {
    expect(jlensBlock(open, {})).toBeNull();
    expect(jlensBlock(open, { hazard: 'gated' })).toBeNull();
  });

  it('blocks a restricted or withheld sample, a hidden sample, and a sample the terms limit', () => {
    expect(jlensBlock(open, { hazard: 'restricted' })).toMatch(/harmful help/);
    expect(jlensBlock(open, { hazard: 'withheld' })).toMatch(/harmful help/);
    expect(jlensBlock(open, { hidden: true })).toMatch(/dataset terms/);
    expect(jlensBlock(open, { display: 'sign_in' })).toMatch(/dataset terms/);
    expect(jlensBlock({ sampleTerms: { display: 'scores_only' } as never }, {})).toMatch(/dataset terms/);
  });
});

describe('jlensDescription', () => {
  const base = {
    evalName: 'DeceptionBench (Huang et al.)',
    sample: '01f6634c',
    url: 'https://openaudit.com/runs/1Cfdqfp7qwjWkWXDA8ydSJ/attempts/1234',
    model: qwen,
  };

  it('has no warning when J-Lens runs on the model that wrote the transcript', () => {
    const d = jlensDescription({ ...base, modelName: 'Qwen3.6-27B', same: true });
    expect(d).not.toMatch(/Warning/);
    expect(d.split('  \n')).toEqual([
      `OpenAudit: ${base.evalName} 01f6634c on Qwen3.6-27B. ${base.url}`,
      NO_TRAINING,
      CANARY,
    ]);
  });

  it('warns when J-Lens runs on another model, and keeps the request not to train within the limit', () => {
    const d = jlensDescription({ ...base, modelName: 'DeepSeek-V4-Flash-0731', same: false });
    const lines = d.split('  \n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(
      /^\*\*Warning:\*\* DeepSeek-V4-Flash-0731 wrote this transcript, but this J-Lens is running on Qwen3\.6-27B/,
    );
    expect(lines.slice(2)).toEqual([NO_TRAINING, CANARY]);
    expect(jlensShareBody(qwen, [], d).description).toBe(d);
  });

  it('cuts the first lines, not the request not to train, when the text is too long', () => {
    const d = jlensDescription({ ...base, evalName: 'E'.repeat(600), modelName: 'M', same: true });
    expect(d).toHaveLength(512);
    expect(d.endsWith(`  \n${NO_TRAINING}  \n${CANARY}`)).toBe(true);
  });
});
