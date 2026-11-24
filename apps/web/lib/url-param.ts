/** Sets or deletes one URL search parameter, with no page load and no new history entry. */
export function replaceUrlParam(key: string, value: string | undefined) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(null, '', url);
}
