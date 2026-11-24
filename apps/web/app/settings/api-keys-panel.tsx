'use client';

import { LocalTime } from '@/components/local-time';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { Copy, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type KeyRow = { id: string; name: string | null; start: string | null; createdAt: Date; lastRequest: Date | null };

// API keys for scripts, agents and the CLI. The plaintext is shown once, at creation.
export default function ApiKeysPanel() {
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  // Bumped to reload the list after a change.
  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    let current = true;
    void authClient.apiKey.list().then(({ data, error }) => {
      if (!current) return;
      if (error) return toast.error(error.message ?? 'Could not load API keys.');
      setKeys(data?.apiKeys ?? []);
    });
    return () => {
      current = false;
    };
  }, [version]);

  async function create() {
    if (!name.trim()) return toast.error('Give the key a name.');
    setBusy(true);
    const { data, error } = await authClient.apiKey.create({ name: name.trim() });
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? 'Could not create the key.');
    setCreated(data.key);
    setName('');
    load();
  }

  async function remove(k: KeyRow) {
    if (!confirm(`Revoke key "${k.name ?? k.start}"? Anything that uses it stops working.`)) return;
    const { error } = await authClient.apiKey.delete({ keyId: k.id });
    if (error) return toast.error(error.message ?? 'Could not revoke the key.');
    toast.success('API key revoked.');
    load();
  }

  return (
    <Card id="api">
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>
          For scripts, AI agents and the CLI. Send as{' '}
          <code className="rounded bg-slate-100 px-1 text-xs text-slate-700">x-api-key</code>. A key acts as you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-4">
        {created && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <div className="mb-1 font-medium">Copy this key now. It is not shown again.</div>
            <div className="flex items-center gap-x-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs">{created}</code>
              <Button
                size="icon"
                variant="outline"
                aria-label="Copy key"
                onClick={() => {
                  void navigator.clipboard.writeText(created);
                  toast.success('Copied.');
                }}
              >
                <Copy />
              </Button>
            </div>
            <button type="button" className="mt-2 text-xs underline" onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        )}
        {keys && keys.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-x-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">{k.name ?? 'Unnamed'}</div>
                  <div className="font-mono text-xs break-all text-slate-500">
                    {k.start}… · created <LocalTime value={k.createdAt} mode="date" />
                    {k.lastRequest && (
                      <>
                        {' '}
                        · last used <LocalTime value={k.lastRequest} mode="date" />
                      </>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Revoke ${k.name ?? 'key'}`}
                  onClick={() => void remove(k)}
                >
                  <Trash2 className="text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {keys && keys.length === 0 && <div className="text-sm text-slate-500">No API keys yet.</div>}
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div className="flex flex-1 flex-col gap-y-1.5">
            <Label htmlFor="key-name">Key name</Label>
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-agent" />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create key'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
