/** Inter for `next/og` images, from Google Fonts. Satori reads TTF, not the site's woff2. With no
 * fonts (no network), `ImageResponse` uses its own font. */
type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: 'normal' };

const WEIGHTS = [400, 600, 700] as const;
let loaded: OgFont[] | null = null;

async function inter(weight: (typeof WEIGHTS)[number]): Promise<OgFont> {
  // With no browser user agent, Google gives a TTF file.
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error(`No TTF for Inter ${weight}.`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Inter ${weight}: HTTP ${res.status}`);
  return { name: 'Inter', data: await res.arrayBuffer(), weight, style: 'normal' };
}

/** The fonts. Keeps only loaded fonts: a Worker request must not wait on another request's I/O. A
 * failed load is tried again on the next image. */
export async function ogFonts(): Promise<OgFont[]> {
  if (loaded) return loaded;
  try {
    return (loaded = await Promise.all(WEIGHTS.map(inter)));
  } catch (e) {
    console.error('[og] no Inter font', e);
    return [];
  }
}
