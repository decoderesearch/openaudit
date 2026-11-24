import SiteImage from '@/app/opengraph-image';
import { categoryLabel } from '@/components/catalog/parts';
import { ogFonts } from '@/lib/og/fonts';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgEntity, OgMeter, OgWarning } from '@/lib/og/parts';
import { modelPath } from '@/lib/server/catalog';
import { modelOg } from '@/lib/server/og';
import { ImageResponse } from 'next/og';

export const alt = 'A model on OpenAudit: its Deploymeter, evals, flagged chats and safety incidents';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const [og, fonts] = await Promise.all([modelOg(owner, repo), ogFonts()]);
  if (!og) return SiteImage();
  const { model, organization, flagged } = og;
  const top = flagged.categories.slice(0, 3).map(([c, n]) => `${categoryLabel(c)} ${n}`);
  return new ImageResponse(
    <OgEntity
      eyebrow={`Model · ${organization.displayName}`}
      title={model.displayName}
      path={modelPath(model)}
      lines={[
        model.name,
        ...(og.tooOld ? [<OgWarning key="old" text="Inaccurate Results Due to Outdated Evaluations" />] : []),
      ]}
      art={og.meter == null ? undefined : <OgMeter score={og.meter} judges={og.judges} width={260} />}
      note={top.length ? `Most flagged: ${top.join(' · ')}` : undefined}
      stats={[
        { value: og.openAudit, label: 'OpenAudit Evals', tone: 'sky' },
        { value: og.systemCard, label: 'System Card Evals', tone: 'slate' },
        { value: flagged.high + flagged.medium, label: 'Flagged Chats', tone: 'amber' },
        { value: og.incidentCount, label: 'Safety Incidents', tone: 'amber' },
      ]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
