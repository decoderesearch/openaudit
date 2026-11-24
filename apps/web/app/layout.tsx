import { AskLauncher } from '@/components/ask/ask-launcher';
import { FirstVisitNotice } from '@/components/first-visit-notice';
import { TutorialPickerHost } from '@/components/hero-buttons';
import { MyEvalsProvider } from '@/components/my-evals/my-evals';
import Navbar from '@/components/nav/navbar';
import { ReportKeyProvider } from '@/components/nav/report-dialog';
import { PdfViewerProvider } from '@/components/pdf-viewer';
import { SiteFooter } from '@/components/site-footer';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ASK_ENABLED,
  NEXT_PUBLIC_URL,
  SITE_NAME,
  SITE_TAGLINE,
  TURNSTILE_ENABLED,
  TURNSTILE_SITE_KEY,
} from '@/lib/env';
import { runMode } from '@/lib/server/run-mode';
import { getViewer } from '@/lib/server/viewer';
import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from 'sonner';
import { inter } from './fonts';
import './globals.css';
// The side panel's server action returns client components. React finds a client component only
// in the client manifest of the page, so each page must import them.
import './runs/panel';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

const DESCRIPTION = 'Independent evaluations of AI models, organizations, and safety methods.';

export const metadata: Metadata = {
  title: { template: `%s | ${SITE_NAME}`, default: `${SITE_NAME}: ${SITE_TAGLINE}` },
  description: DESCRIPTION,
  metadataBase: new URL(NEXT_PUBLIC_URL),
  openGraph: { siteName: SITE_NAME, locale: 'en_US', type: 'website', title: SITE_NAME, description: DESCRIPTION },
  twitter: { card: 'summary_large_image' },
};

export default async function RootLayout({
  children,
  breadcrumbs,
}: {
  children: React.ReactNode;
  breadcrumbs: React.ReactNode;
}) {
  const viewer = await getViewer();
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col overscroll-none font-sans antialiased has-[[data-fit-page=all]]:h-dvh lg:has-[[data-fit-page=lg]]:h-dvh">
        <NextTopLoader color="#0369a1" height={4} showSpinner={false} shadow={false} />
        <TooltipProvider>
          <ReportKeyProvider siteKey={TURNSTILE_ENABLED ? TURNSTILE_SITE_KEY : null}>
            <PdfViewerProvider>
              <MyEvalsProvider enabled={!!viewer && !!runMode(viewer)}>
                <Toaster richColors position="bottom-center" mobileOffset={{ bottom: 88 }} />
                <Navbar viewer={viewer} />
                <main className="flex w-full flex-1 flex-col items-center pt-[calc(3rem+env(safe-area-inset-top))] has-[[data-fit-page=all]]:min-h-0 lg:has-[[data-fit-page=lg]]:min-h-0">
                  {breadcrumbs}
                  {children}
                </main>
                <SiteFooter />
                {ASK_ENABLED && <AskLauncher />}
                <TutorialPickerHost />
                <FirstVisitNotice />
              </MyEvalsProvider>
            </PdfViewerProvider>
          </ReportKeyProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
