'use client';

import { AttestedLink } from '@/components/eval-attestation';
import { bytesSource, plainMember, readDirectory, readMember } from '@/lib/eval-zip';
import { useState, type ReactNode } from 'react';

/** The `.eval` log at `url` as one JSON object: `header`, then `sample` (with its settings). */
async function logJson(url: string): Promise<{ text: string; name: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.text()) || `${res.status}`);
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'attempt.eval';
  const src = bytesSource(new Uint8Array(await res.arrayBuffer()));
  const out: Record<string, unknown> = {};
  for (const e of await readDirectory(src)) {
    const key = e.name === 'header.json' ? 'header' : e.name.startsWith('samples/') ? 'sample' : null;
    if (key) out[key] = JSON.parse(new TextDecoder().decode(await plainMember(await readMember(src, e))));
  }
  return { text: JSON.stringify(out, null, 2), name: name.replace(/\.eval$/, '.json') };
}

function save(text: string, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** One attempt's log as readable JSON. The browser gets the `.eval` file at `href` (with the
 * same checks) and makes the JSON. */
export function JsonLogLink({
  href,
  cleared,
  className,
  children,
}: {
  href: string;
  cleared: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<'idle' | 'busy' | string>('idle');
  const open = async (url: string) => {
    setState('busy');
    try {
      const { text, name } = await logJson(url);
      save(text, name);
      setState('idle');
    } catch (e) {
      setState(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <>
      <AttestedLink href={href} cleared={cleared} className={className} onOpen={(url) => void open(url)}>
        {children}
      </AttestedLink>
      {state === 'busy' && <span className="text-slate-500"> (preparing)</span>}
      {state !== 'idle' && state !== 'busy' && <span className="text-rose-700"> (failed: {state})</span>}
    </>
  );
}
