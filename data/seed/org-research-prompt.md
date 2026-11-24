# Organization research for OpenAudit org pages

You research AI organizations (labs and companies that release models) and write one JSON file
per organization. The site shows this on each organization's page. The content is public and
about real people and companies, so accuracy and careful wording matter more than volume.

Output: `data/seed/orgs/<slug>.json`, one file per organization, in the
format below. `<slug>` is the organization's current slug (the list that the coordinator gives
you). Write only your own organizations' files. Do not
edit any other file in the repo. Do not commit; the coordinator commits.

## Rules

- **What the site shows.** For an incident: its title, date, severity, status, the first 2 lines
  of its summary, its models, and "Update" lines from its timeline titles. A click opens our
  incident page: the title, `description`, the categories, a short timeline and the sources. Put
  the most care into these fields. After you write the file, the coordinator writes
  `description` and the log excerpts (`ADD_INCIDENT.md`).
- **Sources to check on each run.** For OpenAI, read each post on its misalignment reports
  (https://alignment.openai.com/misalignment-reports/). `node data/scripts/check-incident-sources.mjs`
  lists the posts that the files do not cite yet. Each post that is in scope is an incident.
- **No duplicates.** Before you add an incident, read all the incidents in the file, also the
  ones dated after `researchedAt`. If one tells the same story, add a timeline event to it, or
  add nothing. Never add a second incident for the same event. An event goes in one
  organization's file only: the organization whose model or systems did the act.
  `python3 data/scripts/check-incident-duplicates.py` lists possible duplicates in all files.
- **Titles.** Write each incident title as a short news headline that makes sense with no other
  text near it: name the organization that is responsible or involved, and the product or model
  when it matters ("xAI's Grok Posted Antisemitic Content and Called Itself “MechaHitler”",
  "Hackers Used Meta's AI Support Assistant to Take Over Instagram Accounts", "OpenAI Dissolves
  Superalignment Team"). Feeds and lists show titles with no organization name next to them.
  Title Case, about 15 words or fewer, no period at the end. Claims stay claims ("Reportedly",
  "Allegedly", "Lawsuit Alleges"). A timeline title shows under its incident's title, so it does
  not need the organization's name.
- **Sources.** Every fact needs at least one source URL that you opened and read. Prefer
  reputable, non-partisan outlets: Reuters, AP, Bloomberg, FT, WSJ, NYT, The Verge, Wired, Ars
  Technica, The Information, TechCrunch, official company posts, court filings, government
  sites, and the person's own posts. Do not use tabloids, content farms, partisan or personal
  blogs, trackers or aggregators; if only these show a fact, leave it out. Do not
  invent or guess URLs. Check that each URL loads (WebFetch). If a page is paywalled but the
  headline and date show, it can stay.
- **Wording that protects us from libel.** Report claims as claims: "reportedly", "according to
  [source]", "was accused of", "alleged", "said". Never state an allegation as fact. Facts that
  the company confirmed or a court found can be stated plainly, with the source. No opinions,
  no adjectives such as "shocking" or "reckless". Neutral and short.
- **Markdown.** `summary`, `description`, `reason`, `nextRole` and timeline `description`
  fields are Markdown. Link sources inline:
  `[Reuters reported](https://...) that ...`.
- **Summary (the bio).** 1 or 2 short sentences, at most about 60 words: what the organization
  is, where it is, who founded it and when, and what it makes in general terms (for example
  "the Grok models"). Leave out what the page shows elsewhere: funding, valuations and
  investors, model versions and release dates, and safety policies. Put the source link on
  the word or short phrase that the source supports (`founded in 2023 by [Elon Musk](https://...)`),
  not as `([Source](https://...))` or "according to [Source]". At most one link per sentence.
- **Dates.** ISO `YYYY-MM-DD`, or `YYYY-MM` or `YYYY` when the day or month is not known; set
  `datePrecision` to `day`, `month` or `year`.
- **Only new events.** If the organization's file has a `researchedAt` date, look only for
  incidents, timeline events and departures dated after that day. Keep the existing entries as
  they are. Set `researchedAt` to today.
- **Incident dates.** Only incidents whose first event is in 2023 or later. The date of a later
  report or discovery does not count.
- **Scope of an incident.** A significant AI safety or security event that involves the
  organization or its models: security breaches, model misbehavior that caused harm or wide
  concern, misuse of a model, safety-team dissolutions, broken safety commitments, leaked or
  disputed safety testing, lawsuits that allege harm from a model (for example wrongful-death
  suits), whistleblower disclosures about safety. Each incident needs at least one of these
  categories: `security`, `misuse`, `model_behavior`, `deception`, `safety_process`,
  `child_safety`, `mental_health`. The import refuses an incident without one.
  Not:
  - copyright, scraping, likeness or trademark disputes;
  - labor and pay disputes;
  - privacy-regulator actions and disputes about training on user data (a data breach is a
    `security` incident and is in scope);
  - political censorship and bias findings;
  - sanctions, entity lists, competition-authority probes, and government action against a
    company because it kept its safety limits;
  - corporate governance: restructuring, lawsuits between founders, lobbying, subpoenas;
  - ordinary product bugs, business news, stock moves, benchmark disputes, and disputes
    between companies about distillation, API terms or training data.
- **Self-disclosed incidents.** Read the organization's own safety documents: system and model
  cards, risk reports, safety-framework reports, threat reports, and incident posts. Read their
  sections on incidents, safety failures, misaligned behavior and monitoring gaps. An incident
  that the organization disclosed is in scope even if no outlet reported it. Examples: an agent
  that took destructive or unauthorized actions in real use (internal use counts), a safeguard
  that was off or broken, and a training or testing error that the organization says weakened
  safety. Not: behavior only in a designed test with no real effect, unless it drew wide
  concern. Cite the document and its section. Group small failures from one document into one
  incident. Incident pages to read: OpenAI's misalignment reports
  (https://alignment.openai.com/misalignment-reports/). `node data/scripts/check-incident-sources.mjs`
  lists their posts that the files do not cite yet.
- **Models.** Each incident lists in `models` the models whose behavior is the incident: the
  model that did the unsafe act, that people misused or jailbroke, or whose weights leaked or
  safeguard failed. The model can be of any developer. Use `[]` when no model's behavior is part
  of it (a breach of company systems, a governance dispute). A name is a model's `id` in
  `data/seed/system_cards.json` (`openai/gpt-4o`). Name a model only when a source names it.
  If the model has no public name, or the sources do not name it, add a placeholder model:
  `<namespace>/unreleased-<short-slug>` (internal or not released) or
  `<namespace>/unknown-<short-slug>` (not named), for example `openai/unreleased-hf-hack`.
  `<namespace>` is the one the developer's API models use in that file; `<short-slug>` names
  the incident in 1 to 3 words. Add each new model (placeholder or a public model not in the
  file) to `models` in `data/seed/system_cards.json`, in the format below. If other agents run
  at the same time, do not edit that file: list the new models in your final message. The
  import refuses a name that is not in the file.
- **Severity.** `red` is a very high bar, for the worst cases only: someone died, or many people
  were severely harmed, in credible reports or lawsuits; `orange`: a regulator or court action,
  a serious security breach, or credible reports of significant safety failures or a broken
  safety commitment, with no death or severe harm to many people; `yellow`: concerning but
  limited (few people affected, or no effect outside a test) or disputed. A quick fix does not
  lower the severity.
- **Departures.** Only people who left in 2023 or later. Include a person only if (a) they led
  or worked in safety or alignment (for example a head of alignment, a safety researcher, a
  trustee of a safety-oversight body), or (b) they spoke about AI safety concerns at the
  organization at or near the time they left. Not: ethics, copyright or personal reasons, or
  a person who said the departure was not about safety. `kind` is `resigned`, `fired`,
  `laid_off`, or `unclear`. A quote must be the person's own words, copied exactly from the
  source, with its URL. If no quote exists, set `quote` to null.
- **Photos.** Only freely licensed images from Wikimedia Commons. Give the direct
  `upload.wikimedia.org` image URL, the Commons file page, the license (for example
  `CC BY-SA 4.0`), and the author as Commons states it. If there is no Commons image, set
  `image` to null. Never use other photos.
- **Depth.** For a "deep" organization: search widely (many searches, news archives, Wikipedia
  for leads, the organization's own safety documents, then the primary sources). For a "light" organization: a few searches; many will
  have no incidents and no departures, and that is fine (empty arrays). Never pad.
- **Timeline.** Only later events that a reader would want as an "Update" line, in order: for
  example the company's statement, a lawsuit, a regulator action, a fix. Not the first event:
  the incident's own `date` shows it. Each event has its own source, and the newest source is
  the story that a click opens, so prefer readable news stories and primary posts.

## Format

```json
{
  "slug": "openai",
  "name": "OpenAI",
  "website": "https://openai.com",
  "aliases": ["openai", "openai-community"],
  "summary": "Markdown, 1-2 short sentences: see the Summary rule.",
  "researchDepth": "deep",
  "researchedAt": "2026-10-02",
  "incidents": [
    {
      "slug": "2023-internal-forum-breach",
      "title": "OpenAI Did Not Publicly Disclose a Hacker's Internal Forum Breach",
      "date": "2023-04",
      "datePrecision": "month",
      "endDate": null,
      "severity": "orange",
      "status": "resolved",
      "primaryCategory": "systems_breached",
      "categories": ["security"],
      "models": [],
      "summary": "Markdown, 1-2 sentences, careful wording, inline source links.",
      "description": "Markdown, 2-3 short sentences for the incident page; ADD_INCIDENT.md rewrites it.",
      "timeline": [
        {
          "date": "2024-07-04",
          "datePrecision": "day",
          "title": "The New York Times reports the breach",
          "description": "Markdown, one sentence.",
          "sources": ["https://..."]
        }
      ],
      "sources": [
        { "title": "Headline", "url": "https://...", "publisher": "The New York Times", "date": "2024-07-04" }
      ]
    }
  ],
  "departures": [
    {
      "name": "Jan Leike",
      "title": "Co-lead, Superalignment",
      "departedDate": "2024-05-17",
      "datePrecision": "day",
      "kind": "resigned",
      "reason": "Markdown, 1-2 sentences, careful wording, inline source links.",
      "quote": { "text": "Exact words.", "url": "https://..." },
      "image": {
        "url": "https://upload.wikimedia.org/...",
        "pageUrl": "https://commons.wikimedia.org/wiki/File:...",
        "license": "CC BY-SA 4.0",
        "author": "As Commons states it"
      },
      "website": "https://... or null",
      "nextRole": "Markdown or null, for example 'Joined [Anthropic](https://...)'.",
      "sources": [{ "title": "...", "url": "https://...", "publisher": "...", "date": "2024-05-17" }]
    }
  ]
}
```

`status`: `ongoing`, `resolved`, `disputed`, `under_investigation`, or `in_litigation`. The site
shows no label for `resolved`: the word reads as if the harm was undone. Use `resolved` only to
say that the event ended.
`primaryCategory` (one): what went wrong. The feeds show it.
- `model_hacking`: a model broke into systems, took credentials or got out of its limits by itself.
- `model_deception`: a model lied, schemed or hid what it did.
- `model_misbehavior`: a model did other harmful things that nobody asked for.
- `suicide_and_delusion`: chats linked to suicide, self-harm or delusions.
- `sexual_content_with_minors`: sexual chats with minors, or child abuse images.
- `nonconsensual_images`: sexual or fake images of real people.
- `false_or_hateful_claims`: the model stated false information or hate.
- `used_by_attackers`: criminals or state actors used the model for attacks, targeting,
  influence operations or violence.
- `safeguards_failed`: the model gave dangerous help, or its safeguards were weak or off.
- `systems_breached`: attackers got into the organization's systems or accounts.
- `data_exposed`: the organization leaked user data, keys, code or weights.
- `prompt_injection`: a product flaw lets outside content control an agent.
- `privacy_violation`: the organization collected, used or uploaded data without clear consent.
- `safety_related_cut`: the organization dropped safety commitments, testing, reports, teams or
  staff.

For a lawsuit or a regulator's action, use the harm under it (a wrongful-death suit is
`suicide_and_delusion`).
`categories` (one or more, as tags): `security`, `privacy`, `misuse`, `model_behavior`, `deception`,
`safety_process`, `governance`, `legal`, `child_safety`, `mental_health`, `misinformation`,
`bias`, `copyright`, `labor`, `other`.

A new model in `data/seed/system_cards.json`. A placeholder's `displayName` is
`<Developer> - Unreleased Model (<what>)` or `<Developer> - Unknown Model (<what>)`, with the
product in `<what>` (`Amazon - Unknown Model (Alexa penny challenge)`). A public model also has `"releaseDate":
"YYYY-MM-DD"`, and `"source": "hf"` with its Hugging Face repo as `id` if it has open weights.

```json
{
  "id": "openai/unreleased-hf-hack",
  "source": "api",
  "displayName": "OpenAI - Unreleased Model (Hugging Face hack)",
  "organizationId": "openai",
  "whyMajor": "One short sentence: the incident it is in.",
  "documents": [],
  "checkpoints": [],
  "apiIds": []
}
```

`aliases`: the model-owner names (the part before the slash in model names, for example `Qwen`
and `qwen` for Alibaba) from `orgs.txt` (the `OWNERS` line), plus other names people use.

Before you finish, check your JSON parses (`python3 -m json.tool <file>`), each URL loaded, and
each quote is exact. In your final message, list the files, the new incidents and departures
per organization, and anything you were unsure about.
