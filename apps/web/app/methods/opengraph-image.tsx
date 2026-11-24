import SiteImage from '@/app/opengraph-image';
import { ogFonts } from '@/lib/og/fonts';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgEntity } from '@/lib/og/parts';
import { methodsOg } from '@/lib/server/og';
import { ImageResponse } from 'next/og';

export const alt = 'Safety methods on OpenAudit: how many methods, variants and method evaluations';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-dynamic';

export default async function Image() {
  const [og, fonts] = await Promise.all([methodsOg().catch(() => null), ogFonts()]);
  if (!og) return SiteImage();
  return new ImageResponse(
    <OgEntity
      eyebrow="Methods"
      title="Safety Methods"
      path="/methods"
      lines={['How well interpretability and monitoring tools (SAEs, probes, LLM monitors) do their safety jobs.']}
      stats={[
        { value: og.methods, label: 'Methods', tone: 'sky' },
        { value: og.variants, label: 'Variants', tone: 'slate' },
        { value: og.evals, label: 'Method Evaluations', tone: 'sky' },
      ]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
