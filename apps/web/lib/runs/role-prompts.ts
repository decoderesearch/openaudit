import type { ModelSlot } from '@openaudit/spec';

/** A model role's prompts, as the runner keeps them in `extensions.inspect.rolePrompts`. `role`: the
 * Inspect role, else the model. `call`: the call's number in the role. */
export type RolePrompt = {
  role: string;
  model: string;
  calls: number;
  messages: { role: string; text: string; call: number }[];
};

/** The prompts of each of the eval's slots: its simulated users and partners (`auditor` slots) first,
 * then its judges. A slot with no Inspect role finds its prompts by its id, else by its model. */
export function slotPrompts(prompts: RolePrompt[], slots: ModelSlot[], modelOf: (s: ModelSlot) => string) {
  return [...slots.filter((s) => s.role === 'auditor'), ...slots.filter((s) => s.role !== 'auditor')].flatMap(
    (slot) => {
      const model = modelOf(slot);
      const prompt = slot.inspectRole
        ? prompts.find((p) => p.role === slot.inspectRole)
        : (prompts.find((p) => p.role === slot.id) ??
          prompts.find((p) => p.role === p.model && (p.model === model || p.model.endsWith(`/${model}`))));
      return prompt?.messages.length ? [{ slot, prompt }] : [];
    },
  );
}

/** For each call of a partner (`calls` in all), the index of the user message that it wrote, from
 * `users` (the indexes of the thread's user messages). The user messages before the partner's are
 * the sample's own. A last call with no message stays out: the transcript stopped before it. */
export function writtenMessages(users: number[], calls: number) {
  const own = Math.max(0, users.length - calls);
  return users.slice(own, own + calls);
}

/** The heading of each message: its kind, and the calls that got it when the role has more than one.
 * A system prompt stays until the next one. */
export function promptHeadings(label: string, p: RolePrompt) {
  return p.messages.map((m, i) => {
    const kind = m.role === 'system' ? 'System Prompt' : 'User Prompt';
    if (p.calls < 2) return `${label}: ${kind}`;
    if (m.role !== 'system') return `${label}: ${kind} (First Call)`;
    const next = p.messages.slice(i + 1).find((n) => n.role === 'system' && n.call > m.call);
    const end = next ? next.call - 1 : p.calls;
    return `${label}: ${kind} (${end === m.call ? `Call ${m.call}` : `Calls ${m.call}–${end}`})`;
  });
}
