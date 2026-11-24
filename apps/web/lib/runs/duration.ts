/** "About 6 minutes", "About 1 hour 20 minutes", "Less than a minute". */
export function durationText(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'Less than a minute';
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (minutes < 60) return `About ${unit(minutes, 'minute')}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `About ${unit(h, 'hour')}${m ? ` ${unit(m, 'minute')}` : ''}`;
}

/** "~6 min", "~1 h 20 min", "<1 min", for tables. */
export function shortDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `~${minutes} min`;
  const m = minutes % 60;
  return `~${Math.floor(minutes / 60)} h${m ? ` ${m} min` : ''}`;
}
