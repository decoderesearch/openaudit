import { AttestedLink } from '@/components/eval-attestation';
import Link from '@/components/link';
import { JsonLogLink } from '@/components/runs/json-log-link';
import { attemptRule } from '@/lib/runs/terms';
import type { getRun, ShownAttempt } from '@/lib/server/runs';
import { attemptPath, runPath } from '@/lib/server/runs';
import { Download as DownloadIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

type Found = Pick<
  NonNullable<Awaited<ReturnType<typeof getRun>>>,
  'run' | 'version' | 'access' | 'logRule' | 'logLocked' | 'redacted'
>;

const bytes = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.ceil(n / 1e3)} kB`);

const SHOWN = 3;
const LINK = 'text-sky-800 hover:underline';
const PREPARING = 'being prepared';
const TERMS = 'hidden by the dataset terms';

const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <span className="block">
    <span className="text-slate-500">{label}:</span> {children}
  </span>
);

/** The public copy leaves out nothing, so it is the full log. */
const sameFile = ({ redacted }: Found) => !!redacted?.ready && !redacted.omit.length;

const Download = ({ found, href, children }: { found: Found; href: string; children: ReactNode }) => (
  <AttestedLink href={href} cleared={found.access.cleared} className={LINK}>
    {children}
  </AttestedLink>
);

/** The run's Inspect logs as downloads, else why the reader cannot get them. Null: no log. */
export function LogLink({ found }: { found: Found }) {
  const { run, access, logRule, redacted } = found;
  if (!run.log) return null;
  return (
    <>
      <Line label={access.staff && !sameFile(found) ? 'Whole run, redacted' : 'Whole run'}>
        {!redacted?.ready ? (
          PREPARING
        ) : !access.allows(redacted.rule) ? (
          TERMS
        ) : (
          <>
            <Download found={found} href={`${runPath(run)}/log/redacted`}>
              Inspect log ({bytes(redacted.bytes ?? run.log.bytes)})
            </Download>
            {redacted.omit.length > 0 && <LeftOut found={found} />}
          </>
        )}
      </Line>
      {access.staff && !sameFile(found) && (
        <Line label="Whole run, full">
          {access.allows(logRule) ? (
            <Download found={found} href={`${runPath(run)}/log`}>
              Inspect log ({bytes(run.log.bytes)})
            </Download>
          ) : (
            TERMS
          )}
        </Line>
      )}
    </>
  );
}

/** An attempt's Inspect log and its run's, one on each line. Staff also get the run's full log
 * when it is not the public copy. */
export function AttemptLogLinks({ found, attempt }: { found: Found; attempt: ShownAttempt }) {
  const { run, access, logRule, redacted } = found;
  if (!run.log) return null;
  const icon = <DownloadIcon className="mr-1 inline size-3 align-[-2px]" aria-hidden />;
  const mine = AttemptLog({ found, attempt, text: 'Inspect log (this attempt)', icon });
  return (
    <>
      <span className="block">{typeof mine === 'string' ? `This attempt: ${mine}` : mine}</span>
      <span className="block">
        {!redacted?.ready ? (
          `Full run: ${PREPARING}`
        ) : !access.allows(redacted.rule) ? (
          `Full run: ${TERMS}`
        ) : (
          <Download found={found} href={`${runPath(run)}/log/redacted`}>
            {icon}
            Inspect run (full run)
          </Download>
        )}
      </span>
      {access.staff && access.allows(logRule) && !sameFile(found) && (
        <span className="block">
          <Download found={found} href={`${runPath(run)}/log`}>
            {icon}
            Inspect run (not redacted)
          </Download>
        </span>
      )}
      <span className="block text-slate-500">
        Run log as JSON: <code className="font-mono text-[11px]">inspect log convert --to json FILE</code>
      </span>
    </>
  );
}

/** The attempts that the redacted log leaves out: the first few by number, then a count. */
function LeftOut({ found: { run, logLocked, redacted } }: { found: Found }) {
  const omit = new Set(redacted?.omit);
  const named = logLocked.filter((a) => omit.has(a.id)).slice(0, SHOWN);
  const more = omit.size - named.length;
  const word = (n: number) => (n === 1 ? 'attempt' : 'attempts');
  return (
    <>
      {' · leaves out '}
      {named.length > 0 && `${word(omit.size)} `}
      {named.map((a, i) => (
        <Fragment key={a.ordinal}>
          {i > 0 && ', '}
          <Link href={attemptPath(run, a.ordinal)} className={LINK}>
            {a.ordinal}
          </Link>
        </Fragment>
      ))}
      {more > 0 && (named.length ? ` and ${more} more` : `${more} ${word(more)}`)}
    </>
  );
}

/** The log of one attempt. Staff get it from the full log; others only from the redacted copy. */
function AttemptLog({
  found,
  attempt,
  text,
  icon,
}: {
  found: Found;
  attempt: ShownAttempt;
  text: string;
  icon: ReactNode;
}) {
  const { run, version, access, redacted } = found;
  if (!access.allows(attemptRule(version, attempt))) return TERMS;
  const href = `${attemptPath(run, attempt.ordinal)}/log`;
  const link = (
    <>
      <Download found={found} href={href}>
        {icon}
        {text}
      </Download>
      {' · '}
      <JsonLogLink href={href} cleared={access.cleared} className={LINK}>
        JSON
      </JsonLogLink>
    </>
  );
  if (access.staff) return link;
  if (!access.hazardAllows(attempt.hazard ?? null) || redacted?.omit.includes(attempt.id))
    return 'disabled: this attempt has harmful content';
  return redacted?.ready ? link : PREPARING;
}
