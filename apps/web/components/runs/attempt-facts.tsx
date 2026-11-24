import { InfoPopover } from '@/components/info-popover';
import type { PromptRow } from '@/components/runs/prompt-preview';
import { promptOf, seedOf } from '@/lib/runs/auditor-prompt';
import { READOUT_KEYS } from '@/lib/runs/lens-readout';
import { SWAP_KEYS } from '@/lib/runs/probe-swap';
import { promptHeadings, slotPrompts, type RolePrompt } from '@/lib/runs/role-prompts';
import { slotLabel } from '@/lib/runs/routes';
import { WSB_KEYS } from '@/lib/runs/wsb-readout';
import { cn } from '@/lib/utils';
import type { Message, ModelSlot, Transcript } from '@openaudit/spec';
import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

// The facts beside a transcript (the attempt page) or an attempt table (the sample page).

/** A slot's model: the run's, else the slot's default. */
export type ModelOf = (s: ModelSlot) => string;

export type Prompts = { rows: PromptRow[]; title: string; description: ReactNode };

/** The target's thread (else the first) and the auditor's thread. */
export function mainThreads(transcript?: Transcript | null) {
  const roles = new Map(transcript?.participants.map((p) => [p.id, p.role]));
  const threads = transcript?.threads ?? [];
  const thread = threads.find((t) => roles.get(t.participant) === 'target') ?? threads[0];
  const auditor = threads.find((t) => t !== thread && roles.get(t.participant) === 'auditor');
  return { roles, thread, auditor, others: threads.filter((t) => t !== thread && t !== auditor) };
}

/** The prompts of each of the eval's slots, with the slot's name, model and a heading for each prompt. */
export function roleSlots(transcript: Transcript | null | undefined, slots: ModelSlot[], modelOf: ModelOf) {
  const { inspect } = (transcript?.extensions ?? {}) as { inspect?: { rolePrompts?: RolePrompt[] } };
  return slotPrompts(inspect?.rolePrompts ?? [], slots, modelOf).map(({ slot, prompt }) => {
    const label = slotLabel(slot);
    return { slot, prompt, label, model: modelOf(slot), headings: promptHeadings(label, prompt) };
  });
}

/**
 * The prompts of a sample. An audit: the auditor's instructions. Else: the input, the prompts of the
 * simulated users and partners, the target's system prompt, then (with `judges`) the judges'
 * prompts. `transcript`: only when the reader can read it.
 */
export function promptRows({
  transcript,
  slots,
  modelOf,
  input,
  choices,
  subject,
  title,
  description,
  judges = true,
}: {
  transcript?: Transcript | null;
  slots: ModelSlot[];
  modelOf: ModelOf;
  input?: string | null;
  choices?: string[];
  subject: string;
  title: string;
  description: ReactNode;
  judges?: boolean;
}): Prompts {
  const { thread, auditor } = mainThreads(transcript);
  const nameOf = (id?: string) => transcript?.participants.find((p) => p.id === id)?.name;
  if (auditor?.messages.length) {
    const messages = promptOf(auditor.messages);
    const seed = messages.find((m) => m.role === 'user');
    const ordered = [...messages.filter((m) => m.role !== 'system'), ...messages.filter((m) => m.role === 'system')];
    const name = nameOf(auditor.participant);
    return {
      title: 'Auditor Instructions',
      description: (
        <>
          The auditor{name && <span className="font-mono text-xs"> ({name})</span>} is given these instructions to
          interact with the subject model{' '}
          <span className="font-mono text-xs">({nameOf(thread?.participant) ?? subject})</span>.
        </>
      ),
      rows: [
        {
          id: 'auditor',
          preview: seed ? seedOf(seed.text) : 'Auditor Instructions',
          parts: ordered.map((m) => ({
            heading: m.role === 'system' ? 'Auditor: System Prompt' : 'Auditor: Seed Prompt',
            text: m.text,
            markdown: true,
          })),
        },
      ],
    };
  }
  const rows: PromptRow[] = [];
  if (input) {
    const text = fullInput(input, thread?.messages ?? []);
    rows.push({ id: 'input', preview: input, parts: [{ heading: 'Input', text }], choices });
  }
  if (transcript) {
    const roles = roleSlots(transcript, slots, modelOf).map(
      ({ slot, prompt, headings }): PromptRow & { partner: boolean } => ({
        id: slot.id,
        preview: prompt.messages[0]!.text,
        parts: prompt.messages.map((m, i) => ({ heading: headings[i]!, text: m.text })),
        partner: slot.role === 'auditor',
      }),
    );
    rows.push(...roles.filter((s) => s.partner));
    const system = promptOf(thread?.messages ?? []).filter((m) => m.role === 'system');
    if (system.length)
      rows.push({
        id: 'system',
        preview: system[0]!.text,
        parts: system.map((m) => ({ heading: 'System Prompt', text: m.text })),
      });
    if (judges) rows.push(...roles.filter((s) => !s.partner));
  }
  return { title, description, rows };
}

/** The whole input. The runner keeps only its start ("…" at the end); the target's first user
 * message has all of it, when that message starts with the same text. */
export function fullInput(input: string, messages: Message[]) {
  if (!input.endsWith('…')) return input;
  const first = promptOf(messages).find((m) => m.role === 'user')?.text;
  return first && first.length >= input.length && first.startsWith(input.slice(0, -1)) ? first : input;
}

/** One fact, below the scores. `info`: help text in a popover after the label. */
export function Fact({
  label,
  info,
  className,
  children,
}: {
  label: string;
  info?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <dl className={cn('flex flex-col gap-y-1 border-t border-slate-200 px-3 pt-1.5 pb-2 text-xs', className)}>
      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        {label}
        {info && (
          <InfoPopover
            label={label}
            iconClassName="size-3"
            triggerClassName="ml-1 align-[-2px]"
            contentClassName="text-xs font-normal tracking-normal normal-case"
          >
            {info}
          </InfoPopover>
        )}
      </dt>
      <dd className="min-w-0 pl-2 wrap-anywhere text-slate-800">{children}</dd>
    </dl>
  );
}

/** The model of each slot. `names`: the slot's name at the left, the model at the right. */
export function Slots({ slots, modelOf, names }: { slots: ModelSlot[]; modelOf: ModelOf; names: boolean }) {
  return (
    <span className="flex flex-col gap-y-1">
      {slots.map((m) => (
        <span key={m.id} className="flex items-baseline justify-between gap-x-3">
          {names && <span className="text-xs text-slate-500">{slotLabel(m)}</span>}
          <span className="min-w-0 text-right font-mono text-[11px] wrap-anywhere">{modelOf(m)}</span>
        </span>
      ))}
    </span>
  );
}

/** A closed section: a click on `label` opens `children`. */
export function Closed({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <details className={cn('group/closed', className)}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-x-0.5 text-sky-800 select-none hover:underline [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronRight className="size-3 transition-transform group-open/closed:rotate-90" aria-hidden />
      </summary>
      {children}
    </details>
  );
}

/** Metadata in a closed list. */
export function OtherMetadata({ entries }: { entries: (readonly [string, unknown])[] }) {
  return (
    <Closed label="Other Metadata" className="mt-1">
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        {entries.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="font-mono text-[10px]/4 text-slate-500">{k}</dt>
            <dd className="min-w-0 whitespace-pre-line">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
          </Fragment>
        ))}
      </dl>
    </Closed>
  );
}

/** The eval's metadata of a sample in a transcript, with no empty values. The keys of a lens
 * readout, a probe swap, a WorkspaceBench readout or the sample's settings are not included, as
 * their views show them. */
export function metadataOf(transcript?: Transcript | null): [string, unknown][] {
  const { inspect } = (transcript?.extensions ?? {}) as { inspect?: { metadata?: Record<string, unknown> } };
  const meta = inspect?.metadata ?? {};
  const skip = new Set([
    'openauditSettings',
    ...(meta.lensReadout ? READOUT_KEYS : []),
    ...(meta.probeSwap ? SWAP_KEYS : []),
    ...(meta.wsbReadout ? WSB_KEYS : []),
  ]);
  return Object.entries(meta).filter(([k, v]) => v != null && v !== '' && !skip.has(k));
}
