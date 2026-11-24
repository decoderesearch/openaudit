// JSON for the chat helper's prompt: ids, extraction details and empty values removed.

const DROP = new Set([
  'id',
  'documentId',
  'alsoDocumentIds',
  'basedOnDocumentId',
  'documentIds',
  'organizationId',
  'evalId',
  'evalVersionId',
  'modelId',
  'parentId',
  'ownerUserId',
  'pdfPage',
  'extraction',
  'reviewed',
  'canary',
  'sha256',
  'fetchedAt',
  'fileKey',
  'fileUrl',
]);

export function compact(value: unknown): string {
  return JSON.stringify(prune(value) ?? null);
}

/** The value without dropped keys, or undefined when nothing is left. */
function prune(v: unknown): unknown {
  if (v === null || v === undefined || v === '') return undefined;
  if (Array.isArray(v)) {
    const items = v.map(prune).filter((x) => x !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v)
      .filter(([k]) => !DROP.has(k))
      .map(([k, x]) => [k, prune(x)] as const)
      .filter(([, x]) => x !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return v;
}
