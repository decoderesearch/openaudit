'use client';

import Link from '@/components/link';
import { NAV_ITEM } from '@/components/nav/nav-menu';
import Turnstile from '@/components/turnstile';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Textarea } from '@/components/ui/textarea';
import {
  bodyOfHash,
  FIELD_LIMITS,
  presetFromQuery,
  REPLY_TIME,
  REPORT_LIMITS,
  REPORT_TURNSTILE_ACTION,
  REPORT_TYPES,
  reportType,
  SUBMISSION_FIELDS,
  SUBMIT_PAGE,
  submitPreset,
  type Preset,
  type ReportType,
  type SubmissionField,
} from '@/lib/report';
import type { NavMethod } from '@/lib/server/nav-methods';
import { HARNESSES, submitPath } from '@/lib/submissions';
import { cn } from '@/lib/utils';
import { ArrowRight, UserGroup } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

// The submission form. It posts to /api/report, which saves it, emails the support inbox and sends
// the sender a receipt. With a Turnstile key from `ReportKeyProvider`, a Turnstile token goes with
// each submission. A link with `?submit=<type>` opens the form, with the type's fields from the
// other query values (`?submit=method&method=Workspace Lenses`).

type State =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; confirmed: boolean } | { kind: 'error'; message: string };

const ReportKey = createContext<string | null>(null);

/** Gives the Turnstile site key to each submission form. `null`: no Turnstile check. */
export function ReportKeyProvider({ siteKey, children }: { siteKey: string | null; children: ReactNode }) {
  return <ReportKey.Provider value={siteKey}>{children}</ReportKey.Provider>;
}

const SUBMIT_EVENT = 'openaudit:submit';

/** Opens the navbar's form with a type and field values, from any part of the page. */
export function openSubmitForm(type: ReportType, fields: Record<string, string> = {}) {
  window.dispatchEvent(new CustomEvent<Preset>(SUBMIT_EVENT, { detail: { type, fields } }));
}

/** The navbar's "Contribute" link to the contribute page, and the form for `openSubmitForm` and for
 * a `?submit=` link, which then takes the query values off the URL. `methods`: the site's methods,
 * for the Method type's lists. */
export function ReportButton({ methods }: { methods?: NavMethod[] | null }) {
  const pathname = usePathname();
  const [preset, setPreset] = useState<Preset | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onSubmit = (e: Event) => {
      setPreset((e as CustomEvent<Preset>).detail);
      setOpen(true);
    };
    window.addEventListener(SUBMIT_EVENT, onSubmit);
    return () => window.removeEventListener(SUBMIT_EVENT, onSubmit);
  }, []);
  useEffect(() => {
    const found = pathname === SUBMIT_PAGE ? null : presetFromQuery(window.location.search);
    if (!found) return;
    // A link opens the form once; a render cannot derive this from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreset(found);
    setOpen(true);
    window.history.replaceState(window.history.state, '', pathname);
  }, [pathname]);
  return (
    <>
      <Link
        href="/contribute"
        hover={false}
        className={cn(NAV_ITEM, 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800')}
      >
        <UserGroup />
        Contribute
      </Link>
      <ReportDialog
        key={preset ? JSON.stringify(preset) : 'navbar'}
        type={preset?.type}
        fields={preset?.fields}
        methods={methods}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** A button that opens the form with a type and field values: a page's own entry point, such as a
 * model's "Suggest an evaluation". `onPick`: also on a click, for example to close a menu. */
export function SubmitDialogButton({
  type,
  fields,
  className,
  onPick,
  children,
}: {
  type: ReportType;
  fields?: Record<string, string>;
  className?: string;
  onPick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onPick?.();
        openSubmitForm(type, fields);
      }}
    >
      {children}
    </button>
  );
}

const NO_FIELDS: Record<string, string> = {};
/** The text size of the form's fields. A phone keeps 16px, so it does not zoom in on focus. */
const FIELD_TEXT = 'sm:text-xs md:text-xs';

/** A method in the Method type's list: its slug and name. */
type MethodOption = { slug: string; label: string };
/** The list value of "New Method". */
const NEW = '__new__';

function methodOptions(methods: NavMethod[] | null | undefined): MethodOption[] {
  return (methods ?? [])
    .map((m) => ({ slug: m.href.split('/').at(-1) ?? '', label: m.label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** True: the start method is not in the list, so it is a new method. */
const isNewMethod = (fields: Record<string, string>, options: MethodOption[]) =>
  !!fields.method && !options.some((o) => o.label === fields.method);

type StartValues = {
  type?: ReportType;
  body?: string;
  fields?: Record<string, string>;
  methods?: NavMethod[] | null;
};

/** The state of a submission form, from its start values. The dialog keeps it while it is closed,
 * so a draft stays. `reset` goes back to the start values. */
function useSubmission({
  type: startType = 'incident',
  body: startBody = '',
  fields: startFields = NO_FIELDS,
  methods,
}: StartValues) {
  const turnstileSiteKey = useContext(ReportKey);
  const pathname = usePathname();
  const [type, setType] = useState<ReportType>(startType);
  const [body, setBody] = useState(startBody);
  const [email, setEmail] = useState('');
  const [fields, setFields] = useState(startFields);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [token, setToken] = useState<string | null>(null);
  // A token works once: a new key gives a new widget and a new token.
  const [widget, setWidget] = useState(0);
  const checked = !turnstileSiteKey || token !== null;
  const kind = reportType(type);
  const setField = (id: string, v: string) => setFields((f) => ({ ...f, [id]: v }));
  const options = useMemo(() => methodOptions(methods), [methods]);
  const [newMethod, setNewMethod] = useState(() => isNewMethod(startFields, options));
  // True: the variant does not fit the method's harness, so it goes in the form.
  const [noHarness, setNoHarness] = useState(false);
  const picked = newMethod ? undefined : options.find((o) => o.label === fields.method);
  const harnesses = picked ? (HARNESSES[picked.slug]?.length ?? 0) : 0;
  const harness = type === 'method' && picked && harnesses > 0 && !noHarness ? picked : null;
  const shown = SUBMISSION_FIELDS[type].filter(
    (f) => (!f.showIf || f.showIf.values.includes(fields[f.showIf.field] ?? '')) && (!harness || f.id === 'method'),
  );
  const pickMethod = (v: string) => {
    setNewMethod(v === NEW);
    setNoHarness(false);
    setField('method', v === NEW ? '' : v);
  };
  const fieldInput = (f: SubmissionField) =>
    type === 'method' && options.length > 0 && f.id === 'method' ? (
      <MethodField
        key={f.id}
        label={f.label}
        options={options.map((o) => o.label)}
        value={fields.method ?? ''}
        isNew={newMethod}
        onPick={pickMethod}
        onName={(v) => setField('method', v)}
      />
    ) : type === 'method' && f.id === 'variant' ? (
      <FieldInput
        key={f.id}
        field={{ ...f, placeholder: 'The name of your new variant' }}
        value={fields[f.id] ?? ''}
        onChange={setField}
      />
    ) : (
      <FieldInput key={f.id} field={f} value={fields[f.id] ?? ''} onChange={setField} />
    );

  const reset = () => {
    setType(startType);
    setBody(startBody);
    setEmail('');
    setFields(startFields);
    setNewMethod(isNewMethod(startFields, options));
    setNoHarness(false);
    setState({ kind: 'idle' });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState({ kind: 'sending' });
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, body, email, fields, page: pathname, turnstileToken: token }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        confirmed?: boolean;
      } | null;
      if (res.ok) return setState({ kind: 'sent', confirmed: data?.confirmed === true });
      setState({ kind: 'error', message: data?.error ?? 'We could not send your submission. Try again later.' });
    } catch {
      setState({ kind: 'error', message: 'We could not send your submission. Check your connection and try again.' });
    } finally {
      setToken(null);
      setWidget((n) => n + 1);
    }
  }

  return {
    type,
    setType,
    body,
    setBody,
    email,
    setEmail,
    state,
    setToken,
    widget,
    checked,
    kind,
    shown,
    harness,
    harnesses,
    setNoHarness,
    fieldInput,
    submit,
    turnstileSiteKey,
    setField,
    fields,
    reset,
  };
}

type Submission = ReturnType<typeof useSubmission>;

/** The How to Contribute subsection for each type: an AI agent can guide the person through it. */
const CONTRIBUTE_GUIDE: Record<ReportType, string> = {
  incident: '/contribute#submit-incidents',
  evaluation: '/contribute#model-evaluations',
  method: '/contribute#safety-methods',
  other: '/contribute#other',
};

/** A note that points to the type's How to Contribute subsection, where a prompt guides the flow. */
function GuidedFlowNote({ type, onLeave }: { type: ReportType; onLeave?: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-sky-50 p-3 text-xs text-sky-900 sm:flex-row sm:items-center sm:justify-between">
      <p>If you prefer to submit with an AI agent, click the button to the right.</p>
      <Button asChild size="xs" variant="outline" className="shrink-0 self-start bg-white sm:self-auto">
        <Link href={CONTRIBUTE_GUIDE[type]} hover={false} onClick={onLeave}>
          Submit With AI
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

/** The form of a `useSubmission`, or its thank-you note once sent. `onCancel`: a Cancel button.
 * `onLeave`: a link leaves the form. `onType`: after a new type. `done`: the buttons under the
 * thank-you note. */
function SubmissionForm({
  s,
  onCancel,
  onLeave,
  onType,
  done,
}: {
  s: Submission;
  onCancel?: () => void;
  onLeave?: () => void;
  onType?: (type: ReportType) => void;
  done: ReactNode;
}) {
  const {
    type,
    setType,
    body,
    setBody,
    email,
    setEmail,
    state,
    setToken,
    widget,
    checked,
    kind,
    shown,
    harness,
    harnesses,
    setNoHarness,
    fieldInput,
    submit,
    turnstileSiteKey,
    setField,
    fields,
  } = s;
  return state.kind === 'sent' ? (
    <div className="flex flex-col gap-y-4">
      <p className="text-sm text-slate-700">
        Thank you. We got your submission.{' '}
        {state.confirmed
          ? `We sent a confirmation to ${email}. Expect our reply in ${REPLY_TIME}, depending on our backlog.`
          : `We review submissions in ${REPLY_TIME}, depending on our backlog.`}
      </p>
      <DialogFooter>{done}</DialogFooter>
    </div>
  ) : (
    <form onSubmit={submit} className="flex flex-col gap-y-4">
      <fieldset className="flex flex-col gap-y-2">
        <legend className="sr-only">Submission type</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {REPORT_TYPES.map((t) => (
            <label
              key={t.id}
              className={cn(
                'cursor-pointer rounded-full border px-2 py-1 text-center text-xs font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-sky-300',
                type === t.id
                  ? 'border-sky-700 bg-sky-50 text-sky-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              <input
                type="radio"
                name="report-type"
                value={t.id}
                checked={type === t.id}
                onChange={() => {
                  setType(t.id);
                  onType?.(t.id);
                }}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">{kind.about}</p>
      </fieldset>
      {!harness && <GuidedFlowNote type={type} onLeave={onLeave} />}
      {shown.some((f) => f.kind !== 'textarea') && (
        <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
          {shown.filter((f) => f.kind !== 'textarea').map(fieldInput)}
        </div>
      )}
      {harness ? (
        <div className="flex flex-col gap-3 rounded-md bg-sky-50 p-3 text-xs text-sky-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-start gap-1.5">
            <p>
              {harness.label} has{' '}
              {harnesses > 1 ? `${harnesses} method evaluation harnesses` : 'a method evaluation harness'}: our code,
              which you run on your new variant. Then you send it as a pull request. The instructions have the steps and
              a prompt for a coding agent.
            </p>
            <button
              type="button"
              onClick={() => setNoHarness(true)}
              className="text-sky-700 underline decoration-sky-300 underline-offset-2 hover:decoration-sky-700"
            >
              My variant does not fit {harnesses > 1 ? 'the harnesses' : 'the harness'}
            </button>
          </div>
          <Button asChild size="xs" variant="outline" className="shrink-0 self-start bg-white sm:self-auto">
            <Link href={submitPath(harness.slug)} hover={false} onClick={onLeave}>
              Open Instructions
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Label htmlFor="report-body" className="sr-only">
              Submission
            </Label>
            <Textarea
              id="report-body"
              required
              value={body}
              maxLength={REPORT_LIMITS.body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={kind.placeholder}
              className={cn('max-h-64 min-h-28 pb-6', FIELD_TEXT)}
            />
            <p className="pointer-events-none absolute right-3 bottom-1.5 rounded bg-white px-1 text-[11px] text-slate-400 tabular-nums">
              {body.length.toLocaleString('en-US')} / {REPORT_LIMITS.body.toLocaleString('en-US')}
            </p>
          </div>
          {shown
            .filter((f) => f.kind === 'textarea')
            .map((f) => (
              <FieldInput key={f.id} field={f} value={fields[f.id] ?? ''} onChange={setField} className="-mt-2" />
            ))}
          <div className="-mt-2.5 -mb-1 flex flex-col gap-y-1">
            <Label htmlFor="report-email" className="text-xs">
              {kind.needsEmail ? 'Email' : 'Email (optional)'}
            </Label>
            <Input
              id="report-email"
              type="email"
              autoComplete="email"
              required={kind.needsEmail}
              value={email}
              maxLength={REPORT_LIMITS.email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={FIELD_TEXT}
            />
          </div>
          {turnstileSiteKey && (
            <Turnstile
              key={widget}
              siteKey={turnstileSiteKey}
              action={REPORT_TURNSTILE_ACTION}
              appearance="interaction-only"
              onToken={setToken}
            />
          )}
          {state.kind === 'error' && <p className="text-sm text-red-600">{state.message}</p>}
        </>
      )}
      <DialogFooter className="-mt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {!harness && (
          <Button
            type="submit"
            disabled={state.kind === 'sending' || !body.trim() || (kind.needsEmail && !email.trim()) || !checked}
          >
            {state.kind === 'sending' ? 'Sending…' : 'Submit'}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

const PRIVACY_NOTE =
  'Submissions should not be considered anonymous, since we use third party hosting platforms. If you wish to remain truly anonymous, you need to provide your own opsec (eg VPNs, etc).';

/** The submission form in a dialog that `trigger` opens. `type`, `body` and `fields` are the start
 * values. With `open`, the parent opens and closes it. With `methods`, the Method type picks the
 * method from a list. A variant of a method with a harness goes to its submit page. */
export function ReportDialog({
  trigger,
  open: openProp,
  onOpenChange,
  ...start
}: StartValues & {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = (o: boolean) => {
    if (openProp === undefined) setOwnOpen(o);
    onOpenChange?.(o);
  };
  const s = useSubmission(start);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && s.state.kind === 'sent') s.reset();
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[40rem]">
        <DialogHeader>
          <DialogTitle>New Submission</DialogTitle>
          <DialogDescription className="text-xs">{PRIVACY_NOTE}</DialogDescription>
        </DialogHeader>
        <SubmissionForm
          s={s}
          onCancel={() => setOpen(false)}
          onLeave={() => setOpen(false)}
          done={<Button onClick={() => setOpen(false)}>Close</Button>}
        />
      </DialogContent>
    </Dialog>
  );
}

/** The form of the `/submit` page. The type in the URL picks the type, and a new type goes in the
 * URL as `#<type>`, so a link can open each type. `#...&body=` gives the start text. `start`: the
 * values from the query, on the server. */
export function SubmitPageForm({ start, methods }: { start: Preset | null; methods?: NavMethod[] | null }) {
  const s = useSubmission({ type: start?.type, fields: start?.fields, methods });
  const { setType, setBody } = s;
  useEffect(() => {
    const fromUrl = () => {
      const t = submitPreset(window.location.hash, '')?.type;
      if (t) setType(t);
      const body = bodyOfHash(window.location.hash);
      if (body) setBody(body);
    };
    fromUrl();
    window.addEventListener('hashchange', fromUrl);
    return () => window.removeEventListener('hashchange', fromUrl);
  }, [setType, setBody]);
  return (
    <div id="submit-form" className="mx-auto w-full max-w-[40rem] rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-y-4 px-5 py-5 sm:px-6">
        <p className="text-xs text-slate-500">{PRIVACY_NOTE}</p>
        <SubmissionForm
          s={s}
          onType={(t) => window.history.replaceState(window.history.state, '', `${window.location.pathname}#${t}`)}
          done={
            <Button asChild>
              <Link href="/" hover={false}>
                Back to Home
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

/** The list of methods, with "New Method" at the end. A new method gets a text box for its name. */
function MethodField({
  label,
  options,
  value,
  isNew,
  onPick,
  onName,
}: {
  label: string;
  options: string[];
  value: string;
  isNew: boolean;
  onPick: (value: string) => void;
  onName: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <Label htmlFor="report-field-method" className="text-xs">
        {label}
      </Label>
      <SelectNative
        id="report-field-method"
        value={isNew ? NEW : value}
        onChange={(e) => onPick(e.target.value)}
        className={FIELD_TEXT}
      >
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={NEW}>New Method</option>
      </SelectNative>
      {isNew && (
        <Input
          aria-label={`${label} name`}
          value={value}
          maxLength={FIELD_LIMITS.text}
          onChange={(e) => onName(e.target.value)}
          placeholder="The name of the method"
          className={FIELD_TEXT}
        />
      )}
    </div>
  );
}

/** One extra field of a type. A check box and a `wide` field span the grid; the others take one
 * cell. */
function FieldInput({
  field: f,
  value,
  onChange,
  className,
}: {
  field: SubmissionField;
  value: string;
  onChange: (id: string, value: string) => void;
  className?: string;
}) {
  const id = `report-field-${f.id}`;
  if (f.kind === 'check') {
    return (
      <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          className="mt-px size-3.5 shrink-0 accent-sky-700"
          checked={value === 'yes'}
          onChange={(e) => onChange(f.id, e.target.checked ? 'yes' : '')}
        />
        {f.label}
      </label>
    );
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-y-1', f.wide && 'sm:col-span-2', className)}>
      <Label htmlFor={id} className="text-xs">
        {f.label}
      </Label>
      {f.kind === 'select' ? (
        <SelectNative id={id} value={value} onChange={(e) => onChange(f.id, e.target.value)} className={FIELD_TEXT}>
          <option value="">Select</option>
          {f.options?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </SelectNative>
      ) : f.kind === 'textarea' ? (
        <Textarea
          id={id}
          value={value}
          maxLength={FIELD_LIMITS.textarea}
          onChange={(e) => onChange(f.id, e.target.value)}
          placeholder={f.placeholder}
          className={cn('max-h-48 min-h-20', FIELD_TEXT)}
        />
      ) : (
        <Input
          id={id}
          type={f.kind === 'url' ? 'url' : 'text'}
          value={value}
          maxLength={FIELD_LIMITS[f.kind]}
          onChange={(e) => onChange(f.id, e.target.value)}
          placeholder={f.placeholder}
          className={FIELD_TEXT}
        />
      )}
    </div>
  );
}
