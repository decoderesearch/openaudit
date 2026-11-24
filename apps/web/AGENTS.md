# Agent notes: apps/web

## UI style

These rules come from the owner's UI reviews. If a new request differs from a rule, do the
request and update the rule.

### Text

- Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.
- Do not show counts in titles or buttons ("Runs 12"), "N of M" text, or what the page already
  tells (the org name on its own page). Do not add "Details" or "About" titles.
- If readers need a description, put it behind a `?` circle to the right of the title
  (`InfoPopover`), not in the page.
- Use Title Case and full words: "Evaluations", not "Evals". Keep "and", "in" and "of" in lower
  case. Use plain names, not internal terms.
- Make text small by default. Make the main name (model, eval) a bit larger and heavier. Make
  secondary text smaller and lighter (`text-slate-400` or `text-slate-500`).
- Section labels and page types: small, bold, uppercase slate (`Eyebrow` in `components/page.tsx`).
- Join metadata on one line with " · ", the most important item first: "Model · Eval".
- Put a related item to the immediate right of the name, or on a second line below it. Do not
  add a column or parentheses for it.
- Use `font-mono` for ids, hashes, metric keys and raw scores. If the name and the key are the
  same, show only one.
- Keep names on one line (`whitespace-nowrap`). Cut long text with an ellipsis and a `title`, or
  clamp it to some lines.

### Color

- Neutral is slate. For neutral and unselected states, use a light slate fill (slate-50 to
  slate-200), not a border.
- Sky is for links and main actions. Model and eval names are dark sky links. Secondary buttons
  and toggles are slate, with a sky hover.
- Use color only for meaning: emerald is good, rose is bad. Flag levels use `CHAT_GROUP_STYLES`
  (red, amber, yellow). A zero gets no warning color. Show a score with the green/red `SafetyBar`.
- Bordered sections, tables and menu buttons have a white background.

### Layout

- Keep it flat: no wrapper panel around a table, no double borders, no extra separator lines.
- Put secondary information (metrics, specifications, links, sources, history) in dropdown
  buttons at the top right, across from the title.
- On desktop, fill the screen and scroll inside the panels (`FillHeight`, or `<Page fit>`). The
  page does not scroll. A long list gets a maximum height, its own scroll and a sticky header,
  not "N more…".
- On mobile, use one full-width column with no outer border or rounded corners.
- Loading, hover and selection must not move the layout. Show loading in an area of fixed height.
- Hide an empty column or list. In a main panel, show a centered light-slate "No X Found".

### Controls

- Buttons, badges, pills and toggles are fully rounded. Pills have no border.
- Popovers and menus open on click, not on hover; they keep a hover state. A dropdown trigger has
  a chevron. Use our popover (`components/ui/popover.tsx`), not a native select. Keep popovers
  inside the screen.
- Make the whole row the click target (a link with `after:absolute after:inset-0`), not a
  separate button. Table rows use `hover:bg-sky-50`; in lists, underline the name on hover.
- Filter chips are off by default. A click filters; a second click clears. Do not add an "All"
  chip, and hide a filter that has only one choice. Rows that are hidden by default (failed,
  cancelled) get a pill that shows them (`StatusFilterTable`).
- Filter and sort in the browser. Do not load the page again.
- Each breadcrumb level is a dropdown of the pages next to it.
- Use small slate Lucide icons. A link that leaves the site gets an external-link icon.

### Tables

- Make the headers sort (`SortTable`). Center number and score cells. Keep the header sticky.
- Remove columns of little value: tokens, time, settings and status. Show a status that is not
  the normal one below the name, and hide "succeeded", "public" and "active" badges.
- Sort by importance: the most severe flag first, then rows the reader can open, then the
  headline metric, then the name.

### Data

- Dates are short, with no time: "10/21/2026" in tables (`LocalTime mode="numeric"`); "October
  22" in feeds, with no year for the current year.
- Numbers are compact ("3.2k", at most 2 decimals). Show a ± range only on hover.

### Same look everywhere

- Use one component and one style for the same item on all pages (model lists, feeds, popovers,
  breadcrumbs). When you change one, change the others.
- Link to our own pages first. Each item has its own page, not an anchor in a list page.

## Reusable UI components

- **Link to an eval** (`/evaluations/<slug>`): use `EvalLink` from `components/eval-link.tsx`, not
  `Link`. On hover, it shows the eval's one-line summary and its topics (`A · B`). It loads all
  cards from `/api/eval-hovers` once per page. Markdown links to evals get it from
  `evalSlugOf` (`lib/eval-links.ts`). In menus and breadcrumbs, show the same text with
  `EvalAbout` in a tooltip (see `about` in `components/nav/breadcrumbs.tsx`). Use a plain `Link`
  only where the summary and topics already show (eval lists, the Evals menu), and on the
  eval's own pages.

- **Link to a model** (`/<owner>/<repo>`): use `Link`. It finds model paths (`modelPathOf` in
  `lib/model-links.ts`) and shows the model's hover card (`components/model-link.tsx`), from
  `/api/model-hovers` once per page. A new top-level route in `app/` must go in `TOP_ROUTES`.
  Use `hover={false}` where the card is not wanted.

- **Link to a method or variant** (`/methods/<method>[/<variant>]`): use `Link`. It finds these
  paths (`methodPathOf` in `lib/methods.ts`) and shows a hover card (`components/method-link.tsx`)
  from `/api/method-hovers` once per page. A new fixed route under `app/methods/` must go in
  `methodPathOf`.

- **Select-one toggle** (a row of joined buttons, one always on, such as All / OpenAudit / System Card): use
  `SegmentedControl` from `components/ui/segmented-control.tsx`. Do not make chips or tabs for
  this. It is a client component. To keep the choice in the URL, wrap it in a small client
  component that calls `router.push` (`useRouter` from `nextjs-toploader/app`).
- **Table that scrolls in the page** (the site footer stays on the screen): give `<Page>` the `fit`
  prop and give the table box `min-h-0 flex-1 overflow-auto`, with a `sticky top-0` header row
  if it has one. `ModelList` (`model-list.tsx`) does this with its `scroll` prop. Show all rows;
  do not paginate.
- **Updates feed** (newest first, more entries load when the user scrolls near the end): use
  `InfiniteFeed` from `components/infinite-feed.tsx`. The server renders the first page; an API
  route gives the next pages as `FeedPage` (`lib/feed.ts`, `FEED_PAGE` entries each). See
  `components/org/org-feed.tsx` and `app/api/org-feed/route.ts`. On a page with feeds
  and a list, the feeds share the wide space and the list takes `FEED_SIDE` (`components/page.tsx`).

## Navigation and the loading bar

The site shows a loading bar at the top of the screen when a page changes. It uses
[`nextjs-toploader`](https://github.com/TheSGJ/nextjs-toploader). `<NextTopLoader />` is in
`app/layout.tsx`.

- `<Link>` and `<a>` clicks show the bar with no extra code.
- For code navigation, import `useRouter` from `nextjs-toploader/app`, not from `next/navigation`:

  ```tsx
  import { useRouter } from 'nextjs-toploader/app';
  ```

  Only `router.push` and `router.replace` start the bar. `router.refresh` and `router.back` do
  not.

- Other hooks, such as `usePathname` and `useSearchParams`, still come from `next/navigation`.
- ESLint refuses `useRouter` from `next/navigation` (the `no-restricted-imports` rule in
  `eslint.config.mjs`).

## Breadcrumbs

Each page shows a breadcrumb bar below the navbar. The root layout's `@breadcrumbs` slot calls
`crumbsFor` in `lib/server/breadcrumbs.ts`, which builds the crumbs from the URL segments.

- When you add a page, add its case to `crumbsFor`. A page with no case shows no bar, or a bar
  with no crumb for the page itself.
- The last crumb is the current page. Give it a `label` and an `href`.
- Give a crumb a `menu` (`CrumbGroup[]`) of its sibling pages, so that users can go to a sibling
  page from the bar. Give each menu crumb an `href`: its menu then opens with an "Open" link to it.
  Pages below a model start with `modelCrumbs`, which gives the organization and model menus.
- Model documents (System Card, reports) share one `Document` menu. When you add
  a document page, add it to that menu too.

## Organization research and incidents

Incidents, departures and other organization research are in `data/seed/orgs/<slug>.json`.
`scripts/org-research.ts` reads them; `pnpm seed:import --only models,research` imports them.
Safety commitments are in `data/seed/commitments/<slug>.json` (`ADD_COMMITMENT.md`);
`pnpm seed:import --only commitments` imports them.

- To add or research incidents, follow `data/seed/org-research-prompt.md`. Edit that file to
  change the instructions.
- An incident title is a news headline that names the organization ("Titles" in the prompt):
  feeds show it with no organization name next to it.
- Each incident has `models`: the models whose behavior is the incident, by their `id` in
  `data/seed/system_cards.json`. A model with no public name gets a placeholder model there
  (`openai/unreleased-hf-hack`, `<namespace>/unknown-<short-slug>`). The incident page shows
  these names with no link (`isPlaceholderModel`).

## The site assistant

"Ask OpenAudit" (`components/ask/`, `app/api/ask/route.ts`) answers questions about the site. Its
knowledge (`lib/ask/knowledge.ts`) is made from the same sources as these pages, so keep the two
together:

- The FAQs are in `lib/faqs.ts`, the Features page's reasons in `lib/why.ts`, the Contribute page's
  ways to contribute in `lib/contribute.ts`, and the tours in `lib/why-tour.ts`. Edit the text
  there, not in the pages. If you move one of them, or add a page of help text, change its import
  in `lib/ask/knowledge.ts`.
- `lib/ask/site-guide.ts` is the assistant's site map and glossary. When you add, move or remove a
  page, or change what a page shows, update it. `lib/ask/knowledge.test.ts` fails when it names a
  path or an anchor that does not exist.
- The assistant must not read eval content (samples, transcripts, flagged-chat excerpts). A page
  whose main content is eval content goes in `NO_TEXT` (`lib/ask/pages.ts`). A component that
  shows eval content on another page gets the `data-ask-skip` attribute.
- A new kind of page goes in `pageKind` (`lib/ask/pages.ts`). A new tour goes in `ASK_TOURS`.
