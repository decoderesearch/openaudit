import { ACTION } from '@/components/catalog/model-actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  ChevronDown,
  Code,
  Database,
  ExternalLink,
  FileText,
  Flag,
  Globe,
  Link2,
  Newspaper,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import { Children, Fragment, type ReactNode } from 'react';

type SourceLink = { kind: string; url: string; title?: string | null };

/** Short names for the kinds of links. */
const LABELS: Partial<Record<string, string>> = {
  paper: 'Paper',
  repo: 'Code',
  dataset: 'Data',
  homepage: 'Website',
  blog: 'Blog',
  leaderboard: 'Leaderboard',
  error_report: 'Error report',
};

const ICONS: Partial<Record<string, LucideIcon>> = {
  paper: FileText,
  repo: Code,
  dataset: Database,
  homepage: Globe,
  blog: Newspaper,
  leaderboard: Trophy,
  error_report: Flag,
};

const kindLabel = (kind: string) => LABELS[kind] ?? kind.replaceAll('_', ' ');

/** The "Links" menu: each link with its kind and address. Links open in a new tab. */
export function LinksMenu({ links }: { links: SourceLink[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={ACTION}>
        <Link2 aria-hidden />
        Links
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        {links.map((l) => {
          const Icon = ICONS[l.kind] ?? ExternalLink;
          return (
            <DropdownMenuItem key={l.url} asChild className="items-start text-xs">
              <a href={l.url} target="_blank" rel="nofollow noopener noreferrer">
                <Icon className="mt-0.5 text-slate-400" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-slate-800">{l.title ?? kindLabel(l.kind)}</span>
                  <span className="block truncate text-[10px] text-slate-400">
                    {kindLabel(l.kind)} · {l.url.replace(/^https?:\/\//, '')}
                  </span>
                </span>
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const DEMO_HOSTS = new Set(['neuronpedia.org', 'www.neuronpedia.org']);

/** The first Neuronpedia demo link (not docs), and the other links. */
export function splitDemo(links: SourceLink[]): { demo?: SourceLink; rest: SourceLink[] } {
  const demo = links.find((l) => URL.canParse(l.url) && DEMO_HOSTS.has(new URL(l.url).hostname));
  return { demo, rest: links.filter((l) => l !== demo) };
}

/** The Neuronpedia demo, the primary paper (else the first blog post), and the other links. */
export function splitLinks(links: SourceLink[]): { demo?: SourceLink; paper?: SourceLink; rest: SourceLink[] } {
  const { demo, rest } = splitDemo(links);
  const paper = rest.find((l) => l.kind === 'paper') ?? rest.find((l) => l.kind === 'blog');
  return { demo, paper, rest: rest.filter((l) => l !== paper) };
}

/** A button that opens the primary paper or post in a new tab. */
export function PaperButton({ link }: { link: SourceLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="nofollow noopener noreferrer"
      title={link.title ?? undefined}
      className={cn(ACTION, 'bg-white')}
    >
      <FileText aria-hidden />
      Paper
      <ArrowUpRight aria-hidden />
    </a>
  );
}

/** A button that opens a Neuronpedia demo in a new tab. */
export function NeuronpediaButton({ link }: { link: SourceLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="nofollow noopener noreferrer"
      title={link.title ?? undefined}
      className={cn(
        ACTION,
        'border-sky-700 bg-white pl-3.5 font-semibold text-sky-700 hover:bg-sky-50 hover:text-sky-800',
      )}
    >
      <Image src="/neuronpedia-logo.png" alt="" width={14} height={14} className="size-3.5" />
      Neuronpedia
      <ArrowUpRight aria-hidden />
    </a>
  );
}

/** The authors and date of a page, with center dots, above its buttons at the top right. */
export function Byline({ items }: { items: ReactNode[] }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 sm:justify-end">
      {shown.map((b, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>·</span>}
          {b}
        </Fragment>
      ))}
    </p>
  );
}

/** The top right of a method or variant page: `byline`, then a row of buttons: Neuronpedia,
 * Paper, `children`, Links and `end`. `cited`: the link that the page shows on its authors. When it is a
 * paper or a post, it is the primary source: first in Links, with no Paper button. */
export function LinkButtons({
  links,
  cited,
  byline,
  children,
  end,
}: {
  links: SourceLink[];
  cited?: SourceLink;
  byline?: ReactNode[];
  children?: ReactNode;
  end?: ReactNode;
}) {
  const split = splitLinks(links);
  const source = cited && (cited.kind === 'paper' || cited.kind === 'blog') ? cited : undefined;
  const paper = source ? undefined : split.paper;
  const rest = source ? [source, ...splitDemo(links).rest.filter((l) => l.url !== source.url)] : split.rest;
  const { demo } = split;
  const row = Children.toArray([children, end]).length > 0 || !!demo || !!paper || rest.length > 0;
  return (
    <div className="flex shrink-0 flex-col gap-2">
      {byline && <Byline items={byline} />}
      {row && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {demo && <NeuronpediaButton link={demo} />}
          {paper && <PaperButton link={paper} />}
          {children}
          {rest.length > 0 && <LinksMenu links={rest} />}
          {end}
        </div>
      )}
    </div>
  );
}
