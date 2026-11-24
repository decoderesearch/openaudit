// One key per inbox: lowercase, without a `+tag`, and for Gmail without dots. Email limits count
// by this key, so `j.lin+x@gmail.com` and `jlin@gmail.com` share one limit.
export function inboxKey(address: string): string {
  const trimmed = address.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return trimmed;
  let local = trimmed.slice(0, at).split('+')[0];
  let domain = trimmed.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replaceAll('.', '');
  return `${local}@${domain}`;
}
