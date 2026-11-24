import type { NextConfig } from 'next';

// `next dev` serves its dev assets only to localhost and these hosts. To use the dev server
// from another host (for example over Tailscale), set NEXT_PUBLIC_URL to that URL.
const publicUrl = process.env.NEXT_PUBLIC_URL;
const devHosts = publicUrl && URL.canParse(publicUrl) ? [new URL(publicUrl).hostname] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: devHosts,
  // The Playwright server uses its own folder, so it runs beside `pnpm dev`. OpenNext reads `.next`.
  distDir: (!process.env.CF_WORKERS_BUILD && process.env.NEXT_DIST_DIR) || '.next',
  reactStrictMode: true,
  agentRules: false,
  async redirects() {
    return [
      // Extracted system card text links evals as `/evals/<slug>`.
      { source: '/evals', destination: '/models', permanent: true },
      { source: '/evals/:path*', destination: '/evaluations/:path*', permanent: true },
    ];
  },
  // The generated spec types ship as TypeScript source.
  transpilePackages: ['@openaudit/spec'],
  // Tracing follows Node's export conditions and copies only `pg-cloudflare`'s empty stub; the
  // Workers build needs its real socket code.
  outputFileTracingIncludes: {
    '/*': ['../../node_modules/.pnpm/pg@*/node_modules/pg-cloudflare/**'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // `pnpm cf:build` sets CF_WORKERS_BUILD: use the Prisma client made for Workers, and keep
  // React email rendering (unused) out of the Worker bundle.
  ...(process.env.CF_WORKERS_BUILD && {
    turbopack: {
      resolveAlias: {
        '#prisma': './lib/generated/prisma-workers/client.ts',
        '@react-email/render': './lib/email/no-react-render.ts',
      },
    },
  }),
};

export default nextConfig;
