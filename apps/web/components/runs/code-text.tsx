/** Text with its parts in backticks shown as code. */
export function CodeText({ text }: { text: string }) {
  return text.split(/`([^`]*)`/).map((part, i) =>
    i % 2 ? (
      <code key={i} className="rounded bg-slate-100 px-1 font-mono text-[0.9em]">
        {part}
      </code>
    ) : (
      part
    ),
  );
}
